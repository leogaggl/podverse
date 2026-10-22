**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 76 — Web: player artist line for Add by RSS artists

Plan 50 shows verified directory artists above the album in the player and hides the artist line
for Add by RSS playback. This plan fills the line from this browser's Add by RSS data when no
verified artist exists:

- **Playing an Add by RSS album** (followed or listed): the Add by RSS artists on this browser that
  the album names (`podcast:publisher`) or that list it link to `/add-by-rss/artist/[id]` (R50).
  With none stored, the album's publisher pointer is looked up in the directory (plan 70); a
  directory artist links to `/artist/[id]` (R50). Nothing is parsed or followed (R51).
- **Playing a directory album with no verified artist:** Add by RSS artists on this browser that
  list it link to their Add by RSS pages (R52).

Verified directory artists always win; device artists fill in only when the verified list is empty.

## Rows

R50, R51, R52

## Runs after

50, 70, 72

## Files

apps/web/src/lib/artistPublishers.ts
apps/web/src/lib/artistPublishers.test.ts
apps/web/src/utils/addByRSS/deviceArtistLinks.ts
apps/web/src/utils/addByRSS/deviceArtistLinks.test.ts
apps/web/src/hooks/useDeviceArtistLinks.ts
apps/web/src/utils/mediaPlayer/mediaPlayerInfoResolution.ts
apps/web/src/utils/mediaPlayer/mediaPlayerInfoResolution.test.ts
apps/web/src/components/MediaPlayer/Modal/MediaPlayerInfoModal.tsx
apps/web/src/components/MediaPlayer/Desktop/MediaPlayerInfoDesktop.tsx
apps/web/src/components/MediaPlayer/Mobile/MediaPlayerInfoMobile.tsx
release-notes/scratchpad.md

## Decisions this plan fixes

- **Logged-out visitors get no device artists.** Add by RSS data is per member; the hook returns
  `[]` without an account.
- **The embed player shows verified artists only.** `EmbedPlayerInfo.tsx` is not changed; an
  embed never plays Add by RSS media and has no member store.
- **Directory lookups are cached for the session** per feed guid (`null` results too), so a
  repeated track does not call the API again.

## `lib/artistPublishers.ts`

Add beside `presentArtistLine` (do not change it or `artistPublishersForAlbum`):

```typescript
/** Line for links already resolved: one link, or a chooser labelled with the titles. */
export const presentArtistLineLinks = (
  links: readonly ArtistLineLink[]
): ArtistLinePresentation;
```

Zero → `{ kind: 'hidden' }`. One → `{ kind: 'link', link }` (read `links[0]` into a const and
return `hidden` when `undefined`). More → `{ kind: 'chooser', label: links.map((link) => link.title).join(', '), links: [...links] }`.

## `utils/addByRSS/deviceArtistLinks.ts` (new)

```typescript
export type DeviceArtistLinksInput = {
  /** Canonical feed URL or idText of the Add by RSS album playing, when Add by RSS is playing. */
  addByRSS: { feedUrl: string | null; channelIdText: string | null } | null;
  channel: DTOChannel | null | undefined;
  item: DTOItem | null | undefined;
};

/** Artist links from this browser's Add by RSS data, for when no verified artist exists. */
export const resolveDeviceArtistLinks = async (
  input: DeviceArtistLinksInput
): Promise<ArtistLineLink[]>;
```

1. `links = await getAllAddByRSSPublisherLinks()`.
2. Add by RSS playing (`input.addByRSS` non-null):
   - `source` = `getAddByRSSAlbumSourceByUrl(feedUrl)` when `feedUrl` is set, else
     `getAddByRSSAlbumSourceByIdText(channelIdText)` when set; `[]` when neither finds one.
   - `resolution = resolveAddByRSSAlbumArtists({ album: source.feed, links })`.
   - `add_by_rss` → `resolution.links`. `none` → `[]`.
   - `directory_lookup` → for each ref in order, `await lookupDirectoryArtist(ref)`; keep
     non-null results, each `idText` once.
3. Directory playing: when `isAlbumMediumId(channel?.medium_id)` and
   `artistPublishersForAlbum(channel, item).length === 0` and `channel.id_text` is set,
   return `resolveDirectoryAlbumAddByRSSArtists({ channelIdText: channel.id_text, podcastGuid: channel.podcast_guid, links })`.
   Otherwise `[]`.

Private `lookupDirectoryArtist(ref: { feedGuid: string; feedUrl: string | null })`:

- Module `Map<string, Promise<ArtistLineLink | null>>` keyed by `ref.feedGuid`.
- `getApiRequestService().reqChannelGetDirectoryMatch({ feed_guid: ref.feedGuid, feed_url: ref.feedUrl })`.
- A match with `isArtistMediumId(match.medium_id)` and a non-empty trimmed `title` →
  `{ idText: match.id_text, title: match.title.trim(), href: buildArtistPath(match.id_text) }`.
  Anything else → `null`.
