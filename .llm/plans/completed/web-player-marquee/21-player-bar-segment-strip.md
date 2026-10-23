**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 21 — Segment strip above the web player bar

A slim strip sits directly above the bottom player bar, on the desktop bar and on the narrow (mobile web) bar. It names the chapter, clip, or official clip that is playing, and it renders only while one is active. It has a leading icon for a clip or an official clip, an accessible label such as "Chapter: Introduction", and a `MarqueeText` title that takes turn 1 in the player bar group. Plan 20 makes the bar's title line show the episode or track title, so the segment title lives here and nowhere else on the bar.

Parity source: `apps/mobile/src/components/player/NowPlayingSegmentBar.tsx`, with `apps/mobile/src/components/player/nowPlayingSegmentIcon.ts`, `apps/mobile/src/components/player/nowPlayingSegmentStripPresence.ts`, and `apps/mobile/src/theme/bottomChromeStrip.ts`.

## Rows

R9, R17, R18, R19, R20, R21, R22

## Runs after

11

## Files

apps/web/src/utils/mediaPlayer/mediaPlayerSegmentStrip.ts
apps/web/src/utils/mediaPlayer/mediaPlayerSegmentStrip.test.ts
apps/web/src/components/MediaPlayer/SegmentStrip/MediaPlayerSegmentStrip.tsx
apps/web/src/components/MediaPlayer/SegmentStrip/mediaPlayerSegmentStripPresence.ts
apps/web/src/components/MediaPlayer/SegmentStrip/mediaPlayerSegmentStripPresence.test.ts
apps/web/src/styles/components/MediaPlayer/SegmentStrip/MediaPlayerSegmentStrip.module.scss
apps/web/src/components/MediaPlayer/Desktop/MediaPlayerDesktop.tsx
apps/web/src/components/MediaPlayer/Mobile/MediaPlayerMobile.tsx
apps/web/src/components/MediaPlayer/MediaPlayer.tsx
apps/web/src/utils/mediaPlayer/mediaPlayerLayout.ts
apps/web/src/styles/globals/pageAdjust.scss
apps/web/src/components/MediaPlayer/Controller/Video/MediaPlayerVideoPortalFloating.tsx
apps/web/src/components/MediaPlayer/Controller/LiveStream/MediaPlayerLivestreamVideoPortalFloating.tsx
apps/web/e2e/media-player-floating-video-default.spec.ts
packages/i18n-catalog/consumer/originals/en-US.json
packages/i18n-catalog/consumer/originals/es.json
packages/i18n-catalog/consumer/originals/fr.json
packages/i18n-catalog/consumer/originals/el-GR.json

Read only, do not edit:

- `apps/web/src/utils/mediaPlayer/mediaPlayerInfoResolution.ts` (`getMediaPlayerInfoResolution`, `resolveSubsection`)
- `apps/web/src/components/MediaPlayer/Desktop/MediaPlayerInfoDesktop.tsx` and `apps/web/src/components/MediaPlayer/Mobile/MediaPlayerInfoMobile.tsx` (plan 20 edits them; this plan mounts the strip beside them, in their parents)
- `apps/web/src/constants/mediaPlayerMarquee.ts` (plan 11 creates it)
- `packages/ui` `MarqueeText` (plan 11)
- The floating video SCSS files. Their `.hasMarquee` rules already exist and need no edit.

## What is true today (checked at planning time)

