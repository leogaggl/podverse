**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 20 — Player bar title and channel each scroll on one line

The bottom player bar, desktop and the narrow layout, keeps its two text lines. Each line becomes one line that scrolls when it overflows, using `MarqueeText` from plan 11. The title line shows the episode or track title. A chapter, clip, or official clip title moves to the segment strip above the bar (plan 21). The strings come from `getMediaPlayerInfoResolution`, unchanged.

## Rows

R7, R8, R13, R22, R23

## Runs after

11

## Files

apps/web/src/components/MediaPlayer/Desktop/MediaPlayerInfoDesktop.tsx
apps/web/src/components/MediaPlayer/Mobile/MediaPlayerInfoMobile.tsx
apps/web/src/styles/components/MediaPlayer/Desktop/MediaPlayerInfoDesktop.module.scss
apps/web/src/styles/components/MediaPlayer/Mobile/MediaPlayerInfoMobile.module.scss

Read only, do not edit:

- `apps/web/src/utils/mediaPlayer/mediaPlayerInfoResolution.ts` (`getMediaPlayerInfoResolution`)
- `apps/web/src/constants/mediaPlayerMarquee.ts` (plan 11 creates it)
- `packages/ui` `MarqueeText`

Plan 21 edits the parents of these components (`MediaPlayerDesktop.tsx`, `MediaPlayerMobile.tsx`) to mount the segment strip. This plan does not touch those files, so the two plans run at the same time.

## Title line: `itemTitle`, not `displayItemTitle`

`getMediaPlayerInfoResolution` already returns both:

