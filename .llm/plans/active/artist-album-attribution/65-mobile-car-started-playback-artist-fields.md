**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 65 — Car-started playback: artist and album from the native cache

When playback starts from the car's own menus, JS may not be running, so CarPlay and Android Auto
build now-playing from the native cache JS wrote earlier (**mobile-carplay-android-auto**). This
plan adds the verified artist names to the queue and history entries of that cache, and has both
native car services set the same structured fields plan 64 sets for phone-started playback:
artist names in the artist field and the album in the album field, or the album in the artist
field when there is no artist.

Car browse lists are unchanged: a row's detail text stays the album or podcast title.

## Rows

R8, R34, R35, R36, R37

## Runs after

64

## Files

apps/mobile/src/lib/playback/verifiedArtists.ts
apps/mobile/src/lib/playback/verifiedArtists.test.ts
apps/mobile/src/data/nativeCache/projection.ts
apps/mobile/src/data/nativeCache/projection.test.ts
apps/mobile/src/data/nativeCache/carCacheReproject.ts
apps/mobile/src/data/repositories/queueRepository.ts
apps/mobile/modules/podverse-media-engine/ios/PodverseCarPlayCacheModel.swift
apps/mobile/modules/podverse-media-engine/ios/PodverseCarPlaySceneDelegate.swift
apps/mobile/modules/podverse-media-engine/android/src/main/java/expo/modules/podversemediaengine/PodverseNativeCacheModel.kt
apps/mobile/modules/podverse-media-engine/android/src/main/java/expo/modules/podversemediaengine/PodverseMediaLibraryService.kt
release-notes/scratchpad.md

## Decisions this plan fixes

- **Queue and history entries carry the artist; album track lists and downloads do not.** Queue
  and history resources embed the album channel with its `verified_publishers` (plan 12), so their
  entries can name the artist. Album track entries come from stored channel items, which have no
  channel payload, and download rows keep only the channel title. Car-started plays of those keep
  today's fields (album in the artist field). Phone-started plays of the same items are covered
  by plan 64.
- **One new cache field, `artist`.** The album is the entry's existing `podcastTitle` (queue) or
  `channelTitle` (history). Native derives the album field from those only when `artist` is set.
  Additive optional field: `NATIVE_CACHE_SCHEMA_VERSION` stays 2 (see the comment above it).

## JS

### `src/lib/playback/verifiedArtists.ts`

