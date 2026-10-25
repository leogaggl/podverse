import { describe, expect, it } from 'vitest';

import type { DTOPlaybackResourceRef } from '@podverse/helpers';

import type { PlaybackRowIdentity } from './remotePlaybackRowMatch';
import { matchesRemotePlaybackResource } from './remotePlaybackRowMatch';

function identity(overrides: Partial<PlaybackRowIdentity> = {}): PlaybackRowIdentity {
  return {
    itemIdText: null,
    chapterIdText: null,
    clipIdText: null,
    soundbiteIdText: null,
    addByRSSHashIds: null,
    ...overrides,
  };
}

const itemRef: DTOPlaybackResourceRef = { kind: 'item', item_id_text: 'item-1' };

describe('matchesRemotePlaybackResource', () => {
  it('matches an item row to its item and not to a clip of that item', () => {
    const row = identity({ itemIdText: 'item-1' });
    expect(matchesRemotePlaybackResource(itemRef, row, null)).toBe(true);
    expect(matchesRemotePlaybackResource(itemRef, row, 'ch-1')).toBe(true);
    expect(matchesRemotePlaybackResource({ kind: 'item', item_id_text: 'item-2' }, row, null)).toBe(
      false
    );
    expect(
      matchesRemotePlaybackResource({ kind: 'clip', clip_id_text: 'clip-of-item-1' }, row, null)
    ).toBe(false);
  });

  it('matches a clip row only to its clip and a soundbite row only to its soundbite', () => {
    const clipRow = identity({ itemIdText: 'item-1', clipIdText: 'clip-1' });
    expect(
      matchesRemotePlaybackResource({ kind: 'clip', clip_id_text: 'clip-1' }, clipRow, null)
    ).toBe(true);
    expect(
      matchesRemotePlaybackResource({ kind: 'clip', clip_id_text: 'clip-2' }, clipRow, null)
    ).toBe(false);
    expect(matchesRemotePlaybackResource(itemRef, clipRow, null)).toBe(false);

    const soundbiteRow = identity({ itemIdText: 'item-1', soundbiteIdText: 'sb-1' });
    expect(
      matchesRemotePlaybackResource(
        { kind: 'soundbite', item_soundbite_id_text: 'sb-1' },
        soundbiteRow,
        null
      )
    ).toBe(true);
    expect(
      matchesRemotePlaybackResource(
        { kind: 'soundbite', item_soundbite_id_text: 'sb-2' },
        soundbiteRow,
        null
      )
    ).toBe(false);
    expect(matchesRemotePlaybackResource(itemRef, soundbiteRow, null)).toBe(false);
  });

  it('matches a chapter row when the active chapter id equals its id', () => {
    const row = identity({ itemIdText: 'item-1', chapterIdText: 'ch-2' });
    expect(matchesRemotePlaybackResource(itemRef, row, 'ch-2')).toBe(true);
    expect(matchesRemotePlaybackResource(itemRef, row, 'ch-1')).toBe(false);
    expect(matchesRemotePlaybackResource(itemRef, row, null)).toBe(false);
    expect(matchesRemotePlaybackResource({ kind: 'clip', clip_id_text: 'ch-2' }, row, 'ch-2')).toBe(
      false
    );
  });

  it('matches an Add by RSS row when the ref hash is the legacy entry of its list', () => {
    const row = identity({ addByRSSHashIds: ['feed-hash', 'legacy-hash'] });
    expect(
      matchesRemotePlaybackResource(
        { kind: 'add_by_rss', add_by_rss_hash_id: 'legacy-hash' },
        row,
        null
      )
    ).toBe(true);
    expect(
      matchesRemotePlaybackResource(
        { kind: 'add_by_rss', add_by_rss_hash_id: 'other-hash' },
        row,
        null
      )
    ).toBe(false);
  });

  it('returns false when the row has no ids', () => {
    expect(matchesRemotePlaybackResource(itemRef, identity(), null)).toBe(false);
  });
});
