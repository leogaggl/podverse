**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 87 — Mobile Add by RSS track screen: artist link in the byline

Plan 63 made the directory track screen's album header subtitle a link to the album's verified
artists. The Add by RSS track screen (`AddByRssTrackDetailScreen`) still shows the feed's
`itunes:author` text. This plan shows the album's artists from the device instead, with the
player's rules (plan 86): Add by RSS artists open their Add by RSS page; a directory artist the
album's publisher pointer resolved to opens the directory artist page (R53, R47's link). With no
artist, the subtitle stays the author text, unlinked.

## Rows

R8, R47, R50, R53

## Runs after

63, 81, 85, 86

## Files

apps/mobile/src/screens/home/AddByRssTrackDetailScreen.tsx
release-notes/scratchpad.md

## Reuses

- `ChannelHeader`'s `subtitleLink` (plan 63) and `ArtistChooserSheet` taking `LineArtist`
  (plan 86).
- `addByRssAlbumArtists(feedUrl)`, `joinLineArtistTitles`, `useAddByRssArtistIndexVersion`
  (plan 81).
- `buildArtistDetailParams` and `CHANNEL_BROWSE_STACK_ROUTES.ArtistDetail` from
  `'../../navigation'`, as plan 63 uses them.
- Catalog keys `media_player.open_named_screen`, `media.music.artist`, `media.music.artists`.

## Decisions this plan fixes

- **Navigation typing:** the screen's props become
  `NativeStackScreenProps<AddByRssDetailStackParamList & ChannelBrowseStackParamList, 'AddByRssTrackDetail'>`.
  Every stack that registers this screen (Home, Library, and after plan 85 Browse and Search)
  registers `ArtistDetail`, so no cast is needed.
- **Lookup key:** the stored feed's `feedUrl`; plan 81 compares canonical forms.

## `AddByRssTrackDetailScreen.tsx`

1. Imports: `ChannelBrowseStackParamList`, `buildArtistDetailParams`, and
   `CHANNEL_BROWSE_STACK_ROUTES` from `'../../navigation'` (types with `import type` on their own
   line); `ArtistChooserSheet` from `'../../components/content'`; `addByRssAlbumArtists` from
   `'../../lib/addByRss/addByRssArtistIndex'`; `joinLineArtistTitles` and `type LineArtist` from
   `'../../lib/playback/lineArtist'`; `useAddByRssArtistIndexVersion` from
   `'../../hooks/useAddByRssArtistIndexVersion'`.
2. Change `AddByRssTrackDetailScreenProps` (near line 38) as above.
3. Anchor `const openFeed = useCallback(` (near line 210). After that callback:

```typescript
  const artistIndexVersion = useAddByRssArtistIndexVersion();
  const albumArtists = useMemo(
    () => (feed === null ? [] : addByRssAlbumArtists(feed.feedUrl)),
    [artistIndexVersion, feed]
  );
  const artistByline = joinLineArtistTitles(albumArtists);
  const [isArtistChooserOpen, setIsArtistChooserOpen] = useState(false);

  const openArtist = useCallback(
    (artist: LineArtist) => {
      if (artist.kind === 'add-by-rss') {
        navigation.navigate('AddByRssPodcastDetail', { feedIdText: artist.feedIdText });
        return;
      }
      navigation.navigate(
        CHANNEL_BROWSE_STACK_ROUTES.ArtistDetail,
        buildArtistDetailParams({ artistId: artist.publisher.id_text, previewTitle: artist.publisher.title })
      );
    },
    [navigation]
  );

  const onArtistBylinePress = useCallback(() => {
    const [only] = albumArtists;
    if (albumArtists.length === 1 && only !== undefined) {
      openArtist(only);
      return;
    }
    if (albumArtists.length > 1) {
      setIsArtistChooserOpen(true);
    }
  }, [albumArtists, openArtist]);
```

   Hooks sit above the screen's early returns, with the other hooks.
4. Anchor `testID="add-by-rss-track-detail-album-header"` on `<ChannelHeader` (near line 318):
   `subtitle={artistByline.length > 0 ? artistByline : (mappedFeed.channel.about?.author ?? null)}`
   and `subtitleLink` exactly as plan 63 builds it (accessibility label from
   `media_player.open_named_screen` with `media.music.artist` or `media.music.artists`), with
   `testID: 'add-by-rss-track-detail-artist-link'`, only when `artistByline.length > 0`.
5. At the end of the screen's returned `View`, after its last sheet:

```tsx
      <ArtistChooserSheet
        artists={albumArtists}
        onCancel={() => {
          setIsArtistChooserOpen(false);
        }}
        onSelect={(artist) => {
          setIsArtistChooserOpen(false);
          openArtist(artist);
        }}
        testID="add-by-rss-track-detail-artist-chooser"
        visible={isArtistChooserOpen}
      />
```

## Must stay true

- `add-by-rss-track-detail-album-header`, the album title link (`openFeed`), and
  `AddByRssTrackHeader` are unchanged.
- An Add by RSS track whose album has no artist on the device shows exactly today's subtitle.
- No network request is made for the byline.

## Tests

No unit test: the selection is `addByRssAlbumArtists` (plan 81) and the line is plan 86's helper.
Plan 88's Maestro flow asserts `add-by-rss-track-detail-artist-link`.

## Release scratchpad

```markdown
## Mobile Add by RSS track pages link the artist

- Surfaces: mobile
- Change: an Add by RSS track page shows its album's artist under the album title as a link: an
  Add by RSS artist on this device opens its Add by RSS page, and a directory artist the album
  points to opens the directory artist page. Several artists open a chooser. Without one, the
  feed's author text shows as before.
- Who notices: members who open Add by RSS tracks
- Operator steps: none
```
