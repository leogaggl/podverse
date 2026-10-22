# Web player marquee — execution order

Prompts and models: [COPY-PASTA.md](COPY-PASTA.md). Request and settled review answers:
[00-REQUEST.md](00-REQUEST.md). Ledger and decisions: [00-SUMMARY.md](00-SUMMARY.md).

Phases run one after another. Prompts inside one phase run at once and own disjoint files. In
Phase 3, no prompt writes `release-notes/scratchpad.md`; each puts its entry in its final message
under "Release notes entry", and prompt 40 appends them all. Prompts 10 and 11 run alone and have
no entry (nothing renders the marquee until Phase 3).

## Where it runs

The whole set runs on the sibling worktree `../podverse_feature_web_player_marquee`, branch
`feature/web-player-marquee` from `develop` (plan 10 § Worktree, R3). The operator copies this
plan set into the worktree and starts the runner there; the commands are in `COPY-PASTA.md`
"How to use". Final messages land in that worktree's `.artifacts/plan-runner/web-player-marquee/`.

## Outside this set

- **`artist-album-attribution`** runs on its own branch. Its plans 50 and 76 edit
  `MediaPlayerInfoDesktop.tsx`, `MediaPlayerInfoMobile.tsx`, `MediaPlayerInfoModal.tsx`, and
  `MediaPlayerInfoModal.module.scss`, which plans 20 and 30 also edit. Plans 20 and 30 swap
  elements in place and leave `getMediaPlayerInfoResolution` alone to keep that merge small.
  Whichever branch merges second keeps both sets' edits; an artist line in the full-size player
  or the bar then needs its own turn order in `apps/web/src/constants/mediaPlayerMarquee.ts`.

## Dependency graph

From each plan's `## Runs after`:

| Plan | Runs after |
| --- | --- |
| 10 marquee math and turn registry in `@podverse/helpers/marquee` | none |
| 11 web `MarqueeText` in `@podverse/ui`, player turn constants | 10 |
| 12 embed player lines scroll | 11 |
| 20 player bar title and channel scroll | 11 |
| 21 segment strip above the player bar | 11 |
| 30 full-size player lines scroll | 11 |
| 40 Playwright coverage, closes the set | 12, 20, 21, 30 |

## Shared files that set the order

- **`@podverse/helpers/marquee` and `packages/helpers/package.json`:** 10 creates them; 11 builds
  on them. Mobile's marquee imports are repointed in 10 only.
- **`packages/ui` `MarqueeText`, `useMarqueeTurn`, `usePrefersReducedMotion`, `packages/ui/src/index.ts`,
  and `apps/web/src/constants/mediaPlayerMarquee.ts`:** 11 only. Plans 12, 20, 21, and 30 read
  them and do not edit them.
- **Consumer catalog originals and `npm run i18n:compile` output:** 21 only. No other prompt in
  the set edits a catalog, so 21 can compile inside Phase 3.
- **`apps/web/e2e/media-player-floating-video-default.spec.ts`:** 21 only; 40 does not edit it.
- **`tools/web/seed-e2e.mjs`, `apps/web/e2e/helpers/seedConstants.ts`,
  `apps/web/e2e/helpers/mediaPlayerAssertions.ts`, `makefiles/local/e2e-spec-order-web.txt`:**
  40 only.
- **Player bar:** 20 edits the info components (`MediaPlayerInfoDesktop`, `MediaPlayerInfoMobile`);
  21 mounts the strip in their parents (`MediaPlayerDesktop`, `MediaPlayerMobile`). Disjoint files,
  one turn group (`playerBar`: title 0, segment 1, channel 2).

## Phases

### Phase 1 — shared marquee logic

- **10**, alone. Owns `packages/helpers/src/lib/marquee/` (`marqueeScroll.ts`, `marqueeTurns.ts`,
  their tests, `index.ts`), `packages/helpers/package.json`, and on mobile
  `apps/mobile/src/lib/text/marqueeScroll.ts`, `marqueeScroll.test.ts`, `marqueeTurns.ts`,
  `marqueeTurns.test.ts`, `apps/mobile/src/components/primitives/MarqueeText.tsx`, and
  `apps/mobile/vitest.config.ts`.

### Phase 2 — web `MarqueeText` and turn constants

- **11**, alone. Owns `packages/ui/src/components/layout/MarqueeText/` (component, SCSS module,
  test, `index.ts`), `packages/ui/src/hooks/useMarqueeTurn.ts`,
  `packages/ui/src/hooks/usePrefersReducedMotion.ts`, `packages/ui/src/index.ts`, and
  `apps/web/src/constants/mediaPlayerMarquee.ts`.

### Phase 3 — the four web surfaces (4 prompts at once)

- **12** owns `apps/web/src/components/embed/EmbedPlayerInfo.tsx`,
  `apps/web/src/components/embed/EmbedSegmentInfoBar.tsx`, and their SCSS modules under
  `apps/web/src/styles/components/embed/`.
- **20** owns `apps/web/src/components/MediaPlayer/Desktop/MediaPlayerInfoDesktop.tsx`,
  `apps/web/src/components/MediaPlayer/Mobile/MediaPlayerInfoMobile.tsx`, and their SCSS modules
  under `apps/web/src/styles/components/MediaPlayer/Desktop/` and `.../Mobile/`.
- **21** owns `apps/web/src/utils/mediaPlayer/mediaPlayerSegmentStrip.ts` and its test,
  `apps/web/src/components/MediaPlayer/SegmentStrip/` (strip, presence store, its test), the strip
  SCSS module, `MediaPlayerDesktop.tsx`, `MediaPlayerMobile.tsx`, `MediaPlayer.tsx`,
  `apps/web/src/utils/mediaPlayer/mediaPlayerLayout.ts`, `apps/web/src/styles/globals/pageAdjust.scss`,
  both floating video portal components, `apps/web/e2e/media-player-floating-video-default.spec.ts`,
  the four `packages/i18n-catalog/consumer/originals/*.json` files (the `media_player.segment_strip_*`
  keys), and the `npm run i18n:compile` output.
- **30** owns `apps/web/src/components/MediaPlayer/Modal/MediaPlayerInfoModal.tsx` and
  `apps/web/src/styles/components/MediaPlayer/Modal/MediaPlayerInfoModal.module.scss`.

### Phase 4 — Playwright coverage, then close the set

- **40**, alone. Owns `tools/web/seed-e2e.mjs`, `apps/web/e2e/helpers/seedConstants.ts`,
  `apps/web/e2e/helpers/mediaPlayerAssertions.ts`, `apps/web/e2e/media-player-marquee.spec.ts`,
  and `makefiles/local/e2e-spec-order-web.txt`. Appends every Phase 3 release entry, archives the
  set, and carries the cumulative verification.

## Release entries collected by prompt 40

From `.artifacts/plan-runner/web-player-marquee/<NN>.md`, in this order: 12, 20, 21, 30. Plans 10,
11, and 40 have no entry.
