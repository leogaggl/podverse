**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 50 — Web player artist line

Directory album playback on the web player shows the verified artist. The full-size player
(`MediaPlayerInfoModal`, inside the fullscreen `MediaPlayerModal`) shows three rows: the track
title, then a smaller artist line, then the album. The player bar (desktop `MediaPlayerInfoDesktop`
and narrow `MediaPlayerInfoMobile`) keeps two rows. Its second row is `Artist · Album` when an
artist is verified, and the album title otherwise.

Add by RSS playback stays without an artist line. Area H fills that in the same fields. This plan
does not add a marquee. The set `web-player-marquee` owns scrolling text.

`add-by-rss-parity` plans 52 and 53 are mobile-only. They do not edit these web files. Leave
`resolveDefaultLinks` as it is, including the `MediumEnum.Music` album path and the empty link for
every other medium (`MusicL` included).

## Rows

R6, R8, R21, R27, R28, R30, R31, R32

## Runs after

11, 12

Plan 10 defines `verified_publishers`, `resolveVerifiedPublishers`, and `joinVerifiedPublisherTitles`.
Plan 11's seed verifies E2E Music Album to E2E Music Artist. Plan 12 attaches the same field on the
item lists, queue resources, and playlist resources the player loads. This plan reads the field. It
does not fetch it.

## Files

apps/web/src/lib/artistPublishers.ts
apps/web/src/lib/artistPublishers.test.ts
apps/web/src/utils/mediaPlayer/mediaPlayerInfoResolution.ts
apps/web/src/utils/mediaPlayer/mediaPlayerInfoResolution.test.ts
apps/web/src/components/MediaPlayer/Modal/MediaPlayerInfoModal.tsx
apps/web/src/components/MediaPlayer/Modal/MediaPlayerArtistChooser.tsx
apps/web/src/styles/components/MediaPlayer/Modal/MediaPlayerInfoModal.module.scss
apps/web/src/styles/components/MediaPlayer/Modal/MediaPlayerArtistChooser.module.scss
apps/web/src/components/MediaPlayer/Desktop/MediaPlayerInfoDesktop.tsx
apps/web/src/components/MediaPlayer/Mobile/MediaPlayerInfoMobile.tsx
apps/web/e2e/media-player-artist-line.spec.ts
makefiles/local/e2e-spec-order-web.txt
release-notes/scratchpad.md

## Reuses

- `resolveVerifiedPublishers` and `joinVerifiedPublisherTitles` from `@podverse/helpers` (plan 10).
  Do not join names again by hand.
- `isAlbumMediumId` and `isArtistMediumId` from `@podverse/helpers` (`packages/helpers/src/lib/medium.ts`).
  A publisher is shown as an artist only when `isArtistMediumId` is true. Do not filter by any
  other medium list.
- `buildArtistPath` from `@podverse/helpers`. Do not build `` `/artist/${id}` ``.
- `ClickableTitle` in `MediaPlayerInfoModal.tsx` for the one-artist line. Pass `title`. Do not pass
  `children`. The marquee set wraps that `title` prop.
- `Modal` from `@podverse/ui` for the chooser. `PlaybackErrorModal.tsx` is the in-app example of
  `Modal` plus `Modal.Body`.
- `ReactDOM.createPortal` the way `MediaPlayerVideoPortalFloating.tsx` imports it.

## Decisions this plan fixes

- **One artist is a link. Several open a chooser.** `presentArtistLine` returns `link` for one
  publisher and `chooser` for more than one. The chooser is the shared `Modal`, portaled to
  `document.body`. The player modal sets `contentOverflowHidden` and `overflow: hidden`, so a
  dialog rendered inside it is clipped. An inline list under the title was the other option.
- **A missing album title does not become "Untitled" beside an artist.** The bar's second line is
  the artist label alone when the album title is null or empty. When there is no artist, the
  existing `tMisc('untitled')` fallback in the bar components stays.

## What the player shows