- **No strip on the web bar.** `MediaPlayerDesktop` renders `.playerDesktop` > `.bottomSection` (info, controls, buttons). `MediaPlayerMobile` renders `.playerMobile` > `.infoSection` plus `MediaPlayerControlsMobile`. Both roots are already `position: relative`. Both stay mounted; CSS hides one (`.playerDesktop` at `max-width: 991px`, `.playerMobile` at `min-width: 992px`).
- **The page has no room to grow.** `#page-wrapper` and `#sidebar` get a fixed height of the viewport minus the bar (`pageAdjust.scss`, toggled by `updateLayoutForMediaPlayer` in `mediaPlayerLayout.ts`). `WindowWrapper` is `overflow: hidden` at the viewport height. A strip placed in flow would push the bar's bottom off screen. The page scroller is `#mainOuterWrapper` (`MainPageScaffold`, a flex column with `overflow-y: auto`); no web page overrides its id.
- **A strip height already exists.** `--media-player-height-top-section: 28px` (`packages/ui/src/styles/_variables-root.scss`). `BackgroundActivityOverlay` already sits that far above the bar. Both floating video portals' SCSS already has `.floatingVideoPortal.hasMarquee`, which raises the portal by that height, but no TSX applies the class.
- **The scrub preview is the playhead on web.** `MediaPlayerProgress` mouse drag calls `seek(newTime)` and `setMPCurrentTime(newTime)` on every move (`setProgressFromEvent`). Anything that resolves from `mpCurrentTime` follows the drag before the media element seeks. Hovering the bar shows `ChapterProgressTooltip` and does not change `mpCurrentTime`; hover is a preview of where a click would land, not a scrub.
- **The resolver already knows the segment title.** `getMediaPlayerInfoResolution` returns `subsectionTitle`, from `resolveSubsection`: the clip title when `mpClip` is set, else the soundbite title when `mpItemSoundbite` is set, else the active chapter title (`pickActiveChapter`, which reads `mpCurrentTime`), else null. A clip or soundbite with no title yields null and does not fall through to a chapter. It does not return which kind won.
- **Catalog.** `consumer/originals/*.json` has `media_player.now_playing_clip`, `now_playing_chapter`, and `now_playing_official_clip` ("Now Playing Chapter"), which mobile uses as `"<label>: <title>"`. The request wants "Chapter: <title>", so this plan adds three new keys.
- **Floating video spec.** `media-player-floating-video-default.spec.ts` plays `e2eEmbVidItem01`. That item has seeded chapters (`seedEmbedItemChapters(..., buildEmbedItemChapterRows('embSmpChpV'))` in `tools/web/seed-embed-fixtures.mjs`), the first from 0 to 20 seconds. Chapter selection is suppressed only at time 0 (`shouldSuppressChapterSelectionAtTime`), so once playback moves the strip shows "Introduction" and the portal rises. The spec's `bottom: 101px` expectation must change.

## Design

### Placement: the strip overlaps the page, as on mobile

The strip is absolutely positioned above its bar, inside `.playerDesktop` and `.playerMobile`. It does not change the height of `#media-player`, `#page-wrapper`, or `#sidebar`. This mirrors mobile, where the bottom chrome stack overlaps the scene without changing its height (**mobile-sync-orchestration**).

Two consequences are handled here:

1. **Page bottom spacer.** While the strip shows, `#page-wrapper` gets the class `media-player-segment-strip-active`, and `#mainOuterWrapper` gets a trailing spacer the strip's height, so the last row scrolls clear of the strip. Mobile does the same with its bottom spacer. The sidebar needs none: its `.scrollable` has `padding-bottom: var(--spacing-4xl)` (32px), more than the strip's 28px.
2. **Floating video.** While the strip shows, both floating video portals add their existing `hasMarquee` class, so the default position sits on top of the strip instead of covering it. A portal the listener has dragged keeps its own `top` and `left` (`useFloatingVideoTransform` sets `bottom: 'auto'`), so the class does not move it.

`BackgroundActivityOverlay` already reserves the strip's height. Leave it.

### Visibility, kind, and title

Resolve from `getMediaPlayerInfoResolution(...).subsectionTitle`, called with the same arguments the info components pass, so the strip, the bar, and the full-size player agree on the active segment. Do not edit the resolver.

The kind follows `resolveSubsection`'s branch order: `mpClip !== null` → `'clip'`; else `mpItemSoundbite !== null` → `'official-clip'`; else `'chapter'`. Kind names match mobile's `NowPlayingSegmentKind`.

The strip renders `null` when nothing is playing (`mpChannel === null && mpAddByRSS === null`), when `subsectionTitle` is null, or when it is blank after `trim()`. Mobile's `named()` also hides an empty title.

Because the chapter title comes from `mpCurrentTime`, the strip follows a progress-bar drag frame by frame (R21). There is no separate preview state on web, so add none.

### Look (parity with `NowPlayingSegmentBar`)

