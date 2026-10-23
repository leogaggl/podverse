# Web player marquee

## Request

If we don't have a marquee on web already, I think we should look for opportunities where a marquee should be added. And I think maybe that should be a separate plan set that this one should generate so we can complete the marquee work on a separate work tree.

That separate marquee work for web will mirror many of the decisions that Mobile makes for the few instances where marquees happen. For example, the player bar on the bottom of the screen of web, instead of having two lines and then an ellipsis, they could just have one line per text and make that text marquee. And also do the same on the full-size player.

## Operator answers

- **Where this came from:** the operator asked for this set while planning `artist-album-attribution`
  (artist names in the players). An earlier answer there: "for the mobile mini-player and the
  web-player bar, there may not be enough vertical real estate to put three lines in there. So, do
  we make that concatenated string that can marquee into view as needed? I don't know for sure that
  those can't fit three lines, but if you have it on good belief that two lines is the max
  comfortable, then that seems like what we should do."
- **Settled:** web has no marquee today (checked). Each text value in the web player bar and the
  full-size player gets one line that scrolls when it overflows, in place of wrapping to two lines
  and an ellipsis. The behavior mirrors mobile's `MarqueeText`.
- **Worktree:** the operator wants this set implemented on its own worktree, separate from
  `artist-album-attribution`.

### Review of the first planning pass

Answers to the planner decisions D1–D9 in `00-SUMMARY.md` § Decisions to review.

- **D1 kept:** "keep the web MarqueeText in packages/ui."
- **D2 kept:** "move the overflow math and turn registry to @podverse/helpers/marquee and point
  mobile at it."
- **D3 kept:** "hovering a scrolling label pauses it."
- **D4 changed:** "add a plan in block 12-19 that puts the marquee on the embed player: the
  segment title in EmbedSegmentInfoBar, and the title and channel lines in EmbedPlayerInfo; plan
  40 covers them."
- **D5 changed:** "port both restInset and align from mobile, because the new segment strip needs
  them."
- **D6 changed:** "the main web player bar has no segment strip today; add one above both the
  desktop bar and the mobile web bar, mirroring the mobile NowPlayingSegmentBar. It shows only
  while a chapter, clip, or soundbite is active, has a leading icon for the segment kind, an
  accessible label in the form Chapter: <title>, follows the scrub preview, and scrolls as turn 1
  in the player bar group after the title. With the strip in place, the bar title line shows the
  episode or track title instead of displayItemTitle; take that string from the existing
  getMediaPlayerInfoResolution output without moving how strings are resolved. Plans 20 and 40
  change to match."
  - Read as: the player bar group turns go title (0), then the strip (1), then the channel line.
    The full-size player's order (title, channel, subsection) is unchanged.
  - The episode or track title is the existing `itemTitle` field of
    `getMediaPlayerInfoResolution`'s return; `displayItemTitle` stays in the resolver.
- **D7 kept:** "seed two new episodes."
- **D8 kept and widened:** "keep the broad coverage and add the segment strip on both bars plus the
  embed lines."
- **D9 kept:** "do not assert the bar channel line."

## Relationship to `artist-album-attribution`

That set adds an artist line to the same player components: a smaller artist line between the
title and the album in the full-size player, and "Artist · Album" as the second line of the
player bar. Both sets edit `MediaPlayerInfoDesktop.tsx`, `MediaPlayerInfoMobile.tsx`, and
`MediaPlayerInfoModal.tsx`, and they run on separate branches. To keep the merge small:

- The marquee component takes a plain string and knows nothing about artists, albums, or links.
- Swap the existing title and subtitle elements for the marquee component in place. Do not
  restructure the info components or move how their strings are resolved
  (`getMediaPlayerInfoResolution`).
- A linked line (the full-size player's title and channel links) keeps its link; the marquee goes
  inside it.

## Glossary

- **Player bar:** the web bottom player, desktop (`MediaPlayerInfoDesktop`) and mobile web
  (`MediaPlayerInfoMobile`).
- **Full-size player:** the web full-screen player modal (`MediaPlayerInfoModal` inside
  `MediaPlayerModal`).
- **Marquee:** a single line that scrolls horizontally when its text is wider than the space, then
  rests and repeats.
- **Turn group:** labels in one group scroll one at a time and hand off after each pass.

## Orientation

Checked while writing this file. Re-verify; other sets are editing player files.

- Web player text: `apps/web/src/components/MediaPlayer/Desktop/MediaPlayerInfoDesktop.tsx`
  renders `styles.title` and `styles.subtitle` divs from `getMediaPlayerInfoResolution`
  (`displayItemTitle`, `channelTitle`). Siblings: `Mobile/MediaPlayerInfoMobile.tsx`,
  `Modal/MediaPlayerInfoModal.tsx`. Styles under
  `apps/web/src/styles/components/MediaPlayer/`.
- No marquee component exists in `apps/web/src` or `packages/ui/src`. Shared UI placement follows
  `.cursor/rules/prefer-shared-ui-web-management.mdc`.
- Mobile parity source:
  - `apps/mobile/src/components/primitives/MarqueeText.tsx`: one label per string, keyed on the
    string so a new title starts fresh; `align`, `restInset`, `turnGroup`, `turnOrder`.
  - `apps/mobile/src/lib/text/marqueeScroll.ts`: scrolls only when the text overflows by more than
    1 unit; speed 28 per second; rests 2.5 seconds on the first word before every pass; loops with
    a gap of `spacing['2xl']`; Reduce Motion never scrolls and the label truncates instead.
  - `apps/mobile/src/lib/text/marqueeTurns.ts` and `apps/mobile/src/hooks/useMarqueeTurn.ts`: one
    label per group moves at a time, in turn order, handing off after each pass. Groups are
    `full-player` and `mini-player`.
  - Where mobile uses it: `MiniPlayer.tsx` title (`mini-player`, order 0) and
    `NowPlayingSegmentBar.tsx` segment title (`mini-player`, order 1);
    `apps/mobile/src/screens/player/FullPlayerScreen.tsx` title link (`full-player`, order 0) and
    `FullPlayerSegmentBand.tsx` segment title (`full-player`, order 1).
- Web equivalent of Reduce Motion: the `prefers-reduced-motion` media query.

## Likely areas

Non-binding; the Split step decides the areas, waves, and plan files.

- **A. Marquee component:** the web marquee and its turn groups, with Reduced Motion handling,
  unit tests, and a placement decision (`apps/web` or `packages/ui`).
- **B. Player bar:** one line per text value, desktop and mobile web.
- **C. Full-size player:** title and subtitle lines, keeping their links, plus any segment or
  chapter title the web player shows where mobile scrolls one.
- **D. E2E:** Playwright screenshot coverage of the bar and the full-size player with a long title.
