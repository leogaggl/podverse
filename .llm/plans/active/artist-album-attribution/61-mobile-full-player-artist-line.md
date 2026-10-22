**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 61 — Mobile full player artist line

The full player's title block becomes: track title, then a smaller artist line, then the album
line. The artist line links to the artist page: Home when that artist is followed, Browse
otherwise, the same rule the album line uses. With several artists it reads "A, B", and a tap opens
the artist chooser from plan 60. With no verified artist the line is not rendered.

The title block keeps a fixed height per item (**mobile-player-fixed-region**): an item with
artists reserves one extra line inside the block, decided when the item starts, so nothing moves
while it plays.

## Rows

R6, R8, R21, R27, R28, R29, R30, R31

## Runs after

60

## Files

apps/mobile/src/screens/player/fullPlayerLayout.ts
apps/mobile/src/screens/player/fullPlayerLayout.test.ts
apps/mobile/src/screens/player/fullPlayerContentLink.ts
apps/mobile/src/screens/player/fullPlayerContentLink.test.ts
apps/mobile/src/screens/player/FullPlayerScreen.tsx
release-notes/scratchpad.md

## Reuse

- `playbackTargetArtists`, `ArtistChooserSheet` (plan 60).
- `joinVerifiedPublisherTitles` (plan 10, `@podverse/helpers`).
- `playerContentStack`, `onOpenContent`, and the navigation `case 'artist'` branches that already
  route `FullPlayerOpenRequest` with `kind: 'artist'` to `ArtistDetail` on Home or Browse
  (`navigation/index.tsx`, `playerChannelRoute` and the tab-stack switch). No navigation edit.
- `getChannelActionChrome(idText)?.isSubscribed` for "followed", as `openLinkedContent` does.
- Catalog keys `media_player.open_named_screen`, `media.music.artist`, `media.music.artists`. No
  catalog edit.

Pending plans 52 and 53 in `add-by-rss-parity` also edit `fullPlayerContentLink.ts` and
`FullPlayerScreen.tsx` (Add by RSS livestream kinds, the album livestream channel link). The edits
below touch different symbols. Apply them on top of whatever is in the file; do not revert those
edits.

## `fullPlayerLayout.ts`

Anchor: `FULL_PLAYER_TITLE_BLOCK_HEIGHT`.

- Change that constant's doc comment to: `/** Item title + channel title share one band with a
  tight internal gap. */` (keep the value 56).
- Below it add:

```typescript
/** Artist line box inside the title block, between the item title and the album. */
export const FULL_PLAYER_ARTIST_LINE_HEIGHT = 18;
/**
 * Extra title-block height for an item with an artist line: the line plus the block's internal
 * gap. Reserved for the whole item, so a line never appears or disappears mid-play.
 */
export const FULL_PLAYER_ARTIST_LINE_RESERVE = FULL_PLAYER_ARTIST_LINE_HEIGHT + spacing.xs;

export const resolveFullPlayerTitleBlockHeight = (hasArtistLine: boolean): number =>
  hasArtistLine
    ? FULL_PLAYER_TITLE_BLOCK_HEIGHT + FULL_PLAYER_ARTIST_LINE_RESERVE
    : FULL_PLAYER_TITLE_BLOCK_HEIGHT;
```

  with `import { spacing } from '../../theme/spacing';` at the top. The title block's style uses
  `tokens.spacing.xs` for its gap; `spacing.xs` is the same theme-independent value.
- `FullPlayerLayoutInput`: add a required field after `chipStripHeight`:

```typescript
  /**
   * The item has a verified artist. Adds `FULL_PLAYER_ARTIST_LINE_RESERVE` to the title block for
   * the whole item; the artwork gives up that height.
   */
  hasArtistLine: boolean;
