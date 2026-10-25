import { describe, expect, it } from 'vitest';

import { createPlaybackCommandInbox } from './playbackCommandInbox';

describe('createPlaybackCommandInbox', () => {
  it('rejects a repeated command id', () => {
    const inbox = createPlaybackCommandInbox();

    expect(inbox.accept('command-1')).toBe(true);
    expect(inbox.accept('command-1')).toBe(false);
    expect(inbox.accept('command-2')).toBe(true);
  });

  it('accepts the oldest id again once the inbox is past capacity', () => {
    const inbox = createPlaybackCommandInbox({ capacity: 2 });

    expect(inbox.accept('a')).toBe(true);
    expect(inbox.accept('b')).toBe(true);
    expect(inbox.accept('c')).toBe(true);
    expect(inbox.accept('a')).toBe(true);
    expect(inbox.accept('c')).toBe(false);
  });

  it('forgets the oldest id after the default capacity of 200', () => {
    const inbox = createPlaybackCommandInbox();

    for (let index = 0; index < 200; index += 1) {
      expect(inbox.accept(String(index))).toBe(true);
    }

    expect(inbox.accept('0')).toBe(false);
    expect(inbox.accept('200')).toBe(true);
    expect(inbox.accept('0')).toBe(true);
    expect(inbox.accept('1')).toBe(true);
  });
});
