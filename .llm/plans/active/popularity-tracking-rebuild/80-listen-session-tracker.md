**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 80 — Shared listen session tracker in playback-core

Web and mobile must send a listen only once the counted-listen rule is met (60 seconds heard or
25% of the item, whichever comes first) and must measure "heard" as media seconds actually
played, not wall-clock time and not seek distance. Both players already share load policy through
`@podverse/playback-core`, so the measuring and the report timing live there once:

- `PlaybackLoadDecision.shouldRecordPlaybackStat: boolean` becomes
  `listenSession: ListenSessionDirective` (`'start' | 'continue' | 'none'`), which says how a load
  affects the listener's session.
- A new pure module, `listenSession.ts`, holds the session targets, the tracker that counts heard
  seconds from position samples, and the rule for when to emit a report.

Plans 81 (web) and 82 (mobile) wire the tracker into their players and send its reports. This plan
only maps the two existing read sites of `shouldRecordPlaybackStat` onto the new field so the tree
keeps compiling; it adds no sending.

## Rows

R34

## Runs after

30

## Files

- `packages/playback-core/src/listenSession.ts` (new)
- `packages/playback-core/src/__tests__/listenSession.test.ts` (new)
- `packages/playback-core/src/resolvePlaybackLoadDecision.ts`
- `packages/playback-core/src/resolveEnclosureSwitchPlaybackDecision.ts`
- `packages/playback-core/src/index.ts`
- `packages/playback-core/src/__tests__/resolvePlaybackLoadDecision.test.ts`
- `packages/playback-core/src/__tests__/resolveEnclosureSwitchPlaybackDecision.test.ts`
- `packages/playback-core/src/__tests__/stageEnclosureSwitchFromSelection.test.ts`
- `apps/web/src/components/MediaPlayer/Controller/NonLiveMediaOrchestrator.tsx`
- `apps/web/src/components/MediaPlayer/Controller/__tests__/NonLiveMediaOrchestrator.seekPolicy.test.tsx`
- `apps/web/src/hooks/__tests__/useMediaElementBridge.test.tsx`
- `apps/mobile/src/playback/PlaybackProvider.tsx`

## Questions the rows leave open, answered

- **Which loads start a session?** Every load of a catalog item, clip, soundbite, or chapter
  starts one, including music `session_restore`. A session only counts seconds that actually play,
  so a restored-but-paused load never reports. The old flag skipped `session_restore` because the
  old stats fired once per load. That reason is gone (decision; main alternative: keep
  `session_restore` at `'none'`).
- **Enclosure switch** (the same item moving to another file of itself, `enclosure-switch-resume`)
  is `'continue'`: the session, its client listen id, and its heard seconds carry over.
- **Add by RSS** is `'none'`. It has no server row to count.
- **Livestreams are not counted.** The `livestream` decision is `'none'` and
  `listenSessionTargetFromPlaybackTarget` returns `null` for it. This matches mobile today, where
  livestream targets map to no stats target. The web live player never sent stats (decision; main
  alternative: count a live item by its `item_id_text` once heard 60 seconds).
- **Soundbites and chapters** count toward their item (`item_id_text`), as plan 32's contract
  says. A clip counts toward the clip.
