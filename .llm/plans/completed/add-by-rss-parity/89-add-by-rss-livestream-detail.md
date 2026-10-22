# 89 — Mobile Add by RSS livestream page

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

**Rows:** R61 (the page), R60 (the page offers no Queue, Add to Playlist, Mark as Played, or
Share). **Runs after:** 31, 32, 33, 37, 38, 39, 50, 51, 85, and 90. **Runs before:** 86 (its
rows open this page and play through `playLiveItem`), then 87. Never in one phase with 33, 38,
39, 50, or 51 (`navigation/index.tsx`, `addByRssStackParams.ts`, `fullPlayerContentLink.ts`),
31, 37, or 90 (`domain.ts`; 90 also `useAddByRssPlayback.ts`), or 32 (`ItemDetailHeader.tsx`).

**Parity source:** web `apps/web/src/app/add-by-rss/podcast/livestream/[id]/page.tsx` →
`AddByRSSLivestreamItemPageClient` (feed header, `AddByRSSLivestreamDetailHeader`, Summary tab;
play only while live) and mobile `EpisodeDetailScreen`, which regular livestream rows open
(plan 85 decision 7). The page layout copies `AddByRssEpisodeDetailScreen` (plan 33) and
`AddByRssTrackDetailScreen` (plan 38).

## Locked decisions

1. **Route.** `AddByRssLivestreamDetail`, params `{ feedIdText: string; liveItemKey: string }`, on
   the Home and Library stacks. Stack title `t('media.livestream.livestream')`. No header-bar
   action: an Add by RSS livestream is private to the device and has no public URL.
