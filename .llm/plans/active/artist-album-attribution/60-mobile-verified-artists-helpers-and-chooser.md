**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 60 — Mobile verified-artist helpers and the artist chooser sheet

Adds the pieces every mobile artist line reads: which verified publishers count as artists for a
playback target or a track, the mini player's "Artist · Album" text, the OS artist and album fields,
and one bottom sheet that lists several artists. Plans 61 (full player), 62 (mini player), 63
(track screen), 64 (lock screen), and 65 (car) build on these names. Area I (Add by RSS) reuses the
chooser and the text helpers.

No screen changes here.

## Rows

R8, R21, R30, R31, R37

## Runs after

10

## Files

apps/mobile/src/lib/playback/verifiedArtists.ts
apps/mobile/src/lib/playback/verifiedArtists.test.ts
apps/mobile/vitest.config.ts
apps/mobile/src/components/content/ArtistChooserSheet.tsx
apps/mobile/src/components/content/index.ts

## Decisions this plan fixes

- **Only publishers whose route kind is `artist` show as artists.** Plan 10's resolver does not
  filter by medium. Mobile keeps entries where `getChannelRouteKind(medium_id) === 'artist'`
  (today `publisher-music` only, which includes record labels). A podcast network publisher never
  appears as an "artist" line on a podcast. When the helpers package later changes what counts as
  an artist, this filter follows it with no mobile edit.
- **Absent means no line.** Stored queue, channel-item, and playable-item payloads keep DTOs
  verbatim, so rows stored before plan 12 have no `verified_publishers`. Plan 10's resolver treats
  absent as empty. Nothing migrates; the line appears once the row refreshes.
- **Add by RSS targets return no artists here.** Area I adds them on the device.
- **With no artist, the OS keeps today's fields.** The channel title stays in the artist field and
  the album field stays empty, so the second line on the lock screen and in the car is never blank.

## `apps/mobile/src/lib/playback/verifiedArtists.ts` (new)

```typescript
import { joinVerifiedPublisherTitles, resolveVerifiedPublishers } from '@podverse/helpers';
import type { DTOVerifiedPublisher } from '@podverse/helpers/dto';
import { getChannelRouteKind } from '@podverse/helpers/medium';
import type { PlaybackTarget } from '@podverse/playback-core';

type VerifiedPublisherHolder = {
  verified_publishers?: DTOVerifiedPublisher[];
};

/** Verified publishers shown as artists for a channel, or for an item on that channel. */
export const resolveVerifiedArtists = (args: {
  channel?: VerifiedPublisherHolder | null;
  item?: VerifiedPublisherHolder | null;
}): DTOVerifiedPublisher[] => …;

/** Artists for the item a playback target plays. Add by RSS targets have none here. */
export const playbackTargetArtists = (target: PlaybackTarget | null): DTOVerifiedPublisher[] => …;

/**
 * Second line of the mini player: "Artist · Album" when there is an artist, else the album
 * (channel) title. Null when both are empty.
 */
export const artistAlbumLine = (
  artists: readonly DTOVerifiedPublisher[],
  albumTitle: string | null
): string | null => …;

export type NowPlayingArtistFields = {
  /** OS artist field. Artist names, or the channel title when there is no artist. */
  artist: string | null;
  /** OS album field. The channel title, only when `artist` holds artist names. */
  albumTitle: string | null;
};

export const nowPlayingArtistFields = (
  artists: readonly DTOVerifiedPublisher[],
  channelTitle: string | null
): NowPlayingArtistFields => …;
```

Bodies:

- `resolveVerifiedArtists`: `resolveVerifiedPublishers(args).filter((publisher) =>
  getChannelRouteKind(publisher.medium_id) === 'artist')`.
- `playbackTargetArtists`: `[]` when `target === null` or `target.kind === 'add-by-rss'`;
  otherwise `resolveVerifiedArtists({ channel: target.channel, item: target.item })`. Every other
  kind has `channel`; `livestream` may have `item: null`, which the resolver accepts.
