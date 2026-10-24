**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 40 — Mobile artist screen: verified albums, Not Yet Added, track list

`ArtistDetailScreen` reads `GET /publisher-feed/channel/:id` (`reqPublisherFeedGetRemoteItemsForChannel`). Plan 11 keeps the field names and changes what they mean: `channelsAdded` is verified albums, `channelsUnadded` is Not Yet Added Podcast Index feeds, `itemsAdded` is tracks on those albums (newest first), and `itemsUnadded` is always `[]`. This plan renders that on the Albums and Tracks tabs and leaves the device-only section for area I.

Albums tab, top to bottom, each block only when it has rows:

1. **Verified Albums** — `channelsAdded`, in response order.
2. **Your Add by RSS Albums** — a slot. The stub renders nothing. Area I fills it.
3. **Not Yet Added** — `channelsUnadded`, with the helper note under the heading. A row opens `SearchResultDetail` (`PodcastIndexFeedPreviewScreen`) on the stack this artist screen is already on.

Tracks tab: `itemsAdded` only. Each row names its album. A second slot after those rows is where area I appends tracks from Your Add by RSS Albums. Item references from the artist feed are not shown.

## Rows

R8, R18, R20, R22, R23, R24

## Runs after

11

## Files

apps/mobile/src/screens/artist/artistDetailSections.ts
apps/mobile/src/screens/artist/artistDetailSections.test.ts
apps/mobile/src/screens/artist/ArtistYourAddByRssAlbumsSection.tsx
apps/mobile/src/screens/artist/ArtistYourAddByRssTracksSection.tsx
apps/mobile/src/screens/artist/ArtistDetailScreen.tsx
apps/mobile/vitest.config.ts
packages/i18n-catalog/consumer/originals/en-US.json
packages/i18n-catalog/consumer/originals/es.json
packages/i18n-catalog/consumer/originals/fr.json
packages/i18n-catalog/consumer/originals/el-GR.json
release-notes/scratchpad.md

## Decisions this plan fixes

- **A section heading shows whenever that section has rows**, including a Verified Albums heading when it is the only section. The Albums chip stays `media.music.albums`. The in-list heading is a different label so it can sit beside Not Yet Added.
- **Track rows stay without artwork and gain the album name.** `ArtistAddedTrackRow` keeps `showChannelContext={false}` and passes `showContextLine`. The context line is `item.channel.title` from `mapTrackToHomeFeedRow` (the album). Stop writing the artist title over that subtitle, and delete `titleRef` (nothing else reads it). Do not fall back `channelId` to the artist id or `channelKind` to `'artists'`. `handleGoToChannel` already opens `AlbumDetail` when `channelKind` is `'albums'`.
- **Per-section indexes.** `artist-album-row-${n}` is the nth verified album. `artist-album-unadded-row-${n}` is the nth Not Yet Added album. `artist-track-row-${n}` is the nth verified track. Headings, the note, and the slots do not consume those indexes, so `artist.yaml`'s row 0 taps stay on the verified album and the first track.
- **Add stays on the existing preview.** Do not edit `PodcastIndexFeedPreviewScreen`. Its Add button is `directory_add_by_rss` (membership). Tapping a Not Yet Added row only opens that screen.
- **A failed directory load still shows the existing error empty.** While `isRowsLoading` or `rowsErrorKey !== null`, both lists pass empty directory rows and `includeAddByRssSlot: false`, so `artist-detail-albums-error` / `artist-detail-tracks-error` still appear. Offline albums: directory rows stay empty; the Add by RSS slot still renders when its hook says it is not empty. The stub is empty, so offline albums stay on `OFFLINE_UNAVAILABLE_MESSAGE_KEY` until area I fills the slot.

## Catalog keys

Insert in `media.music` in all four consumer originals, immediately after `no_albums_found`. Do not reformat the file. Do not edit `overrides/` or `compiled/`. Then run `npm run i18n:compile` from the repo root. `apps/*/i18n/compiled/` is gitignored; do not commit it.

| Key | en-US | es | fr | el-GR |
| --- | --- | --- | --- | --- |
| `verified_albums` | Verified Albums | Álbumes verificados | Albums vérifiés | Επαληθευμένα άλμπουμ |
| `your_add_by_rss_albums` | Your Add by RSS Albums | Tus álbumes de Añadir por RSS | Vos albums Ajouter par RSS | Τα άλμπουμ σας από Προσθήκη μέσω RSS |
| `not_yet_added` | Not Yet Added | Aún no añadidos | Pas encore ajoutés | Δεν έχουν προστεθεί ακόμα |
| `not_yet_added_albums_note` | This artist's feed lists these albums. They move up once both feeds confirm the link. | El feed de este artista incluye estos álbumes. Suben en la lista cuando ambos feeds confirman el enlace. | Le flux de cet artiste indique ces albums. Ils remontent dans la liste une fois que les deux flux confirment le lien. | Η ροή αυτού του καλλιτέχνη αναφέρει αυτά τα άλμπουμ. Μετακινούνται πιο πάνω μόλις και οι δύο ροές επιβεβαιώσουν τον σύνδεσμο. |

