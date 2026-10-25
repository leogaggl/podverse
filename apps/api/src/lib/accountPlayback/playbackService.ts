import type { DTOPlaybackSnapshot } from '@podverse/helpers';
import { publishAccountEvents } from '@podverse/orm';

import { buildPlaybackStateAfterActiveLeft, toPlaybackStateDto } from './playbackStatePolicy.js';
import type { PlaybackPresenceResult, StoredPlaybackState } from './playbackStore.js';
import {
  compareAndSetPlaybackState,
  prunePlaybackPresence,
  readPlaybackDevices,
  readPlaybackState,
} from './playbackStore.js';

/**
 * Publishes `playback.devices` with the list read now, not a list from an earlier script, so the
 * event always holds the newest membership and its revision.
 */
export async function publishPlaybackDevices(accountId: number, nowMs: number): Promise<void> {
  const devices = await readPlaybackDevices({ accountId, nowMs });
  await publishAccountEvents([{ account_id: accountId, type: 'playback.devices', data: devices }]);
}

/** Publishes `playback.state`; the hub replaces `sent_at_ms` when it writes to each stream. */
export async function publishPlaybackState(
  accountId: number,
  state: StoredPlaybackState,
  nowMs: number
): Promise<void> {
  await publishAccountEvents([
    { account_id: accountId, type: 'playback.state', data: toPlaybackStateDto(state, nowMs) },
  ]);
}

/**
 * After a prune, touch, or remove reported removals: publish devices, and clear the active slot
 * when its device left.
 *
 * Only the caller whose script removed a member sees it in `removedSessionIdTexts`, so one pod
 * publishes per removal, and the compare-and-set clears the active slot once even when two pods
 * race. A conflict means someone claimed or wrote in between, and that write already fanned out.
 */
export async function handlePlaybackPresenceChange(params: {
  accountId: number;
  result: PlaybackPresenceResult;
  nowMs: number;
}): Promise<void> {
  const { accountId, result, nowMs } = params;
  if (!result.devicesChanged) {
    return;
  }
  await publishPlaybackDevices(accountId, nowMs);
  if (result.removedSessionIdTexts.length === 0) {
    return;
  }

  const current = await readPlaybackState(accountId);
  const activeSessionIdText = current.activeSessionIdText;
  if (
    current.state === null ||
    activeSessionIdText === null ||
    !result.removedSessionIdTexts.includes(activeSessionIdText)
  ) {
    return;
  }

  const state = buildPlaybackStateAfterActiveLeft({ current: current.state, nowMs });
  const write = await compareAndSetPlaybackState({
    accountId,
    expectedRevision: current.revision,
    expectedActive: { kind: 'session', sessionIdText: activeSessionIdText },
    newActiveSessionIdText: null,
    state,
  });
  if (write.kind === 'written') {
    await publishPlaybackState(accountId, state, nowMs);
  }
}

/** Prune (handling any removals), then read devices and state; `sent_at_ms` is `nowMs`. */
export async function readPlaybackSnapshot(params: {
  accountId: number;
  nowMs: number;
}): Promise<DTOPlaybackSnapshot> {
  const { accountId, nowMs } = params;
  const pruned = await prunePlaybackPresence({ accountId, nowMs });
  await handlePlaybackPresenceChange({ accountId, result: pruned, nowMs });

  const [devices, current] = await Promise.all([
    readPlaybackDevices({ accountId, nowMs }),
    readPlaybackState(accountId),
  ]);
  return {
    devices,
    state: current.state === null ? null : toPlaybackStateDto(current.state, nowMs),
  };
}
