import { describe, expect, it } from 'vitest';

import {
  ACCOUNT_PLAYBACK_STREAM_EVENT,
  isDTOPlaybackCommand,
  isDTOPlaybackCommandEnvelope,
  isDTOPlaybackSnapshot,
  isDTOPlaybackStartFailed,
  isDTOPlaybackState,
  parseAccountPlaybackStreamEvent,
  toPlaybackMedium,
} from './accountPlaybackStream.js';
import { MediumEnum } from './medium.js';

const baseResource = {
  ref: { kind: 'item', item_id_text: 'item-1' },
  medium: MediumEnum.Podcast,
  title: 'Episode title',
  channel_title: 'Podcast title',
  image_url: 'https://cdn.podverse.fm/image.jpg',
} as const;

const baseState = {
  revision: 1,
  active_session_id_text: 'session-1',
  resource: baseResource,
  status: 'paused',
  is_live: false,
  position_seconds: 42,
  duration_seconds: 360,
  rate: 1,
  updated_at_ms: 1_700_000_000_000,
  sent_at_ms: 1_700_000_000_250,
} as const;

const baseDevices = {
  revision: 1,
  devices: [
    {
      session_id_text: 'session-1',
      client_type: 'web',
      device_label: 'MacBook Pro',
      session_created_at: '2026-10-25T05:10:00.000Z',
    },
  ],
} as const;

describe('parseAccountPlaybackStreamEvent', () => {
  it('parses each supported playback event', () => {
    const snapshot = {
      devices: baseDevices,
      state: baseState,
    };
    expect(
      parseAccountPlaybackStreamEvent(
        ACCOUNT_PLAYBACK_STREAM_EVENT.snapshot,
        JSON.stringify(snapshot)
      )
    ).toEqual({
      type: ACCOUNT_PLAYBACK_STREAM_EVENT.snapshot,
      data: snapshot,
    });

    expect(
      parseAccountPlaybackStreamEvent(
        ACCOUNT_PLAYBACK_STREAM_EVENT.state,
        JSON.stringify(baseState)
      )
    ).toEqual({
      type: ACCOUNT_PLAYBACK_STREAM_EVENT.state,
      data: baseState,
    });

    expect(
      parseAccountPlaybackStreamEvent(
        ACCOUNT_PLAYBACK_STREAM_EVENT.devices,
        JSON.stringify(baseDevices)
      )
    ).toEqual({
      type: ACCOUNT_PLAYBACK_STREAM_EVENT.devices,
      data: baseDevices,
    });

    const commandEnvelope = {
      command_id: 'command-1',
      sender_session_id_text: 'session-1',
      target_session_id_text: 'session-2',
      issued_at_ms: 1_700_000_000_000,
      expires_at_ms: 1_700_000_005_000,
      command: { type: 'next' },
      state: null,
    };
    expect(
      parseAccountPlaybackStreamEvent(
        ACCOUNT_PLAYBACK_STREAM_EVENT.command,
        JSON.stringify(commandEnvelope)
      )
    ).toEqual({
      type: ACCOUNT_PLAYBACK_STREAM_EVENT.command,
      data: commandEnvelope,
    });

    const startFailed = {
      command_id: 'command-1',
      sender_session_id_text: 'session-1',
      target_session_id_text: 'session-2',
      reason: 'autoplay_blocked',
    };
    expect(
      parseAccountPlaybackStreamEvent(
        ACCOUNT_PLAYBACK_STREAM_EVENT.startFailed,
        JSON.stringify(startFailed)
      )
    ).toEqual({
      type: ACCOUNT_PLAYBACK_STREAM_EVENT.startFailed,
      data: startFailed,
    });
  });

  it('returns null for unknown names, invalid json, and empty data strings', () => {
    expect(
      parseAccountPlaybackStreamEvent('notification.state', JSON.stringify({ unread_count: 1 }))
    ).toBeNull();
    expect(
      parseAccountPlaybackStreamEvent('playback.progress', JSON.stringify({ position_seconds: 1 }))
    ).toBeNull();
    expect(parseAccountPlaybackStreamEvent(ACCOUNT_PLAYBACK_STREAM_EVENT.state, '{')).toBeNull();
    expect(parseAccountPlaybackStreamEvent(ACCOUNT_PLAYBACK_STREAM_EVENT.state, '')).toBeNull();
  });
});