- **When a clip ends** (a playing sample reaches the clip's `end_time`), the session is marked
  completed, reports if it counted, and closes. Listening past the clip's end counts toward nothing
  until the next load (decision; main alternative: start an item session at the clip's end).
- **Completion closes the session** for items too (`recordCompleted`). The next load starts a new
  session.

## `packages/playback-core/src/listenSession.ts` (new)

Write it in this shape. Keep the doc comments; they describe the code as it stands
(**comments-future-forward**). `@podverse/helpers/popularityListen` is the subpath plan 30 adds;
import it there rather than through the barrel so mobile bundles only the rule.

```typescript
import type { DTOClip } from '@podverse/helpers';
import {
  isCountedListen,
  POPULARITY_COUNTED_LISTEN_MIN_SECONDS,
} from '@podverse/helpers/popularityListen';

import { parsePlaybackSeconds } from './parsePlaybackSeconds.js';
import type { PlaybackTarget } from './playbackTarget.js';

/**
 * How a load affects the listener's counted-listen session: start a new one, keep the current one
 * (the same media moved to another file), or track nothing.
 */
export type ListenSessionDirective = 'start' | 'continue' | 'none';

/** What a session counts toward. A soundbite or chapter counts toward its item. */
export type ListenSessionTarget =
  | { kind: 'item'; idText: string }
  | { kind: 'clip'; idText: string; startSeconds: number; endSeconds: number | null };

/** One report for `POST /stats/listen`. */
export type ListenSessionReport = {
  target: ListenSessionTarget;
  /** One id per session; every report of the session repeats it. */
  clientListenId: string;
  /** Whole media seconds heard, from 0 to `LISTEN_SESSION_MAX_SECONDS_HEARD`. */
  secondsHeard: number;
  completed: boolean;
  /** Wall-clock time, in ms, at which the session first met the counted-listen rule. */
  countedAtMs: number;
  /** True for the session's first report. */
  firstReport: boolean;
};

export type ListenSessionTracker = {
  /** Apply a load's directive. Any session it replaces ends first. */
  load(input: {
    directive: ListenSessionDirective;
    target: ListenSessionTarget | null;
    mediaDurationSeconds: number | null;
  }): void;
  /** Media duration once the player knows it. */
  setMediaDuration(seconds: number): void;
  /** One position sample from the player. */
  recordPosition(input: { positionSeconds: number; isPlaying: boolean; playbackRate: number }): void;
  /** The listener or the player moved the position; the next sample only sets a new baseline. */
  recordSeek(): void;
  /** Playback paused; sends an update when enough new listening built up. */
  recordPause(): void;
  /** The media played to its end; reports completion when the listen counted, then closes. */
  recordCompleted(): void;
  /** Close the session, sending an update when enough new listening built up. */
  end(): void;
  /** Drop the session without reporting (sign-out). */
  reset(): void;
};

/** Upper bound the listen route accepts for `seconds_heard`. */
export const LISTEN_SESSION_MAX_SECONDS_HEARD = 86_400;

/** Slack, in seconds, between a sample's position change and the wall-clock time it took. */
export const LISTEN_SESSION_TICK_TOLERANCE_SECONDS = 2;

/** New listening, in seconds, that earns an update report on pause or end. */
export const LISTEN_SESSION_UPDATE_STEP_SECONDS = 60;

type ListenSessionState = {
  target: ListenSessionTarget;
  clientListenId: string;
  mediaDurationSeconds: number | null;
  secondsHeard: number;
  lastPositionSeconds: number | null;
  lastSampleAtMs: number | null;
  completed: boolean;
  countedAtMs: number | null;
  lastReportedSeconds: number | null;
  reportedCompleted: boolean;
};

export function listenSessionTargetForClip(
  clip: Pick<DTOClip, 'id_text' | 'start_time' | 'end_time'>
): ListenSessionTarget {
  const startSeconds = parsePlaybackSeconds(clip.start_time) ?? 0;
  const endSeconds = parsePlaybackSeconds(clip.end_time);
  return {
    kind: 'clip',
    idText: clip.id_text,
    startSeconds,
    endSeconds: endSeconds !== undefined && endSeconds > startSeconds ? endSeconds : null,
  };
}

/** Session target for a playback target; `null` for media that is not counted. */
export function listenSessionTargetFromPlaybackTarget(
  target: PlaybackTarget
): ListenSessionTarget | null {
  switch (target.kind) {
    case 'clip':
      return listenSessionTargetForClip(target.clip);
    case 'soundbite':
    case 'chapter':
    case 'item-podcast':
    case 'item-video':
    case 'item-music':
      return { kind: 'item', idText: target.item.id_text };
    case 'add-by-rss':
    case 'livestream':
      return null;
  }
}

function positiveSecondsOrNull(value: number | null): number | null {
  return value !== null && Number.isFinite(value) && value > 0 ? value : null;
}

function sessionDurationSeconds(state: ListenSessionState): number | null {
  const { target, mediaDurationSeconds } = state;
  if (target.kind === 'item') {
    return mediaDurationSeconds;
  }
  if (target.endSeconds !== null) {
    return target.endSeconds - target.startSeconds;
  }
  if (mediaDurationSeconds !== null && mediaDurationSeconds > target.startSeconds) {
    return mediaDurationSeconds - target.startSeconds;
  }
  return null;
}

function wholeSecondsHeard(state: ListenSessionState): number {
  return Math.min(LISTEN_SESSION_MAX_SECONDS_HEARD, Math.floor(state.secondsHeard));
}

function isSameTarget(left: ListenSessionTarget, right: ListenSessionTarget): boolean {
  return left.kind === right.kind && left.idText === right.idText;
}

/**
 * Counts media seconds heard for one session at a time and decides when to report. A sample adds
 * its forward position change only while playing, and only when the change fits in the wall-clock
 * time since the previous sample at the playback rate, so seeks and source jumps add nothing.
 *
 * Reports go out when the session first meets the counted-listen rule, when it first reaches 60
 * seconds after an earlier report below 60 (the server may know a different duration), on
 * completion, and on pause or end once 60 more seconds were heard since the last report. The
 * threshold is checked against whole seconds, the value the server receives.
 */
export function createListenSessionTracker(deps: {
  now: () => number;
  createClientListenId: () => string;
  onReport: (report: ListenSessionReport) => void;
}): ListenSessionTracker {
  let session: ListenSessionState | null = null;

  const emit = (state: ListenSessionState): void => {
    const firstReport = state.lastReportedSeconds === null;
    const secondsHeard = wholeSecondsHeard(state);
    state.lastReportedSeconds = secondsHeard;
    state.reportedCompleted = state.completed;
    try {
      deps.onReport({
        target: state.target,
        clientListenId: state.clientListenId,
        secondsHeard,
        completed: state.completed,
        countedAtMs: state.countedAtMs ?? deps.now(),
        firstReport,
      });
    } catch {
      // A failing reporter never interrupts playback.
    }
  };

  const maybeReport = (state: ListenSessionState, reason: 'progress' | 'pause' | 'end'): void => {
    const secondsHeard = wholeSecondsHeard(state);
    if (state.countedAtMs === null) {
      if (!isCountedListen({ secondsHeard, durationSeconds: sessionDurationSeconds(state) })) {
        return;
      }
      state.countedAtMs = deps.now();
      emit(state);
      return;
    }
    const lastReported = state.lastReportedSeconds ?? 0;
    if (state.completed && !state.reportedCompleted) {
      emit(state);
      return;
    }
    if (
      lastReported < POPULARITY_COUNTED_LISTEN_MIN_SECONDS &&
      secondsHeard >= POPULARITY_COUNTED_LISTEN_MIN_SECONDS
    ) {
      emit(state);
      return;
    }
    if (reason !== 'progress' && secondsHeard >= lastReported + LISTEN_SESSION_UPDATE_STEP_SECONDS) {
      emit(state);
    }
  };

  const closeSession = (): void => {
    if (session === null) {
      return;
    }
    const closing = session;
    session = null;
    maybeReport(closing, 'end');
  };

  const clearBaseline = (state: ListenSessionState): void => {
    state.lastPositionSeconds = null;
    state.lastSampleAtMs = null;
  };

  return {
    load({ directive, target, mediaDurationSeconds }) {
      if (
        directive === 'continue' &&
        session !== null &&
        target !== null &&
        isSameTarget(session.target, target)
      ) {
        const duration = positiveSecondsOrNull(mediaDurationSeconds);
        if (duration !== null) {
          session.mediaDurationSeconds = duration;
        }
        clearBaseline(session);
        return;
      }
      closeSession();
      if (directive === 'none' || target === null) {
        return;
      }
      session = {
        target,
        clientListenId: deps.createClientListenId(),
        mediaDurationSeconds: positiveSecondsOrNull(mediaDurationSeconds),
        secondsHeard: 0,
        lastPositionSeconds: null,
        lastSampleAtMs: null,
        completed: false,
        countedAtMs: null,
        lastReportedSeconds: null,
        reportedCompleted: false,
      };
    },

    setMediaDuration(seconds) {
      const duration = positiveSecondsOrNull(seconds);
      if (session !== null && duration !== null) {
        session.mediaDurationSeconds = duration;
      }
    },

    recordPosition({ positionSeconds, isPlaying, playbackRate }) {
      const state = session;
      if (state === null || !Number.isFinite(positionSeconds)) {
        return;
      }
      if (!isPlaying) {
        clearBaseline(state);
        return;
      }
      const nowMs = deps.now();
      if (state.lastPositionSeconds !== null && state.lastSampleAtMs !== null) {
        const delta = positionSeconds - state.lastPositionSeconds;
        const wallSeconds = Math.max(0, (nowMs - state.lastSampleAtMs) / 1000);
        const rate = Number.isFinite(playbackRate) && playbackRate > 1 ? playbackRate : 1;
        if (delta > 0 && delta <= wallSeconds * rate + LISTEN_SESSION_TICK_TOLERANCE_SECONDS) {
          state.secondsHeard = Math.min(
            LISTEN_SESSION_MAX_SECONDS_HEARD,
            state.secondsHeard + delta
          );
        }
      }
      state.lastPositionSeconds = positionSeconds;
      state.lastSampleAtMs = nowMs;

      if (
        state.target.kind === 'clip' &&
        state.target.endSeconds !== null &&
        positionSeconds >= state.target.endSeconds
      ) {
        state.completed = true;
        closeSession();
        return;
      }
      maybeReport(state, 'progress');
    },

    recordSeek() {
      if (session !== null) {
        clearBaseline(session);
      }
    },

    recordPause() {
      if (session === null) {
        return;
      }
      clearBaseline(session);
      maybeReport(session, 'pause');
    },

    recordCompleted() {
      if (session === null) {
        return;
      }
      session.completed = true;
      closeSession();
    },

    end() {
      closeSession();
    },

    reset() {
      session = null;
    },
  };
}
```

If `isCountedListen`'s signature from plan 30 differs from `{ secondsHeard, durationSeconds }`,
stop and report rather than adapting the rule here.

## `PlaybackLoadDecision` — `packages/playback-core/src/resolvePlaybackLoadDecision.ts`

- Add `import type { ListenSessionDirective } from './listenSession.js';` with the other imports.
- Replace the field and its comment:

```typescript
  /** How this load affects the listener's counted-listen session (`listenSession.ts`). */
  listenSession: ListenSessionDirective;
```

- `baseDecision` sets `listenSession: 'start'` in place of `shouldRecordPlaybackStat: true`.
- `item-music` with `intent === 'session_restore'`: drop the `shouldRecordPlaybackStat: false`
  override. Return `baseDecision({ ... })` directly with the same arguments
  (`initialSeekSeconds`, `reason: 'item-music-session-restore'`, `shouldClearAutoQueue: false`).
- `add-by-rss`: `listenSession: 'none'` in place of `shouldRecordPlaybackStat: false`.
- `livestream`: return `{ ...baseDecision({ initialSeekSeconds: 0, reason: 'livestream' }), listenSession: 'none' }`.

## `packages/playback-core/src/resolveEnclosureSwitchPlaybackDecision.ts`

Line 58: `shouldRecordPlaybackStat: false` becomes `listenSession: 'continue'`.

## `packages/playback-core/src/index.ts`

Add, after the `resolvePlaybackLoadDecision` export block:

```typescript
export {
  createListenSessionTracker,
  LISTEN_SESSION_MAX_SECONDS_HEARD,
  LISTEN_SESSION_TICK_TOLERANCE_SECONDS,
  LISTEN_SESSION_UPDATE_STEP_SECONDS,
  listenSessionTargetForClip,
  listenSessionTargetFromPlaybackTarget,
  type ListenSessionDirective,
  type ListenSessionReport,
  type ListenSessionTarget,
  type ListenSessionTracker,
} from './listenSession.js';
```

No `package.json` subpath is needed; web and mobile import the package root.

## Interim read sites (plans 81 and 82 replace them)

Keep behavior the same apart from the field name:

- `apps/web/src/components/MediaPlayer/Controller/NonLiveMediaOrchestrator.tsx` line 536:
  `if (!stagedDecision.shouldRecordPlaybackStat) {` becomes
  `if (stagedDecision.listenSession !== 'start') {`.
- `apps/mobile/src/playback/PlaybackProvider.tsx` line 1279:
  `decision.shouldRecordPlaybackStat` becomes `decision.listenSession === 'start'`.

Web test fixtures: `useMediaElementBridge.test.tsx` line 40 (`reason: 'item-podcast-fresh'`)
becomes `listenSession: 'start'`; `NonLiveMediaOrchestrator.seekPolicy.test.tsx` line 441
(`reason: 'enclosure-switch-resume'`) becomes `listenSession: 'continue'`.

Search the tree for `shouldRecordPlaybackStat` when done; the only remaining hit may be the
mobile `statsRepository.ts` doc comment, which plan 82 rewrites. `.llm/` hits do not count.

## Tests

`packages/playback-core/src/__tests__/listenSession.test.ts` (new), Vitest, in the style of the
sibling `__tests__` files. Drive the tracker with a fake clock (`let nowMs = 0; now: () => nowMs`),
a counter id factory, and an `onReport` `vi.fn`. Behavior-focused cases
(**unit-test-design-no-overgranularity**):

- A 3,600-second item played in one-second samples (position +1, clock +1000 ms) reports once at
  60 seconds (`firstReport: true`, `completed: false`, `countedAtMs` equal to the clock then), and
  not again through 119 seconds; a pause at 125 seconds sends a second report with 125 and
  `firstReport: false`.
- A 200-second item reports at 50 seconds and again on first reaching 60.
- A forward jump of 300 seconds within one one-second sample adds nothing; so does any sample
  after `recordSeek`. A 30-second position change after 30 seconds of wall-clock time while
  playing (a throttled sample) counts.
- Samples with `isPlaying: false` add nothing, and the first playing sample after them only sets
  the baseline.
- At `playbackRate: 2`, a two-second change per one-second sample counts.
- `'continue'` with the same target keeps the client listen id and the heard seconds. `'start'`
  with the same target closes the old session and issues a new id. `'continue'` with no matching
  session starts one.
- `'none'` and a `null` target create no session: samples are ignored and nothing reports.
- A clip with `end_time` reports `completed: true` when a playing sample reaches the end (when it
  counted), and later samples report nothing. `recordCompleted` on a session that never met the
  rule reports nothing.
- An `onReport` that throws does not make `recordPosition` throw.
- `secondsHeard` is a whole number and never above 86,400.
- `listenSessionTargetFromPlaybackTarget`: clip gives the clip target with its range; soundbite,
  chapter, and the three item kinds give `{ kind: 'item', idText: item.id_text }`; add-by-rss and
  livestream give `null`. `listenSessionTargetForClip` with no `end_time` gives `endSeconds: null`.

Update the existing tests to the new field:

- `resolvePlaybackLoadDecision.test.ts`: lines 125, 148, and 462 expect `listenSession: 'start'`;
  line 381 (music `session_restore`) expects `listenSession: 'start'` and its test name, if it
  mentions stats, says the session starts; lines 519 and 534 (add-by-rss) expect
  `listenSession: 'none'`; the livestream test also expects `listenSession: 'none'`.
- `resolveEnclosureSwitchPlaybackDecision.test.ts` line 50 and
  `stageEnclosureSwitchFromSelection.test.ts` line 128 expect `listenSession: 'continue'`.

## Release scratchpad

none (no sending changes until plans 81 and 82)
