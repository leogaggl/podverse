import { extractAddByRSSHashInput, getAddByRSSHashId } from '@podverse/helpers';

export type PlaybackHandoffLocalState = {
  itemIdText: string;
  itemTitle: string | null;
  lastPlayedAt: string | null;
};

let playbackHandoffLocalState: PlaybackHandoffLocalState | null = null;

const normalize = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

/**
 * The identity an Add by RSS episode carries in the handoff record and in every queue head
 * comparison: its Add by RSS hash, which is the same on every device for feed-form payloads.
 * Queue rows, the loaded player, and the play hook all derive it here so they cannot disagree.
 * A server row passes its stored `add_by_rss_hash_id`; it wins over hashing the payload.
 */
export const addByRSSPlaybackIdentity = (
  resourceData: Record<string, unknown> | null | undefined,
  storedHashId?: string | null
): string | null => {
  const stored = normalize(storedHashId);
  if (stored !== null) {
    return stored;
  }
  if (!resourceData || Object.keys(extractAddByRSSHashInput(resourceData)).length === 0) {
    return null;
  }
  return getAddByRSSHashId(resourceData);
};

export const readPlaybackHandoffLocalState = (): PlaybackHandoffLocalState | null =>
  playbackHandoffLocalState;

export const clearPlaybackHandoffLocalState = (): void => {
  playbackHandoffLocalState = null;
};

export const writePlaybackHandoffLocalState = ({
  itemIdText,
  itemTitle,
  lastPlayedAt,
}: {
  itemIdText: string | null | undefined;
  itemTitle: string | null | undefined;
  lastPlayedAt: string | null | undefined;
}): void => {
  const resolvedItemIdText = normalize(itemIdText);
  if (resolvedItemIdText === null) {
    return;
  }

  playbackHandoffLocalState = {
    itemIdText: resolvedItemIdText,
    itemTitle: normalize(itemTitle),
    lastPlayedAt: normalize(lastPlayedAt),
  };
};
