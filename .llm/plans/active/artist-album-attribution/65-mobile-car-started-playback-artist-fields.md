**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 65 — Car-started playback: artist and album from the native cache

When playback starts from the car's own menus, JS may not be running, so CarPlay and Android Auto
build now-playing from the native cache JS wrote earlier (**mobile-carplay-android-auto**). This
plan adds the verified artist names to the queue, history, and album track list entries of that
cache, and has both native car services set the same structured fields plan 64 sets for
phone-started playback: artist names in the artist field and the album in the album field, or the
album in the artist field when there is no artist.

Album track list entries are the per-channel library files (`NativeCacheChildItem`, written by
`reprojectLibraryChildrenForChannel` from stored `channel_item` rows). Those stored items have no
embedded channel; plan 12 gives each one `channel_wide_verified_publishers`, which this plan reads.

Car browse lists are unchanged: a row's detail text stays the album or podcast title (or, for
album track lists, today's detail line). Downloads are plans 67 (phone) and 68 (car).

## Rows

R8, R34, R35, R36, R37, R62

## Runs after

12, 64

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

- **Queue, history, and album track list entries carry the artist.** Queue and history resources
  embed the album channel with its `verified_publishers` (plan 12). Album track list entries come
  from stored by-channel items, which carry the album's publishers in
  `channel_wide_verified_publishers` (plan 12). One helper, `itemArtistNames`, reads either shape.
  Downloads get their artist in plans 67 and 68, through the download to `channel_item` join.
- **One new cache field, `artist`.** The album is the entry's existing `podcastTitle` (queue),
  `channelTitle` (history), or, for album track list entries, `subtitle` when set and otherwise the
  title of the library node the entry sits under. Native derives the album field from those only
  when `artist` is set. Additive optional field: `NATIVE_CACHE_SCHEMA_VERSION` stays 2 (see the
  comment above it).
- **Album track list plays always fill the artist field.** Today a car play from an album or
  podcast track list sets no subtitle, so the second Now Playing line is blank. With this plan it
  is the artist when there is one, else the entry's `subtitle`, else the library node's title (the
  album or podcast), matching R35's "the second line is never blank".
- **Car names stay verified-only.** `verifiedArtistNames` and `itemArtistNames` read directory
  DTOs only. Plan 86 keeps both on `DTOVerifiedPublisher` types and does not route them through
  Add by RSS artists (D70).

## JS

### `src/lib/playback/verifiedArtists.ts`

Add (reusing the file's imports; add `import type { DTOItem } from '@podverse/helpers/dto';` if the
file does not import it yet):

```typescript
/** "A, B" for the verified artists of an item on a channel, or null when there are none. */
export const verifiedArtistNames = (args: {
  channel?: VerifiedPublisherHolder | null;
  item?: VerifiedPublisherHolder | null;
}): string | null => {
  const names = joinVerifiedPublisherTitles(resolveVerifiedArtists(args));
  return names.length > 0 ? names : null;
};

/**
 * Verified artist names for a stored or listed item: its embedded channel when present, else the
 * channel-wide publishers a by-channel item list puts on the item. Null when there are none.
 */
export const itemArtistNames = (item: DTOItem): string | null =>
  verifiedArtistNames({
    channel: item.channel ?? { verified_publishers: item.channel_wide_verified_publishers },
    item,
  });
```

### `src/data/nativeCache/projection.ts`

- `NativeCacheQueueEntry`: after `podcastTitle?: string | null;` add
  `/** Verified artist names; when set, \`podcastTitle\` is the album. */ artist?: string | null;`
- `NativeCacheHistoryEntry`: after `channelTitle?: string | null;` add the same field with the
  comment naming `channelTitle`.
- `NativeCacheChildItem`: after `subtitle?: string | null;` add
  `/** Verified artist names; when set, \`subtitle\` or the library node title is the album. */ artist?: string | null;`

### `src/data/nativeCache/carCacheReproject.ts`

- `toQueueEntry`: add `artist: itemArtistNames(item),` after `podcastTitle`.
- `reprojectHistoryIndex` (the `entries.push({` inside the resource loop): add
  `artist: itemArtistNames(item),` after `channelTitle`.
- `toChildItem`: add `artist: itemArtistNames(item),` after `subtitle`.
- Import `itemArtistNames` from `'../../lib/playback/verifiedArtists'`.

### `src/data/repositories/queueRepository.ts`

`toNativeCacheEntry`: add `artist: itemArtistNames(item),` after `podcastTitle`, with the same
import (`'../../lib/playback/verifiedArtists'`).

## iOS

### `PodverseCarPlayCacheModel.swift`

- `struct QueueEntry`: add `let artist: String?` after `podcastTitle`. In the queue parser's
  `QueueEntry(` call add `artist: nonBlankString(obj["artist"]),` after `podcastTitle:`.
- `struct HistoryEntry`: add `let artist: String?` after `channelTitle`. In the history parser's
  `HistoryEntry(` call add `artist: nonBlankString(obj["artist"]),` after `channelTitle:`.
