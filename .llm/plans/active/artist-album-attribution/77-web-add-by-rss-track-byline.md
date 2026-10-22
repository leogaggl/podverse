**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 77 — Web: artist byline on Add by RSS track pages

An Add by RSS track page (`/add-by-rss/track/[id]`) shows its album's artists under the track
title, with the same rules as the player (plan 76): Add by RSS artists on this browser link to
their Add by RSS pages, and an album pointing at a directory artist links to `/artist/[id]` (R53).
Directory track pages keep plan 51's verified-only byline; they never show a device-only artist.

The byline markup moves out of `CoreTrackHeader` into a small shared component so both headers
render the same row of links.

## Rows

R53

## Runs after

51, 74, 76

## Files

apps/web/src/components/Media/Header/TrackArtistByline.tsx
apps/web/src/components/Core/Artist/Album/Track/CoreTrackHeader.tsx
apps/web/src/components/AddByRSS/Artist/Album/Track/AddByRSSTrackDetailHeader.tsx
apps/web/src/app/add-by-rss/track/AddByRSSTrackItemPageClient.tsx
release-notes/scratchpad.md

## `components/Media/Header/TrackArtistByline.tsx` (new)

`'use client'`, named export. Takes the links; renders nothing when empty.

```tsx
type TrackArtistBylineProps = {
  links: readonly ArtistLineLink[];
};

export const TrackArtistByline: React.FC<TrackArtistBylineProps> = ({ links }) => {
  if (links.length === 0) {
    return null;
  }
  return (
    <p className={styles.trackArtistByline}>
      {links.map((link, index) => (
        <span key={link.idText}>
          {index > 0 ? ', ' : null}
          <Link href={link.href}>{link.title}</Link>
        </span>
      ))}
    </p>
  );
};
```

`ArtistLineLink` with `import type` from `../../../lib/artistPublishers`. Styles import last:
`../../../styles/components/Common/Media/Podcast/Episode/EpisodeHeader.module.scss` (plan 51 put
`.trackArtistByline` there). The folder already holds `HeaderButtons.tsx` and similar shared
header pieces.

## `CoreTrackHeader.tsx`

Replace plan 51's inline `{artistLinks.length > 0 ? (<p className={styles.trackArtistByline}>…</p>) : null}`
with `<TrackArtistByline links={artistLinks} />`. `artistLinks` is computed exactly as plan 51
wrote it. No other change.

## `AddByRSSTrackDetailHeader.tsx`

- New optional prop `artistLinks?: readonly ArtistLineLink[]`.
- `titleNode` becomes a fragment: the existing title `Link`, then
  `<TrackArtistByline links={artistLinks ?? []} />`.

## `AddByRSSTrackItemPageClient.tsx`

- State `artistLinks: ArtistLineLink[]`, start `[]`.
- Effect on `[feed?.feedUrl, feed?.idText, loggedInAccount?.id_text, artistReloadKey]`: when
  logged out or `feed` is null, set `[]`. Otherwise
  `resolveDeviceArtistLinks({ addByRSS: { feedUrl: feed.feedUrl, channelIdText: feed.idText }, channel: null, item: null })`
  then set, with a `cancelled` flag; on error `console.error` and `[]`.
- `useEffect(() => onAddByRSSFeedChanged(() => setArtistReloadKey((k) => k + 1)), [])`.
- Pass `artistLinks={artistLinks}` to `<AddByRSSTrackDetailHeader … />`.

The file already reads `loggedInAccount` from `useAccount()`; reuse it.

## Must stay true

- Directory track pages render the same byline as plan 51 and never read Add by RSS data.
- A track whose album has no matching artist shows no byline.
- No new catalog keys; no `as`.

## Tests

No new unit test: the link rules are `resolveDeviceArtistLinks` (plan 76's tests) and the
component only renders them. Plan 51's `track-artist-byline.spec.ts` covers the directory page
after the extraction; plan 78 covers the Add by RSS byline.

## Release scratchpad

```markdown
## Add by RSS track pages link the artist

- Surfaces: web
- Change: a track page for an album you added by RSS now shows the artist under the track title
  when this browser knows it: an Add by RSS artist links to its Add by RSS page, and an artist
  in the Podverse directory links to the directory artist page.
- Who notices: members who add music by RSS
- Operator steps: none
```
