**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 68 — Car Downloads list and car-started download plays show the artist

The car's Downloads tab (CarPlay) and Downloads node (Android Auto) read the downloads index JS
writes in `downloadsRepository.refreshNativeCacheProjection`. Each entry carries the download's
`channelTitle`, shown as the row's detail text and passed as the artist field when the car starts
the download. This plan adds the album's verified artist names to each entry, read with plan 67's
`readFollowedMusicPublishers` (the download to `channel_item` join, followed music channels only),
shows them in the Downloads rows, and sets the artist and album fields on car-started download
plays the way plan 65 does for queue, history, and album track lists.

## Rows

R63, R64, R65

## Runs after

65, 67

## Files

apps/mobile/src/data/nativeCache/projection.ts
apps/mobile/src/data/nativeCache/projection.test.ts
apps/mobile/src/data/repositories/downloadsRepository.ts
apps/mobile/src/data/repositories/channelItemsRepository.ts
apps/mobile/modules/podverse-media-engine/ios/PodverseCarPlayCacheModel.swift
apps/mobile/modules/podverse-media-engine/ios/PodverseCarPlaySceneDelegate.swift
apps/mobile/modules/podverse-media-engine/android/src/main/java/expo/modules/podversemediaengine/PodverseNativeCacheModel.kt
apps/mobile/modules/podverse-media-engine/android/src/main/java/expo/modules/podversemediaengine/PodverseMediaLibraryService.kt
release-notes/scratchpad.md

## Decisions this plan fixes

- **No SQLite column** (plan 67): the join reaches the stored album item.
- **The Downloads row shows "Artist · Album".** R63 asks for the artist in the car Downloads list,
  so a row with an artist shows `"<artist> · <channelTitle>"` (the same `" · "` separator the car
  track list rows and the mini player use); a row without one shows `channelTitle` as today.
  Native composes it from the two fields; the cache keeps them separate.