describe('isDTOPlaybackState', () => {
  it('enforces live-state and null-resource invariants', () => {
    expect(
      isDTOPlaybackState({
        ...baseState,
        is_live: true,
        position_seconds: 12,
        duration_seconds: null,
        rate: 1,
      })
    ).toBe(false);
    expect(
      isDTOPlaybackState({
        ...baseState,
        is_live: true,
        position_seconds: null,
        duration_seconds: null,
        rate: 1.5,
      })
    ).toBe(false);
    expect(
      isDTOPlaybackState({
        ...baseState,
        resource: null,
        status: 'playing',
        position_seconds: null,
      })
    ).toBe(false);
  });

  it('accepts valid paused item state and rejects out-of-range rate', () => {
    expect(isDTOPlaybackState(baseState)).toBe(true);
    expect(isDTOPlaybackState({ ...baseState, rate: 0.25 })).toBe(false);
    expect(isDTOPlaybackState({ ...baseState, rate: 3.5 })).toBe(false);
  });

  it('allows unknown extra properties', () => {
    expect(isDTOPlaybackState({ ...baseState, unknown_field: 'ok' })).toBe(true);
  });
});

describe('isDTOPlaybackCommand', () => {
  it('accepts all supported command types', () => {
    expect(isDTOPlaybackCommand({ type: 'play' })).toBe(true);
    expect(isDTOPlaybackCommand({ type: 'pause' })).toBe(true);
    expect(isDTOPlaybackCommand({ type: 'seek', position_seconds: 12 })).toBe(true);
    expect(isDTOPlaybackCommand({ type: 'set_rate', rate: 1.25 })).toBe(true);
    expect(isDTOPlaybackCommand({ type: 'next' })).toBe(true);
    expect(isDTOPlaybackCommand({ type: 'previous' })).toBe(true);
    expect(
      isDTOPlaybackCommand({
        type: 'play_item',
        resource: { kind: 'item', item_id_text: 'item-1' },
        add_by_rss_resource_data: null,
        start_seconds: 0,
      })
    ).toBe(true);
    expect(isDTOPlaybackCommand({ type: 'take_over' })).toBe(true);
  });

  it('rejects invalid command payloads and unsupported command names', () => {
    expect(isDTOPlaybackCommand({ type: 'seek', position_seconds: -1 })).toBe(false);
    expect(
      isDTOPlaybackCommand({
        type: 'play_item',
        resource: { kind: 'add_by_rss', add_by_rss_hash_id: 'hash-1' },
        add_by_rss_resource_data: null,
        start_seconds: null,
      })
    ).toBe(false);
    expect(
      isDTOPlaybackCommand({
        type: 'play_item',
        resource: { kind: 'item', item_id_text: 'item-1' },
        add_by_rss_resource_data: { title: 'Should be null for item kind' },
        start_seconds: 5,
      })
    ).toBe(false);
    expect(isDTOPlaybackCommand({ type: 'toggle' })).toBe(false);
    expect(isDTOPlaybackCommand({ type: 'next_chapter' })).toBe(false);
  });
});

