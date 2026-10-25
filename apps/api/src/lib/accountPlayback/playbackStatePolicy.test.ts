import { describe, expect, it } from 'vitest';

import type { DTOPlaybackResourceSummary, PlaybackStatePublishBody } from '@podverse/helpers';
import { MediumEnum } from '@podverse/helpers';

import type { PlaybackStateDecision } from './playbackStatePolicy.js';
import {
  buildPlaybackStateAfterActiveLeft,
  decidePlaybackStatePublish,
} from './playbackStatePolicy.js';
import type { PlaybackStateRead, StoredPlaybackState } from './playbackStore.js';

const CALLER = 'session-caller';
const OTHER = 'session-other';
const STORED_AT_MS = 1_000_000;

const resource = (overrides?: Partial<DTOPlaybackResourceSummary>): DTOPlaybackResourceSummary => ({
  ref: { kind: 'item', item_id_text: 'item-one' },
  medium: MediumEnum.Podcast,
  title: 'Episode One',
  channel_title: 'The Show',
  image_url: null,
  ...overrides,
});

const publishBody = (overrides?: Partial<PlaybackStatePublishBody>): PlaybackStatePublishBody => ({
  claim: false,
  resource: resource(),
  status: 'playing',
  is_live: false,
  position_seconds: 100,
  duration_seconds: 3600,
  rate: 1,
  ...overrides,
});

const storedState = (overrides?: Partial<StoredPlaybackState>): StoredPlaybackState => ({
  revision: STORED_AT_MS,
  active_session_id_text: CALLER,
  resource: resource(),
  status: 'playing',
  is_live: false,
  position_seconds: 100,
  duration_seconds: 3600,
  rate: 1,
  updated_at_ms: STORED_AT_MS,
  ...overrides,
});

const readOf = (state: StoredPlaybackState | null): PlaybackStateRead => ({
  state,
  revision: state?.revision ?? 0,
  activeSessionIdText: state?.active_session_id_text ?? null,
});

const decide = (params: {
  current: PlaybackStateRead;
  body: PlaybackStatePublishBody;
  nowMs: number;
}): PlaybackStateDecision => decidePlaybackStatePublish({ ...params, callerSessionIdText: CALLER });

const writtenState = (decision: PlaybackStateDecision): StoredPlaybackState => {
  if (decision.kind !== 'write') {
    throw new Error(`expected a write, got ${decision.kind}`);
  }
  return decision.state;
};

