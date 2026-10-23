**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 63 — Mobile track screen artist byline

The directory track screen's album header has a byline under the album name (today the feed's own
`channel_about.author` text). When the track has a verified artist, the byline shows the artist
names as a link to the artist page, on the current stack, the way the album name already opens the
album. Several artists read "A, B", and a tap opens the artist chooser from plan 60. Without a
verified artist the byline stays the feed's author text, not linked.

The album screen (`AlbumDetailScreen`) is not changed; it keeps its author byline.

## Rows

R8, R21, R38, R39

## Runs after

60

## Files

apps/mobile/src/components/channel/ChannelHeader.tsx
apps/mobile/src/components/channel/index.ts
apps/mobile/src/screens/track/TrackDetailScreen.tsx
release-notes/scratchpad.md

## Reuse

- `ChannelHeader` (shared by podcast, album, artist, and track screens). It gains an optional
  subtitle link shaped like its existing `settings` prop; every current caller omits it and
  renders as today.
- `resolveVerifiedArtists`, `ArtistChooserSheet` (plan 60); `joinVerifiedPublisherTitles`
  (plan 10).
- `buildArtistDetailParams` and `CHANNEL_BROWSE_STACK_ROUTES.ArtistDetail` (exported from
  `navigation/index.tsx`), the same way `openAlbum` uses `buildAlbumDetailParams` and
  `CHANNEL_BROWSE_STACK_ROUTES.AlbumDetail`.
- Catalog keys `media_player.open_named_screen`, `media.music.artist`, `media.music.artists`. No
  catalog edit.

The track screen already loads the channel from `GET /item` (embedded channel) or `GET /channel`;
plan 10 puts `verified_publishers` on both. A stored channel from a download row has none, so a
downloaded track shows the author byline until the network load replaces the channel (that
replacement already happens in `loadTrack`).

## `apps/mobile/src/components/channel/ChannelHeader.tsx`

1. Add an exported type above `ChannelHeaderProps`:

```typescript
/** Turns the subtitle into a link, e.g. a track's verified artists. */
export type ChannelHeaderSubtitleLink = {
  accessibilityLabel: string;
  onPress: () => void;
  testID: string;
};
```

   Add `ChannelHeaderSubtitleLink` to `export type { ChannelHeaderProps } from './ChannelHeader';`
   in `components/channel/index.ts`. The screen passes an object literal, so it does not import
   the type.

2. `ChannelHeaderProps`: after `subtitle`, add
   `/** Makes the subtitle a link. Omit for plain text. */ subtitleLink?: ChannelHeaderSubtitleLink;`.

3. `ChannelHeaderTitleRowProps`: add `subtitleLink?: ChannelHeaderSubtitleLink;`. Destructure it
   in `ChannelHeaderTitleRow`.

4. In `ChannelHeaderTitleRow`'s `StyleSheet.create`, add beside `subtitle`:

```typescript
        subtitleLink: {
          ...typography.label,
          color: tokens.text.accent,
        },
```

   (the color `TrackDetailHeader` uses for its album link).

5. Anchor: `{hasSubtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}`. Replace with:

```tsx
      {hasSubtitle ? (
        subtitleLink !== undefined ? (
          <Pressable
            accessibilityLabel={subtitleLink.accessibilityLabel}
            accessibilityRole="link"
            onPress={subtitleLink.onPress}
            style={({ pressed }) => [styles.titlePress, pressed ? { opacity: 0.6 } : null]}
            testID={subtitleLink.testID}
          >
            <Text numberOfLines={1} style={styles.subtitleLink}>
              {subtitle}
            </Text>
          </Pressable>
        ) : (
          <Text style={styles.subtitle}>{subtitle}</Text>
        )
      ) : null}
```

6. `ChannelHeader`: destructure `subtitleLink` and pass
   `subtitleLink={hasSubtitle ? subtitleLink : undefined}` to `<ChannelHeaderTitleRow`.

## `apps/mobile/src/screens/track/TrackDetailScreen.tsx`

1. Imports: add `DTOVerifiedPublisher` to `import type { DTOChannel, DTOItem } from
   '@podverse/helpers';`, `joinVerifiedPublisherTitles` to `import { primaryChannelListArtworkUrl }
   from '@podverse/helpers';`, `ArtistChooserSheet` to the `} from '../../components/content';`
   import, `resolveVerifiedArtists` from `'../../lib/playback/verifiedArtists'`, and
   `buildArtistDetailParams` to `import { buildAlbumDetailParams, CHANNEL_BROWSE_STACK_ROUTES }
   from '../../navigation';`.

2. Anchor: `const openAlbum = useCallback(`. After that callback add:

```typescript
  const trackArtists = useMemo(
    () => resolveVerifiedArtists({ channel, item: track }),
    [channel, track]
  );
  const artistByline = joinVerifiedPublisherTitles(trackArtists);
  const [isArtistChooserOpen, setIsArtistChooserOpen] = useState(false);

  const openArtist = useCallback(
    (artist: DTOVerifiedPublisher) => {
      navigation.navigate(
        CHANNEL_BROWSE_STACK_ROUTES.ArtistDetail,
        buildArtistDetailParams({ artistId: artist.id_text, previewTitle: artist.title })
      );
    },
    [navigation]
  );

  const onArtistBylinePress = useCallback(() => {
    const [only] = trackArtists;
    if (trackArtists.length === 1 && only !== undefined) {
      openArtist(only);
      return;
    }
    if (trackArtists.length > 1) {
      setIsArtistChooserOpen(true);
    }
  }, [openArtist, trackArtists]);
```

3. Anchor: `<ChannelHeader` inside `const listHeader = useMemo(`. Change its props to:

```tsx
            subtitle={
              artistByline.length > 0 ? artistByline : (channel?.channel_about?.author ?? null)
            }
            subtitleLink={
              artistByline.length > 0
                ? {
                    accessibilityLabel: t('media_player.open_named_screen', {
                      name: artistByline,
                      screen: t(
                        trackArtists.length > 1 ? 'media.music.artists' : 'media.music.artist'
                      ),
                    }),
                    onPress: onArtistBylinePress,
                    testID: 'track-detail-artist-link',
                  }
                : undefined
            }
```

   keeping `artworkUri`, `onTitlePress`, `testID`, and `title` as they are. Add `artistByline`,
   `onArtistBylinePress`, and `trackArtists` to the `listHeader` dependency array in sorted
   position.

4. Anchor: `{addToPlaylistSheet}` at the end of the screen's returned `View`. After it add:

```tsx
      <ArtistChooserSheet
        artists={trackArtists}
        onCancel={() => {
          setIsArtistChooserOpen(false);
        }}
        onSelect={(artist) => {
          setIsArtistChooserOpen(false);
          openArtist(artist);
        }}
        testID="track-detail-artist-chooser"
        visible={isArtistChooserOpen}
      />
```

## Must stay true

- `track-detail-album-header`, the album title link, and `TrackDetailHeader` are unchanged.
- Podcast, album, and artist screens render the same: they pass no `subtitleLink`.
- No `as`, no `any`, strict equality only.

## Tests

No unit test (component wiring; the artist list comes from plan 60's tested helper). Maestro: plan
66 asserts `track-detail-artist-link` in `track.yaml`.

## Release scratchpad

```markdown
## Mobile track pages link the artist

- Surfaces: mobile
- Change: on a directory track page, the byline under the album name shows the verified artist
  and opens the artist page. Several artists read "A, B" and open a list of each artist. Tracks
  without a verified artist keep the feed's author text. Album pages are unchanged.
- Who notices: mobile listeners browsing music
- Operator steps: none (needs the API from plan 10)
```
