**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 10 — Move the marquee math and turn registry into `@podverse/helpers`

Mobile's marquee overflow math and turn registry are pure TypeScript with no React Native
imports. Web needs the same numbers and the same hand-off rules. Per **reuse-beyond-components**
("Pure, and useful to more than one surface → `@podverse/helpers`"; "collapse it in the same
change"), move them into a new `@podverse/helpers/marquee` subpath and route mobile through it.
Mobile behavior does not change. Plan 11 builds the web component on this subpath.

## Rows

R3, R4, R5

## Runs after

none

## Worktree (R3)

This set runs on its own sibling worktree, separate from `artist-album-attribution`, per
**git-worktree-sibling**. Branch `feature/web-player-marquee` from `develop`; `develop` holds the
same mobile marquee, web player, and `packages/ui` files as the planning checkout. The plan set is
untracked, so the operator copies it into the worktree before running it. Operator commands
(**Root** tab, fish-safe):

```bash
git worktree add -b feature/web-player-marquee ../podverse_feature_web_player_marquee develop
cp -R .llm/plans/active/web-player-marquee ../podverse_feature_web_player_marquee/.llm/plans/active/
cd ../podverse_feature_web_player_marquee
make local_env_worktree_setup
npm install
npm run mobile:install
./scripts/abcplan/run.sh run web-player-marquee
```

`npm run mobile:install` is there because this plan changes mobile imports, and the set's
verification runs mobile unit tests and the mobile type check in the worktree.

## Files

packages/helpers/src/lib/marquee/marqueeScroll.ts
packages/helpers/src/lib/marquee/marqueeScroll.test.ts
packages/helpers/src/lib/marquee/marqueeTurns.ts
packages/helpers/src/lib/marquee/marqueeTurns.test.ts
packages/helpers/src/lib/marquee/index.ts
packages/helpers/package.json
apps/mobile/src/lib/text/marqueeScroll.ts
apps/mobile/src/lib/text/marqueeScroll.test.ts
apps/mobile/src/lib/text/marqueeTurns.ts
apps/mobile/src/lib/text/marqueeTurns.test.ts
apps/mobile/src/components/primitives/MarqueeText.tsx
apps/mobile/vitest.config.ts

`apps/mobile/src/lib/text/marqueeScroll.ts`, `marqueeScroll.test.ts`, and `marqueeTurns.test.ts`
are deleted. `apps/mobile/src/hooks/useMarqueeTurn.ts` is read only: its imports
(`MarqueeTurnGroup`, `marqueeTurns` from `../lib/text/marqueeTurns`) keep working unchanged.

## Steps

### 1. `packages/helpers/src/lib/marquee/marqueeScroll.ts`

Copy `apps/mobile/src/lib/text/marqueeScroll.ts` with these changes, and nothing else:

- Drop the `spacing` import and the `MARQUEE_LOOP_GAP` constant. Helpers does not depend on
  `@podverse/design-tokens`, and each surface sources the gap from its own spacing token.
- Rename `MARQUEE_SPEED_DP_PER_SECOND` to `MARQUEE_SPEED_PER_SECOND`, value `28`. Doc comment:
  scroll speed in layout units per second (dp on mobile, CSS px on web); slow enough to read a long
  episode title while it passes.
- `marqueeLoopDistance` takes the gap: `marqueeLoopDistance(contentWidth: number, loopGap: number)`
  returns `Math.max(0, contentWidth) + Math.max(0, loopGap)`. Doc comment: one full copy plus the
  seam before the title repeats.
- Keep `MARQUEE_EDGE_HOLD_MS` (2500), `OVERFLOW_EPSILON` (1, not exported),
  `stabilizeMeasuredWidth`, `shouldMarqueeScroll`, `MarqueeLayout`, `resolveMarqueeLayout`, and
  `marqueeScrollDurationMs` exactly as they are, using `MARQUEE_SPEED_PER_SECOND`.
- Reword "Reduce Motion" in doc comments to "reduced motion (Reduce Motion on mobile,
  `prefers-reduced-motion` on web)" once, on `shouldMarqueeScroll`. Keep "dp" out of the shared
  comments; say "unit" or "layout unit" (the 0.4dp jitter comment becomes 0.4-unit).

### 2. `packages/helpers/src/lib/marquee/marqueeTurns.ts`

Copy `apps/mobile/src/lib/text/marqueeTurns.ts` and make the group type generic:

- Remove `export type MarqueeTurnGroup = 'full-player' | 'mini-player';`.
- `export type MarqueeTurnRegistry<Group extends string = string> = { … }` with every `group`
  parameter typed `Group`.
- `export const createMarqueeTurnRegistry = <Group extends string = string>():
  MarqueeTurnRegistry<Group> => { … }`, with `groups` typed `Map<Group, GroupState>`.
- Do **not** export a singleton. Delete the trailing `marqueeTurns` constant; each surface owns
  its own process-wide registry (mobile in step 5, web in plan 11).
