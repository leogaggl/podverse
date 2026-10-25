import { describe, expect, it } from 'vitest';

import type { DTOPlaybackState } from '@podverse/helpers';
import { MediumEnum } from '@podverse/helpers';

import { resolveTakeOverStart } from './resolveTakeOverStart';

const RESOURCE = {
  ref: { kind: 'item' as const, item_id_text: 'item-1' },
  medium: MediumEnum.Podcast,
  title: 'Episode Title',
  channel_title: 'Channel Title',
  image_url: null,
};

const NOW_MS = 100_000;
const TEN_SECONDS_AGO_MS = NOW_MS - 10_000;

function state(overrides: Partial<DTOPlaybackState> = {}): DTOPlaybackState {
  return {
    revision: 1,
    active_session_id_text: 'session-other',
    resource: RESOURCE,
    status: 'playing',
    is_live: false,
    position_seconds: 100,
    duration_seconds: 600,
    rate: 1,
    updated_at_ms: 5_000,
    sent_at_ms: 5_000,
    ...overrides,
  };
}

describe('resolveTakeOverStart', () => {
  it('starts a playing state received 10 seconds ago at rate 1.5 fifteen seconds further on', () => {
    expect(
      resolveTakeOverStart({
        state: state({ rate: 1.5 }),
        receivedAtMs: TEN_SECONDS_AGO_MS,
        nowMs: NOW_MS,
      })
    ).toEqual({ resource: RESOURCE.ref, startSeconds: 115, rate: 1.5 });
  });

  it('starts a livestream at its live point with no speed', () => {
    expect(
      resolveTakeOverStart({
        state: state({ is_live: true, position_seconds: null, duration_seconds: null }),
        receivedAtMs: TEN_SECONDS_AGO_MS,
        nowMs: NOW_MS,
      })
    ).toEqual({ resource: RESOURCE.ref, startSeconds: null, rate: null });
  });

  it('carries the speed over as the nearest web speed', () => {
    expect(
      resolveTakeOverStart({ state: state({ rate: 1.1 }), receivedAtMs: NOW_MS, nowMs: NOW_MS })
        ?.rate
    ).toBe(1.12);
  });

  it('returns null when nothing is loaded', () => {
    expect(
      resolveTakeOverStart({
        state: state({ resource: null }),
        receivedAtMs: NOW_MS,
        nowMs: NOW_MS,
      })
    ).toBeNull();
  });

  it('clamps the estimate only to the shared duration', () => {
    expect(
      resolveTakeOverStart({
        state: state({ position_seconds: 595, duration_seconds: 600 }),
        receivedAtMs: TEN_SECONDS_AGO_MS,
        nowMs: NOW_MS,
      })?.startSeconds
    ).toBe(600);
  });
});
