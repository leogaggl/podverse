# 32 — Shared item detail header

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

Rows: R5 (groundwork), R30 (reuse). Mobile only. No visible change: the podcast episode page must
look and behave exactly as before.

Runs after `31-add-by-rss-download-playback.md` (any order works; it shares no file with 30–31).
Plan 33 builds the Add by RSS episode page on this component.

## Why

R5 asks for the Add by RSS item page header to look identical to the podcast episode page header.
That header is `EpisodePlayChrome` (`src/screens/episode/EpisodePlayChrome.tsx`), and it takes a
catalog `DTOItem`: it reads `item_images`, stored progress by `id_text`, and `pub_date` as an ISO
string. An Add by RSS episode is a parsed feed bundle on the device, not a `DTOItem`. Rather than
copy the layout, split it: a presentational header that takes plain values, used by
`EpisodePlayChrome` now and by the Add by RSS page in plan 33.

## Locked decisions

1. **New component** `src/components/content/ItemDetailHeader.tsx`, exported from
   `src/components/content/index.ts`. It owns the layout, the styles, and every testID that
   `EpisodePlayChrome` renders today.
2. **`EpisodePlayChrome` stays** as the catalog wrapper, keeping its props and doc comment. It
   computes artwork, progress label, download state, and more actions as today, then renders
   `ItemDetailHeader`.
3. **testIDs** move under a `testIDPrefix` prop. The episode page passes `'episode-detail'`, so
   `episode-detail-header`, `-artwork`, `-download`, `-download-complete`, `-podcast-title`,
   `-title`, `-date`, and `-play-chrome` are unchanged. The play bar keeps its row-style ids
   (`home-row-play-…`, `home-row-more-…`, `home-feed-row-duration-…`) built from `mediaIdText`,
   so `e2e/podcast-episode.yaml` keeps passing untouched.
4. **Date label** becomes a pure helper, `itemDetailDateLabel`, in a new
   `src/components/content/itemDetailDateLabel.ts`. It accepts `Date | string | null | undefined`
   because Add by RSS bundles round-trip `pub_date` through SQLite as either.

## Files

| File                                                 | Change                    |
| ---------------------------------------------------- | ------------------------- |
| `src/components/content/ItemDetailHeader.tsx`        | New                       |
| `src/components/content/itemDetailDateLabel.ts`      | New                       |
| `src/components/content/itemDetailDateLabel.test.ts` | New                       |
| `src/components/content/index.ts`                    | Export both               |
| `src/screens/episode/EpisodePlayChrome.tsx`          | Render `ItemDetailHeader` |
| `vitest.config.ts`                                   | Include the new test      |

All paths are under `apps/mobile/`.

## Implementation

### `itemDetailDateLabel.ts`

```typescript
import { formatDateAbbrev } from '@podverse/helpers';

/** Abbreviated publish date for an item detail header, or null when absent or unparseable. */
export const itemDetailDateLabel = (
  pubDate: Date | string | null | undefined,
  language: string
): string | null => { … };
```

Body: `null` for `null`, `undefined`, or an empty string; otherwise build a `Date` (use the value
directly when it is already a `Date`), return `null` when `getTime()` is `NaN`, else
`formatDateAbbrev(parsed, language)`. This is the logic of `EpisodePlayChrome`'s `dateLabel` memo,
widened to accept a `Date`.

### `ItemDetailHeader.tsx`

```typescript
export type ItemDetailHeaderProps = {
  /** Feed URL of a private Add by RSS feed's artwork; set wherever `artworkHeaders` is set. */
  artworkAddByRssFeedUrl?: string | null;
  artworkHeaders?: Record<string, string>;
  artworkUri: string | null;
  channelTitle: string;
  dateLabel: string | null;
  /** Drives the one-tap download control beside the artwork; null hides it. */
  downloadItem: DTOItem | null;
  durationLabel: string | null;
  /** Suffix for the play bar ids and the playback match, as list rows use. */
  mediaIdText: string;
  moreActions: MediaRowMoreAction[];
  onChannelPress?: () => void;
  onPlayPress: () => void;
  testIDPrefix: string;
  title: string;
  viewerUri: string | null;
};

export function ItemDetailHeader(props: ItemDetailHeaderProps) { … }
```