- `artistAlbumLine`: `names = joinVerifiedPublisherTitles(artists)`; `album = albumTitle?.trim()
  ?? ''`. Names and album both non-empty → `` `${names} · ${album}` ``. Only names → names. Only
  album → album. Neither → `null`. The separator is the literal `' · '` (space, U+00B7, space),
  the same separator other mobile rows join with.
- `nowPlayingArtistFields`: `names` as above, `channel = channelTitle?.trim() ?? ''`. Names
  non-empty → `{ artist: names, albumTitle: channel.length > 0 ? channel : null }`. Otherwise →
  `{ artist: channel.length > 0 ? channel : null, albumTitle: null }`.

Check the import specifiers against the files that already import them:
`buildChannelFromDownload.ts` imports types from `@podverse/helpers/dto` and `MediumEnum` from
`@podverse/helpers/medium`; `fullPlayerContentLink.ts` imports from `@podverse/helpers`. Plan 10
exports `DTOVerifiedPublisher` from the dto barrel and both functions from the root barrel.

## `apps/mobile/vitest.config.ts`

Add `'src/lib/playback/verifiedArtists.test.ts',` to `test.include`, in sorted position after
`'src/lib/playback/resolvePlaybackUrl.test.ts',`.

## `apps/mobile/src/components/content/ArtistChooserSheet.tsx` (new)

A bottom sheet listing each artist. Built on `MoreMenu` (`components/primitives/MoreMenu.tsx`), the
sheet the full player's sleep timer and speed control already use, so it mounts in `AppOverlay`
and never uses `Modal`.

```typescript
export type ArtistChooserSheetProps = {
  artists: readonly DTOVerifiedPublisher[];
  onCancel: () => void;
  onSelect: (artist: DTOVerifiedPublisher) => void;
  /** Root testID. Rows are `${testID}-artist-${index}`; cancel is `${testID}-cancel`. */
  testID: string;
  visible: boolean;
};

export function ArtistChooserSheet(props: ArtistChooserSheetProps) { … }
```

- `const { t } = useTranslation();`
- Render `<MoreMenu cancelLabel={t('misc.cancel')} cancelTestID={`${testID}-cancel`}
  onCancel={onCancel} sections={sections} testID={testID} visible={visible} />`.
- `sections` (memoized on `artists`, `onSelect`, `t`, `testID`): one section,
  `{ key: 'artists', title: t('media.music.artists'), items }`, where each artist at `index` maps
  to `{ key: artist.id_text, label: artist.title?.trim() ?? '', onPress: () => onSelect(artist),
  testID: `${testID}-artist-${index}` }`.
- The sheet does not close itself. Callers set `visible` false in `onSelect` and `onCancel`.

Existing catalog keys only (`misc.cancel`, `media.music.artists`); no catalog edit. Named export,
then add `export { ArtistChooserSheet } from './ArtistChooserSheet';` and
`export type { ArtistChooserSheetProps } from './ArtistChooserSheet';` to
`components/content/index.ts`, in the file's existing order and style.

## Must stay true

- No `as`, no `any`, strict equality only, `import type` on its own line for type-only imports.
- The helpers are pure: no React, no storage, no network.

## Tests

`apps/mobile/src/lib/playback/verifiedArtists.test.ts` (vitest), one `describe` per export:

- `resolveVerifiedArtists`: keeps a `MediumEnum.PublisherMusic` entry and drops a
  `MediumEnum.PublisherPodcast` entry from the same list;
  channel-wide first, then item-only; absent fields on both give `[]`.
- `playbackTargetArtists`: `null` → `[]`; an `item-music` target whose channel lists one artist →
  that artist; an `add-by-rss` target → `[]`; a `livestream` target with `item: null` reads the
  channel. Build minimal DTOs the way `fullPlayerContentLink.test.ts` does.
- `artistAlbumLine`: "A, B · Album"; names only; album only; both empty → `null`.
- `nowPlayingArtistFields`: with artists → names plus album; without → channel title in `artist`
  and `albumTitle: null`; nothing → both `null`.

No component test for the sheet. The seed credits one artist, so plan 66's Maestro flow covers
the single-artist path; the sheet only maps artists onto `MoreMenu` rows.

## Release scratchpad

none
