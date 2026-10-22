# 33 — Add by RSS episode detail page

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

Rows: R5 (item-level header parity), R29 and R30 (actions and reuse on the page), R55 (this page
hosts the Chapters and Transcript that plans 35 and 36 add). Mobile only.

Runs after `32-item-detail-header.md` and `30-add-by-rss-item-actions.md`. Plan 34 navigates
here from the rows. Area E (plans 50–59) navigates here from the full player. Plan 36 adds the
Chapters and Transcript chips to this screen (R55); build the chip list so that plan can widen
it.

## Answers

**R5.** Mobile has no Add by RSS item page today: `src/navigation/index.tsx` registers only
`AddByRssPodcastDetail`, `AddByRssCredentials`, `AddByRssRoot`, and `AddByRssAdd`. This plan adds
`AddByRssEpisodeDetail` on the Home and My Library stacks (the two stacks that already host the
Add by RSS channel page). Its header is plan 32's `ItemDetailHeader`, the same component the
podcast episode page renders, so the two headers are identical by construction.

## Locked decisions

1. **Route** `AddByRssEpisodeDetail`, params `{ feedIdText: string; itemKey: string }`. `itemKey`
   is plan 30's `AddByRssHomeEpisode.itemKey` (guid, else the item index as a string).
2. **Header bar.** Title `t('media.podcast.episode')`, the episode page's title. No Share button:
   Add by RSS pages are not shareable.
3. **Header body.** `ItemDetailHeader` with `testIDPrefix="add-by-rss-episode-detail"`, list-row
   artwork for both `artworkUri` and `viewerUri`, the private-feed artwork props, the channel
   title as a link back to `AddByRssPodcastDetail`, the date, duration, play, and the More menu
   from plan 30 (Queue Next, Queue Last, Add to Playlist, Mark as Played, Download). No Share.
4. **Chips.** Summary always; People when the item lists people. Both reuse the episode page's
   bodies (`DescriptionText`, `PeoplePane layout="inline"`) and labels
   (`EPISODE_TAB_LABEL_KEYS` in `src/screens/episode/episodeTabs.ts`). The chip row shows even with
   Summary alone, so the header-to-body layout matches the episode page. Chapters and Transcript
   are not in this plan; plan 36 adds them between Summary and People.
5. **Left out on purpose** (state in the screen doc comment):
   - Funding: parsed item bundles carry no item funding (`ParsedRSSFeedCompatBundle` in
     `packages/parser-mapping/src/compat/partytime/compatFull.ts`).
   - Clips and Official Clips: clips live on the server; soundbite playback takes catalog items.
6. **Tab choice** is screen state, default Summary. No per-feed persistence.
7. **People mapping** is shared with plan 21's channel People: extract its inline map into
   `toAddByRssAboutPeople` and call it for both.

## Files

| File                                                  | Change                                  |
| ----------------------------------------------------- | --------------------------------------- |
| `src/screens/home/addByRss/addByRssStackParams.ts`    | New: shared param list type             |
| `src/screens/home/AddByRssHomeDetailScreen.tsx`       | Import the shared param list type       |
| `src/screens/home/addByRssHomeDetailData.ts`          | `toAddByRssAboutPeople`                 |
| `src/screens/home/addByRssHomeDetailData.test.ts`     | Cover it                                |
| `src/screens/home/addByRss/AddByRssEpisodeHeader.tsx` | New                                     |
| `src/screens/home/AddByRssEpisodeDetailScreen.tsx`    | New                                     |
| `src/navigation/index.tsx`                            | Route constants, params, links, screens |

All paths are under `apps/mobile/`. `navigation/index.tsx` is a large file: Grep
`AddByRssPodcastDetail` and read a window around each hit.

## Implementation

### `addByRssStackParams.ts`

```typescript
/** Routes the Add by RSS screens navigate between; registered on the Home and Library stacks. */
export type AddByRssDetailStackParamList = {
  AddByRssCredentials: { feedIdText: string };
  AddByRssEpisodeDetail: { feedIdText: string; itemKey: string };
  AddByRssPodcastDetail: { feedIdText: string };
};
```

Delete the local `AddByRssDetailStackParamList` in `AddByRssHomeDetailScreen.tsx` and import this
one. If plans 20–22 changed the local type's keys, carry those keys over and add
`AddByRssEpisodeDetail`.

### `navigation/index.tsx`

- `HOME_STACK_ROUTES` and `LIBRARY_STACK_ROUTES`: add `AddByRssEpisodeDetail:
  'AddByRssEpisodeDetail'` after `AddByRssCredentials` (keys stay alphabetical).
