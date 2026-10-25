**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 55 — Full player shows and controls another device's playback

When another of the member's devices is playing, the full player shows that item: title and show
title (linked where the phone can open them), artwork, the chapter the other device is in with
"Playing on {device}" under it, live progress with seeking, previous and next, play/pause, skip
back and forward, and speed. Add to Playlist and Share work. Livestreams show the item, the Live
label, previous, next, and play/pause. Controls that only make sense for this phone's own item are
hidden, and the screen stays open while it shows the other device.

Before editing, confirm these exist. If any is missing, stop and report:

- Plan 50: `useCrossDevicePlayerDisplay`, `usePlayerStatusText`, `useDisplayedAddByRssResourceData`.
- Plan 51: `resolveRemoteNowPlayingSegment` in `apps/mobile/src/playback/nowPlayingSegment.ts`, and
  `useNowPlayingChapters` returning the remote item's chapters while remote.
- Plan 52: the device slot in `FullPlayerUtilityRow.tsx`.
- Plan 54: `FullPlayerRemoteScrubber`.
- Plan 34 routes `pause`, `resume`, `jumpBy`, `setRate`, `skipToNext`, `skipToNextTrack`,
  `skipToPrevious`, and `skipToPreviousTrack` (`routedSkipToNext` and the others in
  `PlaybackProvider.tsx`).
- `DTOPlaybackResourceSummary` has `medium: MediumEnum` (plan 10).

`FullPlayerScreen.tsx` is about 1800 lines: read it in windows around the anchors below.

## Rows

R5, R7, R17, R47, R59, R65, R73, R75, R80, R83, R90

## Runs after

34, 51, 52, 54

## Files

apps/mobile/src/screens/player/FullPlayerRemoteRegion.tsx
apps/mobile/src/screens/player/FullPlayerScreen.tsx
apps/mobile/src/screens/player/FullPlayerSpeedControl.tsx
apps/mobile/src/screens/player/fullPlayerContentLink.ts
apps/mobile/src/screens/player/fullPlayerContentLink.test.ts
apps/mobile/src/components/player/FullPlayerSegmentBand.tsx
apps/mobile/src/components/player/FullPlayerTransportRow.tsx
apps/mobile/src/components/player/FullPlayerUtilityRow.tsx
apps/mobile/src/components/player/fullPlayerRows.ts
apps/mobile/src/components/player/fullPlayerRows.test.ts
apps/mobile/src/lib/share/shareUrl.ts
apps/mobile/src/lib/share/shareUrl.test.ts
apps/mobile/src/lib/share/shareNowPlaying.ts

## Decisions this plan fixes

- **Bands stay fixed (mobile-player-fixed-region).** The remote region uses the same layout math
  and band heights as the local one. The segment band always holds the status line, so a remote
  layout always reserves it (`hasSegmentBand` true) and never has section chips or the pane
  (`hasSections` false). Switching between local and remote is a different item, so the layout may
  change at that moment, never during one remote item.
- **Title links from the summary's medium (R73).** The title opens the playing resource's own
  screen, built from the reference and `medium`:
  - `item`: a track screen for a music medium (`isMusicMediumId`), else an episode screen. A live
    item opens the same screen, as a local livestream's title opens its live item's episode page.
  - `clip`: the clip screen.
  - `soundbite`: plain text. The summary carries only the soundbite id, and the phone has no
    soundbite screen to open.
  - `add_by_rss`: the phone's Add by RSS episode, track, or livestream screen when it has the feed
    and finds the item (the same lookup the local title uses); otherwise plain text.

  The show title is plain text for directory items: the summary has no channel id. For Add by RSS
  it opens the phone's feed screen when the feed is on the phone. A directory title opens as a
  single item screen on Browse (whether the phone follows that channel is unknown without a channel
  id); Add by RSS opens on Home, as it does locally.
