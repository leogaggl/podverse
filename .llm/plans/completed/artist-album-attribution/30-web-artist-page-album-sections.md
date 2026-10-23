**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 30 — Web artist page: verified albums, Not Yet Added, verified tracks

The directory artist page (`/artist/[channel_id]`) reads `GET /publisher-feed/channel/:id`
(plan 11). After that plan the response already means:

- `channelsAdded` — verified directory albums, artist-feed order
- `channelsUnadded` — Not Yet Added Podcast Index feeds, each with `id` for the preview
- `itemsAdded` — tracks on those verified albums, newest first, at most 500
- `itemsUnadded` — always `[]`

The page still paints added and unadded albums as one list with no headings, and the Tracks
tab still has a path that renders item-level references. This plan makes the Albums tab three
regions and the Tracks tab the verified tracks only.

Albums tab, top to bottom:

1. **Verified Albums**, when `channelsAdded` is non-empty.
2. **Your Add by RSS Albums** — a mount that returns nothing. Area H (step 09) fills it from
   the browser's Add by RSS store. It never enters server HTML.
3. **Not Yet Added**, when `channelsUnadded` is non-empty, with the helper note. Each row
   keeps today's link to `/podcast-index/feed/[id]`.

Tracks tab: `itemsAdded` only, then a second mount for tracks from Your Add by RSS Albums.
No "Verified Tracks" heading. The Tracks chip is the heading.

## Rows

R8, R18, R20, R22, R23, R24

## Runs after

11, 13

## Files

apps/web/src/app/artist/[channel_id]/ArtistPageAlbumSections.tsx
apps/web/src/styles/components/Artist/ArtistPageAlbumSections.module.scss
apps/web/src/app/artist/[channel_id]/ArtistPageAddByRssSections.tsx
apps/web/src/app/artist/[channel_id]/page.tsx
apps/web/src/app/artist/[channel_id]/ArtistPageClient.tsx
apps/web/src/app/artist/[channel_id]/ArtistPageList.tsx
apps/web/src/app/artist/[channel_id]/ArtistPageListHeader.tsx
apps/web/src/components/List/Music/Albums/Tracks/ListTracksRemoteItems.tsx
apps/web/src/components/List/Music/Albums/Tracks/ListTrackRemoteItemNodes.tsx
apps/web/src/components/List/Music/Albums/Tracks/ListTrackRowRemoteItemUnadded.tsx
apps/web/src/components/List/Music/Albums/Tracks/ListTrackGridNodeUnadded.tsx
packages/i18n-catalog/consumer/originals/en-US.json
packages/i18n-catalog/consumer/originals/es.json
packages/i18n-catalog/consumer/originals/fr.json
packages/i18n-catalog/consumer/originals/el-GR.json
apps/web/e2e/artist-page-albums-and-tracks.spec.ts
makefiles/local/e2e-spec-order-web.txt
release-notes/scratchpad.md

`ListAlbumRemoteItemNodes.tsx` and `ListAlbumRowRemoteItemUnadded.tsx` stay as they are. The
page calls the nodes component once per album section. Do not edit them.

## Decisions this plan fixes

- **A section heading renders only when that section has rows.** "Verified Albums" still
  renders when it is the only albums section. The other choice was hiding it unless Not Yet
  Added or Your Add by RSS Albums is also present. That heading would then appear after
  hydration whenever this browser has Add by RSS albums, and the list would jump.
- **The Albums and Tracks chips stay hidden when the server lists are empty**, unless
  `useArtistPageAddByRssPresence` reports rows. The stub reports none, so an artist with no
  directory albums keeps today's page. Area H turns the hook true when this browser has Add
  by RSS albums or tracks for the artist. The other choice was always showing the Albums
  chip, which would add an empty tab on every artist who has no albums.
- **Helper sentence**, exact English: "This artist's feed lists these albums. They move up
  once both feeds confirm the link."
- **The Tracks tab has no section heading.** Item-level references are not shown, so there
  is nothing to separate from the verified tracks except the Add by RSS mount, which area H
  marks with the existing Add by RSS row marker.
- **Adding a Not Yet Added feed stays on the Podcast Index preview.** The row only links
  there. Do not add an "Add Feed" control on the artist page.
- **Grid stays unused.** `ArtistPageList` keeps `viewSelected="rows"`. Do not add a view
  toggle and do not build section headings in the grid branch.

## Catalog

Insert three keys immediately after `no_albums_found` inside `media.music`. Grep
`"no_albums_found"` in each file. Do not read the whole catalog. If a key is already present
with this exact English, leave it. Do not edit `overrides/` or `compiled/`.