describe('decidePlaybackStatePublish', () => {
  it('a claim writes with the caller active even when another device is active', () => {
    const nowMs = 2_000_000;

    const decision = decide({
      current: readOf(storedState({ active_session_id_text: OTHER })),
      body: publishBody({ claim: true, position_seconds: 40 }),
      nowMs,
    });

    expect(decision).toEqual({
      kind: 'write',
      newActiveSessionIdText: CALLER,
      state: {
        revision: nowMs,
        active_session_id_text: CALLER,
        resource: resource(),
        status: 'playing',
        is_live: false,
        position_seconds: 40,
        duration_seconds: 3600,
        rate: 1,
        updated_at_ms: nowMs,
      },
    });
  });

  it('a non-claim from a device that is not active is refused with the current active id, including when nothing is active', () => {
    expect(
      decide({
        current: readOf(storedState({ active_session_id_text: OTHER })),
        body: publishBody(),
        nowMs: STORED_AT_MS,
      })
    ).toEqual({ kind: 'not_active', activeSessionIdText: OTHER });

    expect(decide({ current: readOf(null), body: publishBody(), nowMs: STORED_AT_MS })).toEqual({
      kind: 'not_active',
      activeSessionIdText: null,
    });
  });

  it('a release clears the active device and the resource', () => {
    const nowMs = STORED_AT_MS + 5_000;

    const decision = decide({
      current: readOf(storedState()),
      body: publishBody({ resource: null, status: 'playing', position_seconds: 50 }),
      nowMs,
    });

    expect(decision).toEqual({
      kind: 'write',
      newActiveSessionIdText: null,
      state: {
        revision: nowMs,
        active_session_id_text: null,
        resource: null,
        status: 'paused',
        is_live: false,
        position_seconds: null,
        duration_seconds: null,
        rate: 1,
        updated_at_ms: nowMs,
      },
    });
  });

  it('a periodic publish 10 s later is unchanged within the drift tolerance and writes beyond it', () => {
    const nowMs = STORED_AT_MS + 10_000;
    const current = readOf(storedState({ position_seconds: 100 }));

    expect(decide({ current, body: publishBody({ position_seconds: 110 }), nowMs })).toEqual({
      kind: 'unchanged',
    });
    expect(decide({ current, body: publishBody({ position_seconds: 113 }), nowMs }).kind).toBe(
      'write'
    );

    const fastCurrent = readOf(storedState({ position_seconds: 100, rate: 2 }));
    expect(
      decide({ current: fastCurrent, body: publishBody({ position_seconds: 120, rate: 2 }), nowMs })
    ).toEqual({ kind: 'unchanged' });
  });

  it.each([
    ['a status change', publishBody({ status: 'paused' })],
    [
      'a different item',
      publishBody({ resource: resource({ ref: { kind: 'item', item_id_text: 'item-two' } }) }),
    ],
    ['a rate change', publishBody({ rate: 1.5 })],
    ['a title change', publishBody({ resource: resource({ title: 'Episode One (Remastered)' }) })],
  ])('%s writes', (_label, body) => {
    const decision = decide({ current: readOf(storedState()), body, nowMs: STORED_AT_MS });

    expect(decision.kind).toBe('write');
  });

  it('while paused, the same position is unchanged and a 5 s seek writes', () => {
    const nowMs = STORED_AT_MS + 30_000;
    const current = readOf(storedState({ status: 'paused', position_seconds: 100 }));

    expect(
      decide({ current, body: publishBody({ status: 'paused', position_seconds: 100 }), nowMs })
    ).toEqual({ kind: 'unchanged' });
    expect(
      decide({ current, body: publishBody({ status: 'paused', position_seconds: 105 }), nowMs })
        .kind
    ).toBe('write');
  });

  it('two live publishes of the same item with null positions are unchanged', () => {
    const current = readOf(
      storedState({ is_live: true, position_seconds: null, duration_seconds: null, rate: 1 })
    );
    const liveBody = publishBody({ is_live: true, position_seconds: null, duration_seconds: null });

    expect(decide({ current, body: liveBody, nowMs: STORED_AT_MS + 10_000 })).toEqual({
      kind: 'unchanged',
    });
  });

  it('a written revision is the larger of the previous revision + 1 and nowMs, and updated_at_ms is nowMs', () => {
    const claim = publishBody({ claim: true });

    const fromLowRevision = writtenState(
      decide({ current: readOf(storedState({ revision: 5 })), body: claim, nowMs: 1_000 })
    );
    expect(fromLowRevision.revision).toBe(1_000);
    expect(fromLowRevision.updated_at_ms).toBe(1_000);

    const fromHighRevision = writtenState(
      decide({ current: readOf(storedState({ revision: 2_000 })), body: claim, nowMs: 1_000 })
    );
    expect(fromHighRevision.revision).toBe(2_001);
    expect(fromHighRevision.updated_at_ms).toBe(1_000);
  });
});

describe('buildPlaybackStateAfterActiveLeft', () => {
  it('turns playing into paused at the last published position with no active device', () => {
    const current = storedState({ status: 'playing', position_seconds: 250 });
    const nowMs = STORED_AT_MS + 60_000;

    expect(buildPlaybackStateAfterActiveLeft({ current, nowMs })).toEqual({
      ...current,
      revision: nowMs,
      active_session_id_text: null,
      status: 'paused',
      position_seconds: 250,
      updated_at_ms: nowMs,
    });
  });
});
