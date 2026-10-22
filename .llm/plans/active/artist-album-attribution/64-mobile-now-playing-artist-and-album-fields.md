**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 64 — Lock screen and car now-playing: artist and album fields (phone-started playback)

The OS now-playing card (iOS lock screen and Control Center, CarPlay Now Playing, the Android media
notification, Android Auto) gets structured fields for phone-started playback: title is the track,
artist is the verified artist names joined "A, B", album is the album. With no verified artist the
album (channel) title stays in the artist field and the album field stays empty, as today, so the
second line is never blank.

JS sends the fields in the engine source meta. iOS sets `MPMediaItemPropertyAlbumTitle`; Media3
sets `setAlbumTitle`. Car-started playback (from the car's own menus, JS not running) is plan 65.

Native change: needs a dev-client rebuild on both platforms and a device check (below).

## Rows

R8, R21, R34, R35, R36

## Runs after

60

## Files

apps/mobile/modules/podverse-media-engine/src/types.ts
apps/mobile/modules/podverse-media-engine/src/bridgeCommandSerialization.ts
apps/mobile/modules/podverse-media-engine/src/bridgeCommandSerialization.test.ts
apps/mobile/src/lib/playback/mediaEngineSourceMeta.ts
apps/mobile/src/lib/playback/mediaEngineSourceMeta.test.ts
apps/mobile/src/lib/playback/engineSourceAdoption.ts
apps/mobile/src/lib/playback/engineSourceAdoption.test.ts
apps/mobile/vitest.config.ts
apps/mobile/modules/podverse-media-engine/ios/PodverseAudioEngine.swift
apps/mobile/modules/podverse-media-engine/android/src/main/java/expo/modules/podversemediaengine/PodverseAudioEngine.kt
release-notes/scratchpad.md

## Reuse

`playbackTargetArtists` and `nowPlayingArtistFields` (plan 60). The existing `subtitle` meta field
keeps its meaning, "what the OS shows in the artist field". `albumTitle` is new and optional, so
older native builds ignore it and older JS sends none.

## JS

### `modules/podverse-media-engine/src/types.ts`

In `MediaEngineSourceMeta`, after `subtitle?: string | null;` add:

```typescript
  /**
   * OS album field. Set only when `subtitle` holds artist names; otherwise the channel title is
   * in `subtitle` and this is null.
   */
  albumTitle?: string | null;
```

### `modules/podverse-media-engine/src/bridgeCommandSerialization.ts`

In `assertSourceMeta`'s returned object add `albumTitle: meta.albumTitle ?? null,` (keys stay
sorted: first).

### `src/lib/playback/mediaEngineSourceMeta.ts`

- Import `nowPlayingArtistFields` and `playbackTargetArtists` from `'./verifiedArtists'`.
- In `mediaEngineSourceMetaFromTarget`, after `const bounds = …` add
  `const artistFields = nowPlayingArtistFields(playbackTargetArtists(target), subtitleFromTarget(target));`
  and in the returned object add `albumTitle: artistFields.albumTitle,` and change `subtitle:` to
  `artistFields.artist`.
- Add by RSS targets need no branch: `playbackTargetArtists` returns `[]` for them, so their
  subtitle stays the channel title.

### `src/lib/playback/engineSourceAdoption.ts`

Anchor: `buildChannelFromEngineMeta`. The adopted channel's title is the album, which is now in
`albumTitle` when an artist was sent. Change `title:` to:

```typescript
  title: nonEmptyMetaString(meta.albumTitle) ?? nonEmptyMetaString(meta.subtitle),
```

with a file-local helper
`const nonEmptyMetaString = (value: string | null | undefined): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;`
placed above `buildChannelFromEngineMeta`. Without this, an adopted music source would show the
artist names as the album.

### `apps/mobile/vitest.config.ts`

Add `'src/lib/playback/mediaEngineSourceMeta.test.ts',` to `test.include` in sorted position
(after `'src/lib/playback/lastPlaybackStorage.test.ts',`). Plan 60 already added
`verifiedArtists.test.ts` to the same list; keep both.

## iOS — `modules/podverse-media-engine/ios/PodverseAudioEngine.swift`

1. `struct PodverseNowPlayingInfo`: add `var albumTitle: String?` after `artist`.
2. `struct PodverseSourceMeta`: add `let albumTitle: String?` after `subtitle`. In `asDictionary()`
   add `if let albumTitle = albumTitle { dict["albumTitle"] = albumTitle }` after the subtitle
   line. In `parse(json:)` pass `albumTitle: object["albumTitle"] as? String,` after `subtitle:`.