| Playing | Full-size player | Player bar second line |
| --- | --- | --- |
| Album, one verified artist | Track title, artist name (link), album title | `Artist · Album` |
| Album, several verified artists | Track title, `A, B` (button), album title. The button opens the chooser | `A, B · Album` |
| Album, no verified artist, or `verified_publishers` absent | Track title, album title. No artist row | Album title, as today |
| Not an album (podcast, video, artist feed) | No artist row | Channel title, as today |
| Add by RSS (`mpAddByRSS` set) | No artist row | Channel title from the resource, as today |

The full-size item row stays `itemTitle` (the track), not `displayItemTitle`. A chapter, clip, or
soundbite stays in the subtitle section. On the bar, the first line stays `displayItemTitle`. The
artist never replaces that first line.

The artist row is hidden when the list is empty. Do not fall back to `channel_about.author`.

## `apps/web/src/lib/artistPublishers.ts` (new)

Named exports only. No `as`. Import type and value on separate lines.

```typescript
import type { DTOChannel, DTOItem, DTOVerifiedPublisher } from '@podverse/helpers';
import {
  buildArtistPath,
  isAlbumMediumId,
  isArtistMediumId,
  joinVerifiedPublisherTitles,
  resolveVerifiedPublishers,
} from '@podverse/helpers';

/**
 * Verified artists for an album channel: channel-wide credits first, then item credits,
 * each publisher once. Empty when the channel is not an album or no artist has a title.
 */
export const artistPublishersForAlbum = (
  channel: DTOChannel | null | undefined,
  item: DTOItem | null | undefined
): DTOVerifiedPublisher[] => {
  if (!isAlbumMediumId(channel?.medium_id)) {
    return [];
  }
  return resolveVerifiedPublishers({ channel, item }).filter((publisher) =>
    isArtistMediumId(publisher.medium_id)
  );
};

export type ArtistLineLink = {
  idText: string;
  title: string;
  href: string;
};

export type ArtistLinePresentation =
  | { kind: 'hidden' }
  | { kind: 'link'; link: ArtistLineLink }
  | { kind: 'chooser'; label: string; links: ArtistLineLink[] };

export const presentArtistLine = (
  publishers: readonly DTOVerifiedPublisher[]
): ArtistLinePresentation => { /* see below */ };

/**
 * Second line of the player bar. The middle dot is the separator between the artist label
 * and the album title. An empty artist label leaves the album title unchanged.
 */
export const compactArtistAlbumLine = (
  artistLabel: string,
  albumTitle: string | null
): string | null => { /* see below */ };
```

`presentArtistLine`:

- Walk `publishers` in order. Skip a publisher whose `title` is null or empty after trim.
  `href` is `buildArtistPath(publisher.id_text)`. `title` on the link is the trimmed title.
- Zero links: `{ kind: 'hidden' }`.
- One link: `{ kind: 'link', link }`. Read `links[0]` into a const and return `hidden` when it is
  `undefined`, so the index access needs no assertion.
- More than one: `{ kind: 'chooser', label: joinVerifiedPublisherTitles(publishers), links }`.
  The helper already joins with `', '` and skips empty titles, so the label matches the links.

`compactArtistAlbumLine`:

- `artistLabel` length 0: return `albumTitle` (including null).
- `albumTitle` null or length 0: return `artistLabel`.
- Otherwise return `` `${artistLabel} · ${albumTitle}` ``. The dot is U+00B7, with a space on
  each side. Do not put the separator in the catalog.

## `getMediaPlayerInfoResolution`

In `mediaPlayerInfoResolution.ts`, add to `MediaPlayerInfoResolution`:

```typescript
  /** How the full-size player shows verified artists. `hidden` renders no row. */
  artistLine: ArtistLinePresentation;
  /**
   * Player-bar second line. The album title when there is no artist. `Artist · Album` when
   * there is one. Null when the album title is missing and there is no artist.
   */
  compactChannelLine: string | null;
```

