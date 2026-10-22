**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 12 — Lint summary counts each error once

## Rows

R13

## Runs after

10

## Why parser, API, and web errors print twice (R13)

`lint-with-summary.mjs` runs workspace type-check and workspace lint through
`scripts/ci/run-workspaces.mjs`. That script streams each workspace's output live, then, when any
workspace fails, prints `=== <script> summary ===` followed by the last 80 lines of each failed
workspace. Parser, API, and web are workspaces, so their errors appear twice. Mobile type-check
runs as its own step (`npm run type-check:mobile`, not through `run-workspaces.mjs`), so its errors
print once.

The repeat is intended: `run-workspaces.mjs` also drives `test:unit` and `build:packages`, where
the failures would otherwise be buried thousands of lines up. Keep it.

The count is the part that is wrong. `summarize()` in `lint-with-summary.mjs` counts
`error TS\d+` and ESLint `N problems (E errors, W warnings)` across every step's full output,
summary tail included. A type error inside the last 80 lines of a failed workspace is counted
twice, and so is each failed workspace's ESLint problems line. The "175 TS error(s)" in the
request is larger than the number of distinct errors.

## Change

Count only the live stream. Before `summarize()` reads a step's output, drop everything from the
`run-workspaces.mjs` summary heading onward.

## Files

scripts/ci/lint-with-summary.mjs

## Steps

1. Add a helper beside `summarize`:

   ```javascript
   /** Output before run-workspaces.mjs reprints failed workspaces' tails, so nothing counts twice. */
   const withoutWorkspaceSummaryTail = (output) => {
     const index = output.search(/^=== .+ summary ===$/m);
     return index === -1 ? output : output.slice(0, index);
   };
   ```

   The heading `run-workspaces.mjs` prints for `type-check`, `lint`, and `lint:fix` is
   `=== ${scriptName} summary ===`, on its own line after a blank line.
1. Build `allOutput` from `results.map((r) => withoutWorkspaceSummaryTail(r.output))`. Apply it
   to every step. Steps not run through `run-workspaces.mjs` never print that heading.
1. Leave what is printed to the terminal unchanged. The tail still prints; only the counts change.
1. Results that plan 10 records as skipped have `output: ''`. The helper handles that.

## Tests

None added. `lint-with-summary.mjs` is a top-level script with no exports. The final
verification's `npm run lint` shows the counts.

## Release scratchpad

none — developer tooling only; no shipped surface changes.
