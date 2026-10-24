**Cursor model:** Opus 5.5 · **Reasoning:** high

# 86 — Mobile player artist line for Add by RSS albums and albums Add by RSS artists list

Plans 60–65 show verified directory artists on the full player, mini player, lock screen, and
car, and nothing for Add by RSS. This plan fills the line from the device, with the same rules as
web plan 76:

- **Playing an Add by RSS album:** the Add by RSS artists on this device it names or that list it,
  else the directory artist its publisher pointer resolved to, else no line (R50). Nothing is
  parsed to fill it (R51).
- **Playing a directory album with no verified artist:** Add by RSS artists on this device that
  list it (R52).

Verified directory artists always win. Every reader is synchronous (plan 81), so the full
player's band is still decided when an item starts.

## Rows

R8, R40, R44, R50, R51, R52

## Runs after

60, 61, 62, 63, 64, 65, 81

## Files

apps/mobile/src/lib/playback/verifiedArtists.ts
apps/mobile/src/lib/playback/verifiedArtists.test.ts
apps/mobile/src/components/content/ArtistChooserSheet.tsx
apps/mobile/src/screens/player/fullPlayerContentLink.ts
apps/mobile/src/screens/player/fullPlayerContentLink.test.ts
apps/mobile/src/screens/player/FullPlayerScreen.tsx
apps/mobile/src/components/player/MiniPlayer.tsx
apps/mobile/src/screens/track/TrackDetailScreen.tsx
release-notes/scratchpad.md

## Reuses

- `LineArtist`, `directoryLineArtist`, `lineArtistKey`, `lineArtistTitle`,
  `joinLineArtistTitles` (plan 81).
- `addByRssAlbumArtists(albumFeedUrl)` and `addByRssArtistsListingDirectoryAlbum({ channelIdText, podcastGuid })`
  (plan 81).
- `useAddByRssArtistIndexVersion` (plan 81) so the player re-renders when relations load.
- `playerContentStack`: kind `add-by-rss` already opens on Home.

## Decisions this plan fixes

- **`playbackTargetArtists` returns `LineArtist[]`** and every caller follows the type. The
  now-playing fields (plan 64) need no code change: they read only titles through the helpers
  below. The mini player (plan 62) only adds the index version to its memo. `feed_url` on Add by
  RSS playback data is already canonical, the form plan 81 keys albums by.
- **The car's started-playback names (plan 65) stay verified-only.** `verifiedArtistNames` reads
  directory DTOs in the native cache projection, which has no Add by RSS relations; a car session
  started from the phone still gets the line through plan 64's now-playing fields.
- **Directory track pages keep plan 63's verified-only byline**, as web plan 77 decides. Only
  their types change here.