- Keep every other line, including the ordering rules (`sortsBefore`, join order as tie-break,
  wrap-around in `passTurn`) and the doc comment on `createMarqueeTurnRegistry`.

### 3. `packages/helpers/src/lib/marquee/index.ts` and the subpath

`index.ts` re-exports both modules with Tier A `.js` specifiers:

```ts
export * from './marqueeScroll.js';
export * from './marqueeTurns.js';
```

Add to `packages/helpers/package.json` `exports`, after `"./math"`:

```json
"./marquee": {
  "types": "./dist/lib/marquee/index.d.ts",
  "default": "./dist/lib/marquee/index.js"
},
```

Do not add it to `packages/helpers/src/index.ts`. Mobile cannot import the barrel, and web code
imports the subpath (as `PlayButtonRow.tsx` does with `@podverse/helpers/math`).

### 4. Move the tests into helpers

- `packages/helpers/src/lib/marquee/marqueeScroll.test.ts`: move every case from
  `apps/mobile/src/lib/text/marqueeScroll.test.ts`, importing from `./marqueeScroll.js`. Replace
  the `marqueeLoopDistance` block with one case, "travels one copy plus the seam":
  `expect(marqueeLoopDistance(320, 24)).toBe(344)`. Drop the "keeps the seam wider than a
  word-sized gap" case; it asserted a mobile token, which no longer lives here.
- `packages/helpers/src/lib/marquee/marqueeTurns.test.ts`: move
  `apps/mobile/src/lib/text/marqueeTurns.test.ts` as it is, importing from `./marqueeTurns.js`. The
  `'mini-player'` / `'full-player'` strings stay; the generic registry accepts any string. This
  file never ran on mobile (it is not in mobile's Vitest `include`); in helpers it runs under
  `src/**/*.test.ts`.
- Delete both mobile test files.

### 5. Mobile

- `apps/mobile/src/lib/text/marqueeTurns.ts` becomes:

  ```ts
  import { createMarqueeTurnRegistry } from '@podverse/helpers/marquee';

  export type MarqueeTurnGroup = 'full-player' | 'mini-player';

  /** Process-wide registry for player chrome. */
  export const marqueeTurns = createMarqueeTurnRegistry<MarqueeTurnGroup>();
  ```

- Delete `apps/mobile/src/lib/text/marqueeScroll.ts`.
- `apps/mobile/src/components/primitives/MarqueeText.tsx`:
  - Import `MARQUEE_EDGE_HOLD_MS`, `marqueeLoopDistance`, `marqueeScrollDurationMs`,
    `resolveMarqueeLayout`, `stabilizeMeasuredWidth` from `@podverse/helpers/marquee`.
  - Import `spacing` from `../../theme/spacing` and declare, at module scope above
    `MEASURE_MAX_WIDTH`, with the doc comment moved from the deleted file:

    ```ts
    /**
     * Air between the last glyph and the repeated first word. Wider than `spacing.base` so the
     * seam reads as a break rather than the next word of the same title.
     */
    const MARQUEE_LOOP_GAP = spacing['2xl'];
    ```

  - `marqueeLoopDistance(contentWidth)` becomes `marqueeLoopDistance(contentWidth, MARQUEE_LOOP_GAP)`.
  - The `seam` style keeps `width: MARQUEE_LOOP_GAP`. `styles` is created after the constant, so
    keep the constant above `const styles`.
  - The `MarqueeTurnGroup` type import from `../../lib/text/marqueeTurns` stays.
- `apps/mobile/vitest.config.ts`: remove `'src/lib/text/marqueeScroll.test.ts',` from `include`,
  and remove the clause "the marquee overflow and travel math (`src/lib/text/marqueeScroll.ts`),"
  from the doc comment above `defineConfig`, keeping the surrounding sentence grammatical.

Search `apps/mobile` for any other importer of `lib/text/marqueeScroll` before deleting it. At
planning time there were none besides `MarqueeText.tsx` and the moved test.

## What must stay true

- Mobile behavior is byte-for-byte the same: speed 28, rest 2500 ms, overflow threshold 1, loop gap
  `spacing['2xl']` (24), same turn hand-off.
- No React, React Native, DOM, or design-token import in `packages/helpers/src/lib/marquee/`.
- No `as` assertions and no `any` in the moved code.

## Tests

- Unit (helpers, Vitest): `packages/helpers/src/lib/marquee/marqueeScroll.test.ts` and
  `packages/helpers/src/lib/marquee/marqueeTurns.test.ts` (moved from mobile, as above).
- Mobile: no new tests. Mobile unit tests and the mobile type check confirm the repointed imports
  (`npm --prefix apps/mobile run test`, `npm run type-check:mobile`, after `npm run build -w
  packages/helpers` so the subpath's `dist` exists). No Maestro change; behavior is unchanged
  (**mobile-test-economics**).

## Release scratchpad

none