- **Share links from the summary's medium (R73, R75).** Share works while another device plays.
  The link names the playing resource's own public page:
  - A non-live `item`: `/track/{id}` for a music medium, else `/episode/{id}`.
  - A live `item`: `/music/livestream/{id}` for a music medium, else `/podcast/livestream/{id}`.
  - `clip`: `/clip/{id}`. `soundbite`: `/official-clip/{id}`.
  - `add_by_rss`: no link, so Share is disabled, as it is locally for Add by RSS.

  This is more specific than the local share, which shares every item as `/episode`, a
  livestream as its podcast, and an official clip as its episode. The remote side cannot copy
  that mapping: the summary has no channel id for the livestream case and no item id for the
  official clip case. The local share does not change here.
- **Add to Playlist while remote (R75).** Enabled for every reference the phone can name:
  `item` (a live item included, as locally), `clip`, and `soundbite` by id, with the playlist medium
  `music` when the summary's medium is `MediumEnum.Music`, else `av` (the local rule). An
  `add_by_rss` item uses the phone's own copy of its data (`useDisplayedAddByRssResourceData`); when
  the phone does not have the feed, Add to Playlist is disabled for that item only.
- **Previous and next (R80).** The remote transport shows previous and next in their slots, wired
  to the session's `skipToPrevious` and `skipToNext`; plan 34 sends them as `previous` and `next`
  commands, and the playing device runs them as its own buttons, with its own queue and chapters.
  Plan 11's `canTrackPrevious` and `canTrackNext` are true for every remote state, live included,
  so the slots are never empty. Next is never disabled here: this phone's queue does not say what
  the playing device has ahead. Hold does nothing extra (`hasEpisodeChaptersForTrackButtons`
  false), so the buttons keep their plain labels; plan 34 would send the same command for a hold.
- **Music split by medium.** A music medium hides skip back and forward and keeps previous and next,
  as the local music player does. Other non-live media show all five slots. A live item hides skip
  back and forward (`canSkip` false).
- **Segment band with the status line (R83, R90).** Below the artwork, line 1 names the chapter of
  the remote item at the remote position estimate (plan 51's chapters, plan 11's estimate), with
  the chapter link when the chapter has one, as locally. Line 2 is the status line ("Playing on
  {device}", "Paused on…", "Starting on…", or "Sending to {device}…"), in the place the local band
  shows the chapter's time range. With no chapter to name (a clip, a soundbite, a live item, an
  item without chapters, or between chapters), the band shows the status line alone. The remote
  band has no time range: the status line takes that line.
- **The local full player gets no status line (R90).** While this phone plays and a transfer is on
  its way, the local band keeps naming the chapter and its time range. The device button already
  spins and is named "Moving Playback to {device}" (plan 52), and the mini player says "Sending to
  {device}…" (plan 51) once the full player closes, so the local band does not trade its time
  range for it.
- **Utility row.** Speed (not for live) and the device button. No sleep timer, no shuffle or repeat,
  no More: they act on this phone's player.
- **Action row.** Queue, Add to Playlist, and Share stay. Create Clip, Boost, and V4V hide.
- **Speed sheet.** Shows the other device's rate as selected; choosing a rate sends it (plan 34).
- **Livestream (R17).** No progress bar; the progress band shows the Live label.
- **Duration (R5).** The remote scrubber gets `display.durationSeconds`, which is
  `state.duration_seconds` (plans 50 and 54).
- **Stays open.** The screen's empty-session dismissal counts the remote display as a session. When
  the other device releases and nothing is loaded here, the screen closes as it does today when
  playback ends.
- **Sheets opened for the local item close.** When the display turns remote, any open sheet other
  than speed closes.

## `fullPlayerContentLink.ts`

Add, after `resolveFullPlayerChannelLink`:

```typescript
/** Where another device's item title opens, from the shared summary. */
export const resolveRemoteFullPlayerTitleLink = (
  resource: DTOPlaybackResourceSummary,
  addByRss: {
    feedIdText: string | null;
    itemKey: string | null;
    resourceData: AddByRSSResourceData | null;
  }
): FullPlayerContentTarget | null;

/** Where another device's show title opens: only an Add by RSS feed on this phone. */
export const resolveRemoteFullPlayerChannelLink = (
  resource: DTOPlaybackResourceSummary,
  addByRssFeedIdText: string | null
): FullPlayerContentTarget | null;
```

