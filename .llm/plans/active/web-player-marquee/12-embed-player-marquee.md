**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 12 — Embed player lines scroll with `MarqueeText`

The embed player shows a title line and a channel line in `EmbedPlayerInfo`, and the video
(responsive) layout adds a segment strip, `EmbedSegmentInfoBar`, naming the active chapter, clip,
or soundbite beside its time range. All three end in an ellipsis today. Each becomes a
`MarqueeText` from `@podverse/ui` (plan 11), so a long string stays on one line and scrolls when
it overflows, in the `embedPlayer` turn group. The segment strip is the closest web match to
mobile's `NowPlayingSegmentBar`, and it mirrors that strip's full-bleed clip with a rest inset.

## Rows

R15

## Runs after

11

## Files

apps/web/src/components/embed/EmbedPlayerInfo.tsx
apps/web/src/components/embed/EmbedSegmentInfoBar.tsx
apps/web/src/styles/components/embed/EmbedPlayerInfo.module.scss
apps/web/src/styles/components/embed/EmbedSegmentInfoBar.module.scss

## What is true today (checked at planning time)

- `EmbedPlayerPanel` renders one of two layouts, chosen by `playerSize`
  (`?player=compact|responsive`, else from the presentation or media type, see
  `apps/web/src/lib/embed/parseEmbedQueryParams.ts`):
  - **Compact:** one `EmbedPlayerInfo` with `preferItemTitle` false. While a chapter is active
    (`resolveEmbedPrimaryTitle` returns `allowTitleToggle: true`), the text renders inside the
    `embed-title-toggle` button and the title line shows the chapter title. Otherwise it renders
    in `styles.textStack`. There is no segment strip in this layout.
  - **Responsive:** `EmbedResponsiveStage` mounts `EmbedResponsiveInfoOverlay`, which renders
    `EmbedPlayerInfo` with `variant="overlay"` and `preferItemTitle` true, so it always uses the
    `textStack` branch and the title line shows the item, clip, or soundbite title. It also mounts
    `EmbedSegmentInfoBar`, which renders only while `resolveEmbedActiveSegmentInfo` returns a
    segment. Both overlays hide with `opacity: 0` (`.overlayHidden`) while playing without hover
    or focus; they keep their size.
- Only one `EmbedPlayerInfo` is mounted at a time, so the `embedPlayer` group holds at most a
  title, a channel line, and a segment title.
- `EmbedPlayerInfo` renders the channel line as
  `<span className={styles.channelTitle} data-testid="embed-channel-title">` in both branches.
  The title line is `<span className={styles.title}>` inside `styles.titleRow`, after the
  optional `EmbedLiveItemStatus` and the optional `FaListOl` chapter icon
  (`embed-chapter-title-icon`). Only the `textStack` branch's title has a test id, `embed-title`.
- `EmbedPlayerInfo.module.scss`: `.channelTitle` and `.title` each `@include
  ellipsisSingleLineChild`. `.meta` and `.publishDateBadge` use the same mixin.
- `EmbedSegmentInfoBar.module.scss`: `.segmentBar` is a flex row with
  `padding-inline: var(--spacing-lg)`. `.title` sets `overflow: hidden`, `text-overflow:
  ellipsis`, and `white-space: nowrap`. The title span has no test id.
- Existing specs: `embedTitleLocator` in `apps/web/e2e/helpers/embedAssertions.ts` is
  `getByTestId('embed-title-toggle').or(getByTestId('embed-title'))`, used with `toContainText`.
  `embed-routes.spec.ts` clicks `embed-channel-title` to toggle the title.
  `embed-responsive-player.spec.ts` and `embed-clip-soundbite-end.spec.ts` check
  `embed-segment-info-bar`. `toContainText` reads `textContent`, which includes the scrolling
  label's hidden second copy, so these keep passing.

## Turn group and orders

From `apps/web/src/constants/mediaPlayerMarquee.ts` (plan 11):

| Line | Group | Order |
| --- | --- | --- |
| title line (both branches) | `MEDIA_PLAYER_MARQUEE_TURN_GROUP.embedPlayer` | `MEDIA_PLAYER_MARQUEE_TURN_ORDER.embedPlayer.title` |
| segment title | `MEDIA_PLAYER_MARQUEE_TURN_GROUP.embedPlayer` | `MEDIA_PLAYER_MARQUEE_TURN_ORDER.embedPlayer.segment` |
| channel line (both branches) | `MEDIA_PLAYER_MARQUEE_TURN_GROUP.embedPlayer` | `MEDIA_PLAYER_MARQUEE_TURN_ORDER.embedPlayer.channel` |

