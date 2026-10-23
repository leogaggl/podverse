**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 95 — Mobile: every artist unsubscribe asks about albums

Plan 94's `useArtistUnsubscribe` replaces the direct `subscriptionsRepository.unsubscribe` call
wherever an artist can be unsubscribed: the directory artist screen, the Add by RSS artist detail
screen, and the Artists chip on Home and in the Add by RSS library (swipe and long-press sheet).

## Rows

R8, R55, R56, R58

## Runs after

40, 83, 84, 85, 94

Plans 40 and 85 edit `ArtistDetailScreen.tsx`; plans 83 and 84 edit `AddByRssHomeDetailScreen.tsx`.

## Files

apps/mobile/src/screens/artist/ArtistDetailScreen.tsx
apps/mobile/src/screens/home/AddByRssHomeDetailScreen.tsx
apps/mobile/src/screens/home/HomeScreen.tsx
apps/mobile/src/screens/rss/AddByRssRootScreen.tsx
release-notes/scratchpad.md

## Reuses

- `useArtistUnsubscribe` from `screens/artist/useArtistUnsubscribe` (plan 94). Each screen calls
  it once and renders `{artistUnsubscribeDialog}` once.
- Each screen's existing busy flag, error key, and refresh calls.

## Decisions this plan fixes

- **Cancel changes nothing**: no state update, no refresh, no navigation, no error. The swipe row
  closes when the handler's promise resolves, as it does today.
- **Only artist rows ask.** Home and the Add by RSS library route a row through the hook only when
  `selectedMediaType === 'artists'`; every other chip keeps today's call.
- **Remove controls that already confirm stay as they are.** `AddByRssCredentialsScreen` asks
  "Remove Feed" in its own dialog, and the feed it removes has not been read, so the device holds
  no albums it lists. The web credentials page matches. Albums that name such an artist keep their
  follows, the cautious outcome.
- **Rows from Artist and Albums on other chips** refresh the way they do today after an
  unsubscribe (`homeFeedRefresh.notify()` where the screen already calls it; Home reloads a chip
  when it is selected).

## `ArtistDetailScreen.tsx`

- `const { artistUnsubscribeDialog, unsubscribeArtist } = useArtistUnsubscribe();` beside
  `useBoostSheet()`. Render `{artistUnsubscribeDialog}` next to `{boostSheet}` (near the end of
  the returned tree).
- `handleSubscriptionToggle`, subscribed branch: replace the `subscriptionsRepository.unsubscribe`
  call with

  ```typescript
  const result = await unsubscribeArtist({
    source: 'directory',
    idText: artistId,
    title: artistTitle,
    verifiedAlbumIdTexts: showDirectoryAlbums ? verifiedAlbums.map((album) => album.id_text) : undefined,
  });
  if (result.status === 'cancelled') {
    return;
  }
  ```

  then today's `setIsSubscribed(false)`, `homeFeedRefresh.notify()`, and `serverError` notice.
  `showDirectoryAlbums` and `verifiedAlbums` are plan 40's names (the screen's verified albums once
  loaded online); use whatever plan 40 left and keep the rule: pass the list only when it is
  loaded and online, otherwise `undefined`. `artistTitle` is the screen's header title state; use
  `channel?.title` when it is empty. Add the new values to the `useCallback` dependencies.
- The `isSavingSubscription` flag stays set while the dialog is open, so a second press is ignored.

## `AddByRssHomeDetailScreen.tsx`

- Hook as above; render the dialog next to `{boostSheet}`.
- `handleRemove`: when plan 84's `isArtistFeed` is true, call
  `unsubscribeArtist({ source: 'addByRss', feedUrl: detailForRoute.feed.feedUrl, title: headerTitle })`.
  `cancelled` → return (the `finally` clears `isRemoving`). `done` → `homeFeedRefresh.notify()`,
  `navigation.goBack()`, and `setRemoveErrorKey('errors.generic')` when `serverError`. Other feeds
  keep today's call and plan 83's listed-outcome handling. `headerTitle` is the existing const
  near line 480; move the call below it or compute the title in the handler from the same
  expression, whichever keeps hooks before any early return.

## `HomeScreen.tsx`

- Hook as above; render the dialog once inside the screen's root, after the list.
- `handleUnsubscribe`: when `selectedMediaType === 'artists'`, call `unsubscribeArtist` with
  `{ source: 'directory', idText: row.id, title: row.title }` for directory rows and
  `{ source: 'addByRss', feedUrl: row.id, title: row.title }` when `row.source === 'addByRss'`
  (Home passes `row.id` to `unsubscribe` as the feed URL today). `cancelled` → return before
  `setFeedRows`. `done` → today's row removal and `serverError` handling. Keep the
  `unsubscribingIdsRef` guard and its `finally`. Add `selectedMediaType` and `unsubscribeArtist`
  to the dependencies.

## `AddByRssRootScreen.tsx`

Same as Home: when `selectedMediaType === 'artists'`, call
`unsubscribeArtist({ source: 'addByRss', feedUrl: row.id, title: row.title })`; `cancelled` →
return before `setFeedRows`; `done` → today's removal, `homeFeedRefresh.notify()`, and error key.

## Must stay true

- Podcasts, albums, episodes, tracks, and livestreams unsubscribe exactly as today.
- Signed out, every path still works on the device alone.
- `artist-detail-subscribe-toggle`, `add-by-rss-home-remove`, and the row swipe ids are unchanged.
- No `as`, no `any`, strict equality.

## Tests

No unit test: the screens only route to plan 94's hook, whose choices are unit-tested there.
Plan 97 adds the Maestro flow and updates `add-by-rss-artist.yaml`.

## Release scratchpad

```markdown
## Mobile asks about albums when you unsubscribe from an artist

- Surfaces: mobile
- Change: unsubscribing from an artist (directory or Add by RSS) on its screen, or from the
  Artists chip on Home or in the Add by RSS library, opens "Unsubscribe from [Artist]?" when you
  follow at least one of its albums: verified albums for a directory artist; albums it lists or
  that name it for an Add by RSS artist. Artist and Albums ends them together; Artist Only keeps
  the albums; Cancel changes nothing. Albums you never followed leave with the artist without
  asking. Works signed out on the device; signed in, one request updates the account. Offline,
  directory artists unsubscribe without the question.
- Who notices: members who follow an artist and its albums
- Operator steps: none
```