- `HomeStackParamList` and `LibraryStackParamList`: add
  `AddByRssEpisodeDetail: { feedIdText: string; itemKey: string };`.
- `homeTabLinkScreens`: `AddByRssEpisodeDetail:
  `${MOBILE_HOME_TAB_SEGMENT}/add-by-rss/:feedIdText/item/:itemKey``.
- `libraryTabLinkScreens`: `AddByRssEpisodeDetail:
  'my-library/add-by-rss/:feedIdText/item/:itemKey'`.
- In `HomeStackNavigator` and the Library stack navigator, register right after the
  `AddByRssPodcastDetail` screen:

```tsx
<HomeStack.Screen
  component={AddByRssEpisodeDetailScreen}
  name={HOME_STACK_ROUTES.AddByRssEpisodeDetail}
  options={{ title: t('media.podcast.episode') }}
/>
```

  (`LibraryStack` / `LIBRARY_STACK_ROUTES` in the Library navigator.)
- Grep `src/navigation/` tests for `add-by-rss/:feedIdText` or `AddByRssPodcastDetail`. If a test
  lists every link path, add the new path the same way.

### `addByRssHomeDetailData.ts`

```typescript
type AddByRssParsedPerson = {
  href: string | null;
  img: string | null;
  name: string;
  role: string | null;
};

/** Parsed feed or item people as About people, numbered from 1, empty names dropped. */
export const toAddByRssAboutPeople = (
  people: readonly AddByRssParsedPerson[]
): AboutPerson[] => { … };
```

Move plan 21's mapping body (skip empty `name`, then `id: index + 1`) into it, and make
`buildAddByRssHomeDetailData` call `toAddByRssAboutPeople(mappedFeed?.channel.people ?? [])`.
Channel and item people have the same parsed shape (`compatChannelPersonDtos` and
`compatItemPersonDtos`), so both arrays pass without a cast.

### `addByRss/AddByRssEpisodeHeader.tsx`

```typescript
type AddByRssEpisodeHeaderProps = {
  channelTitle: string;
  episode: AddByRssHomeEpisode;
  feedUrl: string;
  onAddToPlaylistPress: () => void;
  onChannelPress: () => void;
  onMarkAsPlayedPress: () => void;
  onPlayPress: () => void;
  onQueuePress: (position: QueueActionPosition) => void;
};
```

- `dateLabel`: `useMemo` of `itemDetailDateLabel(episode.itemBundle.item.pub_date, i18n.language)`.
- `durationLabel`: `formatPlaybackDurationLabel(Number(episode.duration), t)` when
  `episode.duration !== null`, else `null` (`src/lib/formatPlaybackDurationLabel.ts`). Parsed
  durations are seconds (`compatItemAboutDto` stores `duration.toFixed(2)`).
- Download: `useDownloadAction(episode.downloadItem ?? undefined)` and `useActionError`, then the
  `moreActions` memo copied from `EpisodePlayChrome` with these handlers: `onQueueNext` /
  `onQueueLast` → `onQueuePress('next' | 'last')`, `onAddToPlaylist`, `onMarkAsPlayed`,
  `onDownload` (same failed → `openDownloadError` branch, `undefined` when not downloadable). No
  `onShare`. Options: `downloadLabelKey`, `downloadTone`, `idSuffix: `-${episode.id}``.
- `artworkHeaders`: `useAddByRssArtworkHeaders(feedUrl, episode.imageUrl)`.
- Render `ItemDetailHeader` with `artworkAddByRssFeedUrl={feedUrl}`, `artworkHeaders`,
  `artworkUri={episode.imageUrl}`, `viewerUri={episode.imageUrl}`, `channelTitle`, `dateLabel`,
  `downloadItem={episode.downloadItem}`, `durationLabel`, `mediaIdText={episode.id}`,
  `moreActions`, `onChannelPress`, `onPlayPress`, `testIDPrefix="add-by-rss-episode-detail"`,
  `title={episode.title}`.

### `AddByRssEpisodeDetailScreen.tsx`

Props: `NativeStackScreenProps<AddByRssDetailStackParamList, 'AddByRssEpisodeDetail'>`.

