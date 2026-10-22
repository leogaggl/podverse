# 65 — Web Subscribed channel chips include Add by RSS follows

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

Rows: R20, R22, R47 (channel chips). Web only. Paths are under `apps/web/src/` unless stated.
Runs after plans 61 and 64. Plan 66 adds the item chips and reuses this plan's hook.

Parity source: mobile plan 40 (`homeFeedData.ts` reads `subscriptionsRepository.list({
credentials: 'ready', filter: 'all' })`). On web, the Add by RSS library list
(`components/AddByRSS/List/AddByRSSListClient.tsx`) already does the reading this needs; the
Subscribed lists get the same reading through one hook.

## Locked decisions

1. **Which feeds.** This browser's stored Add by RSS feeds of the chip's resource type that are
   ready on this browser: `partitionAddByRSSFeedsByCredentials(...).ready`. Podcasts uses
   resource type `'podcasts'`, Artists `'artists'`, and Albums `'albums'`. A feed's type is its
   medium; livestreams are a per-feed flag, not a type (plans 82 and 88), so a feed with
   livestreams stays on its medium's chip and plan 84 lists its live items. Feeds that need a
   username and password stay off Subscribed; the Add by RSS page's section is the only place
   they show (**add-by-rss-client-held-credentials**). Unparsed feeds that are ready show, as in
   the library.
1. **When the hook runs.** Only when the signed-in account follows at least one Add by RSS feed
   (`loggedInAccount.account_following_add_by_rss_channels` is non-empty). Otherwise it returns
   no feeds and is ready at once, and the list behaves exactly as plan 61 left it.
1. **Hook name and path.** `useReadyAddByRSSFeeds` in `hooks/useReadyAddByRSSFeeds.ts`. Plan 70
   reports its follow sync and first parses to the background activity store.
1. **Merged mode.** In subscribed scope, a channel chip with at least one ready feed reads the
   account's whole subscribed list (`useFullSubscribedChannels`) and pages the merged list
   locally, 60 rows a page (`PAGINATION.DEFAULT_LIMIT`). The page number is component state, as
   the Podcasts filter's page is today, and resets to 1 when sort, range, or filter term change.
   With no ready feeds, the list keeps server paging.
1. **Merge order** (`mergeSubscribedChannelEntries`):
   - `a_z`: by `articleStrippedTitle(title)` with `localeCompare`.
   - `recent`: newest last-published date first; no date after every dated row.
   - `oldest`: oldest first; no date after every dated row.
   - `top`: every server row in server order, then the feeds, newest first. Feeds have no
     listen count (mobile ranks them after ranked rows the same way).
   - Server rows never change their order relative to each other: the merge walks the server
     list and the sorted feeds together, and a tie goes to the server row.
1. **Dates and titles.** Server row: `channel.title ?? ''` and
   `channel.channel_about?.last_pub_date`. Feed: the title the feed's row already shows
   (`mappedFeed?.channel?.channel?.title ?? title ?? feedUrl`) and
   `mappedFeed?.channel?.about?.last_pub_date`. A date is a `Date`, an ISO string, or null;
   convert to epoch ms, null when missing or unparseable.
1. **Rows.** Merging happens on the shared list-item types (`PodcastListItem`, `ArtistListItem`,
   `AlbumListItem`), which the Common row and grid components already render for both sources. An
   Add by RSS row links to its Add by RSS detail page (`/add-by-rss/podcast|artist|album/<idText>`),
   as in the library. Unseen badges stay on server rows only.
1. **Podcasts filter.** The filter term narrows the merged list, so a typed term finds Add by RSS
   feeds too.
1. **Signed out or browse scope.** No change. The hook is inactive and Browse is server only.

## Files

