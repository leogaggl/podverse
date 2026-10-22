**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 43 — Remote progress bar that advances locally and seeks the playing device

In the remote view (plan 42) the progress bar shows the playing device's position, moving forward
on its own between state updates, and dragging it seeks the playing device. The playing device
publishes position, rate, and timestamps (area A); this tab extrapolates with the store's
`getEstimatedPositionSeconds()` (plan 21, using plan 11's estimate), so the bar is smooth without
an event per second.

The bar is display only (**playback-meaningful-events**): it never writes the MediaPlayer context,
`MediaPlayerCurrentTime`, history, or a saved position. A drag sends one `seek` command when the
pointer is released, through plan 25's transport.

Before editing, confirm `apps/web/src/hooks/useRemotePlayerDisplay.ts` (plan 42) and
`apps/web/src/hooks/usePlayerTransport.ts` with `seekTo` (plan 25) exist, and that
`crossDevicePlaybackStore` in `apps/web/src/lib/crossDevicePlayback/crossDevicePlaybackStore.ts`
has `getEstimatedPositionSeconds()` (plan 21). If not, stop and report.

## Rows

R4, R16

## Runs after

42

## Files

apps/web/src/hooks/useRemotePlaybackPositionSeconds.ts
apps/web/src/hooks/__tests__/useRemotePlaybackPositionSeconds.test.tsx
apps/web/src/components/MediaPlayer/Sliders/MediaPlayerProgress.tsx
apps/web/src/components/MediaPlayer/Sliders/RemoteMediaPlayerProgress.tsx

## Decisions this plan fixes

- **Tick.** 250 ms interval while the displayed status is `playing`, rounded down to whole
  seconds, and a state update only when the whole second changes. Paused or loading → no
  interval; the value updates when the state changes.
- **Seek on release.** Dragging shows a local preview position; one `seekTo` on mouseup. A plain
  click (mousedown then mouseup) is a seek to that point. No continuous seeking, since each move
  would be a command over the network.
- **No chapter markers, chapter tooltip, or clip/soundbite highlight** in the remote view: the
  state carries none of that.
- **Unknown duration** (`duration_seconds` null or 0): the bar shows the position, an empty
  duration, no fill, and does not seek.
- **Clip editor and embed stay local.** `MediaPlayerProgress` routes to the remote bar only when
  `isClipForm` is not set and `layoutVariant !== 'embed'`.

## `useRemotePlaybackPositionSeconds.ts`

```typescript
/**
 * Whole-second estimate of the displayed remote position, advancing while it plays.
 * Null when disabled, live, or unknown.
 */
export function useRemotePlaybackPositionSeconds(enabled: boolean): number | null;
```

```typescript
const readWholeSeconds = (): number | null => {
  const value = crossDevicePlaybackStore.getEstimatedPositionSeconds();
  return value === null ? null : Math.floor(value);
};
```

- `const displayState = useCrossDevicePlaybackSnapshot((s) => s.displayState);`
- `const [position, setPosition] = useState<number | null>(() => (enabled ? readWholeSeconds() : null));`
- One `useEffect` on `[enabled, displayState]`:
  - `!enabled` → `setPosition(null)` and return.
  - `setPosition(readWholeSeconds())`.
  - When `displayState?.status === 'playing'`, start
    `setInterval(() => { const next = readWholeSeconds(); setPosition((prev) => (prev === next ? prev : next)); }, 250)`
    and clear it in the cleanup.
- Return `enabled ? position : null`.

The 250 ms constant is file-local (`REMOTE_POSITION_TICK_MS`). Plan 46's row progress calls this
hook with `enabled` true only for the matching row, so at most a few intervals run.

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
- `const shown = dragSeconds ?? estimated;` `const ratio = duration > 0 ? clampRatio(shown / duration) : 0;`
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
- One drag sends at most one `seek`.

## Tests

Vitest, `apps/web/src/hooks/__tests__/useRemotePlaybackPositionSeconds.test.tsx`
(`renderHook`, fake timers; mock `crossDevicePlaybackStore.getEstimatedPositionSeconds` and
`useCrossDevicePlaybackSnapshot` with `vi.mock` on their modules, the way existing hook tests mock
contexts):

- Playing: estimate 10.2, then 10.9 after 250 ms → still 10 and no extra render; 11.1 after
  another 250 ms → 11.
- Paused: no interval runs (advancing timers does not call the estimate again).
- `enabled` false → null and no interval.
- A new `displayState` object re-reads immediately.

Plan 47's Playwright spec checks the remote bar advances and that a drag seeks the playing tab.

## Release scratchpad

```markdown
## Web progress bar follows the playing device

- Surfaces: web
- Change: While another device or tab plays, the web player's progress bar shows that device's
  position and moves forward on its own between updates. Clicking or dragging the bar seeks the
  playing device when released. Chapter marks are not shown on that remote bar.
- Who notices: members with more than one device or tab open
- Operator steps: none
```
