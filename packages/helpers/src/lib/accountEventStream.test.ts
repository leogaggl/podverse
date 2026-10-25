import { describe, expect, it } from 'vitest';

import {
  ACCOUNT_NOTIFICATION_STREAM_EVENT,
  ACCOUNT_SESSION_STREAM_EVENT,
  parseAccountNotificationStreamEvent,
  parseAccountSessionStreamEvent,
} from './accountEventStream.js';
import { AUTH_SESSION_ENDED_NOTICES } from './authSessionNotice.js';

const notification = {
  id: 42,
  account_id: 7,
  category: 'new-content',
  is_unread: true,
  title: 'New episode',
  body: 'A new episode is available.',
  link_path: '/episode/ep-1',
  payload: { message_type: 'new-item' },
  created_at: '2026-10-22T19:41:00.000Z',
  expires_at: '2026-11-22T19:41:00.000Z',
};

describe('parseAccountNotificationStreamEvent', () => {
  it('parses a notification state snapshot', () => {
    expect(
      parseAccountNotificationStreamEvent(
        ACCOUNT_NOTIFICATION_STREAM_EVENT.state,
        JSON.stringify({
          unread_count: 3,
          last_read_at: '2026-10-22T18:00:00.000Z',
        })
      )
    ).toEqual({
      type: ACCOUNT_NOTIFICATION_STREAM_EVENT.state,
      data: {
        unread_count: 3,
        last_read_at: '2026-10-22T18:00:00.000Z',
      },
    });

    expect(
      parseAccountNotificationStreamEvent(
        ACCOUNT_NOTIFICATION_STREAM_EVENT.state,
        JSON.stringify({
          unread_count: 0,
          last_read_at: null,
        })
      )
    ).toEqual({
      type: ACCOUNT_NOTIFICATION_STREAM_EVENT.state,
      data: {
        unread_count: 0,
        last_read_at: null,
      },
    });
  });

  it('parses a created notification', () => {
    expect(
      parseAccountNotificationStreamEvent(
        ACCOUNT_NOTIFICATION_STREAM_EVENT.created,
        JSON.stringify({
          notification,
          unread_count: 4,
        })
      )
    ).toEqual({
      type: ACCOUNT_NOTIFICATION_STREAM_EVENT.created,
      data: {
        notification,
        unread_count: 4,
      },
    });
  });

  it('parses mark-all and single-notification read events', () => {
    expect(
      parseAccountNotificationStreamEvent(
        ACCOUNT_NOTIFICATION_STREAM_EVENT.read,
        JSON.stringify({
          scope: 'all',
          last_read_at: '2026-10-22T19:00:00.000Z',
          unread_count: 0,
        })
      )
    ).toEqual({
      type: ACCOUNT_NOTIFICATION_STREAM_EVENT.read,
      data: {
        scope: 'all',
        last_read_at: '2026-10-22T19:00:00.000Z',
        unread_count: 0,
      },
    });

    expect(
      parseAccountNotificationStreamEvent(
        ACCOUNT_NOTIFICATION_STREAM_EVENT.read,
        JSON.stringify({
          scope: 'one',
          notification_id: 42,
          unread_count: 2,
        })
      )
    ).toEqual({
      type: ACCOUNT_NOTIFICATION_STREAM_EVENT.read,
      data: {
        scope: 'one',
        notification_id: 42,
        unread_count: 2,
      },
    });
  });

  it('parses a replay resync signal', () => {
    expect(
      parseAccountNotificationStreamEvent(
        ACCOUNT_NOTIFICATION_STREAM_EVENT.resync,
        JSON.stringify({ reason: 'replay_limit' })
      )
    ).toEqual({
      type: ACCOUNT_NOTIFICATION_STREAM_EVENT.resync,
      data: {
        reason: 'replay_limit',
      },
    });
  });

  it('returns null for an unknown event name', () => {
    expect(
      parseAccountNotificationStreamEvent('playback.progress', JSON.stringify({ position: 12 }))
    ).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(
      parseAccountNotificationStreamEvent(ACCOUNT_NOTIFICATION_STREAM_EVENT.state, '{')
    ).toBeNull();
  });

  it('returns null when a single-notification read event omits notification_id', () => {
    expect(
      parseAccountNotificationStreamEvent(
        ACCOUNT_NOTIFICATION_STREAM_EVENT.read,
        JSON.stringify({
          scope: 'one',
          unread_count: 2,
        })
      )
    ).toBeNull();
  });

  it('returns null when a created event has a negative unread count', () => {
    expect(
      parseAccountNotificationStreamEvent(
        ACCOUNT_NOTIFICATION_STREAM_EVENT.created,
        JSON.stringify({
          notification,
          unread_count: -1,
        })
      )
    ).toBeNull();
  });

  it('returns null for a session.ended event', () => {
    expect(
      parseAccountNotificationStreamEvent(ACCOUNT_SESSION_STREAM_EVENT.ended, '{"notice":null}')
    ).toBeNull();
  });
});

describe('parseAccountSessionStreamEvent', () => {
  it('parses session.ended for each notice and for a null notice', () => {
    for (const notice of [...AUTH_SESSION_ENDED_NOTICES, null]) {
      const rawData = JSON.stringify({ notice });
      expect(parseAccountSessionStreamEvent(ACCOUNT_SESSION_STREAM_EVENT.ended, rawData)).toEqual({
        type: 'session.ended',
        data: { notice },
      });
    }
  });

  it('returns null for an unknown notice, a missing notice, malformed JSON, or another event name', () => {
    expect(
      parseAccountSessionStreamEvent(
        ACCOUNT_SESSION_STREAM_EVENT.ended,
        JSON.stringify({ notice: 'refresh_reuse' })
      )
    ).toBeNull();
    expect(parseAccountSessionStreamEvent(ACCOUNT_SESSION_STREAM_EVENT.ended, '{}')).toBeNull();
    expect(parseAccountSessionStreamEvent(ACCOUNT_SESSION_STREAM_EVENT.ended, '{')).toBeNull();
    expect(
      parseAccountSessionStreamEvent(
        ACCOUNT_NOTIFICATION_STREAM_EVENT.state,
        JSON.stringify({ notice: null })
      )
    ).toBeNull();
  });
});
