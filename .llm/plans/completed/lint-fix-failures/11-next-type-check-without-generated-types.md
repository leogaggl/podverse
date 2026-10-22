**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 11 — Next app type-check ignores generated `.next` types

## Rows

R8, R9

## Runs after

none

## What happened (R8)

Commit `93af2aaf5` (2026-10-22) deleted the 16 list routes the log names (`src/app/albums/page.tsx`,
`src/app/podcasts/page.tsx`, `src/app/add-by-rss/[resource]/page.tsx`, and the rest). None of
those folders has a `page.*` now. `apps/web/.next/` still holds generated types from 2026-10-20:
a dev run wrote `.next/dev/types/` at 08:59 and a `next build --webpack` wrote `.next/types/` at
14:41. `apps/web/tsconfig.json` includes `.next/types/**/*.ts` and `.next/dev/types/**/*.ts`, so
`npm run type-check -w apps/web` (`tsc --noEmit -p .`) type-checks generated files that import
pages that no longer exist. Nothing in `src/` is wrong.

## Why each error prints three times (R9)

Each deleted page is imported by three generated files, and tsc reports each import:

1. `.next/types/app/<route>/page.ts` — the per-route check the webpack build writes, which imports
   `../../../../src/app/<route>/page.js`.
1. `.next/types/validator.ts` — the build's route validator, one block per route importing the
   page.
1. `.next/dev/types/validator.ts` — the dev server's validator, written separately into
   `.next/dev/`.

Each validator block also fails with TS2344 on `__InvalidParamMatchingKeys` because its import
resolved to nothing. This plan removes all three, because the type-check config includes none of
those trees.

## Change

`type-check` in `apps/web` and `apps/management-web` uses a dedicated tsconfig that includes only
`src/`. Local type-check then reads the same files CI does: in CI, lint runs before
`build:apps`, so there is no `.next/`, and `next-env.d.ts` is gitignored and absent.

Route types are still checked: `next build` type-checks with `tsconfig.json`, which keeps its
`.next` includes and regenerates them fresh in each build. `tsconfig.json` stays unchanged
because Next rewrites its `include` on every `next dev` and `next build`, and the editor keeps
using it.

`apps/management-web` has the same `include` and the same exposure to a leftover `.next/`, so it
gets the same change.

Do not delete or regenerate `.next/` from any script. A leave-running `next dev` owns
`.next/dev/`. `next typegen` writes only `.next/types/{routes.d.ts,validator.ts,…}` and would
leave both `.next/types/app/**` and `.next/dev/types/` out of date.

## Files

apps/web/tsconfig.type-check.json
apps/web/package.json
apps/management-web/tsconfig.type-check.json
apps/management-web/package.json

## Steps

1. Create `apps/web/tsconfig.type-check.json`:

   ```jsonc
   {
     // Type-check reads source only. Generated .next types can name pages that no longer exist;
     // next build checks routes against freshly generated types through tsconfig.json.
     "extends": "./tsconfig.json",
     "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.d.ts"]
   }
   ```

   `next-env.d.ts` is left out on purpose. It imports `./.next/types/routes.d.ts`, and CI
   type-checks without it. `src/types/scss-modules.d.ts` covers the SCSS module imports, and no
   file in `src/` uses Next's generated route globals (`PageProps`, `LayoutProps`,
   `RouteContext`) or static image imports.
1. `apps/web/package.json`: set `"type-check": "tsc --noEmit -p tsconfig.type-check.json"`.
1. Create `apps/management-web/tsconfig.type-check.json` with the same content. `exclude` is
   inherited from `apps/management-web/tsconfig.json`; leave it there.
1. `apps/management-web/package.json`: set `"type-check": "tsc --noEmit -p tsconfig.type-check.json"`.

`incremental: true` from the base config writes `tsconfig.type-check.tsbuildinfo` beside each
config. `.gitignore` already ignores `*.tsbuildinfo`. `scripts/ci/lint-changed.mjs` already
treats any changed `tsconfig*.json` as a type-check trigger, so it needs no edit.

## Tests

None added. The final verification runs `npm run lint`, and web type-check must pass with
`apps/web/.next/` left as it is.

## Release scratchpad

none — developer tooling only; no shipped surface changes.
