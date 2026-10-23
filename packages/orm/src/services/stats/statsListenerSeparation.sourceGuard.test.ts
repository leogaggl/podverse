import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url));

const APP_ROOTS = [
  'apps/api/src',
  'apps/workers/src',
  'apps/management-api/src',
  'apps/web/src',
  'apps/web/sidecar/src',
  'apps/management-web/src',
  'apps/management-web/sidecar/src',
  'apps/mobile/src',
];

const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', '.next', 'test', '__tests__', 'e2e']);

const SKIPPED_FILE_SUFFIXES = ['.test.ts', '.test.tsx', '.spec.ts', '.d.ts'];

const SOURCE_FILE_SUFFIXES = ['.ts', '.tsx', '.mts'];

const FORBIDDEN_TEXT = [/\bstats_listener\b/, /\bStatsListener(?:Service)?\b/];

const ALLOWED_PREFIXES = [
  'packages/orm/src/services/stats/listenerIdentity/',
  'packages/orm/src/entities/stats/statsListener.ts',
  'packages/orm/src/db/entities.ts',
];

const REACH_ROOTS = [
  'apps/workers/src',
  'apps/management-api/src',
  'packages/orm/src/services/stats',
];

function repoRelative(absPath: string): string {
  return relative(repoRoot, absPath).split('\\').join('/');
}

function isSourceFile(name: string): boolean {
  if (SKIPPED_FILE_SUFFIXES.some((suffix) => name.endsWith(suffix))) {
    return false;
  }
  return SOURCE_FILE_SUFFIXES.some((suffix) => name.endsWith(suffix));
}

function isAllowed(relPath: string): boolean {
  return ALLOWED_PREFIXES.some((prefix) => relPath.startsWith(prefix));
}

function isUnder(relPath: string, root: string): boolean {
  return relPath === root || relPath.startsWith(`${root}/`);
}

function walk(absDir: string, found: string[]): void {
  const entries = readdirSync(absDir, { withFileTypes: true });
  for (const entry of entries) {
    const absPath = join(absDir, entry.name);
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) {
        continue;
      }
      walk(absPath, found);
      continue;
    }
    if (entry.isFile() && isSourceFile(entry.name)) {
      found.push(repoRelative(absPath));
    }
  }
}

function packageSrcRoots(): string[] {
  const packagesDir = join(repoRoot, 'packages');
  if (!existsSync(packagesDir)) {
    return [];
  }
  return readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `packages/${entry.name}/src`);
}

function scannedFiles(): string[] {
  const found: string[] = [];
  for (const relRoot of [...APP_ROOTS, ...packageSrcRoots()]) {
    const absRoot = join(repoRoot, relRoot);
    if (!existsSync(absRoot)) {
      continue;
    }
    walk(absRoot, found);
  }
  return found;
}

function offendersIn(relPath: string): string[] {
  if (isAllowed(relPath)) {
    return [];
  }
  const lines = readFileSync(join(repoRoot, relPath), 'utf8').split(/\r?\n/);
  const hits: string[] = [];
  for (const [index, line] of lines.entries()) {
    if (FORBIDDEN_TEXT.some((pattern) => pattern.test(line))) {
      hits.push(`${relPath}:${index + 1}`);
    }
  }
  return hits;
}

describe('listener id separation', () => {
  const files = scannedFiles();

  it('finds no listener-mapping names outside the listener identity zone', () => {
    const offenders = files.flatMap((relPath) => offendersIn(relPath));
    expect(offenders).toEqual([]);
  });

  it('does not re-export the listener entity or service from the orm barrel', () => {
    const indexSrc = readFileSync(join(repoRoot, 'packages/orm/src/index.ts'), 'utf8');
    expect(indexSrc).not.toContain('entities/stats/statsListener.js');
    expect(indexSrc).not.toContain('listenerIdentity/statsListener.js');
  });

  it('scans workers, management API, and orm stats sources', () => {
    for (const root of REACH_ROOTS) {
      expect(files.some((relPath) => isUnder(relPath, root))).toBe(true);
    }
  });
});