| Key | en-US |
| --- | --- |
| `verified_albums` | Verified Albums |
| `not_yet_added` | Not Yet Added |
| `not_yet_added_albums_note` | This artist's feed lists these albums. They move up once both feeds confirm the link. |

Same key paths, each language's own capitalization:

- **es:** `Álbumes verificados` · `Aún no añadidos` · `El feed de este artista incluye estos álbumes. Suben cuando ambos feeds confirman el vínculo.`
- **fr:** `Albums vérifiés` · `Pas encore ajoutés` · `Le flux de cet artiste répertorie ces albums. Ils remontent lorsque les deux flux confirment le lien.`
- **el-GR:** `Επαληθευμένα άλμπουμ` · `Δεν έχουν προστεθεί ακόμα` · `Η ροή αυτού του καλλιτέχνη περιλαμβάνει αυτά τα άλμπουμ. Μετακινούνται προς τα πάνω μόλις και οι δύο ροές επιβεβαιώσουν τη σύνδεση.`

Do not add `your_add_by_rss_albums` here. Nothing in this plan renders it. Area H adds
`media.music.your_add_by_rss_albums` = `Your Add by RSS Albums`.

After the four originals, run `npm run i18n:compile` from the repo root. Do not commit
`apps/*/i18n/compiled/` or `packages/i18n-catalog/*/compiled/` (they are gitignored).

## Mount area H fills

New file `apps/web/src/app/artist/[channel_id]/ArtistPageAddByRssSections.tsx`, `'use client'`,
named exports. The parameter prefix `_` is required while the bodies ignore the channel
(`argsIgnorePattern: '^_'`).

```tsx
export function ArtistPageYourAddByRssAlbums(_props: { channel: DTOChannel }) {
  return null;
}

export function ArtistPageYourAddByRssTracks(_props: { channel: DTOChannel }) {
  return null;
}

export function useArtistPageAddByRssPresence(_channel: DTOChannel): {
  hasAlbums: boolean;
  hasTracks: boolean;
} {
  return { hasAlbums: false, hasTracks: false };
}
```

File comment, future-forward, no plan numbers: these three exports are the browser-only
albums and tracks for this artist. They stay empty on the server, so the section is absent
from the page HTML and from anyone else's view. `DTOChannel` is imported with `import type`.

Area H replaces the bodies and must keep this contract:

- Same three exports and the `{ channel: DTOChannel }` prop. Read `channel.podcast_guid` and
  `channel.id_text`. Do not move the components to another file.
- Server render and the first client render before the store is read return `null` and
  `{ hasAlbums: false, hasTracks: false }`. No heading and no rows in server HTML.
- When the albums section has rows, render
  `<section data-testid="artist-your-add-by-rss-albums">` with an `h2` whose text is
  `Your Add by RSS Albums`, between Verified Albums and Not Yet Added (this plan already
  places the component there).
- When the tracks section has rows, render
  `<section data-testid="artist-your-add-by-rss-tracks">` from
  `ArtistPageYourAddByRssTracks`, which this plan already places after the verified tracks.
- `hasAlbums` / `hasTracks` are true only when that section will render, so the chip exists
  for an artist whose server lists are empty.

## Albums sections

New `ArtistPageAlbumSections.tsx`, `'use client'`. Props: `channel: DTOChannel`,
`channelsAdded: DTOChannel[]`, `channelsUnadded: PodcastBatchByFeedGuidResponse['feeds']`.

```tsx
<div className={styles.sections}>
  {channelsAdded.length > 0 ? (
    <section aria-labelledby={verifiedHeadingId} data-testid="artist-verified-albums">
      <h2 id={verifiedHeadingId} className={styles.heading}>
        {tMedia('music.verified_albums')}
      </h2>
      <ListAlbumRemoteItemNodes
        channelsAdded={channelsAdded}
        channelsUnadded={[]}
        viewSelected="rows"
      />
    </section>
  ) : null}
  <ArtistPageYourAddByRssAlbums channel={channel} />
  {channelsUnadded.length > 0 ? (
    <section
      aria-labelledby={unaddedHeadingId}
      aria-describedby={noteId}
      data-testid="artist-not-yet-added-albums"
    >
      <h2 id={unaddedHeadingId} className={styles.heading}>
        {tMedia('music.not_yet_added')}
      </h2>
      <p id={noteId} className={styles.note} data-testid="artist-not-yet-added-albums-note">
        {tMedia('music.not_yet_added_albums_note')}
      </p>
      <ListAlbumRemoteItemNodes
        channelsAdded={[]}
        channelsUnadded={channelsUnadded}
        viewSelected="rows"
      />
    </section>
  ) : null}
</div>
```

