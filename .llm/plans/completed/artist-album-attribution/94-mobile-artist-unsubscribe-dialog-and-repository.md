**Cursor model:** Opus 5.5 · **Reasoning:** high

# 94 — Mobile: the unsubscribe-from-artist dialog, its data, and many unfollows at once

The pieces plan 95 wires into four screens: a second confirm action on `ConfirmDialog`,
`subscriptionsRepository.unsubscribeMany`, pure helpers that pick the followed albums, and one
hook, `useArtistUnsubscribe`, that finds the albums, asks when there are any, and runs the
choice. No screen changes here.

## Rows

R8, R55, R56, R57, R58, R59

## Runs after

40, 83, 84, 90, 91

Plan 83 adds `addByRssRepository.unfollowFeed` and changes `subscriptionsRepository.unsubscribe`.
Plan 84 adds `listFeedsWithRefs`, `buildAddByRssArtistAlbums`, and `AddByRssArtistAlbumEntry`.
Plan 40 is the last plan that touches `ArtistDetailScreen`'s data before plan 95.

## Files

apps/mobile/src/components/feedback/ConfirmDialog.tsx
apps/mobile/src/data/repositories/subscriptionsRepository.ts
apps/mobile/src/screens/artist/artistUnsubscribeTargets.ts
apps/mobile/src/screens/artist/artistUnsubscribeTargets.test.ts
apps/mobile/src/screens/artist/useArtistUnsubscribe.tsx
apps/mobile/vitest.config.ts

## Reuses

- `ConfirmDialog` and `FormActions` (column of full-width buttons, first on top).
- `subscriptionsRepository.unsubscribe`, `unsubscribeLocal`, `listDirectoryIdTexts`;
  `addByRssRepository.unfollowFeed` (plan 83), `listListedFeeds`, `listFeedsWithRefs` (plan 84).
- `buildAddByRssArtistAlbums` and `AddByRssArtistAlbumEntry` from
  `screens/home/addByRss/addByRssArtistAlbums.ts` (plan 84). Screens already import from each
  other's folders (for example `HomeFeedRowData`); the data layer does not import screens.
- `requestWithMobileAuthRefresh` and `reqPublisherFeedGetRemoteItemsForChannel`, the call
  `ArtistDetailScreen.loadRows` makes; `useAuth`, `useOfflineMode`.
- Plan 90's `reqAccountUnfollowBulk`; plan 91's `features.unsubscribe_artist.*` and `misc.cancel`.

## Decisions this plan fixes

- **Button order (top to bottom):** Artist and Albums (primary), Artist Only (`outline`), Cancel
  (`secondary`). `ConfirmDialog` already puts confirm above cancel; the second confirm sits
  between them.
- **The dialog closes on a choice, then the writes run.** The screen's own busy state (the
  subscribe button's loading, the swipe row's spinner, the remove button's loading) covers the
  wait. `ConfirmDialog` gains no busy prop.
- **Directory artist albums** are its verified albums: the list the screen already loaded when it
  passes one, else a `GET /publisher-feed/channel/:id` at press time. In offline mode, or when that
  request fails, there is nothing to count, so Unsubscribe runs with no dialog. Unsubscribe never
  waits on a failed network call or blocks.
- **Followed** means this device's follow tables: `subscribed_channel` for directory albums, an
  Add by RSS row with `followed !== false` for Add by RSS albums. Signed in, those tables mirror
  the account through follow sync. A listed-only row never counts (R59).
- **Writes:** local first, artist then albums, then one server request for all of them, as
  `unsubscribe` does for one. A server failure leaves the local writes and reports
  `serverError: true`. Add by RSS albums go through `unfollowFeed`, so an album another Add by
  RSS artist on the device still lists stays as listed-only; plan 80's `removeFeed` on the artist
  already drops the listed-only albums nothing else lists.
- **Pending dialog:** a second request while one dialog is open resolves the first as cancelled.
  Unmounting resolves a pending dialog as cancelled.

## `ConfirmDialog.tsx`

Add three optional props, documented together:

```typescript
  /** A second confirm between the first and cancel. Shown only with all three set and a first confirm. */
  secondaryConfirmLabel?: string;
  onSecondaryConfirm?: () => void;
  secondaryConfirmTestID?: string;
```

Build `secondaryConfirmAction: FormAction | undefined` (`variant: 'outline'`) the way
`confirmAction` is built, and `actions` = `[confirmAction, secondaryConfirmAction, cancelAction]`
without the undefined ones; a secondary without a first confirm is dropped. Update the type's doc
comment: one dismiss action, an optional confirm, and an optional second confirm. The 18 current
callers pass none of the new props and render exactly as today.

## `subscriptionsRepository.ts`

```typescript
export type SubscriptionTarget = { idText: string; source: SubscriptionSource };
```

- Extract a module-private `unsubscribeLocalTarget(target): Promise<'listed' | 'removed' | null>`
  from `unsubscribe`'s local branch (Add by RSS → `addByRssRepository.unfollowFeed(idText)`;
  directory → `unsubscribeLocal(idText)` and `null`). `unsubscribe` calls it; its behavior and
  result (including plan 83's `addByRssOutcome`) are unchanged.
- Add after `unsubscribe`:

```typescript
/**
 * End several follows: every local write first, in order, then one account request for all of
 * them. Local writes stand even if the account request fails.
 */
unsubscribeMany: async (params: {
  accountSync?: MobileAuthRequestContext;
  targets: readonly SubscriptionTarget[];
}): Promise<{ serverError: boolean }> => …,
```

  Empty `targets` → `{ serverError: false }`. Signed in: `requestWithMobileAuthRefresh(accountSync, (api) => api.reqAccountUnfollowBulk({ … }))`
  with `channel_id_texts` (directory ids) and `add_by_rss_feed_urls` (Add by RSS ids), each only
  when non-empty. Catch → `{ serverError: true }`.
- Export `SubscriptionTarget` from `data/repositories/index.ts` only if that barrel re-exports
  this file's types by name; otherwise import it from the file.

## `artistUnsubscribeTargets.ts` (new, pure)

```typescript
import type { SubscriptionSource } from '../../data/repositories';
import type { AddByRssArtistAlbumEntry } from '../home/addByRss/addByRssArtistAlbums';

export type ArtistUnsubscribeChoice = 'artist_only' | 'artist_and_albums';
export type ArtistFollowTarget = { idText: string; source: SubscriptionSource };

/** Verified albums this device follows, in album order, each once. Never the artist. */
export const followedDirectoryArtistAlbums = (input: {
  artistIdText: string;
  verifiedAlbumIdTexts: readonly string[];
  subscribedDirectoryIdTexts: ReadonlySet<string>;
}): ArtistFollowTarget[] => …;

/**
 * Albums of an Add by RSS artist this device follows: Add by RSS rows that are followed (feed URL
 * as id) and directory albums in `subscribed_channel`. Entry order, each once, never the artist.
 */
export const followedAddByRssArtistAlbums = (input: {
  artistFeedUrl: string;
  albums: readonly AddByRssArtistAlbumEntry[];
  subscribedDirectoryIdTexts: ReadonlySet<string>;
}): ArtistFollowTarget[] => …;

/** What a choice ends: the artist first, then the albums for Artist and Albums. */
export const artistUnsubscribeTargets = (input: {
  artist: ArtistFollowTarget;
  albums: readonly ArtistFollowTarget[];
  choice: ArtistUnsubscribeChoice;
}): ArtistFollowTarget[] => …;

export const unsubscribeArtistBodyKey = (
  count: number
): 'features.unsubscribe_artist.followed_one_album' | 'features.unsubscribe_artist.followed_albums' => …;
```

Trim ids; skip empty ones. Add by RSS albums compare and dedupe by `feedUrl.trim()`.

## `useArtistUnsubscribe.tsx` (new)

```typescript
export type ArtistUnsubscribeRequest =
  | {
      source: 'directory';
      idText: string;
      title: string;
      /** The verified albums the screen already loaded; omit to fetch them. */
      verifiedAlbumIdTexts?: readonly string[];
    }
  | { source: 'addByRss'; feedUrl: string; title: string };

export type ArtistUnsubscribeResult =
  | { status: 'cancelled' }
  | { status: 'done'; serverError: boolean };

export function useArtistUnsubscribe(): {
  artistUnsubscribeDialog: ReactElement;
  unsubscribeArtist: (request: ArtistUnsubscribeRequest) => Promise<ArtistUnsubscribeResult>;
};
```

Shape follows `components/boost/useBoostSheet.tsx` (a hook returning the element its host
renders once).

1. `accountSync` = `{ accessToken, clearSession, refreshToken, setTokens }` from `useAuth()` when
   `status === 'authenticated'`, else `undefined` (as the screens build it today).
2. Load the followed albums inside a `try`; any throw → `[]` (no dialog):
   - Directory: ids = `verifiedAlbumIdTexts` when given; else `[]` when offline mode is on; else
     `(await requestWithMobileAuthRefresh(authContext, (api) => api.reqPublisherFeedGetRemoteItemsForChannel(idText))).channelsAdded.map((row) => row.id_text)`.
     Then `followedDirectoryArtistAlbums` with `new Set(await subscriptionsRepository.listDirectoryIdTexts())`.
   - Add by RSS: `listListedFeeds(feedUrl)` and `listFeedsWithRefs()`; the artist is the entry
     whose `feed.feedUrl` equals `feedUrl` (none → `[]`); `buildAddByRssArtistAlbums({ artist, listings, feeds }).albums`,
     then `followedAddByRssArtistAlbums` with the same directory set.
3. No albums → `subscriptionsRepository.unsubscribe({ accountSync, idText, source })` (Add by RSS
   passes the feed URL) and return `{ status: 'done', serverError }`.
4. Otherwise store `{ title, albums }` in state and a resolver in a ref; await the choice.
   Cancel (button, backdrop, back) → `{ status: 'cancelled' }`. Artist Only → `unsubscribe` as in
   step 3. Artist and Albums → `unsubscribeMany({ accountSync, targets: artistUnsubscribeTargets(…) })`.
   Clear the dialog state before the writes.
5. `artistUnsubscribeDialog` is a `ConfirmDialog` with `visible={pending !== null}`,
   `title={t('features.unsubscribe_artist.title', { artist: pending.title })}`,
   `body={t(unsubscribeArtistBodyKey(count), { count })}`,
   `confirmLabel={t('features.unsubscribe_artist.artist_and_albums')}`,
   `secondaryConfirmLabel={t('features.unsubscribe_artist.artist_only')}`,
   `cancelLabel={t('misc.cancel')}`, and test ids `artist-unsubscribe-dialog`,
   `artist-unsubscribe-dialog-artist-and-albums`, `artist-unsubscribe-dialog-artist-only`,
   `artist-unsubscribe-dialog-cancel`. Hidden, it renders with empty strings.

`unsubscribeArtist` is stable across renders (`useCallback` over the auth values and offline
flag). A `useEffect` cleanup resolves a pending resolver as cancelled.

## `vitest.config.ts`

Add `src/screens/artist/artistUnsubscribeTargets.test.ts` to `include` beside plan 40's
`artistDetailSections.test.ts`.

## Must stay true

- Every current `ConfirmDialog` renders as before.
- `unsubscribe`'s signature and result are unchanged.
- Nothing here blocks first paint or adds a request on screen load.
- No `as`, no `any`, strict equality. Named exports only. Comments name no plan or step.

## Tests

`artistUnsubscribeTargets.test.ts` (new). One `it` each:

- Directory: two verified albums, one in the subscribed set → that one; the artist's own id and
  an empty id are skipped; a duplicate appears once.
- Add by RSS: a followed `add-by-rss` entry counts by feed URL; one with `followed: false` does
  not; a `directory` entry counts only when subscribed; the artist's own feed never counts.
- `artistUnsubscribeTargets`: Artist Only → just the artist; Artist and Albums → the artist
  first, then the albums in order.
- `unsubscribeArtistBodyKey(1)` and `(2)`.

The repository and hook run against SQLite and React Native and are not unit-tested
(`vitest.config.ts` keeps them out); plan 97's Maestro flow drives them.

## Release scratchpad

none
