import type { DTOPlaybackResourceRef } from '@podverse/helpers';

/** Ids a list row or detail header can carry. Null means this row is not that kind. */
export type PlaybackRowIdentity = {
  itemIdText: string | null;
  chapterIdText: string | null;
  clipIdText: string | null;
  soundbiteIdText: string | null;
  /** Feed form, then the legacy form. Null when the row is not Add by RSS. */
  addByRSSHashIds: readonly string[] | null;
};

/**
 * Whether `ref` is the resource this row represents. The first non-null id wins, in the same
 * order list and detail play buttons use for the local player.
 */
export function matchesRemotePlaybackResource(
  ref: DTOPlaybackResourceRef,
  identity: PlaybackRowIdentity,
  activeChapterIdText: string | null
): boolean {
  const { addByRSSHashIds, chapterIdText, soundbiteIdText, clipIdText, itemIdText } = identity;

  if (addByRSSHashIds !== null) {
    return ref.kind === 'add_by_rss' && addByRSSHashIds.includes(ref.add_by_rss_hash_id);
  }
  if (chapterIdText !== null) {
    return ref.kind === 'item' && activeChapterIdText === chapterIdText;
  }
  if (soundbiteIdText !== null) {
    return ref.kind === 'soundbite' && ref.item_soundbite_id_text === soundbiteIdText;
  }
  if (clipIdText !== null) {
    return ref.kind === 'clip' && ref.clip_id_text === clipIdText;
  }
  if (itemIdText !== null) {
    return ref.kind === 'item' && ref.item_id_text === itemIdText;
  }
  return false;
}
