**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 55 — Full player shows and controls another device's playback

When another of the member's devices is playing, the full player shows that item: title, show,
artwork, "Playing on {device}", live progress with seeking, play/pause, skip back and forward, and
speed. Livestreams show the item, the Live label, and play/pause only. Controls that only make sense
for this phone's own item are hidden or disabled, and the screen stays open while it shows the
other device.

Before editing, confirm plan 50's `useCrossDevicePlayerDisplay`, `usePlaybackDeviceLabel`, and
`remotePlaybackStatusLabelKey`, plan 52's device slot in `FullPlayerUtilityRow.tsx`, and plan 54's
`FullPlayerRemoteScrubber` exist, and that plan 34 routes `pause`, `resume`, `jumpBy`, and
`setRate`. If not, stop and report. `FullPlayerScreen.tsx` is about 1800 lines: read it in
windows around the anchors below.

## Rows

R5, R7, R17, R47, R59, R65

## Runs after

52, 54

## Files

apps/mobile/src/screens/player/FullPlayerRemoteRegion.tsx
apps/mobile/src/screens/player/FullPlayerScreen.tsx
apps/mobile/src/screens/player/FullPlayerSpeedControl.tsx
apps/mobile/src/components/player/FullPlayerTransportRow.tsx
apps/mobile/src/components/player/FullPlayerUtilityRow.tsx

## Decisions this plan fixes

- **Bands stay fixed (mobile-player-fixed-region).** The remote region uses the same layout math
  and band heights as the local one. The segment band holds the "Playing on {device}" line, so a
  remote layout always reserves it (`hasSegmentBand` true) and never has section chips or the pane
  (`hasSections` false). Switching between local and remote is a different item, so the layout may
  change at that moment, never during one remote item.
- **Title block.** Title and show title as plain text. No links: the shared summary carries ids
  but not the slugs and channel the link builders need.
- **Transport (R47).** Skip back, play/pause, skip forward. Previous and next slots stay empty (plan
  34 sends no next or previous), so the play circle stays centered. A live item also leaves the jump
  slots empty. Skip back and forward show for every non-live item, music included: the shared state
  does not say whether the item is music.
- **Utility row.** Speed (not for live) and the device button. No sleep timer, no shuffle or repeat,
  no More: they act on this phone's player.
- **Action row.** Queue stays. Create Clip, Boost, and V4V hide. Add to Playlist and Share show
  disabled, so the action row keeps its shape.
- **Speed sheet.** Shows the other device's rate as selected; choosing a rate sends it (plan 34).
- **Livestream (R17).** No progress bar; the progress band shows the Live label.
- **Stays open.** The screen's empty-session dismissal counts the remote display as a session. When
  the other device releases and nothing is loaded here, the screen closes as it does today when
  playback ends.
- **Sheets opened for the local item close.** When the display turns remote, any open sheet other
  than speed closes.

## `FullPlayerTransportRow.tsx`

Add two optional props, documented in the props type:

- `hideSkipButtons?: boolean` — when true, the first and fifth slots render as empty
  `<View style={styles.slot} />`.
- `hideJumpButtons?: boolean` — the jump slots render empty when `isMusicNowPlaying ||
  hideJumpButtons`.

Update the component comment to mention both.

## `FullPlayerUtilityRow.tsx`

Add `mode?: 'local' | 'remote' | 'remoteLive'` (default `'local'`). `'local'` renders exactly what it
renders now, plus plan 52's device slot. `'remote'` renders only the speed slot and the device slot;
`'remoteLive'` only the device slot. The row keeps its fixed height when it renders no slot. Update
the comment.

## `FullPlayerRemoteRegion.tsx`

```typescript
export type FullPlayerRemoteRegionStyles = {
  region: StyleProp<ViewStyle>;
  content: StyleProp<ViewStyle>;
  upperBands: StyleProp<ViewStyle>;
  titleBlock: StyleProp<ViewStyle>;
  title: StyleProp<TextStyle>;
  subtitle: StyleProp<TextStyle>;
  artworkBand: StyleProp<ViewStyle>;
  controlStack: StyleProp<ViewStyle>;
};

type FullPlayerRemoteRegionProps = {
  artworkSize: number;
  display: Extract<CrossDevicePlayerDisplay, { kind: 'remote' }>;
  onJumpBack: () => void;
  onJumpForward: () => void;
  onOpenSpeed: () => void;
  onPause: () => void;
  onPlay: () => void;
  regionStyles: FullPlayerRemoteRegionStyles;
};

export function FullPlayerRemoteRegion(props: FullPlayerRemoteRegionProps): JSX.Element;
```