| Mobile | Web |
| --- | --- |
| height `bottomChromeStripHeight` | `height: var(--media-player-height-top-section)` (28px), `box-sizing: border-box` |
| `background.tertiary`, hairline top border | `background-color: var(--background-color-tertiary)`, `border-top: 1px solid var(--border-color-opaque)` |
| `paddingHorizontal: 0` (full-bleed clip) | no horizontal padding |
| row, `gap: spacing.md`, centered vertically | `display: flex`, `align-items: center`, `gap: var(--spacing-md)` |
| icon 14, `marginLeft: spacing.lg`, `textSecondary` | icon `font-size: var(--font-size-sm)` (14px), `margin-left: var(--spacing-lg)`, `color: var(--text-color-secondary)` |
| label body size, `textSecondary` | `font-size: var(--font-size-sm)`, `font-weight: var(--font-weight-normal)`, `color: var(--text-color-secondary)` |
| title slot `flex: 1`, `minWidth: 0` | `flex: 1`, `min-width: 0` |
| tablet: centered, `maxWidth: breakpoints.lg` | full width of the bar (the web bar already spans the window) |

Leading icon (R19), exhaustive switch like mobile's `nowPlayingSegmentLeadingIcon`:

| kind | icon | `MarqueeText` |
| --- | --- | --- |
| `chapter` | none (mobile shows none; the bookmark is left out) | `align="center"`, `restInset="var(--spacing-lg)"` |
| `clip` | `FaScissors` from `react-icons/fa6` (the icon `ClipButton` already uses) | `align="left"`, no `restInset` |
| `official-clip` | `FaMicrophone` from `react-icons/fa6` (mobile uses `mic-outline`) | `align="left"`, no `restInset` |

This is plan 11's `restInset` contract. With no icon, the resting first word sits one gutter in from the strip edge and the scrolling glyphs leave at the edge itself. With an icon, the icon's margin and the row gap keep the label clear of it, and the clip edge is beside the icon.

### Marquee turn (R22)

`turnGroup={MEDIA_PLAYER_MARQUEE_TURN_GROUP.playerBar}`, `turnOrder={MEDIA_PLAYER_MARQUEE_TURN_ORDER.playerBar.segment}` (1). The bar title is 0 and the channel line is 2 (plan 20). The hidden variant measures 0 and never takes a turn (plan 11).

### Accessibility (R20)

The strip is not interactive and has no role. Its visible content (icon and `MarqueeText`) sits in an `aria-hidden="true"` row. A visually hidden span after that row carries the full label from the catalog, for example "Chapter: Introduction". Screen readers read one phrase in every browse mode, word order stays per locale, and it matches mobile's `accessibilityLabel`. No live region: mobile does not announce segment changes either.

New catalog keys, in `consumer/originals/*.json` under `media_player`, inserted right after `now_playing_official_clip` (each file has it near line 428). Keep `{title}` identical in every locale.

| key | en-US | es | fr | el-GR |
| --- | --- | --- | --- | --- |
| `segment_strip_chapter` | `Chapter: {title}` | `Capítulo: {title}` | `Chapitre : {title}` | `Κεφάλαιο: {title}` |
| `segment_strip_clip` | `Clip: {title}` | `Clip: {title}` | `Extrait : {title}` | `Απόσπασμα: {title}` |
| `segment_strip_official_clip` | `Official Clip: {title}` | `Clip oficial: {title}` | `Extrait officiel : {title}` | `Επίσημο απόσπασμα: {title}` |

Do not edit `overrides/` or `compiled/`.

### Presence store

The strip's title changes with the playhead, but whether it shows changes only when a segment appears or clears. The page spacer and the floating portals read a presence store, so they re-render on show and hide only, never on a playhead tick. This ports `nowPlayingSegmentStripPresence.ts`.

Web mounts two strips (desktop and mobile), and both compute the same answer. The store keeps a set of visible instance ids, so one strip unmounting cannot clear the other's state.

## Steps

### 1. `apps/web/src/utils/mediaPlayer/mediaPlayerSegmentStrip.ts`

