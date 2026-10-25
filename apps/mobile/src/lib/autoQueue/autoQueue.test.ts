import { describe, expect, it } from 'vitest';

import type { AutoQueueConfig } from '@podverse/playback-core/autoQueue';
import { createDefaultAutoQueueConfig } from '@podverse/playback-core/autoQueue';

import { resolveAutoQueueConfigAfterDirective } from './autoQueue';

const configWith = (overrides: Partial<AutoQueueConfig>): AutoQueueConfig => ({
  ...createDefaultAutoQueueConfig(() => 'default-hash'),
  ...overrides,
});

describe('resolveAutoQueueConfigAfterDirective', () => {
  it('starts a fresh channel source on clear and keeps random and repeat', () => {
    const current = configWith({
      disabled: true,
      nextPage: 4,
      playlist_id_text: 'pl-keep-out',
      random: true,
      repeat: true,
      shuffleHash: 'stale-hash',
    });

    const next = resolveAutoQueueConfigAfterDirective(
      current,
      { mode: 'clear' },
      () => 'fresh-hash'
    );

    expect(next).toEqual({
      disabled: false,
      nextPage: 1,
      playlist_id_text: null,
      random: true,
      repeat: true,
      shuffleHash: 'fresh-hash',
    });
  });

  it('points the source at the playlist on seed-playlist with a new shuffle hash', () => {
    const current = configWith({
      disabled: true,
      nextPage: 3,
      random: false,
      repeat: true,
      shuffleHash: 'stale-hash',
    });

    const next = resolveAutoQueueConfigAfterDirective(
      current,
      { mode: 'seed-playlist', playlistIdText: 'pl-1' },
      () => 'fresh-hash'
    );

    expect(next).toEqual({
      disabled: false,
      nextPage: 1,
      playlist_id_text: 'pl-1',
      random: false,
      repeat: true,
      shuffleHash: 'fresh-hash',
    });
  });

  it('keeps the same config on clear-buffer', () => {
    const current = configWith({
      nextPage: 3,
      playlist_id_text: 'pl-1',
      random: false,
      repeat: true,
      shuffleHash: 'kept-hash',
    });

    const next = resolveAutoQueueConfigAfterDirective(
      current,
      { mode: 'clear-buffer' },
      () => 'fresh-hash'
    );

    expect(next).toBe(current);
  });
});
