**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 10 — Lint refuses to type-check against out-of-date package builds

## Rows

R1, R3, R4, R5, R6, R7, R10, R11

## Runs after

none

## Why `npm run lint:fix` failed (R1)

Four causes, none of them a defect in the files the type errors name:

1. **Out-of-date package `dist/` (R3–R7, R10, R11).** `@podverse/helpers`, `@podverse/orm`, and
   `@podverse/helpers-requests` publish types from `dist/` (`types` / `exports` in each
   `package.json`). Apps, `packages/parser`, and mobile (through the symlinks in
   `apps/mobile/node_modules/@podverse/`) type-check against that `dist/`.
   `scripts/ci/lint-with-summary.mjs` builds nothing first. In this tree the newest source is
   newer than the newest `dist/` in all three packages (helpers source 2026-10-22 01:00 against
   its `dist/` from 2026-10-21 23:21; orm and helpers-requests `dist/` from 2026-10-20, their
   source from 2026-10-21). `tsc --build --dry --verbose` reports all three out of date.
   CI does not see this because `.github/workflows/ci.yml` and `publish-staging.yml` run
   `npm run build:packages` before `npm run lint`.
1. **Leftover `.next` generated types (R8, R9).** Plan 11.
1. **Two mobile source errors (R2, R12).** Area B, plans 20–29.
1. **The error count is inflated (R13).** Plan 12.

### Each package error checked against source

Every caller matches the current source signature, so a rebuilt `dist/` clears them with no source
edit:

| Row | Symbol | Source | Callers |
| --- | --- | --- | --- |
| R3 | `Channel.may_have_live_items`, `ChannelDto.may_have_live_items` | `packages/orm/src/entities/channel/channel.ts` (entity column); local `type ChannelDto` in `packages/orm/src/services/channel/channel.ts` used by `ChannelService.update` | `markChannelMayHaveLiveItems` in `packages/parser/src/lib/rss/liveItem/channelLiveItemFlag.ts`, called from `packages/parser/src/lib/rss/liveItem/liveItem.ts` |
| R4, R7, R11 | `ChannelLiveItemSortKey`, `compareChannelLiveItems` | `packages/helpers/src/lib/liveItemVisibility.ts`, re-exported by `packages/helpers/src/index.ts`. `dist/lib/liveItemVisibility.d.ts` still has only the `Upcoming*` names | `apps/api/src/controllers/liveItem.ts`, `apps/web/src/utils/addByRSS/channelLiveItems.ts`, `apps/mobile/src/lib/addByRss/liveRows.ts` |
| R5 | `ItemService.getManyUpcomingLiveItems(config, { channelIds, mediumType })` | `packages/orm/src/services/item/item.ts` | `LiveItemController.getManyGlobalUpcoming` / `getManySubscribedUpcoming` in `apps/api/src/controllers/liveItem.ts`, both with that argument shape |
| R6, R10 | `ApiRequestService.reqLiveItemGetManyUpcoming(params: QueryParamsLiveItemUpcoming)` (`type`, `medium`, `page`) | `packages/helpers-requests/src/api/liveItem/liveItem.ts`, method on `_request.ts` | `apps/web/src/app/_media-lists/livestreams/livestreamsListSsr.ts`, `LivestreamsPageContext.tsx`, `apps/mobile/src/data/repositories/homeLivestreamsCacheRepository.ts`, `apps/mobile/src/screens/browse/browseFeedData.ts`, all passing `type`, `medium`, `page` |

No real source error was found, so there is no separate source plan.

## Change

Before type-check, `lint-with-summary.mjs` checks whether every package in `build:packages` has a
build at least as new as its source. When any package is out of date, the runner skips both
type-check steps, names the out-of-date packages, and tells the operator to run
`npm run build:packages`. ESLint and Prettier still run, so `lint:fix` still fixes what it can.
The run exits 1.

Do not build packages from the runner. Do not change `.github/workflows/*`; CI builds packages
before lint, so the check passes there.

ESLint here uses `tseslint.configs.recommended` (not the type-checked configs), so out-of-date
`dist/` does not change lint results. Only type-check is skipped.

### Why not compare timestamps for every package