Same nesting as the local region (anchor `const playerRegion = isPlaybackActive ? (` in
`FullPlayerScreen.tsx`), so the bands line up:

1. `<View style={regionStyles.region} testID="full-player-remote-region">`, then `<View
   style={regionStyles.content}>`, then `<View style={regionStyles.upperBands}>`.
2. Title block: `<View pointerEvents="box-none" style={regionStyles.titleBlock}>` with `<MarqueeText
   align="center" style={regionStyles.title} testID="full-player-remote-title"
   turnGroup="full-player" turnOrder={0}>{display.resource.title}</MarqueeText>` and, when
   `display.resource.channel_title` is non-empty, `<Text numberOfLines={1}
   style={regionStyles.subtitle} testID="full-player-remote-channel">`.
3. Artwork band: `<View pointerEvents="box-none" style={regionStyles.artworkBand}>` holding a centered
   `artworkSize` square with `<CoverImage accessibilityLabel={t('media_player.media_player_image')}
   testID="full-player-remote-artwork" uri={display.resource.image_url}
   viewerUri={display.resource.image_url} />` filling it. Copy the band and square styles from
   `FullPlayerArtwork.tsx` (`viewerBand`, `viewerSquare`). No video surface.
4. Status band: a `View` of height `FULL_PLAYER_SEGMENT_BAND_HEIGHT`, row, centered, gap
   `tokens.spacing.sm`, holding `Ionicons name="swap-horizontal-outline"` (size
   `BOTTOM_CHROME_STRIP_ICON_SIZE`, color `themeStyles.textSecondary.color`,
   `accessibilityElementsHidden`, `importantForAccessibility="no"`) and `<Text numberOfLines={1}
   style={…typography.body, color textSecondary…} testID="full-player-remote-status">{t(
   remotePlaybackStatusLabelKey(display.status), { device: deviceLabel(display.activeDevice) })}</Text>`.
5. Progress band, `pointerEvents="auto"`: when `display.controls.showsProgress`,
   `<FullPlayerRemoteScrubber durationSeconds={display.durationSeconds} />`; otherwise a `View` of
   height `FULL_PLAYER_PROGRESS_BLOCK_HEIGHT`, centered, holding `<Text
   testID="full-player-remote-live" style={…typography.body, fontWeight '700',
   themeStyles.textPrimary.color…}>{t('media.livestream.live')}</Text>`.
6. Close `upperBands`. Then `<View pointerEvents="auto" style={regionStyles.controlStack}>` with:
   - `<FullPlayerTransportRow hasEpisodeChaptersForTrackButtons={false} hasNextQueueItem={false}
     hideJumpButtons={!display.controls.canSkip} hideSkipButtons isMusicNowPlaying={false}
     onErrorPress={noop} onJumpBack={onJumpBack} onJumpForward={onJumpForward} onPause={onPause}
     onPlay={onPlay} onSkipToNext={noop} onSkipToNextTrack={noop} onSkipToPrevious={noop}
     onSkipToPreviousTrack={noop} state={display.transportState} />`, with a module-level `const
     noop = (): void => {};`. The skip handlers are unreachable because those slots are empty.
   - `<FullPlayerUtilityRow isMusicNowPlaying={false} isRepeatEnabled={false}
     isShuffleEnabled={false} mode={display.controls.canSetRate ? 'remote' : 'remoteLive'}
     onOpenMore={noop} onOpenSleepTimer={noop} onOpenSpeed={onOpenSpeed} onToggleRepeat={noop}
     onToggleShuffle={noop} playbackRate={display.rate} />`.

## `FullPlayerScreen.tsx`

