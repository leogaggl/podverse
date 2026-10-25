# Media player architecture (non-live)

## When to use

Changing **file-based** podcast / music / clip / soundbite / chapter / add-by-RSS playback, the
queue “now playing” load path, keyboard / slider / button controls that seek or jump the element,
or cross-device playback (publishing state, obeying or sending remote commands, the device menu).

## Stack (today)

- **Policy:** `resolvePlaybackLoadDecision` in `apps/web/src/lib/playback/` — pure; owns safe defaults (e.g. music intent), `explicitPlaybackSeconds` precedence, near-end clamp where applicable.
- **Imperative element surface:** `useMediaElementBridge` plus `mediaElementBridgeSurface.ts` under `apps/web/src/hooks/` — the **only** places that should assign `mediaRef.current` playback fields (`src`, `currentTime`, `load`, `play` / `pause` parity). **ESLint:** root `eslint.config.mjs` uses `no-restricted-syntax` on `apps/web/src/**` for those patterns, with **temporary** ignores only for those two files (the bridge implementation).
- **Controls context:** `MediaPlayerControlsProvider` wraps the app tree in `apps/web/src/providers/Providers.tsx`. `useMediaPlayerControls()` exposes `seek`, `jumpBy`, `pauseAt`, `togglePlay`, `loadAndStart`, etc. `isAttached: false` when no non-live bridge is registered (e.g. livestream-only playback).
- **Non-live mounts:** `NonLiveMediaMount` in `apps/web/src/components/MediaPlayer/MediaElement/NonLiveMediaMount.tsx` — hidden audio + floating video portal; both use `NonLiveMediaOrchestrator` + `useNonLivePlaybackAvProps`.
- **Livestream:** `MediaPlayerControllerLiveStreamAV` renders the shared `MediaElement` (native `<audio>` / `<video>`; HLS through native support or lazy `hls.js`) and owns its own play/pause. It mounts a fresh element per source. No player library: do not add `video.js` or `@videojs/*` back.

## Do / don’t

- **Do** route new UI actions through `useMediaPlayerControls()` (and `setMPCurrentTime` when you need immediate UI sync while paused, e.g. add-by-RSS).
- **Do** read the decision spine in `apps/web/src/components/MediaPlayer/MEDIA-PLAYER-DECISION-MATRIX.md`.
- **Don’t** add `window` `CustomEvent` buses for playback; the `EVENTS.MEDIA_PLAYER` group was removed.
- **Don’t** fold livestream / HLS into the non-live bridge in this initiative — separate plan-set.

## Flow (mermaid)

```mermaid
flowchart LR
  subgraph ui [UI]
    B[Buttons / sliders / keyboard]
  end
  subgraph ctx [Context]
    C[useMediaPlayerControls]
    M[MediaPlayer + current time]
  end
  subgraph av [Non-live]
    NL[NonLiveMediaMount]
    AV[NonLiveMediaOrchestrator]
    BR[useMediaElementBridge]
  end
  B --> C
  C --> AV
  NL --> AV
  AV --> BR
  BR --> E[(HTMLMediaElement)]
  M --> AV
```

## Cross-device playback

- Route every play, pause, seek, skip, rate, next, previous, and item pick by
  `resolvePlaybackRole` from `@podverse/helpers` (mobile:
  `@podverse/helpers/crossDevicePlayback`): `active` and `idle` play locally (`idle` claims),
  `remote` sends a command with the `@podverse/helpers-requests` playback calls.
- Commands name the target state. Next and previous are commands, not toggles. Never add a toggle
  command.
- Remote state is display only: it never goes through the meaningful-playback path, the playback
  journal, history, or position saves.
- Gate controls for live items with `getPlaybackRemoteControls`; do not re-derive the rule.
- The event contract is `packages/helpers/src/lib/accountPlaybackStream.ts`. The architecture is
  in `docs/architecture/ARCHITECTURE.md` under Account events.

## Related

- Phases 0–6 of the media-player architecture refactor are complete on `refactor/media-player`;
  durable implementation state is in the code and related documentation.
- E2E: media-player specs under `apps/web/e2e/media-player-*.spec.ts`.
