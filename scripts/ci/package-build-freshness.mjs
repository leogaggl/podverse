/**
 * Reports which `build:packages` packages have a build older than their source.
 * Composite and incremental projects use `tsc --build --dry` (content hashes in
 * tsbuildinfo). Other projects compare the newest file time under `src/` with
 * `dist/`.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const SKIPPED_DIR_NAMES = new Set(['node_modules', '__tests__', '__mocks__', '__fixtures__']);

const SKIPPED_SOURCE_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;

const PACKAGE_BUILD_DRY_WARNING =
  'Could not check package builds with tsc --build --dry; type-check runs anyway.';

const DIST_MISSING_REASON = 'dist/ is missing';

const DIST_OLDER_REASON = 'dist/ is older than src/';

const TSC_DRY_STALE_REASON = 'tsc --build --dry reports the build is out of date';

/**
 * Workspace directories named by the root `build:packages` script, in script order.
 * Tokens after `--workspaces`, stopping at the next `--` flag. Empty when the
 * script or the flag is missing.
 */
export function readBuildPackageDirs(rootPackageJson) {
  const script = rootPackageJson?.scripts?.['build:packages'];
  if (typeof script !== 'string') {
    return [];
  }
  const tokens = script.split(/\s+/).filter((token) => token.length > 0);
  const flagIndex = tokens.indexOf('--workspaces');
  if (flagIndex === -1) {
    return [];
  }
  const dirs = [];
  for (let index = flagIndex + 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.startsWith('--')) {
      break;
    }
    dirs.push(token);
  }
  return dirs;
}

/**
 * Tsconfig path from the first `tsc -p <file>` or `tsc --project <file>` in the
 * package `build` script. `tsconfig.json` when the script does not pass one.
 */
export function readBuildTsconfigFile(packageJson) {
  const script = packageJson?.scripts?.build;
  if (typeof script !== 'string') {
    return 'tsconfig.json';
  }
  const match = script.match(/\btsc\s+(?:-p|--project)\s+(\S+)/);
  if (!match) {
    return 'tsconfig.json';
  }
  return match[1];
}

/**
 * True when this tsconfig text sets `composite` or `incremental` to true.
 * `extends` is not followed; the flag has to be in the build tsconfig itself.
 */
export function usesBuildInfo(tsconfigText) {
  return /"(composite|incremental)"\s*:\s*true/.test(tsconfigText);
}

/**
 * Absolute project paths `tsc --build --dry` would build. Lines that would only
 * update output timestamps are not out of date.
 */
export function parseTscBuildDryOutput(output) {
  const projects = new Set();
  const pattern = /A non-dry build would build project '([^']+)'/g;
  for (const match of output.matchAll(pattern)) {
    projects.add(match[1]);
  }
  return projects;
}

/**
 * Newest file mtime in milliseconds under `dir`, or null when `dir` is missing
 * or holds no counted file. Skips `node_modules`, `__tests__`, `__mocks__`,
 * `__fixtures__`, and `*.test` / `*.spec` source files.
 */
export function newestMtimeMs(dir) {
  let dirStat;
  try {
    dirStat = fs.statSync(dir);
  } catch {
    return null;
  }
  if (!dirStat.isDirectory()) {
    return null;
  }

  let newest = null;
  const walk = (current) => {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (SKIPPED_DIR_NAMES.has(entry.name)) {
          continue;
        }
        walk(path.join(current, entry.name));
        continue;
      }
      if (!entry.isFile() || SKIPPED_SOURCE_FILE.test(entry.name)) {
        continue;
      }
      let fileStat;
      try {
        fileStat = fs.statSync(path.join(current, entry.name));
      } catch {
        continue;
      }
      if (newest === null || fileStat.mtimeMs > newest) {
        newest = fileStat.mtimeMs;
      }
    }
  };

  walk(dir);
  return newest;
}

/**
 * True when `dist/` has no counted file, or when `src/` has a counted file newer
 * than the newest counted file in `dist/`.
 */
export function isDistOlderThanSource({ distNewestMs, srcNewestMs }) {
  if (distNewestMs === null) {
    return true;
  }
  return srcNewestMs !== null && srcNewestMs > distNewestMs;
}

const readPackageJson = (packageJsonPath) => {
  try {
    return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  } catch {
    return null;
  }
};

/**
 * Out-of-date `build:packages` packages, in script order.
 * `warning` is set when `tsc --build --dry` cannot decide; those projects are
 * left out of `stale`. Timestamp results already collected stay in `stale`.
 * Skip type-check only when `warning` is null and `stale` is non-empty.
 * `name` is the package `name`. `reason` says why that package is out of date.
 */
export function findStalePackageBuilds({ repoRoot }) {
  const rootPackageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const packageDirs = readBuildPackageDirs(rootPackageJson);
  const ordered = [];
  const dryPaths = [];

  for (const dir of packageDirs) {
    const packageJson = readPackageJson(path.join(repoRoot, dir, 'package.json'));
    if (packageJson === null) {
      continue;
    }
    const buildScript = packageJson.scripts?.build;
    if (typeof buildScript !== 'string' || buildScript.length === 0) {
      continue;
    }
    const tsconfigPath = path.resolve(repoRoot, dir, readBuildTsconfigFile(packageJson));
    let tsconfigText;
    try {
      tsconfigText = fs.readFileSync(tsconfigPath, 'utf8');
    } catch {
      continue;
    }
    const name =
      typeof packageJson.name === 'string' && packageJson.name.length > 0 ? packageJson.name : dir;
    if (usesBuildInfo(tsconfigText)) {
      dryPaths.push(tsconfigPath);
      ordered.push({ dir, kind: 'dry', name, tsconfigPath });
      continue;
    }
    const srcNewestMs = newestMtimeMs(path.join(repoRoot, dir, 'src'));
    const distNewestMs = newestMtimeMs(path.join(repoRoot, dir, 'dist'));
    if (!isDistOlderThanSource({ distNewestMs, srcNewestMs })) {
      continue;
    }
    ordered.push({
      dir,
      kind: 'mtime',
      name,
      reason: distNewestMs === null ? DIST_MISSING_REASON : DIST_OLDER_REASON,
    });
  }

  let warning = null;
  const reportedBuilds = new Set();
  if (dryPaths.length > 0) {
    try {
      const require = createRequire(path.join(repoRoot, 'package.json'));
      const tscBin = require.resolve('typescript/bin/tsc');
      const result = spawnSync(
        process.execPath,
        [tscBin, '--build', '--dry', '--verbose', ...dryPaths],
        {
          cwd: repoRoot,
          encoding: 'utf8',
          maxBuffer: 16 * 1024 * 1024,
        }
      );
      const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
      if (result.error || result.status !== 0 || /error TS\d+/.test(output)) {
        warning = PACKAGE_BUILD_DRY_WARNING;
      } else {
        for (const projectPath of parseTscBuildDryOutput(output)) {
          reportedBuilds.add(path.resolve(projectPath));
        }
      }
    } catch {
      warning = PACKAGE_BUILD_DRY_WARNING;
    }
  }

  const stale = [];
  for (const entry of ordered) {
    if (entry.kind === 'mtime') {
      stale.push({ dir: entry.dir, name: entry.name, reason: entry.reason });
      continue;
    }
    if (warning !== null) {
      continue;
    }
    if (reportedBuilds.has(path.resolve(entry.tsconfigPath))) {
      stale.push({ dir: entry.dir, name: entry.name, reason: TSC_DRY_STALE_REASON });
    }
  }

  return { stale, warning };
}