describe('isDTOPlaybackCommandEnvelope', () => {
  it('enforces state coupling for take_over and non-take_over commands', () => {
    expect(
      isDTOPlaybackCommandEnvelope({
        command_id: 'command-1',
        sender_session_id_text: 'session-1',
        target_session_id_text: 'session-2',
        issued_at_ms: 10,
        expires_at_ms: 20,
        command: { type: 'take_over' },
        state: null,
      })
    ).toBe(false);
    expect(
      isDTOPlaybackCommandEnvelope({
        command_id: 'command-1',
        sender_session_id_text: 'session-1',
        target_session_id_text: 'session-2',
        issued_at_ms: 10,
        expires_at_ms: 20,
        command: { type: 'pause' },
        state: baseState,
      })
    ).toBe(false);
    expect(
      isDTOPlaybackCommandEnvelope({
        command_id: 'command-1',
        sender_session_id_text: 'session-1',
        target_session_id_text: 'session-2',
        issued_at_ms: 10,
        expires_at_ms: 20,
        command: { type: 'next' },
        state: null,
      })
    ).toBe(true);
    expect(
      isDTOPlaybackCommandEnvelope({
        command_id: 'command-1',
        sender_session_id_text: 'session-1',
        target_session_id_text: 'session-2',
        issued_at_ms: 10,
        expires_at_ms: 20,
        command: { type: 'next' },
        state: baseState,
      })
    ).toBe(false);
  });

  it('requires expires_at_ms to be greater than issued_at_ms', () => {
    expect(
      isDTOPlaybackCommandEnvelope({
        command_id: 'command-1',
        sender_session_id_text: 'session-1',
        target_session_id_text: 'session-2',
        issued_at_ms: 10,
        expires_at_ms: 10,
        command: { type: 'pause' },
        state: null,
      })
    ).toBe(false);
  });
});

describe('resource medium validation', () => {
  it('requires a valid MediumEnum value in the resource summary and state resource', () => {
    expect(
      isDTOPlaybackState({
        ...baseState,
        resource: {
          ...baseResource,
          medium: MediumEnum.Music,
        },
      })
    ).toBe(true);

    const { medium: removedMedium, ...resourceWithoutMedium } = baseResource;
    expect(removedMedium).toBe(MediumEnum.Podcast);

    expect(
      isDTOPlaybackState({
        ...baseState,
        resource: resourceWithoutMedium,
      })
    ).toBe(false);
    expect(isDTOPlaybackState({ ...baseState, resource: { ...baseResource, medium: null } })).toBe(
      false
    );
    expect(isDTOPlaybackState({ ...baseState, resource: { ...baseResource, medium: '3' } })).toBe(
      false
    );
    expect(isDTOPlaybackState({ ...baseState, resource: { ...baseResource, medium: 2.5 } })).toBe(
      false
    );
    expect(isDTOPlaybackState({ ...baseState, resource: { ...baseResource, medium: 999 } })).toBe(
      false
    );
  });
});

describe('toPlaybackMedium', () => {
  it('returns valid enum values unchanged and falls back to podcast', () => {
    expect(toPlaybackMedium(MediumEnum.Video)).toBe(MediumEnum.Video);
    expect(toPlaybackMedium(undefined)).toBe(MediumEnum.Podcast);
    expect(toPlaybackMedium(null)).toBe(MediumEnum.Podcast);
    expect(toPlaybackMedium('3')).toBe(MediumEnum.Podcast);
    expect(toPlaybackMedium(999)).toBe(MediumEnum.Podcast);
  });
});

describe('isDTOPlaybackStartFailed', () => {
  it('rejects unknown reasons', () => {
    expect(
      isDTOPlaybackStartFailed({
        command_id: 'command-1',
        sender_session_id_text: 'session-1',
        target_session_id_text: 'session-2',
        reason: 'unknown_reason',
      })
    ).toBe(false);
  });
});

describe('isDTOPlaybackSnapshot', () => {
  it('accepts empty device list with null state and rejects invalid state payload', () => {
    expect(
      isDTOPlaybackSnapshot({
        devices: {
          revision: 1,
          devices: [],
        },
        state: null,
      })
    ).toBe(true);
    expect(
      isDTOPlaybackSnapshot({
        devices: baseDevices,
        state: {
          ...baseState,
          rate: 3.5,
        },
      })
    ).toBe(false);
  });
});
