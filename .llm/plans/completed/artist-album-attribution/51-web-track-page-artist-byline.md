**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 51 — Directory track page artist byline

A directory track page lists each verified artist as a link under the track title. The album page
stays as it is: its subtitle is still `channel_about.author`, and this plan does not turn that
text into a link.

The track page also renders `CoreAlbumHeader`, which uses that same album subtitle. Leave it.
The new byline is only under the track title in `CoreTrackHeader`.

Add by RSS track pages are area H. This plan does not edit them, and it does not read the browser's
Add by RSS store. A directory album with no verified artist stays without a byline, including when
an Add by RSS artist on this browser lists that album. That device-only name is the player line
(area H, using plan 50's fields), not this byline.

## Rows

R8, R21, R38, R39

## Runs after

50

Plan 50 adds `artistPublishersForAlbum` and `presentArtistLine`. Plan 11's seed is what the spec
asserts: E2E Music Album is verified to E2E Music Artist (`e2eMusicChnl01`).

## Files

apps/web/src/components/Core/Artist/Album/Track/CoreTrackHeader.tsx
apps/web/src/styles/components/Common/Media/Podcast/Episode/EpisodeHeader.module.scss
apps/web/e2e/track-artist-byline.spec.ts
makefiles/local/e2e-spec-order-web.txt
release-notes/scratchpad.md

## Reuses

Plan 50's `artistPublishersForAlbum` and `presentArtistLine` in
`apps/web/src/lib/artistPublishers.ts`. The track page renders every link from that presentation.
It does not open the player chooser. One artist and several artists are the same row of links.
The separator between links is `', '`, which is what `joinVerifiedPublisherTitles` uses, so the
page reads `Ada, Bea` with each name clickable.

`buildArtistPath` is already what those links' `href` fields hold. Use `link.href`. Do not
concatenate `ROUTES.ARTIST`.

The track title link stays `` `${ROUTES.TRACK}/${item.id_text}` ``. Do not move it.

## Do not edit

- `apps/web/src/components/Core/Artist/Album/CoreAlbumHeaderSubtitle.tsx` and the album header
  views. The album page, and the album banner on the track page, keep `channel_about.author`.
- `apps/web/src/app/album/`.
- `apps/web/src/app/track/[item_id]/page.tsx`. The page already loads the item through
  `getItemForSeoPage` (`GET /item`), and `getChannelForItemPage` uses `item.channel` when the item
  response includes it. Plan 10 puts `verified_publishers` on both. Do not map those objects down
  to a type that drops the field.
- Add by RSS track headers under `apps/web/src/components/AddByRSS/`.

## `CoreTrackHeader.tsx`

The header is a client component and already imports `Link`. Import `artistPublishersForAlbum` and
`presentArtistLine` from `../../../../../lib/artistPublishers`.

```typescript
  const artistLine = presentArtistLine(artistPublishersForAlbum(channel, item));
  const artistLinks =
    artistLine.kind === 'link'
      ? [artistLine.link]
      : artistLine.kind === 'chooser'
        ? artistLine.links
        : [];

  const titleNode = (
    <>
      <Link className={styles.episodeTitleLink} href={`${ROUTES.TRACK}/${item.id_text}`}>
        <h2 className={styles.episodeTitle}>{item.title || 'Untitled'}</h2>
      </Link>
      {artistLinks.length > 0 ? (
        <p className={styles.trackArtistByline}>
          {artistLinks.map((link, index) => (
            <span key={link.idText}>
              {index > 0 ? ', ' : null}
              <Link href={link.href}>{link.title}</Link>
            </span>
          ))}
        </p>
      ) : null}
    </>
  );
```

Leave the `'Untitled'` fallback on the track title. It is existing copy in this file.

The byline is not inside the track title link. Each artist is its own link to `buildArtistPath`.
No "Artist" label, and no chooser button. Empty `artistLinks` renders no byline. Do not show
`channel_about.author` here.

`CommonItemHeader` takes `titleNode` as `React.ReactNode`. A fragment is valid. Do not add a
subtitle prop to `CommonItemHeader`. Episode headers use that component too.

## Styles

`CoreTrackHeader` already imports `EpisodeHeader.module.scss`. Add a class. Do not change
`.episodeTitle` or `.episodeTitleLink`.

```scss
.trackArtistByline {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-light);
  margin-bottom: 0;
  margin-top: var(--spacing-sm);
}
```

Leave link color to the `Link` component. No `var()` fallback.

## Must stay true

- The album page subtitle is still the author string from `CoreAlbumHeaderSubtitle`.
- A track whose album has no verified artist has no byline under the title.
- Several artists are separate links in `claim_position` order (the order
  `resolveVerifiedPublishers` already returns), not one "A, B" button.
- No new catalog keys.
- No plan or step number in a code comment.

## Tests

No new unit test. `artistPublishers.test.ts` (plan 50) holds the list rules. This plan only
renders that list.

### `apps/web/e2e/track-artist-byline.spec.ts`

Public pages. Do not log in. Suite title: `Track page artist byline`.

Use `E2E_MUSIC_TRACK_ONE_ID_TEXT` (`e2eMusicTrk001`), `E2E_MUSIC_ALBUM_ID_TEXT`
(`e2eMusicAlbm01`), and `E2E_MUSIC_CHANNEL_ID_TEXT` (`e2eMusicChnl01`) from
`apps/web/e2e/helpers/seedConstants.ts`.

Test one: "When a visitor opens a directory track whose album names a verified artist, the artist name links to the artist page."

- `page.goto('/track/e2eMusicTrk001')`.
- Expect the heading `E2E Music Track One`.
- Expect a link named `E2E Music Artist` (exact) whose `href` ends with `/artist/e2eMusicChnl01`.
- `capturePageLoad` with that link as `scrollToElement`, label
  `The track page links the verified artist under the track title.`

Test two: "When a visitor opens the album page for that track, the artist name is not a link."

- `page.goto('/album/e2eMusicAlbm01')`.
- Expect the heading `E2E Music Album`.
- Expect `getByRole('link', { name: 'E2E Music Artist', exact: true })` to have count 0.
- `capturePageLoad` with the album heading as `scrollToElement`, label
  `The album page does not link the verified artist.`

The seeded album's `channel_about` row has no author, so the album subtitle is empty. The
assertion is the missing link, not the missing text.

Insert `apps/web/e2e/track-artist-byline.spec.ts` in `makefiles/local/e2e-spec-order-web.txt`
directly after `apps/web/e2e/media-player-artist-line.spec.ts` (plan 50 adds that line).

## Release scratchpad

```markdown
## Track pages link the verified artist

- Surfaces: web
- Change: A directory track page lists each verified artist as a link under the track title.
  An album with no verified artist shows no artist link there. Album pages are unchanged.
- Who notices: anyone opening a directory track on the website
- Operator steps: none
```
