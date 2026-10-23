**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 93 — Web: ask about albums when unsubscribing from an Add by RSS artist

`AddByRSSArtistHeader` gets the same dialog as plan 92. "Albums by the artist" are the albums it
lists plus Add by RSS albums on this browser that name it (plan 72's
`resolveAddByRSSArtistAlbums`). The dialog counts the ones the member follows: followed Add by
RSS albums and directory albums the account follows. Listed albums the member never followed
are not counted and leave with the artist, as plan 71's prune already does (R59).

## Rows

R8, R56, R57, R58, R59

## Runs after

71, 72, 73, 90, 91, 92

Plan 71 adds the listed and publisher-link stores and the prune in
`unfollowAddByRSSChannelAndClear`. Plan 72 adds the matching functions. Plan 73 is the last plan
that edits the Add by RSS artist page before this one. Plan 92 adds `UnsubscribeArtistModal` and
`apps/web/src/lib/artistUnsubscribe.ts`.

## Files

apps/web/src/lib/artistUnsubscribe.ts
apps/web/src/lib/artistUnsubscribe.test.ts
apps/web/src/utils/addByRSS/artistUnsubscribe.ts
apps/web/src/utils/addByRSS/api.ts
apps/web/src/utils/addByRSS/actions.ts
apps/web/src/utils/addByRSS/actions.test.ts
apps/web/src/components/AddByRSS/Artist/AddByRSSArtistHeader.tsx
release-notes/scratchpad.md

## Reuses

- Plan 92's `UnsubscribeArtistModal` and `unsubscribeArtistBodyKey`.
- Plan 72: `mergeAddByRSSAlbumSources`, `resolveAddByRSSArtistAlbums`, `AddByRSSArtistAlbumEntry`.
- Plan 71: `getAllListedAddByRSSFeeds`, `getAddByRSSPublisherLink`,
  `toAddByRSSComparableFeedUrl`, `pruneAddByRSSPublisherData`.
- `getAllAddByRSSFeeds`, `removeAddByRSSFeed` (`storage.ts`), `deleteCredentials`
  (`credentialStore.ts`), and `unfollowAddByRSSChannelAndClear` for Artist Only.
- `getApiRequestService().reqChannelGetByIdOrIdText` for directory album ids, five at a time,
  as plan 73 loads directory artwork.
- Plan 90's `reqAccountUnfollowBulk`.

## Decisions this plan fixes

- **The header works out the albums when Unsubscribe is pressed**, not when the page loads. It
  renders on the artist page, the Add by RSS detail page, and the livestream page, and only the
  first already holds the albums. Reading three IndexedDB stores on press is quick.
- **Directory albums need their numeric id** to check `account_following_channels`, which holds
  only `channel_id`. Fetch each directory album the artist lists with `reqChannelGetByIdOrIdText`,
  in chunks of five with `Promise.allSettled`; a failed fetch counts as not followed. Skip the
  fetches when the account follows no directory channel.
- **When reading the stores fails**, log it and unsubscribe the artist only with no dialog, as
  today. Unsubscribe is never blocked, and the album follows stay, which is the cautious outcome.
- **Artist and Albums is one server request** (plan 90) for the artist, its followed Add by RSS
  albums, and its followed directory albums. Then this browser drops each Add by RSS feed and its
  credentials, as `unfollowAddByRSSChannelAndClear` does for one, and prunes once.
- **Errors** keep the header's behavior: `console.error` and `window.alert('Error performing action.')`.

## `apps/web/src/lib/artistUnsubscribe.ts` (add)

