# Lint fix failures — execution order

Prompts and models: [COPY-PASTA.md](COPY-PASTA.md). Request and settled review answers:
[00-REQUEST.md](00-REQUEST.md). Ledger and decisions: [00-SUMMARY.md](00-SUMMARY.md).

Phases run one after another. Prompts inside one phase run at once and own disjoint files, counting
the shared files in **parallel-plan-execution** § Shared files. Phase 1 has four prompts, so none
of them writes `release-notes/scratchpad.md`: each puts an entry, if it has one, in its final
message under "Release notes entry". Every plan in the set says `## Release scratchpad: none`
(developer tooling and mobile source fixes with no behavior change), so no entry is expected.

Phase 2 is a single prompt, plan 12, and it also closes the set: it appends any release entries,
archives the set, and carries the cumulative verification.

Final messages land in `.artifacts/plan-runner/lint-fix-failures/<NN>.md`. Finished plans move to
`.llm/plans/completed/lint-fix-failures/`.

## Settled decisions

The operator kept D1–D5 as written (00-REQUEST.md § Review of the first planning pass):

- **D1** (plan 10): the lint runner skips type-check when a package `dist/` is out of date and
  names `npm run build:packages`. It does not build packages itself.
- **D2** (plan 11): web `type-check` uses a source-only `tsconfig.type-check.json`.
- **D3** (plan 11): `apps/management-web` gets the same source-only config.
- **D4** (plan 12): the failed-workspace reprint stays; the lint summary counts each error once.
- **D5** (plan 10): `scripts/ci/lint-changed.mjs` gets no freshness check.

## Dependency graph

From each plan's `## Runs after`:

| Plan | Change | Rows | Runs after | Phase |
| --- | --- | --- | --- | --- |
| 10 | Lint refuses to type-check against out-of-date package builds | R1, R3, R4, R5, R6, R7, R10, R11 | none | 1 |
| 11 | Next app type-check ignores generated `.next` types | R8, R9 | none | 1 |
| 20 | Clear the feed-check spinner without returning from finally | R2 | none | 1 |
| 21 | Give the guidless episode fixture an empty guid | R12 | none | 1 |
| 12 | Lint summary counts each error once, and close the set | R13 | 10 | 2 |

## Shared files that set the order

- `scripts/ci/lint-with-summary.mjs`: 10 (P1), 12 (P2). Plan 12 adds its helper beside
  `summarize` in the file plan 10 already changed.

No other file appears in two plans.

## Phases

Each prompt owns exactly its plan's `## Files`.

### Phase 1 — freshness check, source-only Next type-check, mobile source fixes (4 prompts)

- **10** owns `scripts/ci/package-build-freshness.mjs`, `scripts/ci/package-build-freshness.test.mjs`,
  `scripts/ci/lint-with-summary.mjs`, and
  `docs/development/tooling/DOCS-DEVELOPMENT-TOOLING-BUILD-ORDER.md`.
- **11** owns `apps/web/tsconfig.type-check.json`, `apps/web/package.json`,
  `apps/management-web/tsconfig.type-check.json`, and `apps/management-web/package.json`.
- **20** owns `apps/mobile/src/screens/home/addByRss/useAddByRssFeedCheck.ts`.
- **21** owns `apps/mobile/src/lib/addByRss/localResourceData.test.ts`.

Repo-wide `npm run lint`, `npm run lint:fix`, and `npm run type-check` read every workspace, so
no Phase 1 prompt runs them; another prompt's half-finished edit would show up as its error.

### Phase 2 — lint summary count, then close (alone)

- **12** owns `scripts/ci/lint-with-summary.mjs`. Then it appends any Phase 1 release entries to
  `release-notes/scratchpad.md`, moves the `00-*` files and `COPY-PASTA.md` to
  `.llm/plans/completed/lint-fix-failures/`, removes the empty active directory, and ends with the
  cumulative verification.

## Cumulative verification

All in the **Root** tab, after the whole set:

1. `node --test scripts/ci/package-build-freshness.test.mjs` — plan 10's unit tests.
1. `npm run lint` before building — while any package `dist/` is older than its source, it names
   the out-of-date packages, skips both type-check steps, and exits 1. If packages were already
   built, the check passes and the run continues.
1. `npm run build:packages`.
1. `npm run type-check -w apps/web` and `npm run type-check -w apps/management-web` — pass with
   `apps/web/.next/` left as it is (plan 11).
1. `npm run type-check:mobile` and `npm --prefix apps/mobile run test` — plan 21's fixture
   type-checks and the guidless enclosure-match test still returns `'1'`.
1. `npm run lint:fix`, then `npm run lint` — both pass, and the summary counts each error once
   (plan 12).

No Maestro or Playwright run: nothing on screen changes, and no Maestro flow exercises
`checkFeed`. No dependency change, so no lockfile step.