1. **Display.** Directly after the `usePlaybackSession()` destructure (it ends near line 340), add
   `const display = useCrossDevicePlayerDisplay();`, `const remoteDisplay = display.kind ===
   'remote' ? display : null;`, and `const isRemoteDisplay = remoteDisplay !== null;`.
2. **Sections.** `const hasSections = hasSectionsForTarget(activeTarget);` (near line 395) becomes
   `!isRemoteDisplay && hasSectionsForTarget(activeTarget)`. The chip strip, the pane, and
   `canOuterScroll` already follow `hasSections`.
3. **Segment band.** `const hasSegmentBand =` (near line 633) becomes `isRemoteDisplay || (` the
   current expression `)`.
4. **Dismissal.** In the effect that calls `shouldDismissFullPlayerOnEmptySession({`, pass
   `hasPlaybackSession: isRemoteDisplay || (activeTarget !== null && nowPlaying !== null)` and add
   `isRemoteDisplay` to its dependencies.
5. **Sheets.** Add an effect on `[isRemoteDisplay]`: when `isRemoteDisplay` is true and
   `openSheet !== null && openSheet !== 'speed'`, call `setOpenSheet(null)`.
6. **Region.** Change `const playerRegion = isPlaybackActive ? (` so that when `remoteDisplay !==
   null` it renders:

   ```tsx
   <FullPlayerRemoteRegion
     artworkSize={layout.artworkSize}
     display={remoteDisplay}
     onJumpBack={() => {
       jumpBy(-MEDIA_JUMP_BACK_SECONDS);
     }}
     onJumpForward={() => {
       jumpBy(MEDIA_JUMP_FORWARD_SECONDS);
     }}
     onOpenSpeed={() => {
       handleOpenSheet('speed');
     }}
     onPause={handlePause}
     onPlay={handlePlay}
     regionStyles={remoteRegionStyles}
   />
   ```

   and otherwise keeps the current local branch and `null`. Build `remoteRegionStyles` with
   `useMemo` from the screen's existing entries: `region: [styles.playerRegion, { height:
   layout.playerRegionHeight }]`, `content: [styles.column, styles.playerRegionContent,
   styles.playerRegionFull]`, `upperBands: styles.playerRegionUpperBands`, `titleBlock:
   styles.titleBlock`, `title: styles.title`, `subtitle: [styles.subtitle, styles.subtitlePlain]`,
   `artworkBand: styles.playerRegionArtworkBand`, `controlStack: styles.playerRegionControlStack`.
7. **Action row** (anchor `<FullPlayerActionRow`): `disableAddToPlaylist={isRemoteDisplay ||
   addToPlaylistTarget === null}`, `disableShare={isRemoteDisplay || shareUrl === null}`,
   `showBoost={!isRemoteDisplay && canShowBoost}`, `showCreateClip={!isRemoteDisplay &&
   !isMusicNowPlaying}`, `showV4v={!isRemoteDisplay && showV4v}`.

## `FullPlayerSpeedControl.tsx`

Read `useCrossDevicePlayerDisplay()`. `const currentRate = display.kind === 'remote' ? display.rate :
playbackRate;` and use it for `selected` and the `useMemo` dependencies. `setRate` stays (plan 34
sends it to the other device). Update the doc comment to say the selected rate is the other
device's while the player shows it.

## Tests

No new unit test: the display rules and controls are plan 50's and plan 11's tested functions, and
this plan is layout. Plan 57's Maestro flow opens the full player with another device playing and
asserts `full-player-remote-region`, `full-player-remote-title`, `full-player-remote-status`,
`full-player-devices`, `full-player-speed`, and that `full-player-skip-next` and
`full-player-sleep-timer` are not visible. The existing `player-screen` flow covers the local
region.

## Release scratchpad

```markdown
## Mobile full player shows another device's playback

- Surfaces: mobile
- Change: while another of a member's devices plays, the full player shows that item with its
  artwork, "Playing on {device}", live progress that can be dragged to seek, play/pause, skip back
  and forward, and speed. Livestreams show the item, a Live label, and play/pause only. Next and
  previous, sleep timer, More, Create Clip, Boost, and V4V are hidden there; Add to Playlist and
  Share are disabled. The screen stays open while it shows the other device.
- Who notices: members signed in on more than one device
- Operator steps: none
```
