**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 83 — Mobile: follow an album an Add by RSS artist listed, and unfollow back to listed

An album stored because an Add by RSS artist lists it shows only under that artist until the
member follows it (R46). Its screen is the normal Add by RSS album screen
(`AddByRssHomeDetailScreen`). This plan gives that screen a Subscribe button for a listed-only
album, makes Unsubscribe on a listed album return it to listed-only instead of deleting it, and
keeps the library merge from turning listed-only rows into follows or new ids.

## Rows

R8, R44, R46

## Runs after

80, 82

## Files

apps/mobile/src/data/repositories/addByRssRepository.ts
apps/mobile/src/data/repositories/subscriptionsRepository.ts
apps/mobile/src/hooks/useAddByRssFeeds.ts
apps/mobile/src/lib/addByRss/domain.ts
apps/mobile/src/lib/addByRss/domain.test.ts
apps/mobile/src/screens/home/AddByRssHomeDetailScreen.tsx
release-notes/scratchpad.md

## Reuses

- `isFeedListed`, `listAllListedFeeds`, `setFollowed`, `deleteStoredFeed`, `removeFeed`
  (plan 80).
- `reqAccountFollowAddByRSSChannel` and `reqAccountUnfollowAddByRSSChannel`, as
  `useAddByRssAddFlow.ts` and `subscriptionsRepository.unsubscribe` call them.
- `useMembershipGate` (`evaluateFeature('add_by_rss_add')`, `openGate`), as the add flow uses it.
- Catalog keys `features.subscribe`, `features.unsubscribe`, `errors.generic` (all exist).

## Decisions this plan fixes

- **Subscribing a listed album is a normal Add by RSS follow** with the row's own id, bundle, and
  title: one server follow, then `setFollowed(feedUrl, true)` (which seeds auto-download). No
  re-parse; the stored bundle is current from the artist's last refresh.
- **Unsubscribing an album some Add by RSS artist on the device still lists demotes it** to
  listed-only (server unfollow, `followed = 0`), and the screen stays open showing Subscribe. An
  album nothing lists is removed as today and the screen goes back. Area J's dialog (plans 90–99)
  replaces the button press, not this outcome.
- **Unsubscribing an artist** goes through `removeFeed`, which drops its listings and the
  listed-only albums nothing else lists (plan 80). Albums the member followed stay.

## Repository (`addByRssRepository.ts`)

```typescript
/**
 * Ends this device's follow of a feed. A feed an Add by RSS artist on the device still lists
 * stays as listed-only; any other feed is removed.
 */
unfollowFeed: async (feedUrl: string): Promise<'listed' | 'removed'> => …,
```

Read the row (`getFeedByUrl`) and `listAllListedFeeds()`. When the row exists and
`isFeedListed({ feedUrl, podcastGuid }, listings)`, `setFollowed(feedUrl, false)`, remove its
auto-download rule (`autoDownloadRepository.removeChannel(feedUrl)`, as `deleteStoredFeed` does),
and return `'listed'`. Otherwise `await removeFeed(feedUrl)` and return `'removed'`. Read the
row's `podcastGuid` with a select of that one column; `MobileAddByRSSFeedRecord` does not carry it.

## `subscriptionsRepository.unsubscribe`

For `source === 'addByRss'`, call `addByRssRepository.unfollowFeed(params.idText)` instead of
`removeFeed`, and return `{ serverError, addByRssOutcome }` where
`addByRssOutcome?: 'listed' | 'removed'` is set only for Add by RSS. The signature's return type
gains that optional field; directory callers are unchanged. Update the doc comment: a listed album
stays on the device under its artist.

## `useAddByRssFeeds.ts`

- `reloadFeeds`: read `allFeeds = await addByRssRepository.listAllFeeds()` and pass it to the
  merge (so a server follow whose row is listed-only keeps its `idText`). The signed-out and error
  branches show `allFeeds.filter((feed) => feed.followed !== false)`.
- `removeFeed`: call `addByRssRepository.unfollowFeed(feedUrl)` instead of `removeFeed`.

## `domain.ts` (`mergeLocalAndRemoteAddByRssFeeds`)

- Each merged remote record sets `followed: true` (a server follow is a follow).
- `localOnly` keeps only local feeds with `followed !== false`.
- Doc comment: local listed-only rows are inputs for id reuse, not output.

## `AddByRssHomeDetailScreen.tsx`

- `const isListedOnly = detailForRoute?.feed.followed === false;`
- `handleSubscribe` (new `useCallback`, next to `handleRemove` near line 361): return when
  `detailForRoute === null`, busy, or not signed in. `evaluateFeature('add_by_rss_add')`; denied →
  `openGate(reason)` and return. Then `requestWithMobileAuthRefresh({ accessToken, clearSession, refreshToken, setTokens }, (api) => api.reqAccountFollowAddByRSSChannel({ feed_url, image_url: feed.imageUrl, title: headerTitle, ...(feed.requiresCredentials === true ? { requires_credentials: true } : {}) }))`,
  then `addByRssRepository.setFollowed(feed.feedUrl, true)`, `homeFeedRefresh.notify()`, and
  reload the screen's detail the way `handleRetryDetail` does. Failure → `setRemoveErrorKey('errors.generic')`.
  Reuse `isRemoving` as the busy flag for both buttons.
- `handleRemove`: read the result of `subscriptionsRepository.unsubscribe`. When
  `addByRssOutcome === 'listed'`, `homeFeedRefresh.notify()` and reload the detail; do not
  `goBack`. Otherwise keep today's `notify` + `goBack`.
- In the `ChannelHeader` `actions` (near line 486): when `isListedOnly`, render
  `<Button label={t('features.subscribe')} loading={isRemoving} onPress={handleSubscribePress} size="sm" testID="add-by-rss-home-subscribe" variant="primary" />`;
  otherwise today's Unsubscribe button. When signed out, a listed-only album shows no button.

## Must stay true

- A feed no Add by RSS artist lists behaves exactly as today on unsubscribe.
- Library and Home never show a listed-only row, before or after a library reload.
- A server follow never gets a second local row or a new `idText`.

## Tests

`domain.test.ts`: `mergeLocalAndRemoteAddByRssFeeds` with a listed-only local row whose URL the
server follows returns it once with that `idText` and `followed: true`; a listed-only local row
the server does not follow is not returned; a followed local row the server does not list is still
returned (today's case).

## Release scratchpad

```markdown
## Follow an album from an Add by RSS artist on mobile

- Surfaces: mobile
- Change: an album held on the device because an Add by RSS artist lists it shows Subscribe on
  its page. Subscribing follows it like any Add by RSS feed. Unsubscribing an album that an Add by
  RSS artist on the device still lists keeps it under that artist instead of deleting it.
  Removing an Add by RSS artist removes the albums only it listed and that were never followed.
- Who notices: members with Add by RSS artist feeds
- Operator steps: none
```