The responsive layout therefore runs title, segment, channel, the same order as the player bar
and as mobile's mini player (title, then segment strip). The compact layout runs title, then
channel.

## `EmbedPlayerInfo.tsx`

1. Imports:
   - `import { ImageNonReact } from '@podverse/ui';` becomes
     `import { ImageNonReact, MarqueeText } from '@podverse/ui';`.
   - Add
     `import { MEDIA_PLAYER_MARQUEE_TURN_GROUP, MEDIA_PLAYER_MARQUEE_TURN_ORDER } from '../../constants/mediaPlayerMarquee';`
     directly after `import { IMAGES } from '../../constants/images';`.
1. Channel line, in both branches: replace the `embed-channel-title` span with

   ```tsx
   <MarqueeText
     className={styles.channelTitle}
     data-testid="embed-channel-title"
     turnGroup={MEDIA_PLAYER_MARQUEE_TURN_GROUP.embedPlayer}
     turnOrder={MEDIA_PLAYER_MARQUEE_TURN_ORDER.embedPlayer.channel}
   >
     {channelTitle}
   </MarqueeText>
   ```

   The surrounding `channelTitle !== null && channelTitle !== ''` check narrows `channelTitle` to
   `string`, so no conversion is needed.
1. Title line in the toggle branch (inside `embed-title-toggle`): replace
   `<span className={styles.title}>{itemTitle}</span>` with a `MarqueeText` carrying
   `className={styles.title}`, `data-testid="embed-title-toggle-title"`, the `embedPlayer` group,
   and `MEDIA_PLAYER_MARQUEE_TURN_ORDER.embedPlayer.title`. Do **not** reuse `embed-title` here:
   `embedTitleLocator` would then match two elements inside the toggle state and fail
   Playwright's strict mode.
1. Title line in the `textStack` branch: replace the `embed-title` span with a `MarqueeText`
   carrying `className={styles.title}`, `data-testid="embed-title"`, the `embedPlayer` group, and
   `MEDIA_PLAYER_MARQUEE_TURN_ORDER.embedPlayer.title`.
1. Pass no `align` (left is the default and matches today) and no `restInset` on any of these
   three. The live status and chapter icon are flex siblings in `.titleRow`, and the row's gap
   keeps the label clear of them; the label's clip edge is beside the icon, as on mobile when a
   segment icon is shown.
1. Change nothing else: not the branch condition, the toggle handler, the publish date slot, the
   artwork, or how `itemTitle` and `channelTitle` are resolved.

## `EmbedPlayerInfo.module.scss`

1. `.channelTitle`: remove `@include ellipsisSingleLineChild;`. Keep `color`, `display: block`,
   and `font-size`.
1. `.title`: remove `@include ellipsisSingleLineChild;`. Keep `color`, `display: block`,
   `flex: 1 1 auto`, `font-size`, `font-weight`, and `min-width: 0`.
1. `.titleRow`: add `width: 100%;`. In the toggle button (a column flex with
   `align-items: flex-start`) the row would otherwise size to its content, and the label measures
   its box from the row. With the row at full width, a short title still rests at the left edge.
1. Keep the `@use '../../mixins/ellipsis' as *;` line; `.meta` and `.publishDateBadge` still use
   the mixin.

## `EmbedSegmentInfoBar.tsx`

1. Imports: add `import { MarqueeText } from '@podverse/ui';` directly after
   `import { formatHHMMSS } from '@podverse/helpers';`, and add
   `import { MEDIA_PLAYER_MARQUEE_TURN_GROUP, MEDIA_PLAYER_MARQUEE_TURN_ORDER } from '../../constants/mediaPlayerMarquee';`
   directly before `import { useMediaPlayer } from '../../contexts/MediaPlayer';`.