```

- `resolveFixedChromeHeight` becomes `(hasSegmentBand: boolean, hasArtistLine: boolean)` and adds
  `FULL_PLAYER_ARTIST_LINE_RESERVE` when `hasArtistLine`. Update its one call inside
  `resolveFullPlayerLayout` to pass `input.hasArtistLine`.

## `fullPlayerContentLink.ts`

Add after `resolveFullPlayerChannelLink`:

```typescript
/** Artist page for one artist on the player's artist line. */
export const fullPlayerArtistLink = (artist: DTOVerifiedPublisher): FullPlayerContentTarget => ({
  idText: artist.id_text,
  imageUrl: null,
  kind: 'artist',
  name: artist.title?.trim() ?? '',
});
```

Add `DTOVerifiedPublisher` to the existing `import type { AddByRSSResourceData, DTOChannel,
DTOItem } from '@podverse/helpers';` line, keeping names sorted. The publisher summary has no
artwork; the artist page paints its own.

## `FullPlayerScreen.tsx` (large: grep each anchor and read that window)

1. **Imports.** Add `joinVerifiedPublisherTitles` to the multi-line value import that ends
   `} from '@podverse/helpers';` (around line 25), and `DTOVerifiedPublisher` to the file's
   `import type … from '@podverse/helpers'` line (the root barrel re-exports the dtos). Add
   `playbackTargetArtists` from `'../../lib/playback/verifiedArtists'`,
   `playbackTargetRowMediaId` from `'../../lib/playback/buildPlaybackTarget'` (a function export
   there), `ArtistChooserSheet` to the `} from '../../components/content';` import,
   `fullPlayerArtistLink` to the `./fullPlayerContentLink` import, and
   `FULL_PLAYER_ARTIST_LINE_HEIGHT` and `resolveFullPlayerTitleBlockHeight` to the
   `} from './fullPlayerLayout';` import. Remove `FULL_PLAYER_TITLE_BLOCK_HEIGHT` from that import
   once step 6 leaves it unused.

2. **Artists and the per-item band.** Anchor: `const channelLink = useMemo(`. After that memo add:

```typescript
  const playerArtists = useMemo(() => playbackTargetArtists(activeTarget), [activeTarget]);
  const artistLineText = joinVerifiedPublisherTitles(playerArtists);
  const artistBandMediaId = activeTarget === null ? null : playbackTargetRowMediaId(activeTarget);
  const [artistBand, setArtistBand] = useState<{ mediaId: string | null; reserved: boolean }>(
    () => ({ mediaId: artistBandMediaId, reserved: playerArtists.length > 0 })
  );
  if (artistBand.mediaId !== artistBandMediaId) {
    setArtistBand({ mediaId: artistBandMediaId, reserved: playerArtists.length > 0 });
  }
  // The band is decided when an item starts. A later refresh of the same item that adds or drops
  // artists does not resize the block.
  const hasArtistLine =
    artistBand.mediaId === artistBandMediaId ? artistBand.reserved : playerArtists.length > 0;
  const [isArtistChooserOpen, setIsArtistChooserOpen] = useState(false);
```

   This is React's "adjust state while rendering when an input changes" pattern; it settles in the
   same commit, so the first paint of a new item already has the right height. `useState` is
   already imported from `react`.

3. **Open an artist.** Anchor: `const openTitleContent = useCallback(`. Before it add:

```typescript
  const openArtist = useCallback(
    (artist: DTOVerifiedPublisher) => {
      const isSubscribed = getChannelActionChrome(artist.id_text)?.isSubscribed === true;
      onOpenContent({
        ...fullPlayerArtistLink(artist),
        stack: playerContentStack({ isSubscribed, kind: 'artist' }),
      });
    },
    [onOpenContent]
  );
  const onArtistLinePress = useCallback(() => {
    const [only] = playerArtists;
    if (playerArtists.length === 1 && only !== undefined) {
      openArtist(only);
      return;
    }
    if (playerArtists.length > 1) {
      setIsArtistChooserOpen(true);
    }
  }, [openArtist, playerArtists]);
```

   "Followed" is the artist's own follow state, not the album's: `openLinkedContent` checks the
   current channel, which is the album, so it is not reused here.

4. **Close the chooser when the item changes.** Inside the `if (artistBand.mediaId !== …)` block
   from step 2, also call `setIsArtistChooserOpen(false)`.

5. **Layout input.** Anchor: `resolveFullPlayerLayout({`. Add `hasArtistLine,` after
   `chipStripHeight,` in the input object, and `hasArtistLine` to that `useMemo` dependency array in
   sorted position.

6. **Title block height.** Anchor: the `titleBlock:` entry in the screen's `StyleSheet.create`
   (`height: FULL_PLAYER_TITLE_BLOCK_HEIGHT`). Remove the `height` line from the static style. On
   the element `<View pointerEvents="box-none" style={styles.titleBlock}>` use
   `style={[styles.titleBlock, { height: resolveFullPlayerTitleBlockHeight(hasArtistLine) }]}`.
   Reserved and rendered height then come from the same function the layout math uses.

7. **Artist line style.** In the same `StyleSheet.create`, next to `subtitle`, add:

```typescript
        artistLine: {
          color: tokens.text.link,
          fontSize: 15,
          fontWeight: '600',
          lineHeight: FULL_PLAYER_ARTIST_LINE_HEIGHT,
          textAlign: 'center',
        },
```

   Same link color as the album line (`subtitleLink`).

8. **Render.** Anchor: the title `Pressable`/`MarqueeText` pair with `testID="full-player-title"`,
   followed by `{visibleChannelTitle !== null && visibleChannelTitle.length > 0 ? (`. Insert
   between them:

```tsx
            {hasArtistLine && artistLineText.length > 0 ? (
              <Pressable
                accessibilityLabel={t('media_player.open_named_screen', {
                  name: artistLineText,
                  screen: t(
                    playerArtists.length > 1 ? 'media.music.artists' : 'media.music.artist'
                  ),
                })}
                accessibilityRole="link"
                onPress={onArtistLinePress}
                style={({ pressed }) => [pressed ? { opacity: 0.6 } : null]}
                testID="full-player-artist-link"
              >
                <Text numberOfLines={1} style={styles.artistLine}>
                  {artistLineText}
                </Text>
              </Pressable>
            ) : null}
```

   When `hasArtistLine` is true but the text is empty (a refresh dropped the artist), the reserved
   height stays and the block's `justifyContent: 'center'` keeps title and album centered in it.

9. **Chooser.** Anchor: the sheets rendered at the end of the screen (`<FullPlayerSleepTimer`,
   `<FullPlayerSpeedControl`, `<FullPlayerMoreSheet`). Add beside them:

```tsx
      <ArtistChooserSheet
        artists={playerArtists}
        onCancel={() => {
          setIsArtistChooserOpen(false);
        }}
        onSelect={(artist) => {
          setIsArtistChooserOpen(false);
          openArtist(artist);
        }}
        testID="full-player-artist-chooser"
        visible={isArtistChooserOpen}
      />
```

## Must stay true

- Album line, title link, and their testIDs (`full-player-title-link`, `full-player-channel-link`)
  are unchanged.
- No band appears for podcasts, videos, or music without a verified artist: `hasArtistLine` is
  false and the block is 56 tall as today.
- No `Modal`; the chooser is `MoreMenu` in `AppOverlay`.
- No `as`, no `any`, strict equality only.

## Tests

- `fullPlayerLayout.test.ts`:
  - Add `hasArtistLine: false` to `phoneInput` (and any other input literal the file builds) so
    existing cases keep their numbers.
  - In `describe('full player band constants')`, expect `FULL_PLAYER_ARTIST_LINE_HEIGHT` to be 18
    and `resolveFullPlayerTitleBlockHeight(true) - resolveFullPlayerTitleBlockHeight(false)` to
    equal `FULL_PLAYER_ARTIST_LINE_RESERVE`.
  - In `describe('resolveFullPlayerLayout')`, add one case beside the segment-band case: with
    `hasArtistLine: true` the artwork is smaller than without, by at most
    `FULL_PLAYER_ARTIST_LINE_RESERVE`, and `playerRegionHeight` is unchanged.
- `fullPlayerContentLink.test.ts`: add `describe('fullPlayerArtistLink')` with one case: a
  publisher becomes `{ idText, imageUrl: null, kind: 'artist', name }` with the title trimmed.
- Maestro: plan 66 asserts `full-player-artist-link` in `track.yaml`.

## Release scratchpad

```markdown
## Mobile full player shows the album's artist

- Surfaces: mobile
- Change: the full player shows the verified artist under the track title, above the album. It
  links to the artist page, on Home when the artist is followed and on Browse otherwise. Several
  artists read "A, B", and a tap opens a list of each artist. Music without a verified artist,
  podcasts, and videos look as before. The title block grows by one line only for items with an
  artist, decided when the item starts.
- Who notices: mobile listeners playing music from albums whose artist feed lists them
- Operator steps: none (needs the API from plans 10 and 12)
```