Load (in a `useCallback` run from `useEffect` on `feedIdText` and `itemKey`, with a request-id ref
so a stale load cannot overwrite a newer one, as `AddByRssHomeDetailScreen`'s `loadDetail` does):

1. `addByRssRepository.getFeedByIdText(feedIdText)`; `null` → `errorKey = 'errors.generic'`.
2. `addByRssRepository.getMappedFeedByUrl(feed.feedUrl)`; `null` →
   `errorKey = 'features.add_by_rss.status_processing'`.
3. `buildAddByRssHomeDetailData(feed, mappedFeed)`, then
   `episodeRows.find((row) => row.itemKey === itemKey)`; none → `errorKey = 'errors.generic'`.
4. Thrown errors → `errorKey = 'errors.generic'`.

State: `feed`, `mappedFeed`, `episode`, `isLoading`, `errorKey`, `tab` (`'summary' | 'people'`),
`playbackNoticeKey`.

Hooks: `useAddByRssPlayback({ onNotice: setPlaybackNoticeKey })`, `useAddByRssItemActions()`. The
action target is `{ feed, itemBundle: episode.itemBundle, itemIndex: episode.itemIndex,
mappedFeed }`. Play calls `playItem(feed, mappedFeed, episode.itemBundle, episode.itemIndex)`.

People: `useMemo(() => toAddByRssAboutPeople(episode?.itemBundle.people ?? []), [episode])`.
Chips: `SectionChipItem<'summary' | 'people'>[]` with `key`, `label:
t(EPISODE_TAB_LABEL_KEYS[key])`, `testID: `add-by-rss-episode-detail-tab-${key}``; People only when
`people.length > 0`. If `tab === 'people'` and people became empty after a reload, show Summary.

Layout, copied from `EpisodeDetailScreen` (same style values: `container`, `list`, `listContent`,
`chipRow`, `notice`, `description`, `showMore`):

- Root `View` `testID="add-by-rss-episode-detail-screen"`.
- `isLoading` → `LoadingSection testID="add-by-rss-episode-detail-loading"`.
- `errorKey !== null` → `ListError messageKey={errorKey} onRetry={load}
  testID="add-by-rss-episode-detail-error"`.
- Otherwise `FillList` with `data={[]}`, `ListEmptyComponent={null}`,
  `testID="add-by-rss-episode-detail-list"`, and:
  - `ListHeaderComponent`: `AddByRssEpisodeHeader` (channel title `episode.subtitle ??
    feed.feedUrl`; `onChannelPress` → `navigation.navigate('AddByRssPodcastDetail', {
    feedIdText })`), then `actionNoticeKey ?? playbackNoticeKey` as `Text style={styles.notice}`
    when non-null, then `SectionChipRow` (`testID="add-by-rss-episode-detail-sections"`) inside
    `styles.chipRow`.
  - `ListFooterComponent`: Summary → `<View testID="add-by-rss-episode-detail-summary">` with
    `DescriptionText` (`emptyLabel={t('info.summary.no_summary')}`, `html` = the description's
    `value` when non-empty else its `preview`, else `null`; `resetKey={episode.id}`;
    `testID="add-by-rss-episode-detail-description"`;
    `toggleTestID="add-by-rss-episode-detail-description-toggle"`; `truncation` =
    `{ kind: 'item', linkUrl: episode.itemBundle.about?.website_link_url ?? null }` when
    `description.is_truncated`, else `undefined`; no `onDescriptionClock`). People →
    `PeoplePane isLoading={false} layout="inline" people={people}
    testIDPrefix="add-by-rss-episode-detail"`.
- Render `addToPlaylistSheet` once, after the list.

Doc comment: the Add by RSS counterpart of `EpisodeDetailScreen`, built from the parsed feed on the
device; list the left-out chips from decision 5 and say Share is absent because Add by RSS pages
are not shareable.

## Tests

- `addByRssHomeDetailData.test.ts`: `toAddByRssAboutPeople` numbers from 1 and drops a person with
  an empty name; the channel `people` field still matches plan 21's expectations.
- Maestro `e2e/add-by-rss.yaml`: plan 34 adds the row tap that opens this page and its asserts.
  This plan adds nothing to the flow by itself.

## Release scratchpad

```markdown
## Mobile Add by RSS episodes get their own page

- Surfaces: mobile
- Change: Add by RSS episodes now open a page with the same header as a podcast episode page:
  artwork with a download button, the feed title (tap to open the feed), the episode title and
  date, and play, duration, and More. Below it are Summary and, when the feed lists them, People.
  More offers Queue Next, Queue Last, Add to Playlist, Mark as Played, and Download. There is no
  Share, Clips, or Funding on this page.
- Who notices: anyone who adds podcasts by RSS on the phone
- Operator steps: none
```
