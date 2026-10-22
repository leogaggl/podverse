# Web player marquee — summary

Request: [00-REQUEST.md](00-REQUEST.md). Prompts and models: [COPY-PASTA.md](COPY-PASTA.md).
Order and file ownership: [00-EXECUTION-ORDER.md](00-EXECUTION-ORDER.md).

Web gets a single-line scrolling text label (marquee) that mirrors mobile's `MarqueeText`, and the
player bar (desktop and mobile web) and the full-size player swap their wrapping title and
subtitle lines for it. The marquee takes a plain string; links stay on the wrapping element.

## Requirement ledger

- **R1** (area A) "If we don't have a marquee on web already" — question row; the operator answer says none exists in `apps/web/src` or `packages/ui/src`. Area A confirms and records it. — Plan: 11 (§ R1)
- **R2** (area A) "look for opportunities where a marquee should be added" — survey web for single-line text that mobile scrolls or that would truncate in the same way (player bar, full-size player, segment and chapter titles, embed player, anything else); plan the player instances the request settles and list any other opportunity as a decision or deferred item. — Plan: 11 (survey); the embed player it found is planned in 12 (R15)
- **R3** (area A) "that should be a separate plan set that this one should generate so we can complete the marquee work on a separate work tree" — the set runs on its own sibling worktree (**git-worktree-sibling**), separate from `artist-album-attribution`; the first plan names the worktree and the operator's command so Close can copy it into "How to use". — Plan: 10 (§ Worktree), copied into `COPY-PASTA.md` "How to use"
- **R4** (area A) "That separate marquee work for web will mirror many of the decisions that Mobile makes" — behavior parity with `MarqueeText` / `marqueeScroll.ts`: scroll only on overflow past 1 unit, speed 28 per second, 2.5 second rest on the first word before every pass, loop gap matching `spacing['2xl']`, restart when the string changes, `prefers-reduced-motion` never scrolls and truncates instead, `align` and `restInset` where web needs them. — Plan: 10, 11
- **R5** (area A) "for the few instances where marquees happen" — turn groups: one label per group moves at a time, in turn order, handing off after each pass (`marqueeTurns.ts`, `useMarqueeTurn.ts`). Area A defines the web group identifiers for the player bar and the full-size player so areas B and C only consume them. — Plan: 10, 11
- **R6** (area A) "The marquee component takes a plain string and knows nothing about artists, albums, or links." — Plan: 11
- **R7** (area B) "the player bar on the bottom of the screen of web, instead of having two lines and then an ellipsis, they could just have one line per text" — desktop (`MediaPlayerInfoDesktop`) and mobile web (`MediaPlayerInfoMobile`) title and subtitle each render on one line. — Plan: 20
- **R8** (area B) "and make that text marquee" — each player bar line scrolls when it overflows, in the player bar turn group, with a turn order per line. — Plan: 20
- **R9** (area B) "for the few instances where marquees happen" (player bar half) — mobile's mini-player also scrolls its segment title (`NowPlayingSegmentBar`); answer whether the web player bar shows a chapter, clip, or soundbite title (for example through `displayItemTitle`) and plan its marquee if it does. — Plan: 21 (the segment strip, per the D6 review answer)
- **R10** (area C) "And also do the same on the full-size player." — `MediaPlayerInfoModal` item title, channel title, and subsection title each render on one line and scroll when they overflow, in the full-size player turn group. — Plan: 30
- **R11** (area C) "for the few instances where marquees happen" (full-size player half) — mobile scrolls the full player's segment title (`FullPlayerSegmentBand`); the web equivalent is the subsection (chapter, clip, soundbite) title beside its time range and chapter link button. — Plan: 30
- **R12** (area C) "A linked line (the full-size player's title and channel links) keeps its link; the marquee goes inside it." — Plan: 30
- **R13** (areas B, C) "Swap the existing title and subtitle elements for the marquee component in place. Do not restructure the info components or move how their strings are resolved (`getMediaPlayerInfoResolution`)." — each area plans its own components under this constraint. — Plan: 20, 30
- **R14** (area D) "Playwright screenshot coverage of the bar and the full-size player with a long title." — required by **e2e-page-tests** for web UI changes; includes whatever seed or fixture gives an item a title long enough to overflow. — Plan: 40
- **R15** (area A, step 06) "add a plan in block 12-19 that puts the marquee on the embed player: the segment title in EmbedSegmentInfoBar, and the title and channel lines in EmbedPlayerInfo" — Plan: 12
- **R16** (area A, step 06) "port both restInset and align from mobile, because the new segment strip needs them" — revises plan 11. — Plan: 11
- **R17** (area B, step 07) "add one above both the desktop bar and the mobile web bar, mirroring the mobile NowPlayingSegmentBar" — a segment strip above the player bar, parity source `NowPlayingSegmentBar.tsx`. — Plan: 21
- **R18** (area B, step 07) "It shows only while a chapter, clip, or soundbite is active" — Plan: 21
- **R19** (area B, step 07) "has a leading icon for the segment kind" — Plan: 21
- **R20** (area B, step 07) "an accessible label in the form Chapter: <title>" — and the matching forms for a clip and a soundbite; new catalog strings. — Plan: 21
- **R21** (area B, step 07) "follows the scrub preview" — Plan: 21
- **R22** (areas A and B, steps 06 and 07) "scrolls as turn 1 in the player bar group after the title" — player bar turns go title, strip, channel line; step 06 reshapes the turn order constants, step 07 consumes them. — Plan: 11 (constants), 20 and 21 (consumers)
- **R23** (area B, step 07) "the bar title line shows the episode or track title instead of displayItemTitle; take that string from the existing getMediaPlayerInfoResolution output without moving how strings are resolved" — revises plan 20. — Plan: 20
- **R24** (area D, step 08) "plan 40 covers them" — the embed player's segment title, title, and channel lines. — Plan: 40
- **R25** (area D, step 08) "add the segment strip on both bars plus the embed lines" — revises plan 40. — Plan: 40