`useId()` once per id. `useTranslations('media')`. Styles import last.

`ArtistPageAlbumSections.module.scss`, tokens only, no `var()` fallback:

- `.sections`: `display: flex; flex-direction: column; gap: var(--spacing-section-top);`
  A mount that returns `null` is not in the layout, so it leaves no gap.
- `.heading`: `margin: 0; padding: 0 var(--spacing-md); font-size: var(--font-size-lg); font-weight: var(--font-weight-medium); color: var(--text-color-primary);`
  Horizontal padding matches `ListPodcastRow` `.listItem` so the heading lines up with the
  row's left edge. Do not change that row module.
- `.note`: `margin: var(--spacing-md) 0 0; padding: 0 var(--spacing-md); font-size: var(--font-size-sm); color: var(--text-color-secondary);`

The page title stays the `h1` in `CoreArtistHeader`. These headings are `h2`.

`ListAlbumRowRemoteItemUnadded` already links to
`` `${ROUTES.PODCAST_INDEX}/feed/${target.podcastIndexId}` `` via
`unparsedPodcastIndexFeedTarget`. A feed with no positive numeric `id` stays a non-link.
Do not change that. Verified rows stay `ListAlbumRow` links to `/album/${id_text}`.

## Tracks tab

`ListTracksRemoteItems` and `ListTrackRemoteItemNodes` are only used by the artist page.
Drop `channelsAdded` and `itemsUnadded` from both. Delete `visibleUnaddedTracks` and the
unadded row and grid branches. Keep the `itemsAdded` filter that skips an item whose
`channel` is null or undefined, and keep `showChannelInfo` on the remaining rows.

Grep the two unadded components. If nothing else imports them, delete:

- `apps/web/src/components/List/Music/Albums/Tracks/ListTrackRowRemoteItemUnadded.tsx`
- `apps/web/src/components/List/Music/Albums/Tracks/ListTrackGridNodeUnadded.tsx`

Do not delete `ListAlbumRowRemoteItemUnadded` or `ListAlbumGridNodeUnadded`.

In `ArtistPageList`, the tracks branch is the verified list, then the tracks mount:

```tsx
{type === 'tracks' && (
  <>
    <ListTracksRemoteItems itemsAdded={ssrItemsAdded} viewSelected="rows" />
    <ArtistPageYourAddByRssTracks channel={ssrChannel} />
  </>
)}
```

The albums branch becomes `<ArtistPageAlbumSections channel={ssrChannel} ... />` and no
longer calls `ListAlbumsRemoteItems`. `ListAlbumsRemoteItems.tsx` then has no callers.
Grep it; if it is unused, delete that file only. Leave `ListAlbumRemoteItemNodes.tsx`.

## Page wiring

- `page.tsx`: stop passing `ssrItemsUnadded`. Do not read `response.itemsUnadded`. Do not
  put album titles, the helper note, or anything Add by RSS into `generateMetadata`.
- `ArtistPageClient`: drop `ssrItemsUnadded`. `ssrHasTracks` is `ssrItemsAdded.length > 0`
  only. Pass `channel={ssrChannel}` into `ArtistPageListHeader`.
- `ArtistPageListHeader`: new required prop `channel: DTOChannel`. 

```tsx
const presence = useArtistPageAddByRssPresence(channel);
const showAlbums = ssrHasAlbums || presence.hasAlbums;
const showTracks = ssrHasTracks || presence.hasTracks;
```

Use `showAlbums` / `showTracks` where the chips are pushed. Chip labels stay
`tMedia('music.albums')` and `tMedia('music.tracks')`. Do not change boosts, about,
podroll, people, or settings.

`ArtistPageList` drops `ssrItemsUnadded` from its props. About, people, podroll, boosts,
and settings stay.

## Must stay true

- Verified albums and Not Yet Added are public directory data and may be in the server HTML.
  Your Add by RSS Albums must not be: the mount returns `null`, and the heading string is
  not in this plan's source.
- An album row is in at most one section. This plan does not merge the two arrays.
- Podroll, About, People, Boosts, and Settings are unchanged.
- No player, track-page byline, or album-page work (areas F and later).
- Do not edit `detectDuckTypedPublisherMediumId` or `docs/proposals/podcast-namespace/`.
- No `any`, no new `as`, strict equality only. Type-only imports on their own line. Named
  exports. Styles import last.

## Tests

`apps/web/e2e/artist-page-albums-and-tracks.spec.ts`. No new unit test: the change is
presentation, and the seed has no item-level reference whose title differs from the album's
tracks, so a hidden-track title cannot be asserted. Removing the unadded-track components
is the guarantee that those rows cannot render.