| File                                                               | Change                      |
| ------------------------------------------------------------------ | --------------------------- |
| `hooks/useReadyAddByRSSFeeds.ts`                                   | New                         |
| `utils/subscribed/channelListItems.ts`                             | New: item mappers           |
| `utils/subscribed/mergeSubscribedChannels.ts`                      | New: merge and date helpers |
| `utils/subscribed/mergeSubscribedChannels.test.ts`                 | New, Vitest                 |
| `components/Core/Podcast/CorePodcastNodes.tsx`                     | Use the mapper              |
| `components/Core/Artist/CoreArtistNodes.tsx`                       | Use the mapper              |
| `components/Core/Artist/Album/CoreAlbumNodes.tsx`                  | Use the mapper              |
| `components/AddByRSS/Podcast/AddByRSSPodcastListNodes.tsx`         | Use the mapper              |
| `components/AddByRSS/Artist/AddByRSSArtist{Row,GridNode}.tsx`      | Use the mapper              |
| `components/AddByRSS/Artist/Album/AddByRSSAlbum{Row,GridNode}.tsx` | Use the mapper              |
| `components/Core/Podcast/CorePodcasts.tsx`                         | Optional `items`            |
| `components/Core/Artist/CoreArtists.tsx`                           | Optional `items`            |
| `components/Core/Artist/Album/CoreAlbums.tsx`                      | Optional `items`            |
| `app/_media-lists/podcasts/PodcastsPageList.tsx`                   | Merged mode                 |
| `app/_media-lists/artists/ArtistsPageList.tsx`                     | Merged mode                 |
| `app/_media-lists/albums/AlbumsPageList.tsx`                       | Merged mode                 |

## Implementation

### `hooks/useReadyAddByRSSFeeds.ts`

```typescript
export type ReadyAddByRSSFeeds = {
  feeds: AddByRSSFeedRecord[];
  /** False until the first read finishes; true at once when the hook is inactive. */
  isReady: boolean;
};

export function useReadyAddByRSSFeeds(
  resourceTypes: readonly AddByRSSResourceType[]
): ReadyAddByRSSFeeds;
```

Callers pass module-level constant arrays. Key the effects on `resourceTypes.join('|')` and the
account's `id_text`. An empty `resourceTypes` makes the hook inactive, the same as decision 2.

When active, on mount and on an account change:

1. `listFeedsWithCredentials(accountId)` into a `Set`. On error, `console.error` and use an empty
   set.
1. `syncAddByRSSFollowStubs(accountId)`. On error, `console.error` and go on.
1. Read the feeds: `getAddByRSSFeedsByResourceType(type)` for each type, concatenated. Keep the
   ready half of `partitionAddByRSSFeedsByCredentials(feeds, set)`. Set `isReady`.
1. `void enqueueAddByRSSFirstParses({ accountId })`. Its default status handler stores each
   result and emits a feed change.

Then subscribe with `onAddByRSSFeedChanged`. Bursts collapse into one re-read of the credentials
set and the feeds, 250 ms after the last event, the way `AddByRSSListClient` does it (its
`FEED_CHANGED_REFRESH_DELAY_MS`). Unsubscribe and clear the timer on unmount. Ignore results that
land after unmount or after the account changed.

### `utils/subscribed/channelListItems.ts`

Move each existing mapping out of the component into a named function, with no field changes:

- `podcastListItemFromChannel(channel, unseenBadge)` and `podcastListItemFromAddByRSSFeed(feed)`
  from `CorePodcastNodes` and `AddByRSSPodcastListNodes`.
- `artistListItemFromChannel(channel)` and `artistListItemFromAddByRSSFeed(feed)` from
  `CoreArtistNodes` and `AddByRSSArtistRow` / `AddByRSSArtistGridNode` (identical today).
- `albumListItemFromChannel(channel)` and `albumListItemFromAddByRSSFeed(feed)` from
  `CoreAlbumNodes` and `AddByRSSAlbumRow` / `AddByRSSAlbumGridNode`.

Also `addByRSSFeedListTitle(feed)` for the title expression the feed mappers share. The
components call the mappers; their output does not change.

### `utils/subscribed/mergeSubscribedChannels.ts`

```typescript
export type SubscribedChannelEntry<T> = {
  item: T;
  title: string;
  lastPubDateMs: number | null;
};

export const toEpochMsOrNull = (value: Date | string | null | undefined): number | null;

export const mergeSubscribedChannelEntries = <T>(params: {
  server: readonly SubscribedChannelEntry<T>[];
  addByRSS: readonly SubscribedChannelEntry<T>[];
  sort: QueryParamsSubscribedFullSort;
}): T[];
```