## Areas

### A. Marquee component and turn groups

- **Rows:** R1, R2, R3, R4, R5, R6; second pass R15, R16, R22 (constants)
- **Starts from:** mobile parity source `apps/mobile/src/components/primitives/MarqueeText.tsx`, `apps/mobile/src/lib/text/marqueeScroll.ts`, `apps/mobile/src/lib/text/marqueeTurns.ts`, `apps/mobile/src/hooks/useMarqueeTurn.ts`; placement per `.cursor/rules/prefer-shared-ui-web-management.mdc` (`apps/web/src/components/**` versus `packages/ui/src/components/**`); spacing tokens in `@podverse/ui` styles (**styles-source-of-truth**). The opportunity survey (R2) reads web components that render one-line titles, including the embed player.
- **Depends on:** none
- **Shares files with:** none of the other areas edit A's files. Areas B and C import the component and the turn group identifiers A defines. The `artist-album-attribution` branch does not touch A's files.
- **Plan number block:** 10–19

### B. Player bar (desktop and mobile web)

- **Rows:** R7, R8, R9, R13 (with C); second pass R17, R18, R19, R20, R21, R22 (consumer), R23
- **Starts from:** `apps/web/src/components/MediaPlayer/Desktop/MediaPlayerInfoDesktop.tsx` (`styles.title`, `styles.subtitle`), `apps/web/src/components/MediaPlayer/Mobile/MediaPlayerInfoMobile.tsx`, their SCSS under `apps/web/src/styles/components/MediaPlayer/Desktop/` and `.../Mobile/`, and `apps/web/src/utils/mediaPlayer/mediaPlayerInfoResolution.ts` (read only).
- **Depends on:** A (component API and turn group identifiers)
- **Shares files with:** none inside this set. The `artist-album-attribution` branch edits both info components, so B swaps elements in place and leaves string resolution alone (R13).
- **Plan number block:** 20–29

### C. Full-size player

- **Rows:** R10, R11, R12, R13 (with B)
- **Starts from:** `apps/web/src/components/MediaPlayer/Modal/MediaPlayerInfoModal.tsx` (`ClickableTitle`, `titleSection`, `subtitleSection`), `apps/web/src/styles/components/MediaPlayer/Modal/MediaPlayerInfoModal.module.scss`, and `apps/web/src/hooks/useModalArtworkSquareSize.ts`, which sizes the artwork from the measured title and subtitle heights and so changes when those lines stop wrapping.
- **Depends on:** A (component API and turn group identifiers)
- **Shares files with:** none inside this set. The `artist-album-attribution` branch edits `MediaPlayerInfoModal.tsx`, so C swaps elements in place (R13).
- **Plan number block:** 30–39

### D. E2E coverage