- **The downloads index is rebuilt when its artist input changes,** not only on download
  mutations:
  - after a followed music channel's item window is committed, when that channel holds a
    completed download (so stored items from before plan 12 heal on refresh, R37);
  - after `removeChannel` (unsubscribe on this device drops the album's stored items, R65);
  - after `retainChannels` (account sync can remove a `subscribed_channel` row unfollowed on
    another device, R65).
  Each rebuild is one SQLite read plus JSON parsing of the followed music items that have
  downloads. None runs on a playback tick.
- **`verifiedArtistNames` is loaded with a dynamic import** inside the projection. Plan 86 makes
  `verifiedArtists.ts` import the Add by RSS artist index, which reaches repositories; a static
  import from `downloadsRepository` would risk a module cycle. This matches the dynamic imports
  `channelItemsRepository` already uses for `carCacheReproject`.

## JS

### `src/data/nativeCache/projection.ts`

`NativeCacheDownloadEntry`: after `channelTitle?: string | null;` add
`/** Verified artist names; when set, \`channelTitle\` is the album. */ artist?: string | null;`

### `src/data/repositories/downloadsRepository.ts`

`refreshNativeCacheProjection`: after the `rows` query, add

```typescript
  const publishersByItem = await readFollowedMusicPublishers(null);
  const { verifiedArtistNames } = await import('../../lib/playback/verifiedArtists');
```

and in the entry object add, after `channelTitle: row.channelTitle,`:

```typescript
          artist: verifiedArtistNames({
            channel: { verified_publishers: publishersByItem.get(row.itemIdText) },
          }),
```

`verifiedArtistNames` keeps the D43 artist-kind filter and returns `null` when there are none.

### `src/data/repositories/channelItemsRepository.ts`

1. `commitChannelWindow`, inside the `void import('../nativeCache/carCacheReproject').then(async …)`
   block, after `await reprojectLibraryChildrenForChannel(channelIdText, mediumBucket);`:

   ```typescript
      if (mediumBucket === 'music') {
        const downloaded = await downloadsRepository.channelIdTextsWithCompleteDownloads();
        if (downloaded.includes(channelIdText)) {
          await downloadsRepository.reprojectNativeCache();
        }
      }
   ```

2. `removeChannel`: after the `channelItemWindow` delete, add
   `await downloadsRepository.reprojectNativeCache();`.
3. `retainChannels`: add `await downloadsRepository.reprojectNativeCache();` before the early
   `return` in the `channelIdTexts.length === 0 && downloaded.length === 0` branch, and after the
   delete loop at the end. Add one sentence to the method's doc comment: the car downloads index is
   rebuilt because its artist names depend on which channels are followed.

`downloadsRepository` is already imported in this file.

## iOS

### `PodverseCarPlayCacheModel.swift`

`struct DownloadEntry`: add `let artist: String?` after `channelTitle`. In `parseDownloadEntries`'s
`DownloadEntry(` call add `artist: nonBlankString(obj["artist"])` after the `channelTitle:`
argument (move the closing parentheses accordingly).

### `PodverseCarPlaySceneDelegate.swift`

- Add a private helper beside `makeDownloadsTemplate`:

  ```swift
  /// "Artist · Album" when the download names an artist, else the album or podcast title.
  private func downloadDetail(_ entry: PodverseCarPlayCacheModel.DownloadEntry) -> String? {
    guard let artist = entry.artist else { return entry.channelTitle }
    return [artist, entry.channelTitle].compactMap { $0 }.joined(separator: " · ")
  }
  ```

- `makeDownloadsTemplate`: the row becomes
  `CPListItem(text: entry.title, detailText: downloadDetail(entry))`.
- `playDownload`: pass `subtitle: entry.artist ?? entry.channelTitle,
  albumTitle: entry.artist != nil ? entry.channelTitle : nil` (plan 65 added `albumTitle` to
  `playURL`).

## Android

Path: `modules/podverse-media-engine/android/src/main/java/expo/modules/podversemediaengine/`.

### `PodverseNativeCacheModel.kt`

`data class DownloadEntry`: add `val artist: String?,` after `channelTitle`; in
`parseDownloadEntries` add `artist = optStringOrNull(obj, "artist"),` after `channelTitle =`.

### `PodverseMediaLibraryService.kt`

- Add a private helper beside `downloadChildren`:

  ```kotlin
  /** "Artist · Album" when the download names an artist, else the album or podcast title. */
  private fun downloadDetail(entry: PodverseNativeCacheModel.DownloadEntry): String? =
    if (entry.artist == null) entry.channelTitle
    else listOfNotNull(entry.artist, entry.channelTitle).joinToString(" · ")
  ```

- `downloadChildren`: pass `downloadDetail(entry)` as the last `playableItem` argument (today
  `entry.channelTitle`).
- `resolvePlayable`, download branch: pass `download.artist ?: download.channelTitle` as the
  subtitle argument and add
  `albumTitle = if (download.artist != null) download.channelTitle else null` (plan 65 added the
  `ResolvedMedia.albumTitle` field).

## Must stay true

- A downloads cache written by an older JS build (no `artist`) lists and plays exactly as today.
- Podcast downloads and downloads of albums this device does not follow have `artist: null` and
  unchanged rows and Now Playing fields.
- No SQLite reads in native code; no change to car browse structure.
- No `as`, no `any`, strict equality only.

## Tests

- `projection.test.ts`: in `'includes relative download file names'` (or a new case right after
  it, built the same way), give one download entry `artist: 'E2E Music Artist'` and assert the
  written envelope keeps it.
- The projection reads and the rebuild triggers are SQLite and module wiring with no unit harness
  (**mobile-test-economics**); the device check covers them.
- Device check (operator, after a native rebuild): follow the E2E Music Album, pull to refresh it,
  and download a track. In the CarPlay simulator and the Android Auto DHU
  ([ANDROID-AUTO-DHU-CHECKLIST.md](/apps/mobile/modules/podverse-media-engine/ANDROID-AUTO-DHU-CHECKLIST.md)),
  the Downloads row reads "E2E Music Artist · E2E Music Album"; starting it with the phone app
  closed shows "E2E Music Artist" and "E2E Music Album" on Now Playing. Unfollow the album on the
  phone: the row reads "E2E Music Album" and Now Playing puts the album in the artist field.

## Release scratchpad

```markdown
## Car Downloads show the artist

- Surfaces: mobile (CarPlay and Android Auto native services, native cache)
- Change: in the car's Downloads list, a downloaded album track from an album you follow reads
  "Artist · Album", and starting it from the car shows the verified artist as the artist and the
  album as the album, including with the phone app closed. Downloads of podcasts and of albums
  you no longer follow are unchanged. The list updates when an album refreshes, when you unfollow
  one, and after account sync.
- Who notices: listeners who download music and play it in the car
- Operator steps: native rebuild of the mobile app; check in the CarPlay simulator and the
  Android Auto DHU
```
