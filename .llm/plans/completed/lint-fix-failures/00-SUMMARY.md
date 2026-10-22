# Lint fix failures — summary

Request: [00-REQUEST.md](00-REQUEST.md). Run order and models are in [COPY-PASTA.md](COPY-PASTA.md) and
[00-EXECUTION-ORDER.md](00-EXECUTION-ORDER.md).

## Findings from the split

Step 01 checked these from the code only. Area steps confirm them.

- The lint runner `scripts/ci/lint-with-summary.mjs` runs i18n compile, workspace `type-check`,
  `type-check:mobile`, lint, and Prettier. It builds no package first.
- `@podverse/helpers`, `@podverse/orm`, and `@podverse/helpers-requests` publish types from
  `dist/` (`main` / `types` / `exports` in each `package.json`). Mobile reaches them through
  symlinks in `apps/mobile/node_modules/@podverse/` to the same package folders, so it reads the
  same `dist/`. Each `dist/` predates the symbols the errors name (Orientation in 00-REQUEST.md).
  The parser, API, web, and mobile errors for `may_have_live_items`, `ChannelLiveItemSortKey`,
  `compareChannelLiveItems`, `getManyUpcomingLiveItems`, and `reqLiveItemGetManyUpcoming` all
  read like stale package output, not source defects.
- `apps/web/tsconfig.json` includes `.next/types/**/*.ts` and `.next/dev/types/**/*.ts`. None of
  the 16 routes in the `.next` errors has a folder with a `page.*` under `apps/web/src/app/` now.
  `apps/web/.next/` holds output from an earlier build or dev run, so its generated types point at
  pages that moved or were removed.
- The `no-unsafe-finally` lint error and the missing `guid` in a mobile test are source fixes in
  mobile.

## Requirement ledger

- **R1** (area A) "`npm run lint:fix` on branch `feature/mobile-app-init-34` failed" and "debug" — find why, and make `lint:fix` pass — Plan: 10
- **R2** (area B) "`apps/mobile/src/screens/home/addByRss/useAddByRssFeedCheck.ts` 131:11 error Unsafe usage of ReturnStatement no-unsafe-finally" — Plan: 20
- **R3** (area A) Parser: "`channelLiveItemFlag.ts(8,26)` TS2344 … `'may_have_live_items'` is not assignable to type `'keyof Channel'`", "`channelLiveItemFlag.ts(16,5)` TS2353 … `'may_have_live_items'` does not exist in type `'ChannelDto'`", and "`liveItem.ts(136,37)` TS2345 … Property `'may_have_live_items'` is missing in type `'Channel'`" — Plan: 10
- **R4** (area A) API: "`src/controllers/liveItem.ts` … Module `'"@podverse/helpers"'` has no exported member `'ChannelLiveItemSortKey'`" and "… `'compareChannelLiveItems'`" — Plan: 10
- **R5** (area A) API: "`src/controllers/liveItem.ts(137,59)` and `(174,63)` … Property `'getManyUpcomingLiveItems'` does not exist on type `'ItemService'`" — Plan: 10
- **R6** (area A) Web: "`livestreamsListSsr.ts(36,32)` and `LivestreamsPageContext.tsx(77,55)` … Property `'reqLiveItemGetManyUpcoming'` does not exist on type `'ApiRequestService'`" — Plan: 10
- **R7** (area A) Web: "`src/utils/addByRSS/channelLiveItems.ts` … has no exported member `'ChannelLiveItemSortKey'`" and "… `'compareChannelLiveItems'`" — Plan: 10
- **R8** (area A) Web generated `.next` types: "Each of these is `TS2307` Cannot find module `.../page.js`, and the matching `validator.ts` line is `TS2344` `__InvalidParamMatchingKeys` does not satisfy `never`", for the 16 routes the request lists — Plan: 11
- **R9** (area A) "The web `.next` module-not-found errors are printed three times (`.next/dev/types`, `.next/types/app/...`, `.next/types/validator.ts`)" — say why each error appears three times, and whether the fix for R8 removes all three — Plan: 11
- **R10** (area A) Mobile: "`homeLivestreamsCacheRepository.ts(76,11)` and `browseFeedData.ts(121,11)` … Property `'reqLiveItemGetManyUpcoming'` does not exist on type `'ApiRequestService'`" — Plan: 10
- **R11** (area A) Mobile: "`src/lib/addByRss/liveRows.ts` … has no exported member `'ChannelLiveItemSortKey'`" and "… `'compareChannelLiveItems'`" — Plan: 10
- **R12** (area B) Mobile: "`src/lib/addByRss/localResourceData.test.ts(126,7)` TS2741: Property `'guid'` is missing … but required in type `'Episode'`" — Plan: 21
- **R13** (area A) "The same parser, api, and web errors are printed again in the type-check summary." — say whether the repeat is intended and whether it should change — Plan: 12