Follow `medium-canonical-route-redirect.spec.ts` for imports, `capturePageLoad` /
`actionAndCapture` from `./helpers/stepScreenshots`, and a 10s budget (no `setTimeout`
override). Suite title: `Artist page albums and tracks`. Test titles are full sentences.
Top-level describe only. Unauthenticated. Pass the asserted locator as `scrollToElement`.

Import from `./helpers/seedConstants` (plan 13 adds the ones that are not there yet):

- `E2E_MUSIC_CHANNEL_ID_TEXT` (`e2eMusicChnl01`)
- `E2E_MUSIC_ALBUM_ID_TEXT` (`e2eMusicAlbm01`)
- `E2E_MUSIC_ALBUM_TITLE` (`E2E Music Album`)
- `E2E_MUSIC_ALBUM_UNCLAIMED_TITLE` (`E2E Unclaimed Music Album`)
- `E2E_ARTIST_NOT_YET_ADDED_ALBUM_TITLE` (`E2E Not Yet Added Album`)
- `E2E_ARTIST_NOT_YET_ADDED_ALBUM_PODCAST_INDEX_ID` (`2147483631`)

Hardcode the unknown-album title `E2E Unknown Album` and the track titles `E2E Music Track One`
and `E2E Music Track Two`. Track One's `pub_date` is newer (`pubDateOffsetSeconds` 0 vs 60),
so it is first.

**Test 1.** When a visitor opens the seeded artist, verified albums sit above Not Yet Added,
and a Not Yet Added row opens the Podcast Index preview.

- `const response = await page.goto(\`/artist/${E2E_MUSIC_CHANNEL_ID_TEXT}\`)`.
  `expect(response?.status()).toBe(200)`. `const html = await response?.text()`. The HTML
  contains `Verified Albums` and `Not Yet Added`, and does not contain `Your Add by RSS Albums`
  or `artist-your-add-by-rss-albums`.
- `await expect(page).toHaveURL(new RegExp(\`/artist/${E2E_MUSIC_CHANNEL_ID_TEXT}$\`))`.
- Verified section: heading `Verified Albums`, link whose accessible name matches
  `E2E_MUSIC_ALBUM_TITLE`, `href` `/album/${E2E_MUSIC_ALBUM_ID_TEXT}`.
- Not Yet Added section: heading `Not Yet Added`, note test id text equal to the English
  helper sentence, link whose name matches the Not Yet Added title.
- `getByText` count 0 for the unclaimed title and `E2E Unknown Album`.
- `getByTestId('artist-your-add-by-rss-albums')` count 0, and heading
  `Your Add by RSS Albums` count 0.
- `capturePageLoad` of the Not Yet Added section.
- `actionAndCapture`: click the Not Yet Added link. Then
  `toHaveURL` ending `/podcast-index/feed/${E2E_ARTIST_NOT_YET_ADDED_ALBUM_PODCAST_INDEX_ID}`,
  and a heading with the Not Yet Added title is visible. Scroll that heading into the shot.

**Test 2.** When a visitor opens the Tracks chip, they see the verified album's tracks,
newer track first.

- `page.goto` the same artist URL. The Tracks control is a `<button>`, not `role="tab"`:
  `getByRole('button', { name: 'Tracks', exact: true })`. Click it.
- Links whose names match `E2E Music Track One` and `E2E Music Track Two` are visible, and
  Track One's link comes before Track Two's in the document
  (`page.getByRole('link', { name: /E2E Music Track/ })`, `nth(0)` then `nth(1)`).
- `getByTestId('artist-your-add-by-rss-tracks')` count 0.
- `capturePageLoad` scrolled to the Track One link.
- Do not assert a hidden item-reference title. The seeded item references use these same
  two titles.

Insert `apps/web/e2e/artist-page-albums-and-tracks.spec.ts` in
`makefiles/local/e2e-spec-order-web.txt` immediately after
`apps/web/e2e/medium-canonical-route-redirect.spec.ts`.

## Release scratchpad

```markdown
## Web artist page splits verified albums from albums not yet added

- Surfaces: web
- Change: the directory artist Albums tab shows Verified Albums, then Not Yet Added with the
  note "This artist's feed lists these albums. They move up once both feeds confirm the link."
  A Not Yet Added row opens the Podcast Index preview. The Tracks tab lists tracks on the
  verified albums, newest first, and no longer renders item references from the artist feed.
  A browser-only slot between Verified Albums and Not Yet Added stays empty until Add by RSS
  albums for that artist are wired in; it is not in the server HTML.
- Who notices: listeners on web artist pages
- Operator steps: none
```
