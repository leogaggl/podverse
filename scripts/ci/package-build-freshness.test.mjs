import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import {
  isDistOlderThanSource,
  newestMtimeMs,
  parseTscBuildDryOutput,
  readBuildPackageDirs,
  readBuildTsconfigFile,
  usesBuildInfo,
} from './package-build-freshness.mjs';

test('readBuildPackageDirs returns the --workspaces list in order and stops at the next flag', () => {
  const dirs = readBuildPackageDirs({
    scripts: {
      'build:packages':
        'node scripts/ci/run-workspaces.mjs --script build --workspaces packages/helpers packages/orm --foo extra',
    },
  });
  assert.deepEqual(dirs, ['packages/helpers', 'packages/orm']);
  assert.deepEqual(readBuildPackageDirs({ scripts: { build: 'tsc' } }), []);
  assert.deepEqual(readBuildPackageDirs({ scripts: { 'build:packages': 'npm run build' } }), []);
  assert.deepEqual(readBuildPackageDirs({}), []);
});

test('readBuildTsconfigFile reads tsc -p and otherwise defaults to tsconfig.json', () => {
  assert.equal(
    readBuildTsconfigFile({ scripts: { build: 'npm run lint && tsc' } }),
    'tsconfig.json'
  );
  assert.equal(
    readBuildTsconfigFile({ scripts: { build: 'npm run lint && tsc && tsc-alias' } }),
    'tsconfig.json'
  );
  assert.equal(
    readBuildTsconfigFile({ scripts: { build: 'npm run lint && tsc -p tsconfig.build.json' } }),
    'tsconfig.build.json'
  );
  assert.equal(
    readBuildTsconfigFile({ scripts: { build: 'tsc --project tsconfig.build.json' } }),
    'tsconfig.build.json'
  );
});

test('usesBuildInfo is true for composite or incremental true and false otherwise', () => {
  assert.equal(usesBuildInfo('{ "compilerOptions": { "composite": true } }'), true);
  assert.equal(usesBuildInfo('{ "compilerOptions": { "incremental": true } }'), true);
  assert.equal(usesBuildInfo('{ "compilerOptions": { "composite": false } }'), false);
  assert.equal(usesBuildInfo('{ "compilerOptions": { "strict": true } }'), false);
});

test('parseTscBuildDryOutput captures would-build paths and ignores timestamp updates', () => {
  const output = [
    "9:42:08 AM - A non-dry build would build project '/abs/packages/helpers/tsconfig.json'",
    "9:42:08 AM - A non-dry build would update timestamps for output of project '/abs/packages/parser-mapping/tsconfig.json'",
    "9:42:09 AM - A non-dry build would build project '/abs/packages/orm/tsconfig.json'",
  ].join('\n');
  assert.deepEqual(
    [...parseTscBuildDryOutput(output)],
    ['/abs/packages/helpers/tsconfig.json', '/abs/packages/orm/tsconfig.json']
  );
  assert.deepEqual([...parseTscBuildDryOutput('')], []);
});

test('newestMtimeMs skips test files and __tests__ and returns null for a missing dir', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'package-build-freshness-'));
  try {
    const src = path.join(root, 'src');
    const kept = path.join(src, 'kept.ts');
    fs.mkdirSync(src, { recursive: true });
    fs.writeFileSync(kept, 'export const kept = true;\n');
    const newerFiles = [
      path.join(src, 'kept.test.ts'),
      path.join(src, 'kept.spec.ts'),
      path.join(src, '__tests__', 'hidden.ts'),
      path.join(src, '__mocks__', 'hidden.ts'),
      path.join(src, '__fixtures__', 'hidden.ts'),
      path.join(src, 'node_modules', 'hidden.ts'),
    ];
    for (const filePath of newerFiles) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, 'export const hidden = true;\n');
    }
    const older = new Date('2020-01-02T03:04:05.000Z');
    const newer = new Date('2024-06-07T08:09:10.000Z');
    fs.utimesSync(kept, older, older);
    for (const filePath of newerFiles) {
      fs.utimesSync(filePath, newer, newer);
    }

    const newest = newestMtimeMs(src);
    assert.equal(newest, fs.statSync(kept).mtimeMs);
    assert.ok(newest < fs.statSync(newerFiles[0]).mtimeMs);
    assert.equal(newestMtimeMs(path.join(root, 'missing')), null);

    const empty = path.join(root, 'empty');
    fs.mkdirSync(empty);
    assert.equal(newestMtimeMs(empty), null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('isDistOlderThanSource is true for a missing or older dist and false for a newer dist', () => {
  assert.equal(isDistOlderThanSource({ distNewestMs: null, srcNewestMs: 10 }), true);
  assert.equal(isDistOlderThanSource({ distNewestMs: 10, srcNewestMs: 20 }), true);
  assert.equal(isDistOlderThanSource({ distNewestMs: 20, srcNewestMs: 10 }), false);
  assert.equal(isDistOlderThanSource({ distNewestMs: 10, srcNewestMs: 10 }), false);
  assert.equal(isDistOlderThanSource({ distNewestMs: 10, srcNewestMs: null }), false);
});