Import the types with `import type` and the functions as values from `../../lib/artistPublishers`.

After `channelTitle` is computed:

```typescript
  // Directory albums only. Add by RSS playback does not carry verified publishers.
  const artistPublishers = mpAddByRSS ? [] : artistPublishersForAlbum(mpChannel, mpItem);
  const artistLine = presentArtistLine(artistPublishers);
  const artistLabel =
    artistLine.kind === 'link'
      ? artistLine.link.title
      : artistLine.kind === 'chooser'
        ? artistLine.label
        : '';
  const compactChannelLine = compactArtistAlbumLine(artistLabel, channelTitle);
```

Add both fields to the returned object. Do not change `itemTitle`, `displayItemTitle`,
`channelTitle`, `channelLinkUrl`, or `resolveDefaultLinks`.

The player copies `mpItem` and `mpChannel` from the track page (`GET /item`, plan 10) and from
queue, playlist, and list loads (plan 12). Do not add a request from the player to fill
`verified_publishers`. Absent and `[]` both produce `hidden`.

## Full-size player (`MediaPlayerInfoModal.tsx`)

Inside `titleSection`, between the item `ClickableTitle` and the channel block, render one of
three branches. Use a `switch` on `infoResolution.artistLine.kind` with `hidden`, `link`, and
`chooser`, and no default, so a new kind fails typecheck.

Assign `const artistLine = infoResolution.artistLine` before the switch so the `link` and
`chooser` arms keep their narrowing inside callbacks.

- `hidden`: render nothing.
- `link`: `ClickableTitle` with `title={artistLine.link.title}`, `className={styles.artistTitle}`,
  `onClick={() => router.push(artistLine.link.href)}`, and the same `setPlayerModalIsOpen` the
  album line uses. That helper closes the player, then navigates.
- `chooser`: a `div.artistTitle` whose button shows `artistLine.label`. The button is
  `type="button"`, `aria-haspopup="dialog"`, `aria-expanded={chooserOpen}`. Hold it in a ref.
  Clicking sets `chooserOpen` to true. When open, render `MediaPlayerArtistChooser` with
  `links={artistLine.links}`.

`chooserOpen` is `useState(false)`. Reset it to false when `artistLine.kind` is not `chooser`
(a track change), in an effect, so the dialog does not stay open for the next item.

Do not give the one-artist line a different accessible name than its visible title. The album
line works the same way. The several-artist button's accessible name is the visible `A, B`.

## Chooser (`MediaPlayerArtistChooser.tsx`, new)

Props:

```typescript
type MediaPlayerArtistChooserProps = {
  links: readonly ArtistLineLink[];
  onClose: () => void;
  onOpenArtist: (href: string) => void;
};
```

`onOpenArtist` (owned by the modal) closes the chooser, calls `setPlayerModalIsOpen(false)`, then
`router.push(href)`. Same order as `ClickableTitle`.

Render, only when `typeof document !== 'undefined'`:

```tsx
ReactDOM.createPortal(
  <Modal
    ariaLabel={tMedia('music.artists')}
    closeButtonAriaLabel={tMisc('close_modal')}
    header={tMedia('music.artists')}
    isOpen
    onClose={onClose}
  >
    <Modal.Body>
      <ul className={styles.list}>
        {links.map((link, index) => (
          <li key={link.idText}>
            <button
              ref={index === 0 ? firstButtonRef : undefined}
              className={styles.artistButton}
              type="button"
              onClick={() => onOpenArtist(link.href)}
            >
              {link.title}
            </button>
          </li>
        ))}
      </ul>
    </Modal.Body>
  </Modal>,
  document.body
)
```

`tMedia` is `useTranslations('media')`. `tMisc` is `useTranslations('misc')`. Both keys already
exist (`media.music.artists` is "Artists", `misc.close_modal` is "Close Modal"). Do not add
catalog keys.