`tsc --noEmit` (each package's `type-check` script) rewrites `tsconfig.tsbuildinfo` for composite
packages, recording files whose output was never emitted. In this tree those files are dated
09:27 today while `dist/` is days older, so `tsbuildinfo` timestamps mean nothing. Source
timestamps also lie after a checkout or stash that restores the same content: an incremental
build then emits nothing, and a timestamp check would stay out of date forever.
`tsc --build --dry` reads the content hashes and pending-emit list in `tsbuildinfo`, so it is
right in both cases. Probed in this tree: helpers, orm, and helpers-requests report "would build";
parser-mapping (built after its last edit) reports only "would update timestamps".

Projects with no `tsbuildinfo` (not `composite`, not `incremental`) get a false "out of date"
from `tsc --build --dry` (`observability` reports "output file 'tsconfig.tsbuildinfo' does not
exist"). Plain `tsc` rewrites every output file on each build, so for those packages a timestamp
comparison is right.

## Files

scripts/ci/package-build-freshness.mjs
scripts/ci/package-build-freshness.test.mjs
scripts/ci/lint-with-summary.mjs
docs/development/tooling/DOCS-DEVELOPMENT-TOOLING-BUILD-ORDER.md

## Steps

### 1. `scripts/ci/package-build-freshness.mjs` (new)

ESM, named exports only, Node built-ins only (`node:child_process`, `node:fs`, `node:module`,
`node:path`). JSDoc on each export, matching the style of `scripts/ci/lint-changed.mjs`. It is
linted by the `lint:repo-scripts` step and formatted by Prettier.

Exports:

- `readBuildPackageDirs(rootPackageJson)` — from `rootPackageJson.scripts['build:packages']`,
  split on whitespace and return the tokens after `--workspaces` up to the next token that
  starts with `--`. Returns `[]` when the script or flag is missing. This keeps the list and its
  order in sync with `build:packages`.
- `readBuildTsconfigFile(packageJson)` — from `packageJson.scripts.build`, return the path after
  the first `tsc -p <file>` or `tsc --project <file>`; otherwise `'tsconfig.json'`.
  `packages/integrations-web` builds with `tsc -p tsconfig.build.json`; every other package uses
  the default.
- `usesBuildInfo(tsconfigText)` — `true` when the text matches `/"(composite|incremental)"\s*:\s*true/`.
  No tsconfig in this repo inherits either flag through `extends`, so reading the build tsconfig's
  own text is enough.
- `parseTscBuildDryOutput(output)` — return a `Set` of the paths captured by
  `/A non-dry build would build project '([^']+)'/g`. `tsc` prints them absolute. Lines saying
  `would update timestamps for output of project` are **not** out of date.
- `newestMtimeMs(dir)` — the newest file mtime (ms) under `dir`, walking with
  `fs.readdirSync(…, { withFileTypes: true })`. Skip directories named `node_modules`,
  `__tests__`, `__mocks__`, `__fixtures__`, and files matching `/\.(test|spec)\.[cm]?[jt]sx?$/`.
  Return `null` when `dir` is missing or holds no counted file.
- `isDistOlderThanSource({ srcNewestMs, distNewestMs })` — `true` when `distNewestMs` is `null`,
  or when `srcNewestMs` is not `null` and `srcNewestMs > distNewestMs`.
- `findStalePackageBuilds({ repoRoot })` — returns
  `{ stale: Array<{ dir: string; name: string; reason: string }>, warning: string | null }`, with
  `stale` in `build:packages` order:
  1. Read `<repoRoot>/package.json`, then `readBuildPackageDirs`.
  1. For each dir, read its `package.json`; skip a package with no `build` script. Resolve the
     build tsconfig with `readBuildTsconfigFile`. When that file is missing, skip the package.
  1. `usesBuildInfo(text)` true → add the absolute tsconfig path to the dry-run list.
     Otherwise compare `newestMtimeMs(<pkg>/src)` with `newestMtimeMs(<pkg>/dist)` via
     `isDistOlderThanSource`. Out of date → reason `'dist/ is missing'` when the dist value is
     `null`, else `'dist/ is older than src/'`.
  1. Run the dry-run list in **one** call:
     `spawnSync(process.execPath, [tscBin, '--build', '--dry', '--verbose', ...paths], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })`,
     where `tscBin` is `createRequire(path.join(repoRoot, 'package.json')).resolve('typescript/bin/tsc')`.
     Combine `stdout` and `stderr`.
  1. When the call fails to start, exits non-zero, or the output matches `/error TS\d+/`, set
     `warning` to `'Could not check package builds with tsc --build --dry; type-check runs anyway.'`
     and add no dry-run packages to `stale`. The check must never block type-check when it cannot
     decide. A bad tsconfig exits 1 with `error TS5083`, which this case covers.
  1. Otherwise each dry-run package whose absolute tsconfig path is in
     `parseTscBuildDryOutput(output)` is out of date, with reason
     `'tsc --build --dry reports the build is out of date'`. Compare with `path.resolve` on both
     sides.
  1. `name` is the package's `package.json` `name`.

### 2. `scripts/ci/lint-with-summary.mjs`

- Import `findStalePackageBuilds`.
- Before the steps loop, run `findStalePackageBuilds({ repoRoot: process.cwd() })`. The root
  scripts already run it from the repo root, and `run-workspaces.mjs` uses `process.cwd()` the
  same way.
- If `stale` is non-empty, print, before the first step:

  ```text
  --- Package builds are out of date ---
  Type-check reads each package's dist/. These builds are older than their source:
    - packages/helpers (@podverse/helpers): tsc --build --dry reports the build is out of date
    - …
  Run `npm run build:packages`, then lint again. Type-check is skipped this run.
  ```

  If `warning` is set, print it on its own line instead and run type-check as usual.
- Mark the `type-check` and `type-check:mobile` steps with `skipWhenPackagesStale: true`. In the
  loop, when packages are out of date, push `{ step: step.name, code: null, skipped: true, output: '' }`
  for those steps instead of running them.
- Summary block. Add a `Packages:` line above `Type-check:`, and keep the existing alignment
  style:
  - `Packages:   up to date` when nothing is out of date and there is no warning.
  - `Packages:   out of date (packages/helpers, packages/orm, …) — run npm run build:packages`.
  - `Packages:   not checked (tsc --build --dry failed)` when `warning` is set.
- `Type-check:` prints `skipped` when packages are out of date. A skip counts as a failure for
  the exit code: `typeCheckFailed` is true when either type-check result is skipped or has a
  non-zero code.
- Update the file's header comment: the runner checks package build freshness before
  type-check, skips type-check when any package build is older than its source, and names
  `npm run build:packages`. Keep the comment future-forward.

### 3. `docs/development/tooling/DOCS-DEVELOPMENT-TOOLING-BUILD-ORDER.md`

Add a section `## Lint and type-check read package builds` after `## Stage details`. Say:
workspace type-check resolves `@podverse/*` to each package's `dist/`; `npm run lint` and
`npm run lint:fix` first check every `build:packages` package (`tsc --build --dry` for composite
or incremental builds, file times for the rest); when one is out of date they skip type-check,
list the packages, and ask for `npm run build:packages`; CI runs `build:packages` before lint.
Lines at most 100 characters.

## Out of scope

- `scripts/ci/lint-changed.mjs`. It type-checks only the packages that own changed files, and a
  package's own `type-check` reads its `src/`. Applying this check there would refuse
  type-check every time a package file changes. Its header already names `npm run lint` as the
  full check.
- The root `type-check` script. `publish-staging.yml` runs it after `build:packages`.
- Building packages from the runner.

## Tests

- New `scripts/ci/package-build-freshness.test.mjs`, `node:test` plus `node:assert/strict`, in the
  same shape as `scripts/mobile/perf-report.test.mjs`. Cases:
  - `readBuildPackageDirs` returns the `--workspaces` list in order and stops at the next `--` flag;
    returns `[]` when `build:packages` is missing.
  - `readBuildTsconfigFile` returns `tsconfig.json` for `npm run lint && tsc` and for
    `npm run lint && tsc && tsc-alias`, and `tsconfig.build.json` for
    `npm run lint && tsc -p tsconfig.build.json`.
  - `usesBuildInfo` is true for `"composite": true` and `"incremental": true`, and false otherwise.
  - `parseTscBuildDryOutput` captures "would build project" paths and ignores "would update
    timestamps" lines. Use lines copied from the real output format:
    `9:42:08 AM - A non-dry build would build project '/abs/packages/helpers/tsconfig.json'`.
  - `newestMtimeMs` in a temp dir (`fs.mkdtempSync`, `fs.utimesSync`): it skips `*.test.ts` and
    `__tests__/`, and returns `null` for a missing dir.
  - `isDistOlderThanSource` for a missing dist, an older dist, and a newer dist.
- `findStalePackageBuilds` spawns `tsc`; it is not unit-tested. The final verification runs
  `npm run lint` against this tree.

## Release scratchpad

none — developer tooling only; no shipped surface changes.