```typescript
import type { AddByRSSArtistAlbumEntry } from '../utils/addByRSS/publisherLinks';

/** Albums of an Add by RSS artist the member follows, split by where each follow lives. */
export type AddByRSSArtistFollowedAlbums = {
  addByRSSFeeds: { feedUrl: string; idText: string }[];
  directoryChannelIdTexts: string[];
};

export const countAddByRSSArtistFollowedAlbums = (albums: AddByRSSArtistFollowedAlbums): number =>
  albums.addByRSSFeeds.length + albums.directoryChannelIdTexts.length;

/**
 * Add by RSS entries count when their source is followed (a listed-only album never does).
 * Directory entries count when their channel id is in the account's follows. Entry order, each
 * album once.
 */
export const followedAddByRSSArtistAlbums = (input: {
  albums: readonly AddByRSSArtistAlbumEntry[];
  directoryChannelIdsByIdText: ReadonlyMap<string, number>;
  followingChannelIds: ReadonlySet<number>;
}): AddByRSSArtistFollowedAlbums => …;
```

Use `import type`. Add by RSS dedupe compares `toAddByRSSComparableFeedUrl(feed.feedUrl)`.

## `apps/web/src/utils/addByRSS/artistUnsubscribe.ts` (new)

```typescript
/** The albums of `artist` the member follows, read from this browser's stores. */
export const loadAddByRSSArtistFollowedAlbums = async (params: {
  artist: AddByRSSFeedRecord;
  followingChannelIds: ReadonlySet<number>;
}): Promise<AddByRSSArtistFollowedAlbums> => …;
```

1. In parallel: `getAllAddByRSSFeeds()`, `getAllListedAddByRSSFeeds()`,
   `getAddByRSSPublisherLink(toAddByRSSComparableFeedUrl(artist.feedUrl))`.
2. `entries = resolveAddByRSSArtistAlbums({ artist, link, sources: mergeAddByRSSAlbumSources(followed, listed) })`.
3. When `followingChannelIds.size > 0`: the distinct `channelIdText`s of `directory` entries,
   fetched five at a time as above; build `Map<id_text, id>` from the fulfilled results
   (`console.error` each rejection).
4. Return `followedAddByRSSArtistAlbums({ albums: entries, directoryChannelIdsByIdText, followingChannelIds })`.

## `api.ts`

```typescript
export const unfollowAddByRSSFeedsBulk = async (params: {
  feedUrls: string[];
  channelIdTexts: string[];
}): Promise<DTOAccount> =>
  getApiRequestService().reqAccountUnfollowBulk({
    add_by_rss_feed_urls: params.feedUrls,
    ...(params.channelIdTexts.length > 0 ? { channel_id_texts: params.channelIdTexts } : {}),
  });
```

## `actions.ts`

- Extract from `unfollowAddByRSSChannelAndClear` a module-private
  `clearLocalAddByRSSFollow({ accountId, feedUrl, channelIdText })`: `removeAddByRSSFeed` and the
  `deleteCredentials` try/catch. `unfollowAddByRSSChannelAndClear` calls it and keeps plan 71's
  prune; its result is unchanged.
- Add:

```typescript
/** Ends the artist's follow and the given album follows in one request, then clears them here. */
export const unfollowAddByRSSArtistAndAlbums = async (params: {
  accountId: string;
  artist: { feedUrl: string; idText: string };
  albums: AddByRSSArtistFollowedAlbums;
}): Promise<DTOAccount> => …;
```

  1. `account = await unfollowAddByRSSFeedsBulk({ feedUrls: [artist.feedUrl, ...albums.addByRSSFeeds.map((f) => f.feedUrl)], channelIdTexts: albums.directoryChannelIdTexts })`.
  2. `clearLocalAddByRSSFollow` for the artist, then each Add by RSS album, in order.
  3. `pruneAddByRSSPublisherData()` in its own try/catch that logs, exactly as plan 71's prune in
     `unfollowAddByRSSChannelAndClear`.
  4. Return `account`.

  The server call comes first, as in the single unfollow: if it fails, nothing changes here.

## `AddByRSSArtistHeader.tsx`

- State: `const [promptAlbums, setPromptAlbums] = useState<AddByRSSArtistFollowedAlbums | null>(null);`
  and `const [promptBusy, setPromptBusy] = useState<'artist_only' | 'artist_and_albums' | null>(null);`.