English headings are title case. The note is a sentence. Other locales use their own capitalization. `your_add_by_rss_albums` uses each locale's existing name for Add by RSS (`Añadir por RSS`, `Ajouter par RSS`, `Προσθήκη μέσω RSS`).

Area D (web) should use these same keys. This plan does not edit web files.

## Pure list builder

`apps/mobile/src/screens/artist/artistDetailSections.ts`. No React, no React Native.

```typescript
export type ArtistDetailSectionRow<T> =
  | { kind: 'verified-heading'; key: 'verified-heading' }
  | { kind: 'verified'; key: string; sectionIndex: number; row: T }
  | { kind: 'add-by-rss-slot'; key: 'add-by-rss-albums' }
  | { kind: 'not-yet-added-heading'; key: 'not-yet-added-heading' }
  | { kind: 'not-yet-added-note'; key: 'not-yet-added-note' }
  | { kind: 'not-yet-added'; key: string; sectionIndex: number; row: T }
  | { kind: 'track'; key: string; sectionIndex: number; row: T }
  | { kind: 'add-by-rss-tracks-slot'; key: 'add-by-rss-tracks' };

export function buildArtistAlbumSectionRows<T>(args: {
  verified: readonly T[];
  notYetAdded: readonly T[];
  includeAddByRssSlot: boolean;
  verifiedKey: (row: T, sectionIndex: number) => string;
  notYetAddedKey: (row: T, sectionIndex: number) => string;
}): ArtistDetailSectionRow<T>[]

export function buildArtistTrackSectionRows<T>(args: {
  tracks: readonly T[];
  includeAddByRssSlot: boolean;
  trackKey: (row: T, sectionIndex: number) => string;
}): ArtistDetailSectionRow<T>[]
```

Album order, and nothing else:

1. `verified-heading` when `verified.length > 0`, then one `verified` row per album, `sectionIndex` from 0.
2. `add-by-rss-slot` when `includeAddByRssSlot` is true.
3. `not-yet-added-heading`, then `not-yet-added-note`, then one `not-yet-added` row per feed, when `notYetAdded.length > 0`. `sectionIndex` restarts at 0.

Track order: one `track` row per item (`sectionIndex` from 0), then `add-by-rss-tracks-slot` when `includeAddByRssSlot` is true.

Do not sort. Empty input and `includeAddByRssSlot: false` returns `[]`.

## Slot components

Both files are the mount area I replaces. They agree: `isEmpty` is true exactly when the component returns null for that `artistId`. The stub is synchronously empty and does not read storage.

`ArtistYourAddByRssAlbumsSection.tsx`:

```typescript
export const ARTIST_YOUR_ADD_BY_RSS_ALBUMS_LABEL_KEY = 'media.music.your_add_by_rss_albums';

export function useArtistYourAddByRssAlbums(_artistId: string): { isEmpty: boolean } {
  return { isEmpty: true };
}

export function ArtistYourAddByRssAlbumsSection(_props: { artistId: string }): ReactElement | null {
  return null;
}
```

`ArtistYourAddByRssTracksSection.tsx`: the same shape, hook `useArtistYourAddByRssTracks`, component `ArtistYourAddByRssTracksSection`, no label constant (tracks have no extra heading).

`import type { ReactElement } from 'react'` on its own line. No user-facing string in the stub. A comment in each file states only the current contract: the section is albums (or tracks) stored on this device for this directory artist, and it renders nothing when there are none. Do not mention a plan, a step, or a later edit.

## Screen wiring

Anchors in `ArtistDetailScreen.tsx`: `loadRows`, `albumsRows`, `tracksRows`, `renderAlbumsItem`, `renderTracksItem`, `handleOpenUnaddedAlbum`, `ArtistUnaddedAlbumRow`, `ArtistUnaddedTrackRow`, `handleOpenUnaddedTrack`.

Keep the `reqPublisherFeedGetRemoteItemsForChannel` call. Do not add a repository. Do not edit `navigation/index.tsx`. `SearchResultDetail` is already registered on Home, Search, Library, and Browse, which are the stacks that mount this screen. `navigation.navigate(CHANNEL_BROWSE_STACK_ROUTES.SearchResultDetail, …)` stays on the current tab.

`loadRows`:

- Keep storing `channelsAdded`, `channelsUnadded`, and `itemsAdded`.
- Delete `tracksUnadded` state. Do not read `itemsUnadded` into the list.
- Offline branch: still local title/artwork, `channelItemsRepository.listByChannel` into `tracksAdded`, and empty album arrays. Do not fetch.

Before building album rows, drop a verified album whose `id_text` trims to empty (it cannot open `AlbumDetail`). Keep every Not Yet Added feed the response sent.

Call the two hooks in the component body, not inside `useMemo`.

```typescript
const slotAllowed = !isRowsLoading && rowsErrorKey === null;
const showDirectoryAlbums = slotAllowed && !offlineModeEnabled;

const albumSectionRows = buildArtistAlbumSectionRows({
  verified: showDirectoryAlbums ? verifiedAlbums : [],
  notYetAdded: showDirectoryAlbums ? albumsUnadded : [],
  includeAddByRssSlot: slotAllowed && !addByRssAlbums.isEmpty,
  verifiedKey: (row) => `verified-${row.id_text}`,
  notYetAddedKey: (row) => `not-yet-added-${row.id}`,
});
```

