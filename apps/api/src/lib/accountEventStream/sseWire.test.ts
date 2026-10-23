import { describe, expect, it } from 'vitest';

import {
  formatSseComment,
  formatSseEvent,
  formatSseRetry,
  parseSseLastEventId,
} from './sseWire.js';

describe('sseWire', () => {
  it('formats an event with an id as id, event, and one data line', () => {
    expect(formatSseEvent({ event: 'notification.created', data: { a: 'x\ny' }, id: 42 })).toBe(
      'id: 42\nevent: notification.created\ndata: {"a":"x\\ny"}\n\n'
    );
  });

  it('omits the id line when no id is given', () => {
    expect(formatSseEvent({ event: 'notification.state', data: { unread_count: 3 } })).toBe(
      'event: notification.state\ndata: {"unread_count":3}\n\n'
    );
  });

  it('formats a comment and a retry line', () => {
    expect(formatSseComment('ping')).toBe(': ping\n\n');
    expect(formatSseRetry(5000)).toBe('retry: 5000\n\n');
  });

  it('accepts only positive safe integers as a last event id', () => {
    expect(parseSseLastEventId('100')).toBe(100);
    expect(parseSseLastEventId(' 7 ')).toBe(7);
    expect(parseSseLastEventId('0')).toBeNull();
    expect(parseSseLastEventId('-3')).toBeNull();
    expect(parseSseLastEventId('1.5')).toBeNull();
    expect(parseSseLastEventId('abc')).toBeNull();
    expect(parseSseLastEventId('99999999999999999999')).toBeNull();
    expect(parseSseLastEventId(undefined)).toBeNull();
    expect(parseSseLastEventId(['5'])).toBeNull();
  });
});
