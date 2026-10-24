import { describe, expect, it } from 'vitest';

import { createSseEventParser } from './sseEventParser';

describe('createSseEventParser', () => {
  it('buffers an event split across three chunks, including a split CRLF', () => {
    const parser = createSseEventParser();

    expect(parser.push('event: notification.st')).toEqual([]);
    expect(parser.push('ate\r\ndata: {"unread_count":2}\r')).toEqual([]);
    expect(parser.push('\n\r\n')).toEqual([
      { kind: 'event', event: 'notification.state', data: '{"unread_count":2}', id: null },
    ]);
  });

  it('accepts bare CR line endings', () => {
    const parser = createSseEventParser();

    expect(parser.push('data: one\r\r')).toEqual([
      { kind: 'event', event: 'message', data: 'one', id: null },
    ]);
  });

  it('joins two data lines with a line feed', () => {
    const parser = createSseEventParser();

    expect(parser.push('data: first\ndata: second\n\n')).toEqual([
      { kind: 'event', event: 'message', data: 'first\nsecond', id: null },
    ]);
  });

  it('yields a comment for a line that starts with a colon', () => {
    const parser = createSseEventParser();

    expect(parser.push(': ping\n')).toEqual([{ kind: 'comment' }]);
  });

  it('yields a retry for a digits-only value and ignores any other value', () => {
    const parser = createSseEventParser();

    expect(parser.push('retry: 5000\n')).toEqual([{ kind: 'retry', ms: 5000 }]);
    expect(parser.push('retry: soon\n')).toEqual([]);
  });

  it('dispatches nothing for a blank line with no data, and drops the pending event name', () => {
    const parser = createSseEventParser();

    expect(parser.push('event: notification.state\n\n')).toEqual([]);
    expect(parser.push('data: x\n\n')).toEqual([
      { kind: 'event', event: 'message', data: 'x', id: null },
    ]);
  });

  it('attaches an id to its own event only', () => {
    const parser = createSseEventParser();

    expect(
      parser.push(
        'id: 41\nevent: notification.created\ndata: {}\n\nevent: notification.read\ndata: {}\n\n'
      )
    ).toEqual([
      { kind: 'event', event: 'notification.created', data: '{}', id: '41' },
      { kind: 'event', event: 'notification.read', data: '{}', id: null },
    ]);
  });
});