`slotAllowed` is false during the first load and after a failed load, so the slot stays out and the existing error or spinner empty still shows. Offline (`offlineModeEnabled`) hides verified albums and Not Yet Added, and still includes the slot when the hook is not empty. The stub is empty, so offline albums stay on the offline empty until area I fills the slot.

Tracks: `buildArtistTrackSectionRows` from `tracksAdded` when `slotAllowed`, skipping an item whose `id_text` trims to empty (same as today's `row.id.length === 0` skip). `includeAddByRssSlot` is `slotAllowed && !addByRssTracks.isEmpty`. Offline still uses the tracks `loadRows` already stored. Delete the `resolveUnaddedTrackParentAlbum` loop and `ArtistUnaddedTrackRow`.

`renderAlbumsItem`:

- `verified-heading`: `SectionHeading`, `t('media.music.verified_albums')`, `testID="artist-albums-verified-heading"`. No extra top margin. The list's `paddingTop` is the gap above it.
- `verified`: existing `ArtistAddedAlbumRow` with `index={sectionIndex}`.
- `add-by-rss-slot`: `ArtistYourAddByRssAlbumsSection`. No hairline wrapper.
- `not-yet-added-heading`: `SectionHeading`, `t('media.music.not_yet_added')`, `testID="artist-albums-not-yet-added-heading"`, `marginTop: tokens.spacing.lg`.
- `not-yet-added-note`: `HelperNote` `scale="reading"`, `t('media.music.not_yet_added_albums_note')`, `testID="artist-albums-not-yet-added-note"`, `marginTop` and `marginBottom` of `tokens.spacing.base`.
- `not-yet-added`: existing `ArtistUnaddedAlbumRow` with `index={sectionIndex}`.

`renderTracksItem`: `track` uses `ArtistAddedTrackRow` with `index={sectionIndex}`, `showChannelContext={false}`, `showContextLine`. `add-by-rss-tracks-slot` renders `ArtistYourAddByRssTracksSection` with no hairline.

`albumsEmpty` / `tracksEmpty` stay as they are. They show only when the section array is empty, which is the loading, error, offline-albums, and true-empty cases above.

`handleOpenUnaddedAlbum` stays: `unparsedPodcastIndexFeedTarget(row)` and, when non-null, navigate to `SearchResultDetail` with `resultId`, `author`, `description`, `feedUrl`, `imageUrl`, and `title`. A null target leaves the row not pressable (the row component already does this). Delete `handleOpenUnaddedTrack`.

Remove unused imports (`resolveUnaddedTrackParentAlbum`, `EpisodeByGuidResponse`, `UnaddedTrackParentAlbum`, `useRef` if nothing else uses it).

Do not change chips, subscribe, podroll, about, funding, people, or settings. `DEFAULT_ARTIST_TAB` stays Albums.

## Must stay true

- Verified albums and Not Yet Added feeds are never in both lists. The screen does not re-check verification; plan 11 already partitioned them.
- `itemsUnadded` is not rendered, even if a response still contains it.
- No new route, no tab switch, no edit to the preview screen.
- No `as`, no `any`, strict equality only.
- Comments do not name a plan or a step number.

## Tests

`apps/mobile/src/screens/artist/artistDetailSections.test.ts`. Add that path to the `include` array in `apps/mobile/vitest.config.ts` beside the other `src/screens/` entries. The test imports only `artistDetailSections.ts`.

`buildArtistAlbumSectionRows`:

- Verified only: `verified-heading`, then `verified` indexes 0 and 1. No note and no slot.
- Not Yet Added only: `not-yet-added-heading`, `not-yet-added-note`, then `not-yet-added` index 0. No verified heading.
- Both, with the slot: verified heading and rows, then `add-by-rss-slot`, then the Not Yet Added heading, note, and rows. Indexes restart at 0 in the second section.
- All empty and slot false: `[]`.
- All empty and slot true: exactly `[add-by-rss-slot]`.

`buildArtistTrackSectionRows`:

- Two tracks, slot false: indexes 0 and 1, no slot.
- Two tracks, slot true: those rows, then `add-by-rss-tracks-slot`.
- No tracks, slot true: exactly the slot.
- No tracks, slot false: `[]`.

Maestro is plan 41. This plan does not edit `apps/mobile/e2e/artist.yaml`.

## Release scratchpad

```markdown
## Artist screen separates verified albums from albums not yet added

- Surfaces: mobile
- Change: On an artist screen, Albums lists verified albums first, under a Verified Albums heading. Albums the artist names that Podverse has not parsed yet appear under Not Yet Added, with a note that they move up once both feeds confirm the link. Tapping one opens the Podcast Index preview on the same tab, where a member can add the feed. Albums Podverse has parsed that do not name the artist back are not listed. Tracks lists the tracks on the verified albums, and each row names its album. Track references that exist only on the artist feed are not listed.
- Who notices: listeners browsing an artist
- Operator steps: none
```
