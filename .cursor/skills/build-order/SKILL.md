---
name: build-order
description: Keep monorepo build order dependency-safe and keep build-order docs in sync when build orchestration changes.
---

# Build Order

Use this skill when you change root build orchestration, workspace build sequencing, or CI/local
validation flows that affect build execution order.

## Canonical sequence

From repo root, build in this order:

1. `npm run build:packages`
2. `npm run build:apps`
3. `npm run build:tools`

`npm run build` must preserve this staged order.

## Why

Package outputs (`dist/*.d.ts`) are required by downstream workspace builds. If order is broken,
first-time builds can fail with `TS2307` module-resolution errors.

## Keep in sync when build process changes

When changing build order/process, update all relevant sources in the same PR:

- `package.json` (`build`, `build:packages`, `build:apps`, `build:tools`)
- `docs/development/tooling/DOCS-DEVELOPMENT-TOOLING-BUILD-ORDER.md`
- Any workflow/docs summaries that would otherwise describe stale ordering

## Do

- Use explicit workspace ordering for dependency-sensitive package builds.
- Keep root build orchestration readable and staged.
- Update build-order docs whenever orchestration behavior changes.

## Don't

- Do not use all-workspace build enumeration for root `build` unless dependencies are guaranteed.
- Do not change build sequencing without updating the canonical build-order doc.

## Examples

Worked examples for commands from the monorepo root (**commands-from-monorepo-root**).

**Workers (devPiBulkFeedsAddFromFile):**

```bash
npm run dev_pi_bulk_feeds_add_from_file -w apps/workers -- -startId 1 -endId 10 -q rss-slow
```

**Building a single app:**

```bash
npm run build -w apps/workers
```

**Running any workspace script from root:**

```bash
npm run <script-name> -w <workspace> -- [args]
```

**Unit tests — full tier vs scoped:**

```bash
npm run test:unit
npm run test -w apps/web
npm run test -w @podverse/playback-core
```

This keeps instructions copy-pasteable from repo root and avoids confusion about where `.env` and default paths resolve. Using fenced code blocks ensures the UI shows a copy button for each command.
