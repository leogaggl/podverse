# 53 — Album livestream channel line opens the album

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

Rows: R74 (a regular livestream on an album feed: the full player's channel line shows the
album title and opens the album page, on Home when this device follows the album and on Browse
when it does not). Mobile only. Web is unchanged.

Runs after `52-player-livestream-title-link.md`. Never in one phase with 52, or with any plan
that edits `fullPlayerContentLink.ts` or `fullPlayerContentLink.test.ts` (50, 51, 52). This
plan does not edit `FullPlayerScreen.tsx` or `navigation/index.tsx`. It is the last prompt: its
COPY-PASTA prompt archives the set. Plan 52 moves only its own file.

Publisher (artist) feeds stay as they are. Do not route them to the artist page, and do not
open the album under an artist page.

## Answer

`resolveItemPlaybackStart` (`src/lib/playback/buildPlaybackTarget.ts`) turns any item with
`live_item` into kind `'livestream'` and keeps that item's channel. The channel line's text is
already `channel.title`: `summaryFromItem` in `PlaybackProvider.tsx` sets `channelTitle` from
it, and `FullPlayerScreen` renders `nowPlaying.channelTitle`. On an album that title is the
album title. Do not change that text.

The link is the gap. `resolveFullPlayerChannelLink` returns kind `'podcast'` for every
`'livestream'`. A track (`'item-music'`) uses `musicChannelKind`, which is `'album'` unless
`isArtistMediumId`. `homeContentParams` and `catalogContentParams` (`browseContentParams` calls
it) in `navigation/index.tsx` already map kind `'album'` to `AlbumDetail` through
`buildAlbumDetailParams`. `playerContentStack` sends a follow to Home and anything else to
Browse, for every kind except `'add-by-rss'`. `openLinkedContent` in `FullPlayerScreen.tsx`
sets that follow from `getChannelActionChrome(channel.id_text)?.isSubscribed === true`.
`channelFromTarget` returns `target.channel` for a livestream, and `AlbumDetailScreen` writes
the same chrome through `subscriptionsRepository.subscribeLocal`. Home hidden on the tab bar
already uses `MoreOverflowHome`; Browse hidden uses `MoreOverflowBrowse`.

Plan 50's item-title press passes this same channel link into `onOpenItem`. After this change,
tapping the livestream title on an album feed opens the tab root, then `AlbumDetail`, then
`EpisodeDetail` (the livestream page plan 52 already links). Plan 50's table still names
`PodcastDetail` for every livestream; its code passes `channelLink`, so do not edit plan 50.
The channel press stays one screen.

Web already opens the album for `MediumEnum.Music` in `resolveDefaultLinks`
(`apps/web/src/utils/mediaPlayer/mediaPlayerInfoResolution.ts`), livestreams included. This
plan does not edit that file.

## Locked decisions

1. **Album medium only.** In the `'livestream'` case, the kind is `'album'` when
   `isAlbumMediumId(channel.medium_id)` is true. That is `MediumEnum.Music` and
   `MediumEnum.MusicL`. Every other livestream, including `MediumEnum.PublisherMusic`, stays
   `'podcast'`. Do not call `musicChannelKind` or `getChannelRouteKind`. Both return
   `'artist'` for a publisher feed.
2. **Same Home / Browse choice as other channel links.** Do not add a follow check, a download
   check, or a stack branch. Kind `'album'` and the livestream's title kind `'episode'` both
   follow `isSubscribed` in `playerContentStack`. Plan 50 passes `channelLink.kind` on the
   channel press and `titleLink.kind` on the title press. Leave that.
3. **Channel press is one screen.** `AlbumDetail` on Home or Browse, with the tab root under
   it (`initial: false`, already in `homeContentParams`). Do not push `ArtistDetail` under the
   album. Do not push the livestream page on a channel press.
4. **Title press keeps plan 50's stack.** Tab root, then this channel link, then the item.
   The item stays `EpisodeDetail` (plan 52). Do not edit `resolveFullPlayerTitleLink`.
5. **No new route, catalog key, or title source.** The accessible name becomes
   `media.music.album` through the existing `fullPlayerOpenScreenLabelKey` album case. Leave
   `PlaybackProvider.tsx` and `summaryFromItem` alone. `channelRequest` already fills
   `idText`, `imageUrl`, and `name`.