```ts
import type { DTOClip, DTOItemSoundbite } from '@podverse/helpers';

export type MediaPlayerSegmentKind = 'chapter' | 'clip' | 'official-clip';

export type MediaPlayerSegmentStripSegment = {
  kind: MediaPlayerSegmentKind;
  title: string;
};

/**
 * The segment the strip above the player bar names, or `null` when the whole item is playing.
 * `subsectionTitle` comes from `getMediaPlayerInfoResolution`; the kind follows the same
 * precedence (clip, then official clip, then chapter).
 */
export const resolveMediaPlayerSegmentStripSegment = ({
  hasContent,
  mpClip,
  mpItemSoundbite,
  subsectionTitle,
}: {
  hasContent: boolean;
  mpClip: DTOClip | null;
  mpItemSoundbite: DTOItemSoundbite | null;
  subsectionTitle: string | null;
}): MediaPlayerSegmentStripSegment | null => {
  if (!hasContent) {
    return null;
  }
  const title = subsectionTitle?.trim() ?? '';
  if (title === '') {
    return null;
  }
  const kind: MediaPlayerSegmentKind =
    mpClip !== null ? 'clip' : mpItemSoundbite !== null ? 'official-clip' : 'chapter';
  return { kind, title };
};

/** `media_player` catalog key for the strip's accessible label (`{title}` interpolated). */
export const mediaPlayerSegmentStripLabelKey = (
  kind: MediaPlayerSegmentKind
): 'segment_strip_chapter' | 'segment_strip_clip' | 'segment_strip_official_clip' => {
  switch (kind) {
    case 'chapter':
      return 'segment_strip_chapter';
    case 'clip':
      return 'segment_strip_clip';
    case 'official-clip':
      return 'segment_strip_official_clip';
  }
};
```

Import types on their own `import type` line (**type-imports-separate-line**).

### 2. `apps/web/src/components/MediaPlayer/SegmentStrip/mediaPlayerSegmentStripPresence.ts`

```ts
import { useSyncExternalStore } from 'react';

/**
 * Whether a segment strip is showing above the player bar. The strip's title follows the
 * playhead, but this only changes when a segment appears or clears, so the page spacer and the
 * floating video read it without re-rendering on every tick. Desktop and mobile web each mount a
 * strip, so the store tracks instances and is visible while any one of them is.
 */
type Listener = () => void;

const visibleInstanceIds = new Set<string>();
const listeners = new Set<Listener>();

const emit = (): void => {
  listeners.forEach((listener) => {
    listener();
  });
};

export const getMediaPlayerSegmentStripVisible = (): boolean => visibleInstanceIds.size > 0;

export const subscribeMediaPlayerSegmentStrip = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const setMediaPlayerSegmentStripVisible = (instanceId: string, visible: boolean): void => {
  const wasVisible = getMediaPlayerSegmentStripVisible();
  if (visible) {
    visibleInstanceIds.add(instanceId);
  } else {
    visibleInstanceIds.delete(instanceId);
  }
  if (getMediaPlayerSegmentStripVisible() !== wasVisible) {
    emit();
  }
};

const getServerSnapshot = (): boolean => false;

export function useMediaPlayerSegmentStripVisible(): boolean {
  return useSyncExternalStore(
    subscribeMediaPlayerSegmentStrip,
    getMediaPlayerSegmentStripVisible,
    getServerSnapshot
  );
}
```

### 3. `apps/web/src/components/MediaPlayer/SegmentStrip/MediaPlayerSegmentStrip.tsx`

- `'use client'`. Props: `{ variant: 'desktop' | 'mobile' }`. Named export `MediaPlayerSegmentStrip`.
- Read `mpChannel`, `mpItem`, `mpAddByRSS`, `mpItemChapter`, `mpItemChapters`, `mpClip`, `mpItemSoundbite` from `useMediaPlayer()`, and `mpCurrentTime` from `useMediaPlayerCurrentTime()`.
- Call `getMediaPlayerInfoResolution({ mpChannel, mpItem, mpAddByRSS, mpClip, mpItemSoundbite, mpItemChapter, mpItemChapters, currentTimeSeconds: mpCurrentTime })` and pass its `subsectionTitle` to `resolveMediaPlayerSegmentStripSegment` with `hasContent: mpChannel !== null || mpAddByRSS !== null`.
- Presence, with `const instanceId = useId();` and `const segmentVisible = segment !== null;`:

