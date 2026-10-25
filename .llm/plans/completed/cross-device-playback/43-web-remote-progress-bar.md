**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 43 — Remote progress bar that advances locally and seeks the playing device

In the remote view (plan 42) the progress bar shows the playing device's position, moving forward
on its own between state updates, and dragging it seeks the playing device. The playing device
publishes position, rate, and timestamps (area A); this tab extrapolates through plan 49's shared
position clock (`useRemotePlaybackPositionSeconds`, which reads the store's
`getEstimatedPositionSeconds()` from plan 21 and plan 11's estimate), so the bar is smooth without
an event per second.

**Duration comes from the shared state.** The bar's length and its duration label read
`remote.state.duration_seconds`, the playing device's own file length (plan 10's field, plan 11's
rule). It never reads this tab's media element or `mpDuration`: dynamic ads can give devices
different file lengths, and this tab has no file loaded in the remote role.

The bar is display only (**playback-meaningful-events**): it never writes the MediaPlayer context,
`MediaPlayerCurrentTime`, history, or a saved position. A drag sends one `seek` command when the
pointer is released, through plan 25's transport.

Before editing, confirm `apps/web/src/hooks/useRemotePlayerDisplay.ts` (plan 42),
`apps/web/src/hooks/useRemotePlaybackPositionSeconds.ts` (plan 49), and
`apps/web/src/hooks/usePlayerTransport.ts` with `seekTo` (plan 25) exist. If not, stop and report.

## Rows

R4, R16

## Runs after

42

## Files

apps/web/src/components/MediaPlayer/Sliders/MediaPlayerProgress.tsx
apps/web/src/components/MediaPlayer/Sliders/RemoteMediaPlayerProgress.tsx

## Decisions this plan fixes

- **Tick.** Plan 49's clock: whole seconds, one shared 250 ms interval while the displayed status
  is `playing`, a re-render only when the whole second changes. Paused or loading → no interval;
  the value updates when the state changes.
- **Seek on release.** Dragging shows a local preview position; one `seekTo` on mouseup. A plain
  click (mousedown then mouseup) is a seek to that point. No continuous seeking, since each move
  would be a command over the network.
- **No chapter markers, chapter tooltip, or clip/soundbite highlight on the remote bar.** The
  segment strip above the bar names the chapter or clip instead (plan 42).
- **Unknown duration** (`duration_seconds` null or 0): the bar shows the position, an empty
  duration, no fill, and does not seek.
- **Clip editor and embed stay local.** `MediaPlayerProgress` routes to the remote bar only when
  `isClipForm` is not set and `layoutVariant !== 'embed'`.

## `RemoteMediaPlayerProgress.tsx`

```typescript
type RemoteMediaPlayerProgressProps = {
  remote: RemotePlayerDisplay;
  includeMobileTime?: boolean;
};

export const RemoteMediaPlayerProgress: React.FC<RemoteMediaPlayerProgressProps>;
```

Same markup and the same `MediaPlayerProgress.module.scss` classes as the local bar's default
layout (time span, `customProgressBar` with `customProgressBarInner`, `progressLevel`,
`progressRemaining`, duration span, and the `includeMobileTime` block), so the two look identical.
Leave out the highlight, chapter markers, and tooltip.

- `const estimated = useRemotePlaybackPositionSeconds(true) ?? 0;`
- `const duration = remote.state.duration_seconds !== null && remote.state.duration_seconds > 0 ? remote.state.duration_seconds : 0;`
- `const [dragSeconds, setDragSeconds] = useState<number | null>(null);` and a `dragSecondsRef`
  mirroring it for the window listeners.
- `const shown = Math.min(dragSeconds ?? estimated, duration > 0 ? duration : Number.POSITIVE_INFINITY);`
  (plan 11's estimate already clamps at the shared duration; this keeps a drag preview inside it
  too). `const ratio = duration > 0 ? clampRatio(shown / duration) : 0;`
  (`clampRatio` from `@podverse/helpers/math`, as `PlayButtonRow` uses).
- `const { seekTo } = usePlayerTransport();`
- `secondsFromClientX(clientX)`: null when `barRef.current` is null or `duration === 0`; else
  `Math.round(percent * duration)` with the same percent math as the local
  `setProgressFromEvent`.
- `onMouseDown` on the bar: compute seconds (null → return); set the preview; add window
  `mousemove` (update the preview when non-null) and `mouseup` (remove both listeners; when the
  ref holds a number, `seekTo(thatNumber)`; then clear the preview). Remove the listeners in an
  unmount effect too, via refs.
- No `onClick` handler (mouseup already sends), and no touch handlers: mobile browsers fire
  mousedown and mouseup after a tap, which seeks once.
- Times: `formatHHMMSS(shown)` and, when `duration > 0`, `formatHHMMSS(duration)`, else an empty
  duration span.
- Slider semantics: `role="slider"`, `tabIndex={0}`, `aria-valuemin={0}`,
  `aria-valuenow={shown}`, `aria-valuemax={duration}`,
  ``aria-valuetext={`${formatHHMMSS(shown)} of ${formatHHMMSS(duration)}`}`` (the same text the
  local bar builds), and `data-testid="media-player-remote-progress"`.
- `aria-disabled={duration === 0 ? true : undefined}`.

Keyboard seeking is the window arrow-key handler (plan 25 routes it), as for the local bar.

## `MediaPlayerProgress.tsx`

Split without changing the local bar:

1. Rename the current component body to a file-local `LocalMediaPlayerProgress` with the same
   props type. Do not change its code.
2. Export a new `MediaPlayerProgress` with the same props:

   ```tsx
   export const MediaPlayerProgress: React.FC<MediaPlayerProgressProps> = (props) => {
     const remote = useRemotePlayerDisplay();
     if (remote !== null && !props.isClipForm && props.layoutVariant !== 'embed') {
       return <RemoteMediaPlayerProgress remote={remote} includeMobileTime={props.includeMobileTime} />;
     }
     return <LocalMediaPlayerProgress {...props} />;
   };
   ```

The hook runs before the branch on every render, so hook order is stable. The local bar's
continuous seek, `setMPCurrentTime`, chapter markers, and tooltip stay exactly as they are.

Plan 42 already renders the Live label instead of `MediaPlayerProgress` for a live remote item,
so `RemoteMediaPlayerProgress` never shows a live item; when `remote.controls.showsProgress` is
false anyway, render nothing.

## Must stay true

- The local bar's behavior, markup, and test ids are unchanged.
- The remote bar never calls `seek` from `useMediaPlayerControls`, `setMPCurrentTime`, or any
  queue or history hook.
- The remote bar's duration is `remote.state.duration_seconds` only.
- One drag sends at most one `seek`.

## Tests

No new unit test: plan 49's `remotePlaybackClock.test.ts` covers the estimate and tick, and this
component is markup over it and plan 25's transport. Plan 47's Playwright spec checks the remote
bar advances and that a click on it seeks the playing browser.

## Release scratchpad

```markdown
## Web progress bar follows the playing device

- Surfaces: web
- Change: While another device or tab plays, the web player's progress bar shows that device's
  position and moves forward on its own between updates, with that device's duration. Clicking or
  dragging the bar seeks the playing device when released. Chapter marks are not shown on that
  remote bar; the strip above the player names the current chapter instead.
- Who notices: members with more than one device or tab open
- Operator steps: none
```