- `toggleSubscribe`, subscribed branch, before today's unfollow (inside the existing
  `setIsUpdating(true)` / `try`):

  ```typescript
  let albums: AddByRSSArtistFollowedAlbums | null = null;
  try {
    albums = await loadAddByRSSArtistFollowedAlbums({
      artist: feed,
      followingChannelIds: new Set(loggedInAccount.account_following_channels?.map((row) => row.channel_id) ?? []),
    });
  } catch (error) {
    console.error('Could not read albums for this artist', error);
  }
  if (albums !== null && countAddByRSSArtistFollowedAlbums(albums) > 0) {
    setPromptAlbums(albums);
    return;
  }
  ```

  Then today's `unfollowAddByRSSChannelAndClear`. The `finally` already clears `isUpdating`.
- `runPromptAction(action)`: return when signed out or `promptAlbums === null`; set busy; Artist
  Only → `unfollowAddByRSSChannelAndClear({ accountId, feedUrl, channelIdText: feed.idText })`;
  Artist and Albums → `unfollowAddByRSSArtistAndAlbums({ accountId, artist: { feedUrl, idText: feed.idText }, albums: promptAlbums })`;
  `setLoggedInAccount(nextAccount)`. `catch` → today's error handling. `finally` → clear busy and
  `setPromptAlbums(null)`.
- Render `<UnsubscribeArtistModal isOpen={promptAlbums !== null} albumCount={promptAlbums === null ? 0 : countAddByRSSArtistFollowedAlbums(promptAlbums)} artistTitle={title} busyAction={promptBusy} onCancel={() => setPromptAlbums(null)} onArtistOnly={…} onArtistAndAlbums={…} />`
  once, after `CommonArtistHeader` inside a fragment (not inside `buttonsNode`, which renders
  twice for desktop and tablet).

## Must stay true

- Subscribe, and Unsubscribe with no followed album, behave exactly as today.
- A listed album the member never followed is never counted and never sent to the server; plan
  71's prune removes it when no remaining artist lists it.
- An album another followed artist still lists stays listed under that artist after Artist and
  Albums (the prune keeps it).
- `AddByRSSAlbumHeader` and `AddByRSSPodcastHeader` are unchanged. The credentials page's remove
  control is unchanged (see plan 95's decision about remove controls that already confirm).
- No `as`, no `any`, strict equality.

## Tests

- `apps/web/src/lib/artistUnsubscribe.test.ts` (add): a followed Add by RSS album counts and a
  listed one does not; a directory entry counts only when its id is followed; a directory entry
  with no id in the map is skipped; the same Add by RSS album under an `http` and an `https` URL
  counts once; `countAddByRSSArtistFollowedAlbums` adds both lists.
- `apps/web/src/utils/addByRSS/actions.test.ts` (add a `describe('unfollowAddByRSSArtistAndAlbums')`):
  extend the existing `vi.mock('./api')` and `vi.mock('./storage')` factories with
  `unfollowAddByRSSFeedsBulk` and `removeAddByRSSFeed`, and mock `./credentialStore`
  (`deleteCredentials`) and `./listedFeeds` (`pruneAddByRSSPublisherData`) with `vi.hoisted` fns,
  keeping every name plan 71 already mocks there. Cases: the bulk call gets the artist URL first,
  then the album URLs and the directory id texts; `removeAddByRSSFeed` runs for the artist and
  each album; prune runs once; when the bulk call rejects, nothing is removed and the error
  propagates.

Plan 96 adds the Playwright spec.

## Release scratchpad

```markdown
## Web asks about albums when you unsubscribe from an Add by RSS artist

- Surfaces: web
- Change: Unsubscribe on an Add by RSS artist opens "Unsubscribe from [Artist]?" when you follow
  at least one album it lists or that names it (Add by RSS or directory). Artist Only keeps those
  album follows; Artist and Albums ends them with the artist in one request. Albums you never
  followed, which only showed under the artist, still leave with it without asking.
- Who notices: signed-in members with Add by RSS artists
- Operator steps: none
```
