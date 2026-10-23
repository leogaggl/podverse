**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 62 — Mobile mini player "Artist · Album" line

The mini player has room for two lines. Its second line becomes "Artist · Album" when the item has
a verified artist, and stays the album (channel) title otherwise. That line now scrolls in the
same `MarqueeText` turn group as the title: the title takes its pass first, then the second line.

## Rows

R8, R32, R33

## Runs after

60

## Files

apps/mobile/src/components/player/MiniPlayer.tsx
release-notes/scratchpad.md

## Reuse

`playbackTargetArtists` and `artistAlbumLine` (plan 60); `MarqueeText` with
`turnGroup="mini-player"` as the title already uses (`lib/text/marqueeTurns.ts` hands the turn on
by `turnOrder`, then join order).

## `apps/mobile/src/components/player/MiniPlayer.tsx`

1. Imports: `playbackTargetArtists` and `artistAlbumLine` from
   `'../../lib/playback/verifiedArtists'`. Drop `Text` from the `react-native` import if nothing
   else in the file uses it after step 3.
2. Anchor: the `if (activeTarget === null || nowPlaying === null) {` early return. Hooks must stay
   above it. Directly above it add:

```typescript
  const artists = useMemo(() => playbackTargetArtists(activeTarget), [activeTarget]);
```

   Directly below the early return add:

```typescript
  const secondLine = artistAlbumLine(artists, nowPlaying.channelTitle);
```

3. Anchor: `{nowPlaying.channelTitle !== null ? (` and its `<Text numberOfLines={1}
   style={styles.subtitle}>`. Replace that whole conditional with:

```tsx
          {secondLine !== null ? (
            <MarqueeText
              style={styles.subtitle}
              testID="mini-player-subtitle"
              turnGroup="mini-player"
              turnOrder={1}
            >
              {secondLine}
            </MarqueeText>
          ) : null}
```

4. Keep `MINI_PLAYER_CHANNEL_TITLE_NUDGE` and its value. Change its comment to
   `/** Second-line ink paints 1pt above its layout slot. Both lines keep their layout positions. */`.

`nowPlaying.channelTitle` is the album title for music (`summaryFromItem` in
`PlaybackProvider.tsx`) and the Add by RSS channel title for Add by RSS items; plan 60's
`playbackTargetArtists` returns no artists for Add by RSS, so those keep today's text until area I.

## Decisions this plan fixes

- **The second line always uses `MarqueeText`**, including podcasts and videos with no artist. A
  long channel title now scrolls after the title instead of truncating. One component for the line
  keeps the turn order fixed whether or not an artist is present.

## Must stay true

- No new height: the row stays `MINI_PLAYER_ARTWORK_SIZE` tall with two lines.
- The mini player still opens the full player on tap; the second line is not a link.
- No `as`, no `any`, strict equality only.

## Tests

No unit test: the text comes from `artistAlbumLine`, which plan 60 tests. Maestro: plan 66 asserts
`mini-player-subtitle` in `track.yaml`.

## Release scratchpad

```markdown
## Mobile mini player names the artist

- Surfaces: mobile
- Change: the mini player's second line reads "Artist · Album" for music with a verified artist,
  and the channel or album title otherwise. That line now scrolls after the title when it is too
  long, for every item, instead of being cut off.
- Who notices: mobile listeners; podcast listeners see long channel names scroll
- Operator steps: none
```