- Title: `name = nonEmpty(resource.title)`; null name → null. Exhaustive `switch` on
  `resource.ref.kind`, no `default`:
  - `item` → `{ idText: ref.item_id_text, imageUrl: resource.image_url, kind:
    isMusicMediumId(resource.medium) ? 'track' : 'episode', name }`.
  - `clip` → `{ idText: ref.clip_id_text, imageUrl: null, kind: 'clip', name }`.
  - `soundbite` → null.
  - `add_by_rss` → null unless `feedIdText`, `itemKey`, and `resourceData` are all present; then
    `add-by-rss-livestream` when `isAddByRssLivestreamResourceData(resourceData)`,
    `add-by-rss-track` when `isMusicMediumId(resource.medium)`, else `add-by-rss-episode`, each
    `{ idText: feedIdText, imageUrl: null, itemKey, name }`.
- Channel: `name = nonEmpty(resource.channel_title)`; null name → null. `add_by_rss` with a
  non-empty `addByRssFeedIdText` → `{ idText, imageUrl: null, kind: 'add-by-rss', name }`; every
  other kind → null.

Type-only import of `DTOPlaybackResourceSummary` from `@podverse/helpers/accountPlaybackStream`;
`isMusicMediumId` from `@podverse/helpers/medium`.

## `shareUrl.ts`

- Extend `ShareResource` with `'music-livestream' | 'official-clip' | 'podcast-livestream'`, mapped in
  `SHARE_RESOURCE_ROUTES` to `APP_ROUTES.MUSIC_LIVESTREAM`, `APP_ROUTES.OFFICIAL_CLIP`, and
  `APP_ROUTES.PODCAST_LIVESTREAM`. Keep the union and the record in alphabetical order.
- Add:

  ```typescript
  export function buildRemotePlaybackShareUrl(
    webBaseUrl: string | null,
    resource: DTOPlaybackResourceSummary,
    isLive: boolean
  ): string | null;
  ```

  Exhaustive `switch` on `resource.ref.kind`, no `default`: `item` → live:
  `isMusicMediumId(medium) ? 'music-livestream' : 'podcast-livestream'`, not live:
  `getItemTypeFromMedium(medium)` (`'track'` or `'episode'`), with `item_id_text`; `clip` →
  `'clip'`; `soundbite` → `'official-clip'` with `item_soundbite_id_text`; `add_by_rss` → null.
  Every case goes through `buildPublicShareUrl`.

## `shareNowPlaying.ts`

Add `buildRemotePlaybackShareUrl(resource, isLive)` that passes `getMobileConfig().webBaseUrl`,
next to `buildNowPlayingShareUrl`, importing the `shareUrl.ts` function under an alias the way the
file already does.

## `fullPlayerRows.ts`

Add after `resolveAddToPlaylistTarget`:

```typescript
export const resolveRemoteAddToPlaylistTarget = (
  resource: DTOPlaybackResourceSummary,
  addByRssResourceData: AddByRSSResourceData | null
): FullPlayerAddToPlaylistTarget | null;
```

`medium = resource.medium === MediumEnum.Music ? 'music' : 'av'`. Exhaustive `switch` on
`resource.ref.kind`, no `default`: `item` → `{ idText: item_id_text, kind: 'item', medium }`; `clip`
→ `{ idText: clip_id_text, kind: 'clip', medium }`; `soundbite` → `{ idText:
item_soundbite_id_text, kind: 'soundbite', medium }`; `add_by_rss` → `addByRssResourceData === null
? null : { kind: 'add-by-rss', medium, resourceData: addByRssResourceData }`.

## `FullPlayerTransportRow.tsx`

Add one optional prop, documented in the props type: `hideJumpButtons?: boolean`. The jump slots
render empty when `isMusicNowPlaying || hideJumpButtons`. Update the component comment. Previous
and next always render.

## `FullPlayerUtilityRow.tsx`

Add `mode?: 'local' | 'remote' | 'remoteLive'` (default `'local'`). `'local'` renders exactly what it
renders now, plus plan 52's device slot. `'remote'` renders only the speed slot and the device slot;
`'remoteLive'` only the device slot. The row keeps its fixed height when it renders no slot. Update
the comment.