```ts
useLayoutEffect(() => {
  setMediaPlayerSegmentStripVisible(instanceId, segmentVisible);
}, [instanceId, segmentVisible]);

useLayoutEffect(() => {
  return () => {
    setMediaPlayerSegmentStripVisible(instanceId, false);
  };
}, [instanceId]);
```

  The media player is loaded with `ssr: false` (`LazyLoadedComponents`), so `useLayoutEffect` never runs on the server. The layout effect lets the floating video and the spacer move in the same frame the strip appears.
- Return `null` when `segment === null`, after the hooks.
- Icon helper at module scope, exhaustive switch, returning `IconType | null` (`import type { IconType } from 'react-icons';`): `chapter` → `null`, `clip` → `FaScissors`, `official-clip` → `FaMicrophone`.
- Markup:

```tsx
const LeadingIcon = segmentStripLeadingIcon(segment.kind);

return (
  <div
    className={styles.strip}
    data-segment-kind={segment.kind}
    data-testid={`media-player-segment-strip-${variant}`}
  >
    <div aria-hidden="true" className={styles.row}>
      {LeadingIcon !== null ? (
        <span className={styles.icon} data-testid={`media-player-segment-strip-icon-${variant}`}>
          <LeadingIcon />
        </span>
      ) : null}
      <div className={styles.titleSlot}>
        <MarqueeText
          align={LeadingIcon === null ? 'center' : 'left'}
          className={styles.title}
          data-testid={`media-player-segment-strip-title-${variant}`}
          restInset={LeadingIcon === null ? 'var(--spacing-lg)' : undefined}
          turnGroup={MEDIA_PLAYER_MARQUEE_TURN_GROUP.playerBar}
          turnOrder={MEDIA_PLAYER_MARQUEE_TURN_ORDER.playerBar.segment}
        >
          {segment.title}
        </MarqueeText>
      </div>
    </div>
    <span className={styles.visuallyHidden} data-testid={`media-player-segment-strip-label-${variant}`}>
      {tMediaPlayer(mediaPlayerSegmentStripLabelKey(segment.kind), { title: segment.title })}
    </span>
  </div>
);
```

  `tMediaPlayer` is `useTranslations('media_player')`. Keep the label span after the row: `expectMediaPlayerTitleVisible` takes the first text match in `aside#media-player`, and the first match should be the visible title.
- Imports: `MarqueeText` from `@podverse/ui`; the turn constants from `../../../constants/mediaPlayerMarquee`; contexts from `../../../contexts/MediaPlayer` and `../../../contexts/MediaPlayerCurrentTime`; the resolver and the strip helper from `../../../utils/mediaPlayer/...`; the store from `./mediaPlayerSegmentStripPresence`; styles last, from `../../../styles/components/MediaPlayer/SegmentStrip/MediaPlayerSegmentStrip.module.scss`.

### 4. `apps/web/src/styles/components/MediaPlayer/SegmentStrip/MediaPlayerSegmentStrip.module.scss`

```scss
.strip {
  position: absolute;
  right: 0;
  // Sits on #media-player's 1px border-top (MediaPlayer.module.scss), which stays visible between
  // the strip and the bar.
  bottom: calc(100% + 1px);
  left: 0;
  z-index: 1;
  display: flex;
  height: var(--media-player-height-top-section);
  box-sizing: border-box;
  overflow: hidden;
  border-top: 1px solid var(--border-color-opaque);
  background-color: var(--background-color-tertiary);
  color: var(--text-color-secondary);
}

.row {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--spacing-md);
  min-width: 0;
}

.icon {
  display: flex;
  flex: 0 0 auto;
  margin-left: var(--spacing-lg);
  font-size: var(--font-size-sm);
}

.titleSlot {
  flex: 1;
  min-width: 0;
}

.title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-normal);
}

.visuallyHidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

`.title` carries typography only: no `overflow`, `text-overflow`, `white-space`, `line-clamp`, or `-webkit-box` (plan 11's caller contract). No `var()` fallbacks.

The strip's bottom edge meets the top of `#media-player`'s border, so its top is `--media-player-height-top-section` above the bar. That is where the floating video's `.hasMarquee` rule puts the portal's bottom edge (`bar height + top section + 1px`), so the two sit flush.

