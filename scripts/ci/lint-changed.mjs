/**
 * Lint-fix and type-check the working tree: staged, unstaged, and untracked files.
 * Exits non-zero when ESLint, Prettier, i18n validation, or an affected project's
 * type-check fails.
 *
 * Type-check runs the package `type-check` script for each package that owns a
 * changed TypeScript file (or its package.json / tsconfig). It does not type-check
 * dependents. `npm run lint` remains the full CI check.
 *
 * Usage: node scripts/ci/lint-changed.mjs
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const ESLINT_EXTENSIONS = new Set(['.cjs', '.cts', '.jsx', '.mjs', '.mts', '.ts', '.tsx']);

const I18N_COMPILE_DIRS = new Set(['apps/management-web', 'apps/mobile', 'apps/web']);

const CHUNK_SIZE = 80;

const toPosix = (filePath) => filePath.split(path.sep).join('/');

const gitLines = (args) => {
  const result = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
  if (result.error) {
    console.error(`git failed: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    const detail = (result.stderr || '').trim();
    console.error(detail || 'git failed');
    process.exit(1);
  }
  return result.stdout.split('\0').filter((line) => line.length > 0);
};

const collectChangedFiles = () => {
  const files = new Set([
    ...gitLines(['diff', '--name-only', '-z', '--diff-filter=ACMR']),
    ...gitLines(['diff', '--name-only', '-z', '--cached', '--diff-filter=ACMR']),
    ...gitLines(['ls-files', '-z', '--others', '--exclude-standard']),
  ]);
  return [...files].map(toPosix).sort();
};

// Generated media fixtures; MPEG-TS HLS segments share the `.ts` extension with TypeScript.
const isTestAsset = (rel) => rel.startsWith('tools/test-assets/assets/');

const isExistingFile = (rel) => {
  const absolute = path.join(repoRoot, rel);
  if (!fs.existsSync(absolute)) {
    return false;
  }
  return fs.statSync(absolute).isFile();
};

const eslintIgnored = (rel) => {
  if (rel.endsWith('.d.ts') || rel.endsWith('.js') || rel.endsWith('.md') || rel.endsWith('.mdc')) {
    return true;
  }
  if (!ESLINT_EXTENSIONS.has(path.posix.extname(rel))) {
    return true;
  }
  const segments = rel.split('/');
  return (
    segments.includes('node_modules') ||
    segments.includes('dist') ||
    segments.includes('.next') ||
    rel.startsWith('.llm/plans/') ||
    rel.includes('/.llm/plans/')
  );
};

const triggersTypecheck = (rel) => {
  const base = path.posix.basename(rel);
  if (base === 'package.json') {
    return true;
  }
  if (base.startsWith('tsconfig') && base.endsWith('.json')) {
    return true;
  }
  const ext = path.posix.extname(base);
  return ext === '.ts' || ext === '.tsx' || ext === '.mts' || ext === '.cts';
};

const owningPackageDir = (rel) => {
  let dir = path.posix.dirname(rel);
  while (dir !== '.' && dir !== '') {
    if (fs.existsSync(path.join(repoRoot, dir, 'package.json'))) {
      return dir;
    }
    const parent = path.posix.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return null;
};

const readPackage = (dir) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(repoRoot, dir, 'package.json'), 'utf8'));
  } catch {
    return null;
  }
};

const typecheckRank = (dir) => {
  if (dir.startsWith('packages/')) {
    return 0;
  }
  if (dir.startsWith('extensions/')) {
    return 1;
  }
  if (dir.startsWith('tools/')) {
    return 2;
  }
  return 3;
};

const chunks = (items) => {
  const groups = [];
  for (let index = 0; index < items.length; index += CHUNK_SIZE) {
    groups.push(items.slice(index, index + CHUNK_SIZE));
  }
  return groups;
};

const run = (command, args) => {
  console.log(`\n> ${[command, ...args].join(' ')}`);
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: 'inherit' });
  if (result.error) {
    console.error(result.error.message);
    return false;
  }
  return result.status === 0;
};

const bin = (name) => path.join(repoRoot, 'node_modules', '.bin', name);

const changed = collectChangedFiles().filter((rel) => isExistingFile(rel) && !isTestAsset(rel));

if (changed.length === 0) {
  console.log('No staged, unstaged, or untracked files.');
  process.exit(0);
}

const eslintFiles = changed.filter((rel) => !eslintIgnored(rel));
const catalogChanged = changed.some((rel) => rel.startsWith('packages/i18n-catalog/'));

const typecheckProjects = [];
const seenProjects = new Set();
for (const rel of changed) {
  if (!triggersTypecheck(rel)) {
    continue;
  }
  const dir = owningPackageDir(rel);
  if (dir === null || seenProjects.has(dir)) {
    continue;
  }
  seenProjects.add(dir);
  const pkg = readPackage(dir);
  const script = pkg?.scripts?.['type-check'];
  const name = pkg?.name;
  if (
    typeof script !== 'string' ||
    script.length === 0 ||
    typeof name !== 'string' ||
    name.length === 0
  ) {
    continue;
  }
  typecheckProjects.push({ dir, name });
}
typecheckProjects.sort(
  (a, b) => typecheckRank(a.dir) - typecheckRank(b.dir) || a.dir.localeCompare(b.dir)
);

let prettierFiles = [];
if (changed.length > 0) {
  let prettier;
  try {
    prettier = require('prettier');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`prettier is not installed (${message}). Run npm install from the repo root.`);
    process.exit(1);
  }
  const ignorePath = path.join(repoRoot, '.prettierignore');
  const infos = await Promise.all(
    changed.map(async (rel) => {
      try {
        const info = await prettier.getFileInfo(path.join(repoRoot, rel), {
          ignorePath,
          resolveConfig: false,
        });
        return { rel, info };
      } catch {
        return { rel, info: { ignored: true, inferredParser: null } };
      }
    })
  );
  prettierFiles = infos
    .filter(({ info }) => info.ignored !== true && info.inferredParser !== null)
    .map(({ rel }) => rel);
}

console.log(
  `lint:changed — ${changed.length} changed file(s); eslint ${eslintFiles.length}, prettier ${prettierFiles.length}, type-check ${typecheckProjects.length}`
);

let ok = true;

if (eslintFiles.length > 0) {
  const eslintBin = bin('eslint');
  if (!fs.existsSync(eslintBin)) {
    console.error('eslint is not installed. Run npm install from the repo root.');
    ok = false;
  } else {
    for (const group of chunks(eslintFiles)) {
      const passed = run(eslintBin, [
        '--fix',
        '--max-warnings',
        '0',
        '--no-warn-ignored',
        ...group,
      ]);
      ok &&= passed;
    }
  }
}

if (prettierFiles.length > 0) {
  const prettierBin = bin('prettier');
  if (!fs.existsSync(prettierBin)) {
    console.error('prettier is not installed. Run npm install from the repo root.');
    ok = false;
  } else {
    for (const group of chunks(prettierFiles)) {
      const passed = run(prettierBin, [
        '--write',
        '--ignore-unknown',
        '--log-level',
        'warn',
        ...group,
      ]);
      ok &&= passed;
    }
  }
}

if (catalogChanged) {
  ok &&= run('npm', ['run', 'i18n:validate']);
}

const needsI18nCompile = typecheckProjects.some((project) => I18N_COMPILE_DIRS.has(project.dir));
let i18nCompiled = true;
if (needsI18nCompile) {
  i18nCompiled = run('npm', ['run', 'i18n:compile']);
  ok &&= i18nCompiled;
}

for (const project of typecheckProjects) {
  if (!i18nCompiled && I18N_COMPILE_DIRS.has(project.dir)) {
    console.error(`\nSkipping type-check ${project.dir}: i18n:compile failed.`);
    continue;
  }
  if (project.dir === 'apps/mobile') {
    ok &&= run('npm', ['run', 'type-check:mobile']);
    continue;
  }
  // Path filters are prefixes: `-w apps/web` also selects `apps/web/sidecar`.
  ok &&= run('npm', ['run', 'type-check', '-w', project.name]);
}

console.log(`\n--- lint:changed: ${ok ? 'passed' : 'failed'} ---`);
if (eslintFiles.length > 0 || prettierFiles.length > 0) {
  console.log('If ESLint or Prettier rewrote files, review the diff and stage those edits.');
}

process.exit(ok ? 0 : 1);