2. **Live item key.** `addByRssLiveItemKey(liveBundle, liveIndex)` is the trimmed
   `liveBundle.item.guid`, else `String(liveIndex)` (the bundle's index in `mappedFeed.liveItems`).
   Rows (plan 86) and the page use this one function, so a tap always finds its item.
3. **Header.** Shared `ItemDetailHeader` (plan 32). Title: the trimmed live item title, else
   `t('media.livestream.livestream')`. Channel line: the feed title, which opens
   `AddByRssPodcastDetail` for `feedIdText` on the current stack. Artwork: the live item's own
   image (`image`, else `itunesImage`), else the feed header artwork (plan 38
   `addByRssFeedHeaderArtwork`), with the private-feed headers.
4. **Date line.** The status word, then ` • `, then `itemDetailDateLabel(startTime, language)`.
   Status words: Live → `media.livestream.live`, Pending → `media.livestream.pending`
   ("Scheduled"), Ended → `media.livestream.ended`. No date → the word alone.
5. **Play.** Only while the status is Live, through `playLiveItem` (below). A scheduled or ended
   livestream shows no play control, as on web. The playing livestream shows pause through plan
   90's `playbackMediaId`.
6. **No More actions (R60).** No Queue Next, Queue Last, Add to Playlist, Mark as Played,
   Download, or Share. `ItemDetailHeader` hides its play bar entirely when it has no play, no
   duration, and no More actions, so a scheduled livestream shows no empty bar.
7. **Chips.** Summary always; People when the live item lists people. Labels from
   `EPISODE_TAB_LABEL_KEYS`. Left out: Chapters and Transcript (a live item is a raw parsed entry,
   not a compat item bundle, and web's page has neither), Clips (Add by RSS items have no clips),
   Funding (channel level), and Boosts (the mobile episode page has no Boosts tab).
8. **Summary body.** `pickItemDescriptionSource` over the live item's `content`,
   `descriptionRaw`, `description`, and `summary`. No source → `info.summary.no_summary`.
9. **Missing data.** Feed record missing or live item not found → `errors.generic` with retry.
   Mapped feed missing → `features.add_by_rss.status_processing`. Same request-id guard as
   plan 38's loader, shared through one extracted hook (below).
10. **Full player.** Livestream titles stay plain text in the full player (plans 39 and 51); this
    plan does not add a player link. Only the doc comment that says livestreams have no item page
    changes, because this page makes it untrue.

## Files

Paths are under `apps/mobile/src/` unless they start at the repo root.

| File                                                       | Change                   |
| ---------------------------------------------------------- | ------------------------ |
| `lib/addByRss/liveItemDetail.ts`                           | New: key, find, mapper   |
| `lib/addByRss/liveItemDetail.test.ts`                      | New                      |
| `lib/addByRss/domain.ts`                                   | Live playback data       |
| `lib/addByRss/domain.test.ts`                              | Live playback case       |
| `hooks/useAddByRssPlayback.ts`                             | `playLiveItem`           |
| `components/content/ItemDetailHeader.tsx`                  | Optional play, empty bar |
| `screens/home/addByRss/addByRssStackParams.ts`             | Route params             |
| `screens/home/addByRss/useAddByRssItemDetail.ts`           | Extract the feed loader  |
| `screens/home/addByRss/AddByRssLivestreamHeader.tsx`       | New                      |
| `screens/home/AddByRssLivestreamDetailScreen.tsx`          | New                      |
| `navigation/index.tsx`                                     | Route on both stacks     |
| `screens/player/fullPlayerContentLink.ts`                  | Doc comment only         |
| `apps/mobile/vitest.config.ts`                             | Include the new test     |
| `release-notes/scratchpad.md`                              | Entry                    |

No i18n change: every key above exists (`media.livestream.*`, `info.summary.*`,
`info.people.people`, `errors.generic`, `features.add_by_rss.status_processing`).

## Implementation

### `lib/addByRss/liveItemDetail.ts` (pure)

```ts
type AddByRssLiveBundle = AddByRSSMappedFeed['liveItems'][number];

export type AddByRssLivePerson = {
  href: string | null;
  img: string | null;
  name: string;
  role: string | null;
};

export type AddByRssLiveItemDetail = {
  descriptionHtml: string | null;
  imageUrl: string | null;
  liveBundle: AddByRssLiveBundle;
  liveIndex: number;
  liveItemKey: string;
  people: AddByRssLivePerson[];
  startTime: Date | string | null;
  statusId: LiveItemStatusEnum;
  title: string | null;
};

export const addByRssLiveItemKey = (liveBundle: AddByRssLiveBundle, liveIndex: number): string;
export const findAddByRssLiveItemDetail = (
  mappedFeed: AddByRSSMappedFeed,
  liveItemKey: string
): AddByRssLiveItemDetail | null;
export const addByRssLiveStatusLabelKey = (statusId: LiveItemStatusEnum): string;
```

- `findAddByRssLiveItemDetail` walks `mappedFeed.liveItems` with their index and returns the first
  whose `addByRssLiveItemKey` equals `liveItemKey`, mapped; none → `null`.
- `title`, `imageUrl` (`item.image`, else `item.itunesImage`): `toNonEmptyTrimmedString`.
- `descriptionHtml`: `pickItemDescriptionSource` from `@podverse/helpers`, passing each field as
  `?? undefined`; result through `toNonEmptyTrimmedString`.
- `people`: from `item.podcastPeople ?? []`; drop entries without a trimmed name; `role`
  lowercased and trimmed, else `null`; `href` and `img` kept only when `isValidHttpUrl`
  (`@podverse/helpers-validation/client`), else `null`.
- `startTime`: `liveBundle.liveItem.start_time ?? null` (a string after the SQLite JSON round
  trip). `statusId`: `liveBundle.liveItem.live_item_status`.
- `addByRssLiveStatusLabelKey`: exhaustive `switch` over `LiveItemStatusEnum` (decision 4).

### `lib/addByRss/domain.ts`

`toAddByRssLiveItemPlaybackResourceData(record, mappedFeed, liveBundle, liveIndex)`: the same body
as `toAddByRssItemPlaybackResourceData` (same `feedForIndex`, canonical `feed_url`, and
`playback_position` handling), but builds the index item with
`toLiveIndexItem(feedForIndex, liveBundle, liveIndex, record.idText)` from
`@podverse/parser-mapping`. Export it beside the item version; do not change the item version.

### `hooks/useAddByRssPlayback.ts`

`playLiveItem(feed, mappedFeed, liveBundle, liveIndex)`, returned beside `playItem`:

1. `toNonEmptyTrimmedString(liveBundle.item.enclosure.url)` is null → the same notice `playItem`
   shows, and return.
2. `resourceData = toAddByRssLiveItemPlaybackResourceData(...)`; when
   `addByRssPlaybackMediaId(resourceData)` is the current item, apply plan 90's pause/resume
   toggle and return.
3. Else `playAddByRssResourceData(resourceData)`, as `playItem` does.

Share steps 2–3 with `playItem` through one local helper in the hook; do not copy the toggle.

### `components/content/ItemDetailHeader.tsx`

- `onPlayPress?: () => void`. Doc: omit for an item that cannot play now (a scheduled
  livestream). Pass it through unchanged; `MediaRowActions` renders no play without a handler.
- Render the play-chrome `View` (`${testIDPrefix}-play-chrome`) only when
  `onPlayPress !== undefined || durationLabel !== null || moreActions.length > 0`.
- Existing callers pass all three, so they render as before.

### `addByRss/addByRssStackParams.ts`

Add `AddByRssLivestreamDetail: { feedIdText: string; liveItemKey: string }`, keys alphabetical.

### `addByRss/useAddByRssItemDetail.ts`

Extract plan 38's loader body into `useAddByRssFeedSelection<T>({ feedIdText, key, select })`,
returning `{ errorKey, feed, isLoading, mappedFeed, reload, selected: T | null }`:

- `select: (feed: MobileAddByRSSFeedRecord, mappedFeed: AddByRSSMappedFeed, key: string) =>
  T | null` is a module-scope function; the effect depends on `feedIdText`, `key`, and `select`.
- The four steps, their error keys, and the request-id ref stay as plan 38 moved them; the item
  step becomes `select(...)`, and `null` still → `errors.generic`.
- `useAddByRssItemDetail` becomes a call with its existing item lookup as `select` and maps
  `selected` to `item`; its signature and return shape do not change.
- Export `useAddByRssLiveItemDetail(input: { feedIdText: string; liveItemKey: string })`, which
  calls the same hook with `(feed, mappedFeed, key) => findAddByRssLiveItemDetail(mappedFeed,
  key)` defined at module scope, and returns the same shape with `liveItem` for `selected`.

### `addByRss/AddByRssLivestreamHeader.tsx`

Props: `{ feed, liveItem, mappedFeed, onChannelPress, onPlayPress? }`.

- Artwork per decision 3: `itemImage = liveItem.imageUrl`; `artworkUri = itemImage ??
  headerArtwork.listUrl`, `viewerUri = itemImage ?? headerArtwork.viewerUrl`,
  `artworkAddByRssFeedUrl = feed.feedUrl`, `artworkHeaders =
  useAddByRssArtworkHeaders(feed.feedUrl, artworkUri)`.
- `mediaIdText`: `${feed.idText}-${liveItem.liveItemKey}` (testIDs only).
- `playbackMediaId`: `addByRssPlaybackMediaId(toAddByRssLiveItemPlaybackResourceData(feed,
  mappedFeed, liveItem.liveBundle, liveItem.liveIndex))`, memoized.
- `dateLabel` per decision 4; `durationLabel={null}`; `downloadItem={null}`;
  `moreActions={NO_MORE_ACTIONS}` (module-scope empty array).
- `testIDPrefix="add-by-rss-livestream-detail"`; `title` per decision 3;
  `channelTitle={feed.title}`.

### `screens/home/AddByRssLivestreamDetailScreen.tsx`

Copy `AddByRssEpisodeDetailScreen`'s structure, style values, and loading and error branches:

- `useAddByRssLiveItemDetail(route.params)`; `{ playLiveItem } = useAddByRssPlayback()`.
- `isLive = liveItem.statusId === LiveItemStatusEnum.Live`; pass
  `onPlayPress={isLive ? handlePlayPress : undefined}`, where `handlePlayPress` calls
  `playLiveItem(feed, mappedFeed, liveItem.liveBundle, liveItem.liveIndex)`.
- `onChannelPress`: push `AddByRssPodcastDetail` with `{ feedIdText }` on the current stack.
- `aboutPeople = toAddByRssAboutPeople(liveItem.people)`; chips `['summary']`, plus `'people'`
  when `aboutPeople.length > 0`. Selected chip resets to `summary` when the key changes.
- Summary: `DescriptionText` with `html={liveItem.descriptionHtml}`,
  `emptyLabel={t('info.summary.no_summary')}`, `resetKey={liveItemKey}`, no `truncation`.
- People: `PeoplePane layout="inline"`.
- testIDs: `add-by-rss-livestream-detail-screen`, `-loading`, `-error`, `-list`, `-sections`,
  `-summary`, `-description`, `-description-toggle`, `-people`, `-tab-<key>`.

### `navigation/index.tsx`

- `HOME_STACK_ROUTES.AddByRssLivestreamDetail` and `LIBRARY_STACK_ROUTES.AddByRssLivestreamDetail`
  (keys alphabetical); add to both param lists through `AddByRssDetailStackParamList`.
- Register the screen after `AddByRssEpisodeDetail` on both stacks, with
  `title: t('media.livestream.livestream')`.
- Linking: `${MOBILE_HOME_TAB_SEGMENT}/add-by-rss/:feedIdText/livestream/:liveItemKey` on Home,
  `'my-library/add-by-rss/:feedIdText/livestream/:liveItemKey'` on Library, beside plan 33's
  `item` paths.

### `screens/player/fullPlayerContentLink.ts`

Reword the doc comment that lists livestreams as having no item page to: livestream titles stay
plain text in the full player. No code change.

### `vitest.config.ts`

Add `src/lib/addByRss/liveItemDetail.test.ts` to `include`.

## Reuse

`ItemDetailHeader`, `itemDetailDateLabel`, `addByRssFeedHeaderArtwork`, `useAddByRssArtworkHeaders`,
`toAddByRssAboutPeople`, `DescriptionText`, `PeoplePane`, `SectionChipRow`, `FillList`,
`EPISODE_TAB_LABEL_KEYS`, `toLiveIndexItem`, `buildAddByRSSResourceData` (through the domain
helper), `addByRssPlaybackMediaId`, `pickItemDescriptionSource`, `isValidHttpUrl`. Plan 86's rows
import `addByRssLiveItemKey`, `toAddByRssLiveItemPlaybackResourceData`, and `playLiveItem`.

## Tests

- `liveItemDetail.test.ts`:
  - The key is the trimmed guid; a blank guid falls back to the index.
  - Find returns the second of two items by key, and `null` for an unknown key.
  - Mapper: title fallback to `null`, image then iTunes image, description source order, people
    filtering (blank name dropped, invalid href nulled, role lowercased).
  - The status label key for each `LiveItemStatusEnum` member.
- `domain.test.ts`: the live playback data keeps the canonical `feed_url` and the stored
  `playback_position`, and its media id matches the row id plan 86 builds.
- Device proof is plan 87's `add-by-rss-livestream` flow.

## Release scratchpad entry

```markdown
## Mobile Add by RSS livestreams get their own page

- Surfaces: mobile
- Change: an Add by RSS livestream, live or scheduled, opens a page with its artwork, title, feed,
  status and start time, Summary, and People. A live one has a play button; a scheduled or ended
  one does not. The page offers no Queue, playlist, played, download, or Share actions.
- Who notices: listeners who add a feed by RSS that announces livestreams
- Operator steps: none
```