### 5. Mount above both bars

`MediaPlayerDesktop.tsx`: render `<MediaPlayerSegmentStrip variant="desktop" />` as the first child of `.playerDesktop`, before `.bottomSection`.

`MediaPlayerMobile.tsx`: render `<MediaPlayerSegmentStrip variant="mobile" />` as the first child of `.playerMobile`, before `.infoSection`.

Import from `../SegmentStrip/MediaPlayerSegmentStrip`. Do not edit `MediaPlayerInfoDesktop`, `MediaPlayerInfoMobile`, or the bar SCSS. The strip is first in the DOM so reading order matches the visual order, top to bottom.

### 6. Page spacer

`mediaPlayerLayout.ts`: add beside `updateLayoutForMediaPlayer`:

```ts
/**
 * Toggles the class that gives the page scroller a trailing spacer while the segment strip
 * overlaps the bottom of the page, so the last row can scroll clear of it.
 */
export function updateLayoutForMediaPlayerSegmentStrip(
  segmentStripVisible: boolean,
  options?: UpdateLayoutForMediaPlayerOptions
) {
  if (options?.skipMainAppLayoutMutations) {
    return;
  }
  document
    .getElementById('page-wrapper')
    ?.classList.toggle('media-player-segment-strip-active', segmentStripVisible);
}
```

`MediaPlayer.tsx`: read `const segmentStripVisible = useMediaPlayerSegmentStripVisible();` and add a second effect after the existing one:

```ts
useEffect(() => {
  updateLayoutForMediaPlayerSegmentStrip(segmentStripVisible, { skipMainAppLayoutMutations });
  return () => {
    updateLayoutForMediaPlayerSegmentStrip(false, { skipMainAppLayoutMutations });
  };
}, [segmentStripVisible, skipMainAppLayoutMutations]);
```

`MediaPlayer.tsx` must not read `useMediaPlayerCurrentTime`; the store is what keeps the whole player tree from re-rendering on each tick.

`pageAdjust.scss`, after the `#page-wrapper.media-player-active` rule:

```scss
// The segment strip overlaps the bottom of the page; this spacer lets the last row scroll clear.
#page-wrapper.media-player-segment-strip-active #mainOuterWrapper::after {
  content: '';
  flex: 0 0 var(--media-player-height-top-section);
}
```

`#mainOuterWrapper` is a flex column, so the pseudo-element is a fixed-height last item. On a page shorter than the window, `.main` (`flex: 1 1 auto`) gives up that height and no scrollbar appears.

### 7. Floating video portals

In `MediaPlayerVideoPortalFloating.tsx` and `MediaPlayerLivestreamVideoPortalFloating.tsx`, read `const segmentStripVisible = useMediaPlayerSegmentStripVisible();` (import from `../../SegmentStrip/mediaPlayerSegmentStripPresence`) and append the existing class to the portal's `className` the same way `isDragging` is appended: `${segmentStripVisible ? ` ${cssClass(styles, 'hasMarquee')}` : ''}`. Change nothing else. A live item has no clip, soundbite, or chapter today, so the livestream portal rarely gets the class; it shares the rule so the two portals cannot drift.

### 8. `apps/web/e2e/media-player-floating-video-default.spec.ts`

The item it plays has a chapter from 0 to 20 seconds, so the strip shows once playback starts and the portal sits on the strip. Update the one test:

- Add `const MEDIA_PLAYER_SEGMENT_STRIP_HEIGHT_PX = 28;` beside the other constants. Extend the doc comment above `MEDIA_PLAYER_HEIGHT_DESKTOP_PX` to say it also syncs with `--media-player-height-top-section`.
- After the portal and its `video` are visible, assert the strip: `const segmentStrip = page.getByTestId('media-player-segment-strip-desktop'); await expect(segmentStrip).toBeVisible();`, then `await expect(segmentStrip).toHaveAttribute('data-segment-kind', 'chapter');`.
- Replace the computed-`bottom` check with `await expect(portal).toHaveCSS('bottom', `${MEDIA_PLAYER_HEIGHT_DESKTOP_PX + MEDIA_PLAYER_BORDER_TOP_PX + MEDIA_PLAYER_SEGMENT_STRIP_HEIGHT_PX}px`);`, which retries until the class lands. Keep the `right` and `borderTopLeftRadius` checks (read them after the `toHaveCSS`).
- Compare the portal's bottom edge to the strip's top: `expect(portalBox.y + portalBox.height).toBeCloseTo(stripBox.y, 0);` using `segmentStrip.boundingBox()`, in place of the `#media-player` box.
- Rename the test to `loads the floating video portal flush to the right edge and on top of the segment strip with square corners`, and the capture sentence to `The floating video portal is flush to the right edge and sits on the segment strip above the media player bar, with square corners.`
- Keep the test inside the 10 second budget; do not add a timeout.

## What must stay true

- `getMediaPlayerInfoResolution`, `MediaPlayerInfoDesktop`, and `MediaPlayerInfoMobile` are not edited by this plan.
- The strip renders only while a chapter, clip, or official clip with a non-blank title is active, and is gone otherwise (no reserved band, no empty strip).
- The strip never changes the height of `#media-player`, `#page-wrapper`, or `#sidebar`.
- `MediaPlayer.tsx` and the floating portals re-render on strip show and hide only, not on playhead ticks.
- Screen readers hear exactly one phrase, such as "Chapter: Introduction". The scrolling copies are hidden from them.
- A dragged floating video stays where the listener put it.
- Reduced motion truncates the strip title and does not scroll (plan 11).

## Tests

- **Unit, `apps/web/src/utils/mediaPlayer/mediaPlayerSegmentStrip.test.ts`** (Vitest): returns null with no content; returns null when `subsectionTitle` is null or whitespace; a clip wins over a soundbite and names `'clip'`; a soundbite with no clip names `'official-clip'`; neither names `'chapter'`; the title is trimmed. One case for `mediaPlayerSegmentStripLabelKey` covering all three kinds.
- **Unit, `apps/web/src/components/MediaPlayer/SegmentStrip/mediaPlayerSegmentStripPresence.test.ts`** (Vitest): two instances visible, one hides, the store is still visible and listeners are not notified; the second hides and listeners are notified once; setting the same state twice does not notify. Clear the store between cases by hiding every id the case used.
- **Playwright:** `media-player-floating-video-default.spec.ts` as in step 8. The strip's own coverage (both bars, each kind, scroll, reduced motion, scrub) belongs to plans 40–49; they use the test ids below.

| id | element | when |
| --- | --- | --- |
| `media-player-segment-strip-desktop` / `-mobile` | strip root; `data-segment-kind` is `chapter`, `clip`, or `official-clip` | only while a segment is active; the desktop one is visible at `min-width: 992px`, the mobile one at `max-width: 991px` |
| `media-player-segment-strip-title-desktop` / `-mobile` | `MarqueeText` root, carries `data-marquee-layout` | with the strip |
| `media-player-segment-strip-icon-desktop` / `-mobile` | icon wrapper | clip and official clip only; absent for a chapter |
| `media-player-segment-strip-label-desktop` / `-mobile` | visually hidden label, e.g. `Chapter: Introduction` | with the strip |

## Release scratchpad

```markdown
## Segment strip above the web player bar

- Surfaces: web
- Change: A slim strip above the bottom player bar, on wide and narrow windows, names the chapter, clip, or official clip that is playing. It shows only while one is active. Clips get a scissors icon and official clips a microphone icon; chapters show the title alone, centered. A long title scrolls in turn with the bar's title and channel lines, and reduced motion keeps it still with an ellipsis. Dragging the progress bar updates the chapter name as you drag. Screen readers hear "Chapter: <title>", "Clip: <title>", or "Official Clip: <title>". While the strip shows, the floating video sits on top of it and the page gains a small bottom spacer so the last row can scroll clear. New catalog keys: `media_player.segment_strip_chapter`, `media_player.segment_strip_clip`, `media_player.segment_strip_official_clip`.
- Who notices: listeners using the web player on episodes with chapters, and anyone playing a clip or official clip
- Operator steps: none
```
