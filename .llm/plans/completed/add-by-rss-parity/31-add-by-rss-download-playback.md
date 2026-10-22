# 31 — Add by RSS episodes play their download from the device

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

Rows: R29 (Download is only worth offering if the file plays). Mobile only.

Runs after `30-add-by-rss-item-actions.md`.

## Why

Plan 30 lets a user download an Add by RSS episode from its row. Today that file is never played
from the Add by RSS screens:

- `startAddByRssPlayback` in `src/playback/PlaybackProvider.tsx` always loads
  `resolveAddByRssPlaybackUrl(resourceData)`, which is the remote enclosure.
- `itemIdFromTarget` returns `null` for `'add-by-rss'`, so the download handoff never applies.
- The Offline Mode toggle is ignored: an Add by RSS episode streams with the toggle on, which
  breaks **mobile-offline-mode** (playback uses a completed local file only, no remote fallback).
  It also defeats plan 21, which opens a podcast feed on its Downloaded chip in Offline Mode.

Library → Downloads already plays these files, because it plays them as catalog-style items
through `resolvePlaybackUrl`. This plan gives the Add by RSS path the same local-first rule.

## Locked decisions

1. **Local first.** When the caller names a download id and that download is complete with its
   file on disk, play the `file://` path. Reuse the existing local lookup in
   `src/lib/playback/resolvePlaybackUrl.ts` (including its mark-missing step) rather than a second
   copy.
2. **Offline Mode.** With the toggle on, Add by RSS playback never falls back to the remote
   enclosure. This applies to every Add by RSS play (rows, queue, playlists), not only rows that
   have a download. The refusal uses the notice items already use: `media_player.no_media`.
3. **Who passes the download id.** `useAddByRssPlayback.playItem` knows the feed record, the item,
   and its index, so it computes `addByRssDownloadItemIdText(feed.feedUrl, itemBundle.item,
   itemIndex)` (plan 21) and passes it. Queue and playlist plays pass no id, so they still stream
   when online. Matching those to a download needs the local feed record; that is left out.
4. **No mid-play swap.** A download that finishes while its Add by RSS episode plays does not swap
   the source. The next play picks up the file.
5. **Credentials.** `withAddByRssPlaybackAuth` in `src/playback/addByRssMediaAuth.ts` only reads
   credentials for remote `http(s)` URLs, so a local file loads without them. No change there.

## Files

| File                                          | Change                                      |
| --------------------------------------------- | ------------------------------------------- |
| `src/lib/playback/resolvePlaybackUrl.ts`      | Export the local lookup                     |
| `src/lib/playback/resolvePlaybackUrl.test.ts` | Cover the exported lookup                   |
| `src/playback/PlaybackProvider.tsx`           | Local-first and Offline Mode for Add by RSS |
| `src/hooks/useAddByRssPlayback.ts`            | Pass the download id                        |

All paths are under `apps/mobile/`. `PlaybackProvider.tsx` is a large file: search for the anchors
below and read a window around each.

## Implementation

### `resolvePlaybackUrl.ts`

Rename the private `resolveLocalDownloadUrl` to `resolveLocalDownloadPlaybackUrl` and export it.
`resolvePlaybackUrl` keeps calling it. Doc comment: the `file://` path of a completed download
whose file is still on disk, else `null`; a complete row whose file is gone is marked failed so the
UI offers a re-download.

### `PlaybackProvider.tsx`

Anchors: `const resolveAddByRssPlaybackUrl` (module scope), `const startAddByRssPlayback`,
`const playAddByRssResourceData`, and the context type member `playAddByRssResourceData:` (in the
session value type near the other `play*` members).

- Import `resolveLocalDownloadPlaybackUrl` beside the existing `resolvePlaybackUrl` import.
  `isOfflineModeEnabled` is already imported.
- `startAddByRssPlayback` options gain `localDownloadItemIdText?: string`. Replace the first two
  statements of its body with:

```typescript
const localUrl =
  options.localDownloadItemIdText !== undefined
    ? await resolveLocalDownloadPlaybackUrl(options.localDownloadItemIdText)
    : null;
const url =
  localUrl ?? (isOfflineModeEnabled() ? null : resolveAddByRssPlaybackUrl(resourceData));
if (url === null) {
  setNoticeKey('media_player.no_media');
  return;
}
```

  The `playTarget` call after it is unchanged.
- `playAddByRssResourceData` options gain `localDownloadItemIdText?: string`, passed through to
  `startAddByRssPlayback`. Update the context type member to the same options shape.
- `playQueueResource`'s Add by RSS branch passes no download id; leave it as is. It now gets the
  Offline Mode refusal from `startAddByRssPlayback`.
- Add one sentence to the doc comment above `startAddByRssPlayback` (add the comment if there is
  none): a finished download plays from the device when the caller names it, and with Offline
  Mode on there is no remote fallback.

### `useAddByRssPlayback.ts`

In `playItem`, after the enclosure check:

```typescript
await playAddByRssResourceData(
  toAddByRssItemPlaybackResourceData(feed, mappedFeed, itemBundle, itemIndex),
  { localDownloadItemIdText: addByRssDownloadItemIdText(feed.feedUrl, itemBundle.item, itemIndex) }
);
```

Keep the existing `status_processing` notice for an item with no enclosure. Extend the hook's doc
comment: a finished download of the episode plays from the device.

## Tests

- `resolvePlaybackUrl.test.ts`: the file already mocks the download store, file system, and
  Offline Mode. Add a `describe('resolveLocalDownloadPlaybackUrl')` with three cases that reuse
  those mocks: a complete row whose file exists returns the absolute path; a row that is not
  complete returns `null`; a complete row whose file is missing returns `null` and calls
  `downloadManager.markFileMissing`.
- No PlaybackProvider unit test (React Native module). Coverage is the Maestro playback step in
  `e2e/add-by-rss.yaml`, which must still pass online with no download.
- No new Maestro flow for offline Add by RSS playback: it needs a finished download inside the
  flow first, and the Downloads and Offline Mode flows already cover the shared local lookup.

## Release scratchpad

```markdown
## Mobile Add by RSS episodes play their download and respect Offline Mode

- Surfaces: mobile
- Change: Playing an Add by RSS episode from its feed page or the Add by RSS library now uses the
  downloaded file when one is finished, instead of streaming again. With Offline Mode on, Add by
  RSS episodes, including ones in the queue or a playlist, no longer stream; without a download
  they show the same "no media" notice other episodes show.
- Who notices: people who download Add by RSS episodes or use Offline Mode
- Operator steps: none
```