- On a thrown error: `console.error`, delete the key so a later play retries, return `null`.

## `hooks/useDeviceArtistLinks.ts` (new)

```typescript
/** Device-only artist links for what is playing. Empty when logged out or nothing matches. */
export const useDeviceArtistLinks = (): readonly ArtistLineLink[];
```

- Reads `mpAddByRSS`, `mpChannel`, `mpItem` from `useMediaPlayer()` and `loggedInAccount` from
  `useAccount()`.
- `feedUrl = typeof mpAddByRSS?.resourceData?.feed_url === 'string' ? mpAddByRSS.resourceData.feed_url : null`;
  `channelIdText` the same with `channel_id_text`.
- Key: `null` when logged out; `rss:${feedUrl ?? channelIdText ?? ''}` for Add by RSS;
  `dir:${mpChannel.id_text}` for a directory channel; else `null`.
- Module `Map<string, Promise<ArtistLineLink[]>>` shared by every caller (the bar and the modal
  mount at once). Clear it from `onAddByRSSFeedChanged`, registered once lazily on the client.
- State `links` starts `[]`. An effect on `[key, reloadKey]` sets `[]`, then awaits the shared
  promise and sets the result unless the key changed (`cancelled` flag).
- `useEffect(() => onAddByRSSFeedChanged(() => setReloadKey((k) => k + 1)), [])` so a parse that
  adds an artist updates the line without replaying.
- Return a stable empty array constant when `links.length === 0`.

## `mediaPlayerInfoResolution.ts`

Add to the params type: `deviceArtistLinks?: readonly ArtistLineLink[];` with a doc comment
"Add by RSS artist links from this browser, shown when no verified artist exists."

Replace plan 50's two lines

```typescript
  // Directory albums only. Add by RSS playback does not carry verified publishers.
  const artistPublishers = mpAddByRSS ? [] : artistPublishersForAlbum(mpChannel, mpItem);
  const artistLine = presentArtistLine(artistPublishers);
```

with

```typescript
  // Verified directory artists win; this browser's Add by RSS artists fill an empty line.
  const artistPublishers = mpAddByRSS ? [] : artistPublishersForAlbum(mpChannel, mpItem);
  const verifiedArtistLine = presentArtistLine(artistPublishers);
  const artistLine =
    verifiedArtistLine.kind === 'hidden'
      ? presentArtistLineLinks(deviceArtistLinks ?? [])
      : verifiedArtistLine;
```

`artistLabel` and `compactChannelLine` follow unchanged, so the bar reads `Artist · Album` for
device artists too.

## Callers

`MediaPlayerInfoModal.tsx`, `MediaPlayerInfoDesktop.tsx`, `MediaPlayerInfoMobile.tsx`: call
`const deviceArtistLinks = useDeviceArtistLinks();` beside `useMediaPlayer()` and pass
`deviceArtistLinks` to `getMediaPlayerInfoResolution`. Plan 50's `switch` on
`artistLine.kind`, the chooser, and the styles already handle every kind; an Add by RSS link uses
the same `ClickableTitle` and `router.push(link.href)`.

## Must stay true

- A directory album with verified artists shows exactly plan 50's line.
- Podcast and video playback show no artist line.
- Nothing here parses, follows, or writes to the Add by RSS stores.
- No `as`; strict equality; type imports on their own line.

## Tests

`artistPublishers.test.ts`: `presentArtistLineLinks` with zero, one, and two links (label
`A, B`).

`deviceArtistLinks.test.ts` (new; mock `./storage` and `../../factories/apiRequestService` with
`vi.hoisted` fns):

- Add by RSS album named by a stored artist → one Add by RSS link; the API is not called.
- Add by RSS album with no stored artist and a publisher pointer whose lookup returns an artist
  medium → one `/artist/<id>` link; a second call for the same guid does not call the API again.
- A lookup returning a non-artist medium or `null` → `[]`.
- Directory album with no verified publishers, listed by a stored artist → that Add by RSS link;
  the same album with a verified artist → `[]`.

`mediaPlayerInfoResolution.test.ts`: with `mpAddByRSS` set and one `deviceArtistLinks` entry,
`artistLine.kind` is `link` and `compactChannelLine` is `Artist · Album`; a verified directory
album with `deviceArtistLinks` given still shows the verified artist.

## Release scratchpad

```markdown
## The player names Add by RSS artists

- Surfaces: web
- Change: when you play an album you added by RSS, the player shows its artist above the album
  title (and in the player bar) when that artist is an Add by RSS artist on this browser, linking
  to its Add by RSS artist page. If the album names an artist that is in the Podverse directory,
  the line links to the directory artist instead. Directory albums with no verified artist show
  the Add by RSS artists on this browser that list them. Verified directory artists always take
  priority. Nothing is parsed or followed to fill the line.
- Who notices: members who add music by RSS
- Operator steps: none
```