3. `load` (anchor: `// Prefer caller meta; fall back to the URL file name until setNowPlayingMetadata runs.`):
   add `albumTitle: meta?.albumTitle,` after `artist: meta?.subtitle,` in the
   `PodverseNowPlayingInfo(…)` initializer.
4. `setNowPlayingMetadata(title:artist:)` becomes
   `func setNowPlayingMetadata(title: String?, artist: String? = nil, albumTitle: String? = nil)`
   and builds `PodverseNowPlayingInfo(title: title, artist: artist, albumTitle: albumTitle)`. The
   default keeps the CarPlay call site compiling until plan 65 passes it.
5. Player rebuild path (anchor: `let artist = self.nowPlaying.artist` inside the rebuild that calls
   `self.load(url: source.url, …, metaJson: nil, …)`): add
   `let albumTitle = self.nowPlaying.albumTitle` beside it, and call
   `self.setNowPlayingMetadata(title: title, artist: artist, albumTitle: albumTitle)`, so a rebuild
   does not drop the album.
6. `updateNowPlayingInfo()`: after the `MPMediaItemPropertyArtist` block add
   `if let albumTitle = nowPlaying.albumTitle { info[MPMediaItemPropertyAlbumTitle] = albumTitle }`.

Update the `setNowPlayingMetadata` doc comment to say "title, artist, and album".

## Android — `PodverseAudioEngine.kt`

Path: `modules/podverse-media-engine/android/src/main/java/expo/modules/podversemediaengine/`.

1. `parseSourceMeta`: add `"albumTitle" to obj.optString("albumTitle").takeIf { it.isNotBlank() },`
   after the `"subtitle"` entry. The returned map is what the engine hands back to JS, so JS
   adoption sees `albumTitle` too.
2. `buildMediaItem`: after `(meta["subtitle"] as? String)?.let { metadataBuilder.setArtist(it) }`
   add `(meta["albumTitle"] as? String)?.let { metadataBuilder.setAlbumTitle(it) }`.

`buildMediaItem` is the only place the engine sets the artist from meta. The other `setArtist`
call, in `PodverseMediaLibraryService.kt`, is plan 65.

## Must stay true

- Podcasts, videos, clips, livestreams, Add by RSS items, and music without a verified artist send
  the same `subtitle` as today and `albumTitle: null`.
- No change to transport, the shared player instance, or remote commands.
- No `as`, no `any`, strict equality only; Swift and Kotlin follow the surrounding style.

## Tests

- `bridgeCommandSerialization.test.ts`: in `'appends metaJson as the fifth arg when meta is
  provided'`, add `albumTitle: 'Album', subtitle: 'Artist'` to `meta` and to the
  `toMatchObject` expectation; add one case that omits both and expects `albumTitle: null`.
- `mediaEngineSourceMeta.test.ts` (new), `describe('mediaEngineSourceMetaFromTarget')`:
  - an `item-music` target whose channel lists one `publisher-music` artist → `subtitle` is the
    artist title and `albumTitle` the channel title;
  - the same target with no `verified_publishers` → `subtitle` is the channel title,
    `albumTitle` null;
  - an `item-podcast` target → `subtitle` is the channel title, `albumTitle` null.
  Build minimal DTOs like `fullPlayerContentLink.test.ts`. If importing the module pulls a native
  module, mock it the way `addByRssPlaybackIdentity.test.ts` does.
- `engineSourceAdoption.test.ts`: one case for `buildChannelFromEngineMeta`: meta with
  `albumTitle: 'Album'` and `subtitle: 'Artist'` → channel title `'Album'`; the existing fixture
  (subtitle only) keeps its title.
- Device check (operator, after a rebuild on both platforms): play a seeded E2E Music Album track
  from the phone; the lock screen (iOS) and the media notification (Android) show the track title,
  "E2E Music Artist", and "E2E Music Album". A podcast episode still shows the podcast title under
  the episode title.

## Release scratchpad

```markdown
## Lock screen and car show the artist and album

- Surfaces: mobile (iOS and Android native media engine)
- Change: when music with a verified artist plays from the phone, the lock screen, Control
  Center, the Android media notification, CarPlay, and Android Auto show the track as the title,
  the artist names as the artist, and the album as the album. Without a verified artist, the
  album title stays in the artist field as before.
- Who notices: mobile listeners using the lock screen or a car
- Operator steps: native rebuild of the mobile app (new store build); check the lock screen on an
  iOS device and the media notification on Android
```