13 rows.

## Areas

### Area A — Type-check against stale package and Next output

- **Rows:** R1, R3, R4, R5, R6, R7, R8, R9, R10, R11, R13
- **Starts from:** `scripts/ci/lint-with-summary.mjs`; root `package.json` scripts `lint`,
  `lint:fix`, `type-check`, `type-check:mobile`, `build:packages`; `apps/web/tsconfig.json`
  (`include` of `.next/types` and `.next/dev/types`) and the `type-check` script in
  `apps/web/package.json`; `packages/helpers`, `packages/orm`, `packages/helpers-requests`
  `package.json` `types`/`exports`; the **build-order** skill.
- **What the plans must settle:** First, confirm from source that every R3–R7, R10, and R11 error
  goes away once `dist/` is rebuilt. Read the code to check this; do not build or type-check. A
  real source error goes in its own plan. Then decide how `lint` and `lint:fix` stop reporting
  stale `dist/` and stale `.next` types. Options include building packages first, a freshness
  check that fails fast and names the command to run, or clearing or regenerating
  `.next/types` before web type-check. Answer R9 and R13 in the plan that owns the runner change.
  Watch **cross-surface-change-impact** and **build-order**: the same runner serves CI, so check
  `.github/workflows` for callers of `lint` / `type-check` before you change their behavior.
- **Depends on:** none.
- **Shares files with:** none known. `release-notes/scratchpad.md` is written only by the last
  implementation prompt when prompts share a phase.
- **Plan number block:** 10–19.

### Area B — Mobile source fixes

- **Rows:** R2, R12
- **Starts from:** `checkFeed` in `apps/mobile/src/screens/home/addByRss/useAddByRssFeedCheck.ts`
  (the `isMountedRef` check in `finally` before `setIsChecking(false)`); `guidlessFeed` in
  `describe('addByRssEpisodeItemKey')` in `apps/mobile/src/lib/addByRss/localResourceData.test.ts`,
  whose second item `No Guid` must stay guidless because the next test expects index `'1'` from
  an enclosure match. Check what `Episode` type that test builds and how other mobile tests type a
  guidless parsed episode.
- **Depends on:** none.
- **Shares files with:** none.
- **Plan number block:** 20–29.

## Waves

- **Wave 1:** area A (step 02), area B (step 03). The two areas edit disjoint files, and neither
  plan uses anything the other creates.

## Decisions to review

Step 03 (area B, plans 20–21) reported none. Step 02 (area A, plans 10–12):

- **D1** (step 02, plan 10) The lint runner refuses to type-check when a package `dist/` is out of
  date and names `npm run build:packages`; it does not build packages itself. Alternative: the
  runner builds out-of-date packages before type-check, so `lint:fix` passes without an extra
  command, but lint then writes `dist/` and runs each package's lint a second time.
- **D2** (step 02, plan 11) Web type-check uses a source-only `tsconfig.type-check.json` instead of
  deleting or regenerating `.next` types. Alternatives: delete `.next/types` (disturbs a running
  `next dev`) or run `next typegen` (leaves `.next/types/app/**` and `.next/dev/types/` out of date).
- **D3** (step 02, plan 11) The same tsconfig change goes into `apps/management-web`, which did not
  fail but has the same `include`. Alternative: change web only.
- **D4** (step 02, plan 12) The repeated tail of each failed workspace's output stays; only the
  lint summary's count stops double-counting it. Alternative: hide the tail in the lint runner,
  which `test:unit` and `build:packages` also rely on.
- **D5** (step 02, plan 10) `scripts/ci/lint-changed.mjs` gets no freshness check, because it
  type-checks only packages that own changed files and those read their own `src/`. Alternative:
  add the check there too, which would refuse type-check after every package edit.

## Order

First planning pass: step 01 split, steps 02–03 in wave 1, then Review, then Close.

Review of the first planning pass: the operator kept D1–D5 as written (00-REQUEST.md). There are no
new rows and no second pass.

Close: every row maps to a plan. Phase 1 runs plans 10, 11, 20, and 21 at once; Phase 2 runs plan
12 alone, after plan 10, and closes the set.