## `FullPlayerSegmentBand.tsx`

Anchor: `export function FullPlayerSegmentBand({ chapters }: FullPlayerSegmentBandProps)`.

1. Move everything from the `styles` `useMemo` through the returned JSX into a file-local
   `function FullPlayerSegmentBandView({ detail, segment }: { detail: { kind: 'time' | 'status';
   text: string } | null; segment: NowPlayingSegment | null })`. `kind: 'time'` renders today's
   time line (`styles.segmentTime`, `testID="full-player-segment-time"`). `kind: 'status'` renders
   a row with `Ionicons name="swap-horizontal-outline"` (size `BOTTOM_CHROME_STRIP_ICON_SIZE`,
   color `themeStyles.textSecondary.color`, hidden from accessibility) and `<Text numberOfLines={1}
   style={…segmentTime's size and line height, color themeStyles.textSecondary.color…}
   testID="full-player-remote-status">`.
2. The view renders the cluster when `segment !== null` (as today, with `detail` as the second
   line and the chapter link when `webUrl` is set). When `segment === null` and `detail` is a
   status, it renders the status row alone, centered in the band. When both are null it renders
   the empty band, as today.
3. The accessible name joins the segment label, the title, and the detail text with ", ", as today
   for the time range.
4. `FullPlayerSegmentBand` keeps its hooks and computes `segment` and the time label as now, then
   renders the view with `detail = timeLabel === null ? null : { kind: 'time', text: timeLabel }`.
   Its behavior and test ids do not change.
5. Add:

   ```typescript
   export function FullPlayerRemoteSegmentBand(props: {
     chapters: DTOItemChapter[];
     isLive: boolean;
     refKind: DTOPlaybackResourceRef['kind'];
     statusText: string | null;
   }): JSX.Element;
   ```

   It reads `useRemotePlaybackPositionSeconds()` and `usePlaybackScrubPreview()`, computes
   `resolveRemoteNowPlayingSegment({ chapters, isLive, positionSeconds, previewPositionSeconds,
   refKind })`, and renders the view with `detail = statusText === null ? null : { kind: 'status',
   text: statusText }`. It is a leaf, so only the band re-renders once a second.
6. Update the file's doc comment: the local band shows the time range under the segment; the
   remote band shows the status line there.

## `FullPlayerRemoteRegion.tsx`

```typescript
export type FullPlayerRemoteRegionStyles = {
  region: StyleProp<ViewStyle>;
  content: StyleProp<ViewStyle>;
  upperBands: StyleProp<ViewStyle>;
  titleBlock: StyleProp<ViewStyle>;
  title: StyleProp<TextStyle>;
  titleLink: StyleProp<ViewStyle>;
  subtitle: StyleProp<TextStyle>;
  subtitleLink: StyleProp<TextStyle>;
  artworkBand: StyleProp<ViewStyle>;
  controlStack: StyleProp<ViewStyle>;
};

type FullPlayerRemoteRegionProps = {
  artworkSize: number;
  channelLink: FullPlayerContentTarget | null;
  chapters: DTOItemChapter[];
  contentLinkLabel: (request: FullPlayerContentTarget) => string;
  display: Extract<CrossDevicePlayerDisplay, { kind: 'remote' }>;
  onJumpBack: () => void;
  onJumpForward: () => void;
  onOpenChannel: () => void;
  onOpenSpeed: () => void;
  onOpenTitle: () => void;
  onPause: () => void;
  onPlay: () => void;
  onSkipToNext: () => void;
  onSkipToNextTrack: () => void;
  onSkipToPrevious: () => void;
  onSkipToPreviousTrack: () => void;
  regionStyles: FullPlayerRemoteRegionStyles;
  statusText: string | null;
  titleLink: FullPlayerContentTarget | null;
};

export function FullPlayerRemoteRegion(props: FullPlayerRemoteRegionProps): JSX.Element;
```

Same nesting as the local region (anchor `const playerRegion = isPlaybackActive ? (` in
`FullPlayerScreen.tsx`), so the bands line up:

1. `<View style={regionStyles.region} testID="full-player-remote-region">`, then `<View
   style={regionStyles.content}>`, then `<View style={regionStyles.upperBands}>`.
2. Title block: `<View pointerEvents="box-none" style={regionStyles.titleBlock}>`, built like the
   local title block (anchor `testID="full-player-title-link"`):
   - With `titleLink !== null`: a `Pressable` (`accessibilityLabel={contentLinkLabel(titleLink)}`,
     `accessibilityRole="link"`, `onPress={onOpenTitle}`, pressed opacity 0.6, style
     `regionStyles.titleLink`, `testID="full-player-remote-title-link"`) around `<MarqueeText
     align="center" style={regionStyles.title} testID="full-player-remote-title"
     turnGroup="full-player" turnOrder={0}>{display.resource.title}</MarqueeText>`. Without, the
     same `MarqueeText` alone.
   - When `display.resource.channel_title` is non-empty: with `channelLink !== null`, a
     `Pressable` (`accessibilityRole="link"`, `onPress={onOpenChannel}`,
     `testID="full-player-remote-channel-link"`) around `<Text numberOfLines={1}
     style={regionStyles.subtitleLink}>`; without, `<Text numberOfLines={1}
     style={regionStyles.subtitle} testID="full-player-remote-channel">`.
3. Artwork band: `<View pointerEvents="box-none" style={regionStyles.artworkBand}>` holding a centered
   `artworkSize` square with `<CoverImage accessibilityLabel={t('media_player.media_player_image')}
   testID="full-player-remote-artwork" uri={display.resource.image_url}
   viewerUri={display.resource.image_url} />` filling it. Copy the band and square styles from
   `FullPlayerArtwork.tsx` (`viewerBand`, `viewerSquare`). No video surface.
4. Segment band: `<FullPlayerRemoteSegmentBand chapters={chapters} isLive={display.isLive}
   refKind={display.resource.ref.kind} statusText={statusText} />`.
5. Progress band, `pointerEvents="auto"`: when `display.controls.showsProgress`,
   `<FullPlayerRemoteScrubber durationSeconds={display.durationSeconds} />`; otherwise a `View` of
   height `FULL_PLAYER_PROGRESS_BLOCK_HEIGHT`, centered, holding `<Text
   testID="full-player-remote-live" style={…typography.body, fontWeight '700',
   themeStyles.textPrimary.color…}>{t('media.livestream.live')}</Text>`.
6. Close `upperBands`. Then `<View pointerEvents="auto" style={regionStyles.controlStack}>` with:
   - `<FullPlayerTransportRow hasEpisodeChaptersForTrackButtons={false} hasNextQueueItem
     hideJumpButtons={!display.controls.canSkip}
     isMusicNowPlaying={isMusicMediumId(display.resource.medium)} onErrorPress={noop}
     onJumpBack={onJumpBack} onJumpForward={onJumpForward} onPause={onPause} onPlay={onPlay}
     onSkipToNext={onSkipToNext} onSkipToNextTrack={onSkipToNextTrack}
     onSkipToPrevious={onSkipToPrevious} onSkipToPreviousTrack={onSkipToPreviousTrack}
     state={display.transportState} />`, with a module-level `const noop = (): void => {};` for
     the error press (a remote state never has the `error` transport state).
   - `<FullPlayerUtilityRow isMusicNowPlaying={false} isRepeatEnabled={false}
     isShuffleEnabled={false} mode={display.controls.canSetRate ? 'remote' : 'remoteLive'}
     onOpenMore={noop} onOpenSleepTimer={noop} onOpenSpeed={onOpenSpeed} onToggleRepeat={noop}
     onToggleShuffle={noop} playbackRate={display.rate} />`.

## `FullPlayerScreen.tsx`

1. **Display.** Directly after the `usePlaybackSession()` destructure (it ends near line 340), add
   `const display = useCrossDevicePlayerDisplay();`, `const remoteDisplay = display.kind ===
   'remote' ? display : null;`, `const isRemoteDisplay = remoteDisplay !== null;`, and `const
   statusText = usePlayerStatusText(display);`.