- **An Add by RSS artist opens its Add by RSS page on Home** (`kind: 'add-by-rss'`,
  `idText` the artist feed's idText), the same target the player's channel title uses for Add by
  RSS.

## `verifiedArtists.ts`

```typescript
export const playbackTargetArtists = (target: PlaybackTarget | null): LineArtist[] => …;

export const artistAlbumLine = (
  artists: readonly LineArtist[],
  albumTitle: string | null
): string | null => …;

export const nowPlayingArtistFields = (
  artists: readonly LineArtist[],
  channelTitle: string | null
): NowPlayingArtistFields => …;
```

- `playbackTargetArtists`:
  - `null` → `[]`.
  - `add-by-rss`: `feedUrl = target.resourceData.feed_url`; when it is a non-empty string,
    `addByRssAlbumArtists(feedUrl)`, else `[]`. Read it with a `typeof` check (no `as`).
  - Every other kind: `verified = resolveVerifiedArtists({ channel: target.channel, item: target.item })`.
    Non-empty → `verified.map(directoryLineArtist)`. Empty →
    `addByRssArtistsListingDirectoryAlbum({ channelIdText: target.channel.id_text, podcastGuid: target.channel.podcast_guid })`.
- `artistAlbumLine` and `nowPlayingArtistFields`: replace `joinVerifiedPublisherTitles(artists)`
  with `joinLineArtistTitles(artists)`; nothing else changes.
- Update the doc comment of `playbackTargetArtists` ("Add by RSS targets have none here" no longer
  holds): artists for the item a target plays, verified first, then the member's Add by RSS
  artists on this device.

`resolveVerifiedArtists` and `verifiedArtistNames` keep their `DTOVerifiedPublisher` types.

## `ArtistChooserSheet.tsx`

`artists: readonly LineArtist[]`, `onSelect: (artist: LineArtist) => void`. Item `key` is
`lineArtistKey(artist)`, `label` is `lineArtistTitle(artist)`. Testids unchanged.

## `fullPlayerContentLink.ts`

```typescript
export const fullPlayerArtistLink = (artist: LineArtist): FullPlayerContentTarget =>
  artist.kind === 'directory'
    ? { idText: artist.publisher.id_text, imageUrl: null, kind: 'artist', name: lineArtistTitle(artist) }
    : { idText: artist.feedIdText, imageUrl: null, kind: 'add-by-rss', name: lineArtistTitle(artist) };
```

Drop `DTOVerifiedPublisher` from this file's type import if nothing else uses it.

## `FullPlayerScreen.tsx` (large: grep each anchor)

- Anchor `const playerArtists = useMemo(() => playbackTargetArtists(activeTarget), [activeTarget]);`:
  add `const artistIndexVersion = useAddByRssArtistIndexVersion();` above it and add
  `artistIndexVersion` to that memo's dependencies.
- Anchor `const artistLineText = joinVerifiedPublisherTitles(playerArtists);`: use
  `joinLineArtistTitles`. Remove `joinVerifiedPublisherTitles` from the `@podverse/helpers` import
  if unused.
- Anchor `const openArtist = useCallback(`: the parameter becomes `artist: LineArtist`. Body:
  `const link = fullPlayerArtistLink(artist);` then
  `const isSubscribed = artist.kind === 'directory' && getChannelActionChrome(artist.publisher.id_text)?.isSubscribed === true;`
  then `onOpenContent({ ...link, stack: playerContentStack({ isSubscribed, kind: link.kind }) })`.
- Replace `DTOVerifiedPublisher` with `LineArtist` in this file's types; import `LineArtist` with
  `import type` from `'../../lib/playback/lineArtist'`.

The per-item band logic stays as it is. An index reload that adds artists mid-item does not resize
the block, by plan 61's design.

## `MiniPlayer.tsx`

Anchor `const artists = useMemo(() => playbackTargetArtists(activeTarget), [activeTarget]);`: add
`const artistIndexVersion = useAddByRssArtistIndexVersion();` above it and add it to the
dependencies.

## `TrackDetailScreen.tsx` (plan 63's byline)

- `const trackLineArtists = useMemo(() => trackArtists.map(directoryLineArtist), [trackArtists]);`
  and pass it to `ArtistChooserSheet`.
- The chooser's `onSelect` receives a `LineArtist`; when `artist.kind === 'directory'`, call
  `openArtist(artist.publisher)`. It never receives the other kind here.
- `artistByline` and `openArtist` keep plan 63's `DTOVerifiedPublisher` path.

## Must stay true

- A directory item with verified artists shows exactly plans 61–64's line.
- With no Add by RSS artists on the device and nothing stored, every line reads as before plan 81.
- No network request is made to fill the line.

## Tests

- `verifiedArtists.test.ts` (hydrate the plan 81 index in each case; reset after):
  - An Add by RSS target whose album an Add by RSS artist lists returns that artist;
    `artistAlbumLine` gives `Artist · Album`.
  - An Add by RSS target with no stored artist and a stored directory match with an artist medium
    returns one directory artist.
  - An Add by RSS target with neither returns `[]`, and `nowPlayingArtistFields` keeps the channel
    title in `artist` (plan 64's fallback).
  - A directory target with a verified artist ignores a listing Add by RSS artist.
  - A directory target with no verified artist, listed by an Add by RSS artist, returns it.
  - Update existing cases that compared `DTOVerifiedPublisher[]` results to compare
    `directoryLineArtist(...)` values.
- `fullPlayerContentLink.test.ts`: `fullPlayerArtistLink` for both kinds; update plan 61's case to
  pass `directoryLineArtist(publisher)`.

## Release scratchpad

```markdown
## Mobile player shows Add by RSS artists

- Surfaces: mobile
- Change: playing an Add by RSS album shows its artist on the full player, mini player, and lock
  screen: an Add by RSS artist on this device that lists the album or that the album names, else
  the directory artist its publisher pointer matches. A directory album with no verified artist
  shows the Add by RSS artists on this device that list it. Tapping opens that artist; several
  open a chooser. Verified artists always come first, and nothing is fetched to fill the line.
- Who notices: members who play Add by RSS music
- Operator steps: none
```