Add (reusing the file's imports):

```typescript
/** "A, B" for the verified artists of an item on a channel, or null when there are none. */
export const verifiedArtistNames = (args: {
  channel?: VerifiedPublisherHolder | null;
  item?: VerifiedPublisherHolder | null;
}): string | null => {
  const names = joinVerifiedPublisherTitles(resolveVerifiedArtists(args));
  return names.length > 0 ? names : null;
};
```

### `src/data/nativeCache/projection.ts`

- `NativeCacheQueueEntry`: after `podcastTitle?: string | null;` add
  `/** Verified artist names; when set, \`podcastTitle\` is the album. */ artist?: string | null;`
- `NativeCacheHistoryEntry`: after `channelTitle?: string | null;` add the same field with the
  comment naming `channelTitle`.

### `src/data/nativeCache/carCacheReproject.ts`

- `toQueueEntry`: add `artist: verifiedArtistNames({ channel: item.channel, item }),` after
  `podcastTitle`.
- `reprojectHistoryIndex` (the `entries.push({` inside the resource loop): add
  `artist: verifiedArtistNames({ channel: item.channel, item }),` after `channelTitle`.
- Import `verifiedArtistNames` from `'../../lib/playback/verifiedArtists'`.

### `src/data/repositories/queueRepository.ts`

`toNativeCacheEntry`: add `artist: verifiedArtistNames({ channel: item.channel, item }),` after
`podcastTitle`, with the same import (`'../../lib/playback/verifiedArtists'`).

## iOS

### `PodverseCarPlayCacheModel.swift`

- `struct QueueEntry`: add `let artist: String?` after `podcastTitle`. In the queue parser's
  `QueueEntry(` call add `artist: nonBlankString(obj["artist"]),` after `podcastTitle:`.
- `struct HistoryEntry`: add `let artist: String?` after `channelTitle`. In the history parser's
  `HistoryEntry(` call add `artist: nonBlankString(obj["artist"]),` after `channelTitle:`.

### `PodverseCarPlaySceneDelegate.swift`

- `playURL(…, subtitle: String? = nil)`: add a trailing parameter `albumTitle: String? = nil`. In
  the body add `if let albumTitle = albumTitle { meta["albumTitle"] = albumTitle }` after the
  subtitle line, and call
  `PodverseAudioEngine.shared.setNowPlayingMetadata(title: title, artist: subtitle, albumTitle: albumTitle)`
  (plan 64 added the parameter).
- `playQueueEntry`: pass `subtitle: entry.artist ?? entry.podcastTitle,
  albumTitle: entry.artist != nil ? entry.podcastTitle : nil`.
- `playHistory`: pass `subtitle: entry.artist ?? entry.channelTitle,
  albumTitle: entry.artist != nil ? entry.channelTitle : nil`.
- `playDownload`, `playLive`, `playChild`: unchanged.
- The queue list rows (`CPListItem(text: entry.title, detailText: entry.podcastTitle)`) stay as
  they are.

## Android

Path: `modules/podverse-media-engine/android/src/main/java/expo/modules/podversemediaengine/`.

### `PodverseNativeCacheModel.kt`

- `data class QueueEntry`: add `val artist: String?,` after `podcastTitle`; in the queue parser
  add `artist = optStringOrNull(obj, "artist"),` after `podcastTitle =`.
- `data class HistoryEntry`: add `val artist: String?,` after `channelTitle`; in
  `parseHistoryEntries` add `artist = optStringOrNull(obj, "artist"),` after `channelTitle =`.

### `PodverseMediaLibraryService.kt`

1. `private data class ResolvedMedia`: add `val albumTitle: String? = null,` as the last field.
   Existing positional constructor calls keep compiling.
2. `playableMetadata(title, artworkUrl, subtitle)`: add a fourth parameter
   `albumTitle: String? = null` and, inside `.apply {`, `albumTitle?.let { setAlbumTitle(it) }`.
3. `resolvePlayable`:
   - Queue branch (the loop over `QUEUE_AV` and `QUEUE_MUSIC`): pass
     `entry.artist ?: entry.podcastTitle` as the subtitle argument (today `entry.podcastTitle`)
     and add the named argument `albumTitle = if (entry.artist != null) entry.podcastTitle else null`.
   - History branch: pass `history.artist ?: history.channelTitle` and
     `albumTitle = if (history.artist != null) history.channelTitle else null`.
   - Live, download, and channel-items branches: unchanged.
4. `resolveForPlayback`: call `playableMetadata(resolved.title, resolved.artworkUrl,
   resolved.subtitle, resolved.albumTitle)`.
5. `engineMediaItem`: inside the `.apply {` add
   `playable.albumTitle?.let { put("albumTitle", it) }` after the subtitle line, and call
   `playableMetadata(playable.title, playable.artworkUrl, playable.subtitle, playable.albumTitle)`.
   Plan 64 taught the engine to read `albumTitle` from that meta JSON.
6. The browse rows built with `playableItem(...)` (queue, queue-music, history) keep
   `entry.podcastTitle` / `entry.channelTitle` as their subtitle.

## Must stay true

- A cache written by an older JS build (no `artist`) parses and plays exactly as today.
- Podcast queue and history entries have `artist: null` and unchanged fields.
- No SQLite reads in native code; no change to car browse structure or queue policy.
- No `as`, no `any`, strict equality only.

## Tests

- `verifiedArtists.test.ts`: add `describe('verifiedArtistNames')`: one artist → its title; two
  → "A, B"; none or only a non-artist publisher → `null`.
- `projection.test.ts`: add a case after `'stamps schema version 2 on queue snapshots'`, built
  the same way, where one entry has `artist: 'E2E Music Artist'`; assert the envelope keeps the
  field and still has `schemaVersion: 2`.
- No native unit tests exist for these files. Device check (operator, after a rebuild): with the
  phone app closed, start an E2E Music Album track from the car queue in the CarPlay simulator and
  the Android Auto DHU
  ([ANDROID-AUTO-DHU-CHECKLIST.md](/apps/mobile/modules/podverse-media-engine/ANDROID-AUTO-DHU-CHECKLIST.md));
  Now Playing shows "E2E Music Artist" and "E2E Music Album".

## Release scratchpad

```markdown
## Car-started music shows the artist

- Surfaces: mobile (CarPlay and Android Auto native services, native cache)
- Change: music started from the car's Queue or History menus, including with the phone app
  closed, shows the verified artist as the artist and the album as the album. Album track lists
  and downloads started from the car keep the album in the artist field.
- Who notices: listeners who start music from CarPlay or Android Auto
- Operator steps: native rebuild of the mobile app; check in the CarPlay simulator and the
  Android Auto DHU
```