`addByRSS` is sorted with the sort's comparator (for `top`, the `recent` comparator) and merged
with `server` per decision 5. Equal keys fall back to the stripped title, then keep input order.

### Core list components

`CorePodcasts`, `CoreArtists`, and `CoreAlbums` take an optional `items` prop of their list-item
type. When it is given, the nodes come from `CommonPodcastListNodes` / `CommonArtistListNodes` /
`CommonAlbumListNodes` with those items, and the scroll-to-top effect watches `items` in place of
`channels`. Without it, nothing changes.

### List files (merged mode)

The three `<Media>PageList.tsx` files follow one pattern. Podcasts shown; Artists and Albums are
the same without the filter term.

```typescript
const ADD_BY_RSS_PODCAST_TYPES = ['podcasts'] as const;
// inside the component:
const isSubscribedScope = scope === 'subscribed';
const addByRSS = useReadyAddByRSSFeeds(isSubscribedScope ? ADD_BY_RSS_PODCAST_TYPES : NO_TYPES);
const isMerged = isSubscribedScope && addByRSS.feeds.length > 0;
const isLocalPaging = isMerged || isFiltering;
const fullList = useFullSubscribedChannels(isLocalPaging, { medium, range, sort });
```

- `NO_TYPES` is a module-level empty array; with no types the hook is inactive.
- `scope` comes from the list context (plan 61). Mediums: Podcasts `'av'`, Artists
  `'publisher-music'`, Albums `'music'`, the values each context already sends.
- Build entries from `fullList.channels` with the channel mapper and from `addByRSS.feeds` with
  the feed mapper, merge, then page with `selectFilteredSubscribedPage({ channels: merged, page,
pageSize: PAGINATION.DEFAULT_LIMIT, term })`. Artists and Albums pass `term: ''` and import it
  from `../podcasts/podcastsFilter`. Memoize the merged array and the page slice.
- Render the Core list with `items={slice.channels}`, `page={slice.page}`, `totalPages`, and the
  local `setPage` when `isLocalPaging`; the server props otherwise.
- `HowToStartInfo` gets the merged rows and their page count in merged mode, so an account that
  follows only Add by RSS feeds does not see the getting-started message.
- The Podcasts results count and "no matches" message use the merged match count.
- The loading overlay also shows while `isMerged && !fullList.isReady`. Until then the server
  page stays on screen.

## Reuse

`AddByRSSListClient`'s load sequence (credentials set, follow sync, read, first parse, feed-change
re-read), `partitionAddByRSSFeedsByCredentials`, `useFullSubscribedChannels`,
`selectFilteredSubscribedPage`, the Common row and grid components, and mobile's comparator rules
in `apps/mobile/src/data/repositories/subscriptionsMerge.ts` (`compareSubscribedByTitle`,
`compareSubscribedByRecency`).

## Tests

**Unit** — `utils/subscribed/mergeSubscribedChannels.test.ts` (Vitest, plain entries with a
string `item`):

- `a_z` places a feed titled "The Beta" between server rows "Alpha" and "Gamma".
- `recent` interleaves by date and puts an undated feed after dated server rows.
- `oldest` puts the oldest feed first and undated rows last.
- `top` keeps every server row first in server order, then feeds newest first.
- Server rows given out of the comparator's order keep their relative order.
- A tie between a server row and a feed puts the server row first.
- `toEpochMsOrNull` reads a `Date`, an ISO string, null, and an invalid string (null).

The hook is covered by plan 69's Playwright spec (an Add by RSS feed shows on Subscribed).

## Release scratchpad

```markdown
## Web Subscribed lists include this browser's Add by RSS feeds

- Surfaces: web
- Change: On Subscribed (`/`), the Podcasts, Artists, and Albums chips list the account's
  followed podcasts, artists, and albums together with the Add by RSS feeds of that kind that
  this browser can read, in the chosen sort. An Add by RSS row opens its Add by RSS page. Feeds
  waiting for a username and password stay on the Add by RSS page. The Podcasts filter also
  finds Add by RSS feeds. Under "Top", Add by RSS feeds follow the ranked podcasts.
- Who notices: signed-in web users who follow Add by RSS feeds
- Operator steps: none
```