On mount, focus `firstButtonRef`. `onClose` (the modal's close, backdrop, and Escape) is the
parent's callback, which sets `chooserOpen` false and focuses the trigger button.

While mounted, a `window` `keydown` listener calls `onClose` when `event.key === 'Escape'`.
The shared `Modal` does not listen for Escape and does not trap focus. Do not add a focus trap.

No `Modal.Actions`. The header close button is the dismiss control.

## Styles

`MediaPlayerInfoModal.module.scss` already imports the line-clamp mixin. Add:

```scss
.artistTitle {
  display: flex;
  justify-content: center;
}

.artistTitle > button {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-light);
  color: var(--text-color-accent) !important;
  @include line-clamp(1);
  margin-top: var(--spacing-sm);
}
```

The `!important` color matches `.channelTitle > button`, which needs it against the global button
color. `--font-size-sm` is smaller than the album line, which inherits the body size. Do not
change `--media-modal-title-reserve`. The artist row sits inside `.titleSection` (`titleRef`);
`useModalArtworkSquareSize` already measures that band. Do not edit that hook.

`MediaPlayerArtistChooser.module.scss` (new). Import the focus mixin the way the modal file
imports line-clamp (`@use '../../../mixins/focus' as focus`):

```scss
.list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  list-style: none;
  margin: 0;
  min-width: 0;
  padding: 0;
}

.artistButton {
  background: none;
  border: none;
  color: var(--text-color-accent);
  cursor: pointer;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-light);
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  padding: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.artistButton:focus-visible {
  @include focus.focus-ring;
}
```

No `var()` fallbacks. No marquee, and no change to `.title` / `.subtitle` line-clamp in the bar
styles. The marquee set deletes those clamps.

## Player bar

In both `MediaPlayerInfoDesktop.tsx` and `MediaPlayerInfoMobile.tsx`, change only the subtitle
expression:

```typescript
  const subtitle = hasContent
    ? (infoResolution.compactChannelLine ?? tMisc('untitled'))
    : '';
```

Leave the `<div className={styles.title}>` and `<div className={styles.subtitle}>` elements, their
classes, and both SCSS modules. Do not extract a shared bar component. The two files already
duplicate this block, and the marquee set edits each file in place.

Do not set `aria-label` on the bar button. Its accessible name stays the visible title plus the
second line. Existing specs match the track title as a substring of that name.

## Must stay true

- Podcast and video playback render the same two lines they render today.
- `resolveDefaultLinks` is unchanged. A `MusicL` album still has an empty `channelLinkUrl`.
- The artist line does not show for `mpAddByRSS`.
- No new i18n keys. No edits under `packages/i18n-catalog/`.
- No second network read for publishers.
- Code comments do not name a plan, a step, or a file under `.llm/plans/`.

## Tests

### `apps/web/src/lib/artistPublishers.test.ts`

Build channels with `as DTOChannel` the way `mediaPlayerInfoResolution.test.ts` does. Only the
fields this module reads need to be real: `medium_id` and `verified_publishers`.

- Music channel, one `PublisherMusic` publisher "Ada" with `id_text` `artistAda`: `presentArtistLine`
  is `link`, title `Ada`, href `buildArtistPath('artistAda')`.
- Same channel plus a second publisher "Bea": kind `chooser`, label `Ada, Bea`, two links in that
  order.
- A publisher with `medium_id` `MediumEnum.Music` on that album is left out.
- A publisher with title `'  '` is left out. If it was the only one, the line is `hidden`.
- `MediumEnum.Podcast` channel with a `PublisherMusic` publisher: `artistPublishersForAlbum` is
  `[]`.
- `MediumEnum.MusicL` channel with a `PublisherMusic` publisher: one link.
- Channel with no `verified_publishers` property: `[]`.
- `compactArtistAlbumLine('Ada', 'Album')` is `Ada · Album`. `compactArtistAlbumLine('', 'Album')`
  is `Album`. `compactArtistAlbumLine('Ada', null)` is `Ada`. `compactArtistAlbumLine('', null)`
  is null.

### `mediaPlayerInfoResolution.test.ts`

Add cases. Reuse the file's channel and item fixtures.

- Music channel, `verified_publishers: [{ id_text: 'e2eMusicChnl01', title: 'E2E Music Artist', medium_id: MediumEnum.PublisherMusic }]`,
  item title and channel title set, `mpAddByRSS: null`: `artistLine.kind` is `link`,
  `compactChannelLine` is `E2E Music Artist · E2E Music Album` when `channelTitle` is that album
  title. `channelTitle` and `channelLinkUrl` stay the album values (`buildAlbumPath`).
- The same channel with `mpAddByRSS: { idText: 'feed-1', resourceData: { title: 'Local track', channel_title: 'Local album' } }`:
  `artistLine.kind` is `hidden`, and `compactChannelLine` is `Local album` (the resource title
  wins over the channel, which is existing behavior).
- The file's podcast fixture: `artistLine.kind` is `hidden`, `compactChannelLine` equals
  `channelTitle`.

### `apps/web/e2e/media-player-artist-line.spec.ts`

The seed has one verified artist, so this spec covers the link, not the chooser. Do not add a
second artist to `tools/web/seed-e2e.mjs`. Plan 11's artist page and the mobile artist flow depend
on that pair.

Follow `media-player-music-playback.spec.ts` for login (`e2e-user@example.com` / `Test!1Aa`,
`http://localhost:4030/api/v2/auth/login`) and `clearSeededPodcastQueueResources`. Follow
`media-player-modal-video.spec.ts` for opening the player: click `#media-player`'s first button,
then `getByRole('dialog', { name: 'Fullscreen Media Player' })`.

Suite title: `Player artist line`.

One test: "When a directory album track is playing, the player bar shows the artist and the album, and the full-size player opens the artist page."

- `page.goto('/track/e2eMusicTrk001')` and expect the heading `E2E Music Track One`.
- Click `main`'s Play button (the music spec clicks the first Play; prefer `main` so the player
  bar's own button is not the click).
- Expect `#media-player` to show the text `E2E Music Artist · E2E Music Album` (exact), first
  match. Desktop and the narrow bar are both in the DOM.
- Open the fullscreen dialog. Expect a button named `E2E Music Artist` (exact) and a button named
  `E2E Music Album`.
- `captureVerifiedElement` on the artist button, label
  `The full-size player shows the verified artist between the track and the album.`
- Click the artist button. Expect the URL to end with `/artist/e2eMusicChnl01`, the heading
  `E2E Music Artist` to be visible, and the fullscreen dialog to have count 0.
- `capturePageLoad` with that heading as `scrollToElement`.

Constants: `E2E_MUSIC_TRACK_ONE_ID_TEXT` and `E2E_MUSIC_CHANNEL_ID_TEXT` from
`apps/web/e2e/helpers/seedConstants.ts`. The visible titles are `E2E Music Track One`,
`E2E Music Artist`, and `E2E Music Album`.

Insert `apps/web/e2e/media-player-artist-line.spec.ts` in
`makefiles/local/e2e-spec-order-web.txt` directly after
`apps/web/e2e/media-player-alt-enclosure-load.spec.ts`.

No component test of the modal. The chooser branch is `presentArtistLine`'s `chooser` kind plus
the switch above. Mounting `MediaPlayerInfoModal` needs the player providers.

## Release scratchpad

```markdown
## Web player shows the artist above the album

- Surfaces: web
- Change: While a directory album track is playing, the full-size player shows the verified
  artist in smaller text between the track title and the album title. One artist links to that
  artist's page. Several artists show as "A, B" and open a list of those artists. The player
  bar's second line reads "Artist · Album" when an artist is verified, and stays the album title
  otherwise. Playback with no verified artist, and Add by RSS playback, keep the two lines they
  have today.
- Who notices: anyone playing a directory album track on the website
- Operator steps: none
```