2. **Add by RSS data.** Replace both inline expressions (anchors `const addByRssItemResourceData =`
   and `const addByRssResourceData =`) with one read placed before the first:
   `const addByRssResourceData = useDisplayedAddByRssResourceData();` and
   `const addByRssItemResourceData = addByRssResourceData !== null &&
   !isAddByRssLivestreamResourceData(addByRssResourceData) ? addByRssResourceData : null;`. Locally
   this is the same data as before. While remote it is the phone's copy of the remote Add by RSS
   item, so the existing feed-id and item-key effect resolves the remote item's links, and the
   sections store tracks the same item as `useNowPlayingChapters`.
3. **Sections.** `const hasSections = hasSectionsForTarget(activeTarget);` (near line 395) becomes
   `!isRemoteDisplay && hasSectionsForTarget(activeTarget)`. The chip strip, the pane, and
   `canOuterScroll` already follow `hasSections`.
4. **Share and Add to Playlist.** `shareUrl`: `remoteDisplay !== null ?
   buildRemotePlaybackShareUrl(remoteDisplay.resource, remoteDisplay.isLive) :` the current
   expression. `addToPlaylistTarget`: `remoteDisplay !== null ?
   resolveRemoteAddToPlaylistTarget(remoteDisplay.resource, addByRssResourceData) :
   resolveAddToPlaylistTarget(activeTarget)`. `handleShare` and `handleAddToPlaylist` stay as they
   are.
5. **Links.** `titleLink`: `remoteDisplay !== null ?
   resolveRemoteFullPlayerTitleLink(remoteDisplay.resource, { feedIdText: addByRssFeedIdText,
   itemKey: addByRssItemKey, resourceData: addByRssResourceData }) :` the current call.
   `channelLink`: `remoteDisplay !== null ?
   resolveRemoteFullPlayerChannelLink(remoteDisplay.resource, addByRssFeedIdText) :` the current
   call. Add `remoteDisplay` and `addByRssResourceData` to the memo dependencies. In
   `openLinkedContent` and `openTitleContent`, `isSubscribed` is false while `isRemoteDisplay`
   (this phone's `channel` is not the remote item's channel); add `isRemoteDisplay` to their
   dependencies.
6. **Segment band.** `const hasSegmentBand =` (near line 633) becomes `isRemoteDisplay || (` the
   current expression `)`.
7. **Dismissal.** In the effect that calls `shouldDismissFullPlayerOnEmptySession({`, pass
   `hasPlaybackSession: isRemoteDisplay || (activeTarget !== null && nowPlaying !== null)` and add
   `isRemoteDisplay` to its dependencies.
8. **Sheets.** Add an effect on `[isRemoteDisplay]`: when `isRemoteDisplay` is true and
   `openSheet !== null && openSheet !== 'speed'`, call `setOpenSheet(null)`.