- **Rows:** R14; second pass R24, R25
- **Starts from:** existing web player specs under `apps/web/e2e/` (`media-player-foundation.spec.ts`, `media-player-modal-video.spec.ts`, `media-player-chapter-seek.spec.ts`), E2E seed constants in `apps/web/e2e/helpers/seedConstants.ts`, and the test ids and selectors B and C plan.
- **Depends on:** B and C (the elements and test ids the spec asserts), and A through them
- **Shares files with:** none inside this set; seed or fixture files it edits are its own.
- **Plan number block:** 40–49

## Waves

- **Wave 1:** A — everything else builds on its component and turn groups.
- **Wave 2:** B, C — both use A's component; their files are disjoint, so they plan at once.
- **Wave 3:** D — asserts on what B and C render.

## Decisions to review

Collected from the area steps' `## Decisions`. Step 04 (area C, plan 30) reported none.

**Operator answers (first review):** D1, D2, D3, D7, D9 kept. D4 changed (R15), D5 changed (R16),
D6 changed (R17–R23), D8 kept and widened (R24, R25). Quotes are in `00-REQUEST.md` § Review of
the first planning pass.

### Step 02 — area A (plans 10, 11)

- **D1** (step 02, plan 11) The web `MarqueeText` goes in `packages/ui` (`packages/ui/src/components/layout/MarqueeText/`). Alternative: app-local under `apps/web/src/components/`, since management-web has no use for it today. Reason given: the shared-UI rule sends generic primitives with no user-facing text to `packages/ui`.
- **D2** (step 02, plan 10) Mobile's pure marquee logic (overflow math, turn registry) moves into a new `@podverse/helpers/marquee` subpath and mobile is repointed to it. Alternative: a web-only copy that leaves mobile untouched. Sharing keeps speed, rest, and hand-off identical on both surfaces; the cost is edits to mobile files and mobile verification in this set.
- **D3** (step 02, plan 11) Hovering a scrolling label pauses it on web. Mobile has no equivalent. Alternative: honor reduced motion only, as mobile does. Reason given: a way to stop moving text that runs longer than 5 seconds (WCAG 2.2.2).
- **D4** (step 02, plan 11 survey) The embed player is left out of this set: the segment title in `EmbedSegmentInfoBar` and the title and channel lines in `EmbedPlayerInfo`. Alternative: add a plan for them now; the segment bar is the closest web match to mobile's `NowPlayingSegmentBar`.
- **D5** (step 02, plan 11) No `restInset` prop on web. Alternative: a full port of mobile's props. No web line in this set has a leading icon, which is mobile's only reason for it.

### Step 03 — area B (plan 20)

- **D6** (step 03, plan 20) No separate segment line on the player bar. The title line already shows the chapter, clip, or soundbite title through `displayItemTitle`. Alternative: a third strip like mobile's segment bar, using turn order `subsection`. The bar stays two lines.

### Step 05 — area D (plan 40)

- **D7** (step 05, plan 40) Two new seeded episodes for the spec: one with a 215-character title and no chapters, one with a short title and a 207-character chapter. Alternative: lengthen an existing title, which would break every spec matching `E2E Podcast Resume P > 0`.
- **D8** (step 05, plan 40) The spec also covers the narrow (mobile web) bar, reduced motion, and the full-size player's chapter line. Alternative: one desktop screenshot of the long title on the bar and the full-size player only.
- **D9** (step 05, plan 40) The bar's channel line is not asserted, because `E2E Podcast Seed Channel` is about as wide as the desktop bar's text column and fit versus scroll is not stable there. The full-size player's channel line is asserted `fit`. Alternative: assert the bar's channel line too, which needs a channel title chosen to be clearly short or clearly long.

## Order

First planning pass: split into areas A–D across three waves.

Second pass after the first review: rows R15–R25 from the operator's answers to D4, D5, D6, and
D8. Step 06 (area A) revises plan 11 (`restInset`, per-group turn orders) and writes plan 12 for
the embed player. Step 07 (area B) revises plan 20 and plans the segment strip in 20–29. Step 08
(area D) revises plan 40. They run in that order, one heading each, because each builds on the
plan before it. Plan 30 changes only if step 06 renames a turn order identifier it imports.

Close: four phases. 10, then 11, then 12, 20, 21, and 30 at once (disjoint files), then 40, which
appends the Phase 3 release entries, archives the set, and carries the cumulative verification.