- `itemTitle`: the episode or track title (add-by-RSS `resourceData.title`, else the VTS like target's title, else `mpItem.title`). A chapter, clip, or soundbite never replaces it.
- `displayItemTitle`: `subsectionTitle ?? itemTitle`. A chapter, clip, or soundbite title replaces the item title.

The bar reads `displayItemTitle` today. Switch it to `itemTitle`. The full-size player (`MediaPlayerInfoModal`) already reads `itemTitle` for its title, so the bar and the full-size player name the same item.

Leave the resolver file alone, including `displayItemTitle` and its doc comment. `EmbedPlayerInfo` still reads `displayItemTitle` for its title line.

R9 answer, for the ledger: today the bar shows a chapter, clip, or soundbite title by swapping it into the title line. After this set it shows that title on the strip above the bar instead (plan 21). This plan and plan 21 ship together: without plan 21 the bar would stop naming the segment.

Keep `useMediaPlayerCurrentTime` and the `getMediaPlayerInfoResolution` call as they are. Nothing on the bar lines reads the playhead any more, but the call signature needs `currentTimeSeconds`, and removing the hook would reshape both files on the `artist-album-attribution` branch.

## Steps

Apply the same swap in `MediaPlayerInfoDesktop.tsx` and `MediaPlayerInfoMobile.tsx`. Keep the two components separate. They already duplicate this block, and an extracted wrapper would reshape both files on the `artist-album-attribution` branch.

1. Change the title line from `displayItemTitle` to `itemTitle`. The subtitle line is unchanged:

```ts
const title = hasContent ? (infoResolution.itemTitle ?? tMisc('untitled')) : '';
const subtitle = hasContent ? (infoResolution.channelTitle ?? tMisc('untitled')) : '';
```

2. Import `MarqueeText` from `@podverse/ui` on the existing `ImageNonReact` line. Import `MEDIA_PLAYER_MARQUEE_TURN_GROUP` and `MEDIA_PLAYER_MARQUEE_TURN_ORDER` from `../../../constants/mediaPlayerMarquee`, next to the `IMAGES` import. Styles stay the last import.

3. Replace the two divs inside `styles.textSection`. Pass the existing `title` and `subtitle` strings as `children`. Do not pass `align` (the default is left, and `.textSection` is `text-align: left`). Do not pass `restInset`. Both lines use `MEDIA_PLAYER_MARQUEE_TURN_GROUP.playerBar`. The title uses `MEDIA_PLAYER_MARQUEE_TURN_ORDER.playerBar.title` (0). The channel line uses `MEDIA_PLAYER_MARQUEE_TURN_ORDER.playerBar.channel` (2). Order 1 is the segment strip (plan 21), so the bar group turns go title, strip, channel.

Desktop:

```tsx
<div className={styles.textSection}>
  <MarqueeText
    className={styles.title}
    data-testid="media-player-bar-title-desktop"
    turnGroup={MEDIA_PLAYER_MARQUEE_TURN_GROUP.playerBar}
    turnOrder={MEDIA_PLAYER_MARQUEE_TURN_ORDER.playerBar.title}
  >
    {title}
  </MarqueeText>
  <MarqueeText
    className={styles.subtitle}
    data-testid="media-player-bar-subtitle-desktop"
    turnGroup={MEDIA_PLAYER_MARQUEE_TURN_GROUP.playerBar}
    turnOrder={MEDIA_PLAYER_MARQUEE_TURN_ORDER.playerBar.channel}
  >
    {subtitle}
  </MarqueeText>
</div>
```

Mobile is the same with `data-testid="media-player-bar-title-mobile"` and `data-testid="media-player-bar-subtitle-mobile"`.

Both variants stay mounted (`MediaPlayer.tsx` renders `MediaPlayerDesktop` and `MediaPlayerMobile`). CSS hides one: `.playerDesktop` is `display: none` at `max-width: 991px`, `.playerMobile` at `min-width: 992px`. They share `playerBar`. The hidden variant's box width is 0, which plan 11 treats as `measuring`, so it does not take a turn. Do not give them different groups.

The surrounding `<button>` stays the control that opens the full-size player (`setPlayerModalIsOpen(true)`), with its existing `aria-description`. `MarqueeText` renders spans, so it stays valid inside that button. The bar lines are not links.

Render both labels even when `title` or `subtitle` is `''` (no channel and no add-by-RSS item). That matches the empty divs there today.

4. Desktop SCSS, `MediaPlayerInfoDesktop.module.scss`:

- Delete `@use '../../../mixins/lineClamp' as *;`. Nothing else in the file uses it.
- `.info`: add `min-width: 0` so the `flex: 0 0 28%` slot stays 28% when the title is long.
- `.button`: add `min-width: 0`.
- `.textSection`: add `flex: 1`, `min-width: 0`, and `overflow: hidden`. Keep the column, `justify-content`, margin, `text-align`, and `gap`.
- `.title`: delete the `line-clamp(2)` include. Keep `font-weight: var(--font-weight-light)`.
- `.subtitle`: delete the `line-clamp(2)` include. Keep font size, weight, and accent color.

5. Mobile SCSS, `MediaPlayerInfoMobile.module.scss`: the same edits, including deleting the `lineClamp` use. `.info` already has `flex: 1`; add `min-width: 0` there too. Keep `gap: 0.375rem` and its comment. `.title` and `.subtitle` lose `line-clamp(1)` and keep their typography.

Do not set `white-space`, `display`, `width`, `overflow`, `text-overflow`, `line-clamp`, or `-webkit-box` on `.title` or `.subtitle`. Those classes carry typography only. `MarqueeText` owns the line and the overflow.

Leave image sizes, the 28% desktop slot, the mobile `flex: 1`, colors, and the player bar heights alone. The desktop lines go from a two-line clamp to one line each. The narrow layout was already one line and gains the scroll.

## What must stay true

- `getMediaPlayerInfoResolution` and its file are unchanged.
- The title line always shows the episode or track title, including while a chapter, clip, or soundbite is active. The bar keeps two lines; the segment title is on the strip (plan 21).
- The button still opens the full-size player. No new link, label, or catalog string in this plan.
- A line that fits does not scroll. A line that overflows scrolls in the `player-bar` group: title, then the strip, then the channel line. `prefers-reduced-motion: reduce` truncates and does not scroll (plan 11).

## Tests

No unit test and no API test. The swap adds no branch, and `mediaPlayerInfoResolution.test.ts` already asserts that `itemTitle` stays the episode title while a chapter is active ("keeps itemTitle as base episode title when an active chapter has a subsection title"). Playwright coverage is plans 40–49 (R14). This plan only adds the ids that spec uses:

| id | line | layout |
| --- | --- | --- |
| `media-player-bar-title-desktop` | `itemTitle` | desktop, visible at `min-width: 992px` |
| `media-player-bar-subtitle-desktop` | `channelTitle` | desktop |
| `media-player-bar-title-mobile` | `itemTitle` | narrow, visible at `max-width: 991px` |
| `media-player-bar-subtitle-mobile` | `channelTitle` | narrow |

`data-marquee-layout` is on that same element (`measuring`, `fit`, or `scroll`).

Existing specs that call `expectMediaPlayerTitleVisible` with a chapter or clip title (`media-player-chapter-seek.spec.ts` with `Topic A` and `Intro`, `media-player-clip-soundbite-end-pause.spec.ts` with the clip and soundbite titles) keep passing. The helper searches all of `aside#media-player`, and the strip from plan 21 shows those titles there. `expectMediaPlayerTitleAbsent` after a clip ends still passes, because the strip clears when `mpClip` clears, which is the same condition that cleared `displayItemTitle`.

## Release scratchpad

```markdown
## Player bar titles scroll on one line

- Surfaces: web
- Change: The bottom player bar, on wide and narrow windows, shows the title and the channel name on one line each. A line wider than its space scrolls, rests, and repeats. Reduced motion keeps the ellipsis and does not scroll. The first line always shows the episode or track title. A chapter, clip, or official clip title no longer replaces it there; it appears on the new strip above the bar.
- Who notices: listeners using the web player bar
- Operator steps: none
```
