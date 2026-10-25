# `@podverse/playback-core`

Shared **pure** playback and queue policy extracted from the web media player. Both `apps/web` and
`apps/mobile` import this package; platform-specific bridges (DOM `HTMLMediaElement`, native
AVPlayer/ExoPlayer) stay in each app.

## What lives here

- `resolvePlaybackLoadDecision` and related types
- `PlaybackTarget`, `PlaybackLoadRequest`, `playbackTargetFromStandardLoad`
- Resume/seek helpers (`resumeSeekFromAbridged`, `clampNearEndSeconds`, `parsePlaybackSeconds`)
- Enclosure-switch policy helpers
- `combineQueueNowPlayingAndUpcoming`
- Auto-queue policy helpers (source choice, forward/backward walks, row mapping, playable-row
  checks, dedupe, and config transitions)
- Add by RSS list walk: build a feed list context from ordered item ids, order episodes by
  publish date, step to the newer or older neighbor, and read the next ids ahead. Storage
  lookups and livestream ordering stay with each surface.

Each surface supplies its own `AutoQueueSourceFetchers` transport implementation.

## What does not live here

- DOM or React Native APIs
- `@podverse/ui`, `@podverse/orm`, or app contexts
- Native media engine bridge code

## Dependencies

- `@podverse/helpers` only (DTOs, `MediumEnum`, enclosure helpers)

## Commands (from monorepo root)

```bash
npm run build -w @podverse/playback-core
npm run test -w @podverse/playback-core
npm run lint -w @podverse/playback-core
```

## References

- [DOCS-MOBILE-PROCESS-PLAYBACK-QUEUE-PARITY.md](/docs/proposals/mobile/app-development-process/DOCS-MOBILE-PROCESS-PLAYBACK-QUEUE-PARITY.md)
- [media-player-architecture](/.cursor/skills/media-player-architecture/SKILL.md)
- Web decision matrix: `apps/web/src/components/MediaPlayer/MEDIA-PLAYER-DECISION-MATRIX.md`