9. **Region.** Change `const playerRegion = isPlaybackActive ? (` so that when `remoteDisplay !==
   null` it renders:

   ```tsx
   <FullPlayerRemoteRegion
     artworkSize={layout.artworkSize}
     channelLink={channelLink}
     chapters={chapters}
     contentLinkLabel={contentLinkLabel}
     display={remoteDisplay}
     onJumpBack={() => {
       jumpBy(-MEDIA_JUMP_BACK_SECONDS);
     }}
     onJumpForward={() => {
       jumpBy(MEDIA_JUMP_FORWARD_SECONDS);
     }}
     onOpenChannel={() => {
       if (channelLink !== null) {
         openLinkedContent(channelLink);
       }
     }}
     onOpenSpeed={() => {
       handleOpenSheet('speed');
     }}
     onOpenTitle={openTitleContent}
     onPause={handlePause}
     onPlay={handlePlay}
     onSkipToNext={() => {
       void skipToNext();
     }}
     onSkipToNextTrack={() => {
       void skipToNextTrack();
     }}
     onSkipToPrevious={() => {
       void skipToPrevious();
     }}
     onSkipToPreviousTrack={() => {
       void skipToPreviousTrack();
     }}
     regionStyles={remoteRegionStyles}
     statusText={statusText}
     titleLink={titleLink}
   />
   ```

   and otherwise keeps the current local branch and `null`. Build `remoteRegionStyles` with
   `useMemo` from the screen's existing entries: `region: [styles.playerRegion, { height:
   layout.playerRegionHeight }]`, `content: [styles.column, styles.playerRegionContent,
   styles.playerRegionFull]`, `upperBands: styles.playerRegionUpperBands`, `titleBlock:
   styles.titleBlock`, `title: styles.title`, `titleLink: styles.titleLink`, `subtitle:
   [styles.subtitle, styles.subtitlePlain]`, `subtitleLink: [styles.subtitle,
   styles.subtitleLink]`, `artworkBand: styles.playerRegionArtworkBand`, `controlStack:
   styles.playerRegionControlStack`. `chapters` is the screen's existing `useNowPlayingChapters()`
   result, which follows the remote item (plan 51).
10. **Action row** (anchor `<FullPlayerActionRow`): `disableAddToPlaylist` and `disableShare` keep
    their current expressions (`addToPlaylistTarget === null`, `shareUrl === null`), which now
    cover the remote item. `showBoost={!isRemoteDisplay && canShowBoost}`,
    `showCreateClip={!isRemoteDisplay && !isMusicNowPlaying}`, `showV4v={!isRemoteDisplay &&
    showV4v}`.

## `FullPlayerSpeedControl.tsx`

Read `useCrossDevicePlayerDisplay()`. `const currentRate = display.kind === 'remote' ? display.rate :
playbackRate;` and use it for `selected` and the `useMemo` dependencies. `setRate` stays (plan 34
sends it to the other device). Update the doc comment to say the selected rate is the other
device's while the player shows it.

## Tests

- `fullPlayerContentLink.test.ts`: `resolveRemoteFullPlayerTitleLink` gives `episode` for a podcast
  medium `item`, `track` for a music medium `item`, `episode` for a live podcast `item`, `clip` for
  a clip, null for a soundbite, the Add by RSS episode, track, and livestream kinds when the feed id,
  item key, and data are present, and null for Add by RSS when any is missing, or when the title is
  blank. `resolveRemoteFullPlayerChannelLink` links only Add by RSS with a feed id.
- `shareUrl.test.ts`: `buildRemotePlaybackShareUrl` gives `/episode/…` and `/track/…` by medium,
  `/podcast/livestream/…` and `/music/livestream/…` for live items, `/clip/…`, `/official-clip/…`,
  and null for Add by RSS and for a missing web base URL.
- `fullPlayerRows.test.ts`: `resolveRemoteAddToPlaylistTarget` returns the item, clip, and soundbite
  targets with `music` for `MediumEnum.Music` and `av` otherwise, the Add by RSS target with data,
  and null for Add by RSS without data.

Plan 57's Maestro flow opens the full player with another device playing and asserts the remote
region, title link, status line, segment title, previous and next, enabled Share and Add to
Playlist, the device and speed buttons, and that `full-player-sleep-timer` is not visible. The
existing `player-screen` flow covers the local region and the local segment band.

## Release scratchpad

```markdown
## Mobile full player shows another device's playback

- Surfaces: mobile
- Change: while another of a member's devices plays, the full player shows that item with its
  artwork, the chapter that device is in, "Playing on {device}" (or Paused / Starting / Sending
  to), live progress that can be dragged to seek, previous and next, play/pause, skip back and
  forward (not for music), and speed. The title opens the episode, track, or clip screen, and Add
  by RSS titles open the phone's copy when it has the feed. Add to Playlist and Share work; an Add
  by RSS item the phone does not have cannot be added to a playlist, and Add by RSS has no share
  link. Remote share links point at the item's own page, including the livestream and official
  clip pages. Livestreams show the item, a Live label, previous, next, and play/pause. Sleep
  timer, More, Create Clip, Boost, and V4V are hidden there. The screen stays open while it shows
  the other device.
- Who notices: members signed in on more than one device
- Operator steps: none
```