1. Replace `<span className={styles.title}>{segmentInfo.title}</span>` with

   ```tsx
   <MarqueeText
     className={styles.title}
     data-testid="embed-segment-info-title"
     restInset="var(--spacing-lg)"
     turnGroup={MEDIA_PLAYER_MARQUEE_TURN_GROUP.embedPlayer}
     turnOrder={MEDIA_PLAYER_MARQUEE_TURN_ORDER.embedPlayer.segment}
   >
     {segmentInfo.title}
   </MarqueeText>
   ```

   `segmentInfo.title` is typed `string` (`resolveEmbedActiveSegmentInfo`).
1. Leave the time range span, `formatSegmentTimeRange`, and the `embed-segment-info-bar` test id
   as they are.

## `EmbedSegmentInfoBar.module.scss`

1. `.segmentBar`: `padding-inline: var(--spacing-lg);` becomes
   `padding-inline: 0 var(--spacing-lg);`. The title clips at the strip's left edge, and its
   `restInset` puts the resting first word exactly where the padding put it, so a still title
   does not move. A scrolling title's glyphs leave at the strip edge instead of one gutter in,
   which is how mobile's `NowPlayingSegmentBar` clips. The time range keeps its right padding.
1. `.title`: remove `overflow: hidden;`, `text-overflow: ellipsis;`, and `white-space: nowrap;`.
   Keep `color`, `flex: 1 1 auto`, `font-size`, and `min-width: 0`.
1. `.timeRange` is unchanged.

## Behavior after this plan

- **Fits:** each line rests still at the left, as today.
- **Overflows:** a line rests on its first word for 2.5 s, scrolls at 28 px/s with a seamless
  loop, then hands the turn to the next overflowing line in the embed's order. One line moves at
  a time.
- **New string:** a chapter change, the title toggle, or a clip or soundbite ending swaps the
  string, and the label starts fresh at its first word.
- **Hidden overlay:** the responsive overlays fade to `opacity: 0` while playing, and their labels
  keep their size, so the rotation continues while they are faded. Showing them again shows the
  rotation wherever it is.
- **Hover:** hovering a scrolling line pauses it (plan 11). The info overlay already stops click
  propagation, so a click on a line does not toggle playback.
- **Reduced motion:** every line stays still and ends in an ellipsis, as today.
- **Accessibility:** the toggle button's accessible name is still its visible text (channel, title,
  date), since `MarqueeText` exposes one copy. The segment strip reads its title and time range,
  as today.

## Parity with mobile

Mobile has no embed player. The responsive layout matches mobile's mini player: the title and the
segment strip scroll in one group, title first, and the segment strip clips full-bleed with a
rest inset. Web also scrolls the embed's channel line, as it does in the player bar and the
full-size player.

## Tests

- No unit test. Neither component has a component test, and the scroll, turn, inset, and
  reduced-motion behavior is unit-tested on `MarqueeText` in plan 11. This plan wires strings,
  test ids, and constants.
- Playwright coverage is in plans 40–49, through these test ids, each on the `MarqueeText` root
  that carries `data-marquee-layout`:
  - `embed-title`: title line in the `textStack` branch (compact with no active chapter, and the
    responsive overlay)
  - `embed-title-toggle-title`: title line inside `embed-title-toggle` (compact while a chapter
    is active)
  - `embed-channel-title`: channel line in either branch
  - `embed-segment-info-title`: segment title in the responsive layout while a segment is active
- Existing specs that must keep passing unchanged: `apps/web/e2e/embed-routes.spec.ts`,
  `apps/web/e2e/embed-clip-soundbite-end.spec.ts`, `apps/web/e2e/embed-responsive-player.spec.ts`,
  and `apps/web/e2e/embed-share-builder.spec.ts`. Do not edit them or
  `apps/web/e2e/helpers/embedAssertions.ts` in this plan.

## Release scratchpad

```markdown
## Embed player titles scroll instead of truncating

- Surfaces: web (embed player)
- Change: in the embed player, the title line, the podcast or artist line, and the chapter, clip,
  or soundbite strip on the video layout each stay on one line. A line too long for the space
  scrolls horizontally after a 2.5 second rest on its first word, then hands off to the next long
  line, one line at a time. Short lines stay still. Hovering a scrolling line pauses it. With
  reduced motion turned on, long lines stay still and end in an ellipsis.
- Who notices: listeners using embedded players on other sites, with long episode, podcast, or
  chapter titles
- Operator steps: none
```