Move from `EpisodePlayChrome` into this file, unchanged except for the substitutions below:

- `EPISODE_ARTWORK_SIZE` (rename `ITEM_DETAIL_ARTWORK_SIZE`, still 96) and the whole
  `StyleSheet.create` block, with the same `useTheme` / `typography` inputs.
- The channel title block (`podcastName` today): a `Pressable` with `accessibilityRole="link"`
  when `onChannelPress` is set, plain `Text` otherwise; testID `${testIDPrefix}-podcast-title`.
- The returned tree: root `View` (`${testIDPrefix}-header`), artwork row with `CoverImage`
  (`accessibilityLabel={title}`, `${testIDPrefix}-artwork`, `uri={artworkUri}`,
  `viewerUri={viewerUri}`, `addByRssFeedUrl={artworkAddByRssFeedUrl}`,
  `headers={artworkHeaders}`; the same two optional props plan 20 adds to `ChannelHeader`) and,
  only when `downloadItem !== null`, `DownloadRowControl`
  (`item={downloadItem}`, `testID={`${testIDPrefix}-download`}`,
  `completeTestID={`${testIDPrefix}-download-complete`}`); the titles stack; the date
  (`${testIDPrefix}-date`) when `dateLabel !== null`; and the play chrome `View`
  (`${testIDPrefix}-play-chrome`) holding `MediaRowActions` with
  `appearance="icons"`, `durationLabel`, `durationTestID={`home-feed-row-duration-${mediaIdText}`}`,
  `idSuffix={`-${mediaIdText}`}`, `moreActions`, `moreTestID={`home-row-more-${mediaIdText}`}`,
  `onPlayPress`, `playbackMediaId={mediaIdText}`, `playLabel={t('media_player.play')}`,
  `playTestID={`home-row-play-${mediaIdText}`}`.
- Doc comment: take `EpisodePlayChrome`'s layout paragraph and say it is shared by the podcast
  episode page and the Add by RSS episode page.

### `EpisodePlayChrome.tsx`

Keep: props, `formatProgressTimeLabel`, `useEpisodeStoredProgress`, the
`explicitSelectedParams` / `useDownloadAction` block, `useActionError`, `artworkUri`, `viewerUri`,
`episodeTitle`, `durationLabel`, and the `moreActions` memo. Replace the `dateLabel` memo with
`itemDetailDateLabel(episode.pub_date, i18n.language)` (inside `useMemo` keyed on the same two
inputs). Delete the styles, the `podcastName` block, and the JSX, and return:

```tsx
<ItemDetailHeader
  artworkUri={artworkUri}
  channelTitle={podcastTitle}
  dateLabel={dateLabel}
  downloadItem={episode}
  durationLabel={durationLabel}
  mediaIdText={episode.id_text}
  moreActions={moreActions}
  onChannelPress={onPodcastPress}
  onPlayPress={() => {
    onPlayPress(episodeRow);
  }}
  testIDPrefix="episode-detail"
  title={episodeTitle}
  viewerUri={viewerUri}
/>
```

`EpisodePlayChrome` does not pass the two artwork props. Remove imports that are no longer used
(`Pressable`, `StyleSheet`, `Text`, `View`, `CoverImage`, `DownloadRowControl`, `MediaRowActions`,
`typography`, `useTheme`, `formatDateAbbrev`). Keep `buildMediaRowMoreActions`.

The episode page always rendered `DownloadRowControl`, which hides itself when the item is not
downloadable. Passing `downloadItem={episode}` keeps that.

## Tests

- `itemDetailDateLabel.test.ts` (new; add `'src/components/content/itemDetailDateLabel.test.ts'`
  to the `include` list in `apps/mobile/vitest.config.ts`, beside the other `'src/components/…'`
  entries such as `'src/components/form/chipRowReveal.test.ts'`): an ISO string and the same
  instant as a
  `Date` give the same label; `null`, `undefined`, `''`, and `'not a date'` give `null`.
- No new Maestro step: `e2e/podcast-episode.yaml` already asserts `episode-detail-header`,
  `episode-detail-title`, the download control, and the `home-row-more-.*` menu, and must pass
  unchanged.

## Release scratchpad

None: refactor with no behavior change. Plan 33 carries the entry for the Add by RSS page.