6. **Add by RSS is unchanged.** An Add by RSS livestream's channel link stays kind
   `'add-by-rss'` (the feed page). Do not open `AlbumDetail` for it.
7. **No web edit.** Copy the mobile album check (`isAlbumMediumId`), not web's
   `medium_id === MediumEnum.Music` check. Web's MusicL channel link stays as it is.
8. **No Maestro flow.** The new claim is which kind the pure function returns. `AlbumDetail`,
   the follow chrome, and Home versus Browse are the path a track's channel line already
   uses. `e2e/player-screen.yaml` plays a podcast and must keep expecting
   `podcast-detail-screen`. There is no seeded album livestream.

## Files

Paths under `apps/mobile/` unless noted. `navigation/index.tsx` is large: Grep `case 'album'`
and read that window only, to confirm both switches. Do not edit the file. If either
`'album'` case is missing, stop and report BLOCKED.

| File                                               | Anchor                           | Change                |
| -------------------------------------------------- | -------------------------------- | --------------------- |
| `src/screens/player/fullPlayerContentLink.ts`      | `resolveFullPlayerChannelLink`   | Album livestream kind |
| `src/screens/player/fullPlayerContentLink.test.ts` | `resolveFullPlayerChannelLink`   | Album and podcast     |
| `release-notes/scratchpad.md` (repo root)          | end of file                      | Entry                 |

`vitest.config.ts` already includes the test file (plan 50).

## Implementation

`fullPlayerContentLink.ts` already imports `isArtistMediumId` from `@podverse/helpers/medium`.
Add `isAlbumMediumId` to that import, alphabetically first.

Split `'livestream'` out of the podcast group. Leave `'item-music'` on `musicChannelKind`.

```typescript
case 'livestream':
  return channelRequest(
    target.channel,
    name,
    isAlbumMediumId(target.channel.medium_id) ? 'album' : 'podcast'
  );
case 'clip':
case 'soundbite':
case 'chapter':
case 'item-podcast':
case 'item-video':
  return channelRequest(target.channel, name, 'podcast');
```

Replace the doc comment on `resolveFullPlayerChannelLink` with:

```typescript
/**
 * Where the visible channel name opens. A directory livestream whose channel is an album
 * opens that album. Any other directory livestream opens the podcast. Add by RSS opens only
 * when this device has the feed.
 */
```

Grep `apps/mobile/src/navigation/index.tsx` for `case 'album'` and confirm `homeContentParams`
and `catalogContentParams` both return `screen: 'AlbumDetail'` via `buildAlbumDetailParams`.
Grep `openLinkedContent` in `FullPlayerScreen.tsx` and confirm the follow check is still
`getChannelActionChrome` on the playing channel's `id_text`. Do not edit either file. If plan
50 removed that check, stop and report BLOCKED.

## Tests

In `describe('resolveFullPlayerChannelLink')`, using the file's `channel` (`id_text`
`'show-1'`) and `item`. Spread `medium_id` the way the music cases already do.

- A livestream on `MediumEnum.Music`, visible title `'Album One'`, third argument `null` →
  `{ idText: 'show-1', kind: 'album', name: 'Album One' }`.
- The same with `MediumEnum.MusicL` → kind `'album'`.
- The same with `MediumEnum.PublisherMusic` → kind `'podcast'`.
- The same with `MediumEnum.Podcast` (the fixture's own medium) → kind `'podcast'`.

In `describe('playerContentStack')`:

- `{ isSubscribed: true, kind: 'album' }` → `'Home'`.
- `{ isSubscribed: false, kind: 'album' }` → `'Browse'`.

## Release scratchpad

```markdown
## Album livestreams in the player open the album

- Surfaces: mobile
- Change: While a livestream from an album is playing, the full player's channel line shows
  that album's title and opens the album page, on Home when this device follows the album and
  on Browse when it does not.
- Who notices: anyone who plays a livestream from an album on the phone
- Operator steps: none
```

Move this plan to `.llm/plans/completed/add-by-rss-parity/` when done. It is the last prompt.
Its COPY-PASTA prompt also moves `00-REQUEST.md`, `00-SUMMARY.md`, `00-EXECUTION-ORDER.md`,
and `COPY-PASTA.md` there, removes the empty active directory, and ends with the cumulative
verification already written on that prompt. Do not archive the set from plan 52.