- `struct ChildItem`: add `let artist: String?` after `subtitle`. In `parseChildItems`'s
  `ChildItem(` call add `artist: nonBlankString(obj["artist"]),` after `subtitle:`.

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
- `playChild`: change the signature to
  `playChild(_ child: PodverseCarPlayCacheModel.ChildItem, node: PodverseCarPlayCacheModel.BrowseNode)`.
  Inside, `let album = child.subtitle ?? node.title`, pass `queueMedium: node.mediumBucket` where it
  passed `queueMedium` before, and add `subtitle: child.artist ?? album,
  albumTitle: child.artist != nil ? album : nil` to the `playURL` call. In `pushChannelChildren`,
  the row handler calls `self?.playChild(child, node: node)`.
- `playDownload`, `playLive`: unchanged here (plan 68 changes `playDownload`).
- List rows (`queueItems`, `historyItems`, the `pushChannelChildren` rows and their
  Played / In progress / Downloaded detail) stay as they are.

## Android

Path: `modules/podverse-media-engine/android/src/main/java/expo/modules/podversemediaengine/`.

### `PodverseNativeCacheModel.kt`

- `data class QueueEntry`: add `val artist: String?,` after `podcastTitle`; in the queue parser
  add `artist = optStringOrNull(obj, "artist"),` after `podcastTitle =`.
- `data class HistoryEntry`: add `val artist: String?,` after `channelTitle`; in
  `parseHistoryEntries` add `artist = optStringOrNull(obj, "artist"),` after `channelTitle =`.
- `data class ChildItem`: add `val artist: String?,` after `subtitle`; in `parseChildItems` add
  `artist = optStringOrNull(obj, "artist"),` after `subtitle =`.

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
   - Channel-items branch (the `for (node in readBrowseNodes())` loop): add
     `val album = child.subtitle ?: node.title` before the `return`, pass `child.artist ?: album`
     as the subtitle argument (today `child.subtitle`), and add
     `albumTitle = if (child.artist != null) album else null`.
   - Live and download branches: unchanged here (plan 68 changes the download branch).
4. `resolveForPlayback`: call `playableMetadata(resolved.title, resolved.artworkUrl,
   resolved.subtitle, resolved.albumTitle)`.
5. `engineMediaItem`: inside the `.apply {` add
   `playable.albumTitle?.let { put("albumTitle", it) }` after the subtitle line, and call
   `playableMetadata(playable.title, playable.artworkUrl, playable.subtitle, playable.albumTitle)`.
   Plan 64 taught the engine to read `albumTitle` from that meta JSON.
6. The browse rows built with `playableItem(...)` (queue, queue-music, history) keep
   `entry.podcastTitle` / `entry.channelTitle` as their subtitle, and `channelChildren` keeps
   `child.subtitle`.

## Must stay true

- A cache written by an older JS build (no `artist`) parses and plays: queue and history exactly
  as today; album track list plays now show the library node title in the artist field instead of
  nothing.
- Podcast entries have `artist: null`; their other fields are unchanged.
- No SQLite reads in native code; no change to car browse structure or queue policy.
- No `as`, no `any`, strict equality only.

## Tests

- `verifiedArtists.test.ts`: add `describe('verifiedArtistNames')`: one artist → its title; two
  → "A, B"; none or only a non-artist publisher → `null`. Add `describe('itemArtistNames')`: an
  item with an embedded channel naming an artist → that name; an item with no `channel` and
  `channel_wide_verified_publishers` naming an artist → that name; an item with neither → `null`.
- `projection.test.ts`: add a case after `'stamps schema version 2 on queue snapshots'`, built
  the same way, where one entry has `artist: 'E2E Music Artist'`; assert the envelope keeps the
  field and still has `schemaVersion: 2`. In `'builds library children and history / live
  envelopes'`, give one library entry `artist: 'E2E Music Artist'` and assert it survives.
- No native unit tests exist for these files. Device check (operator, after a rebuild): with the
  phone app closed, start an E2E Music Album track from the car queue, and another from the
  album's track list under Music, in the CarPlay simulator and the Android Auto DHU
  ([ANDROID-AUTO-DHU-CHECKLIST.md](/apps/mobile/modules/podverse-media-engine/ANDROID-AUTO-DHU-CHECKLIST.md));
  Now Playing shows "E2E Music Artist" and "E2E Music Album" for both. The album's stored items
  must have synced after plan 12 shipped (pull to refresh the album on the phone first).

## Release scratchpad

```markdown
## Car-started music shows the artist

- Surfaces: mobile (CarPlay and Android Auto native services, native cache)
- Change: music started from the car's Queue, History, or album track lists, including with the
  phone app closed, shows the verified artist as the artist and the album as the album. With no
  verified artist, the album (or podcast) title fills the artist field; car plays from a track
  list used to leave that line blank. Album track lists stored before this update show the
  artist after the album's next refresh.
- Who notices: listeners who start music or podcasts from CarPlay or Android Auto
- Operator steps: native rebuild of the mobile app; check in the CarPlay simulator and the
  Android Auto DHU
```
