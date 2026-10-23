import { loggerService } from '@api/factories/loggerService.js';
import type { AccountEventSubscription } from '@api/lib/accountEvents/accountEventRedis.js';
import { subscribeAccountEvents } from '@api/lib/accountEvents/accountEventRedis.js';
import { accountNotificationToJson } from '@api/lib/accountNotificationApiSerialization.js';

import type {
  DTOAccountNotificationStreamCreated,
  DTOAccountNotificationStreamRead,
  DTOAccountNotificationStreamResync,
  DTOAccountNotificationStreamState,
} from '@podverse/helpers';
import {
  ACCOUNT_EVENTS_STREAM_HEARTBEAT_MS,
  ACCOUNT_NOTIFICATION_STREAM_EVENT,
  ACCOUNT_NOTIFICATIONS_REPLAY_LIMIT,
} from '@podverse/helpers';
import type { AccountEvent, AccountNotification, AccountNotificationSignal } from '@podverse/orm';
import {
  AccountNotificationService,
  AccountService,
  toAccountNotificationSignal,
} from '@podverse/orm';

import { formatSseComment, formatSseEvent, formatSseRetry } from './sseWire.js';

/**
 * Bounds how long a deleted account, a changed password, or a terms change can keep a stream, and
 * spreads clients across pods after a scale-out.
 */
export const ACCOUNT_EVENT_STREAM_MAX_LIFETIME_MS = 30 * 60_000;

/** Per account, per pod. Web shares one stream across tabs, so this is a guard. */
export const ACCOUNT_EVENT_STREAM_MAX_PER_ACCOUNT = 10;

/** Browser reconnect delay, sent as the first bytes of every stream. */
export const ACCOUNT_EVENT_STREAM_RETRY_MS = 5_000;

/** Delivered notification ids each stream remembers, so a repeated id is not sent twice. */
const RECENT_IDS_LIMIT = 200;

/** The part of an Express response a stream writes to. */
export type AccountEventStreamResponse = {
  readonly writable: boolean;
  readonly writableEnded: boolean;
  write(chunk: string): boolean;
  end(): unknown;
};

export type AccountEventStream = {
  readonly account_id: number;
  readonly response: AccountEventStreamResponse;
  /** This stream's copy of the account's Mark All as Read cutoff. */
  cutoff: Date | null;
  /** Highest notification id this stream has delivered or knows the client has. */
  highWaterId: number;
  readonly recentIds: Set<number>;
  heartbeat: ReturnType<typeof setInterval> | null;
  endTimer: ReturnType<typeof setTimeout> | null;
  closed: boolean;
};

export type AccountEventStreamAdmission = 'open' | 'limit' | 'closed';

const streamsByAccount = new Map<number, Set<AccountEventStream>>();
const chainsByAccount = new Map<number, Promise<void>>();
const loggedUnhandledTypes = new Set<string>();
let subscription: AccountEventSubscription | null = null;
let hubClosed = false;
let accountNotificationService: AccountNotificationService | null = null;
let accountService: AccountService | null = null;

const getAccountNotificationService = (): AccountNotificationService => {
  accountNotificationService ??= new AccountNotificationService();
  return accountNotificationService;
};

const getAccountService = (): AccountService => {
  accountService ??= new AccountService();
  return accountService;
};

const getOpenStreams = (account_id: number): AccountEventStream[] =>
  Array.from(streamsByAccount.get(account_id) ?? []).filter((stream) => !stream.closed);

/**
 * Runs each account's work in arrival order, so two events for one account are delivered in the
 * order they were received even when the first one's queries resolve last.
 */
const enqueueForAccount = (account_id: number, work: () => Promise<void>): void => {
  const previous = chainsByAccount.get(account_id) ?? Promise.resolve();
  const next = previous.then(work).catch((error: unknown) => {
    loggerService.logError('Account event stream delivery failed', error);
  });
  chainsByAccount.set(account_id, next);
  void next.finally(() => {
    if (chainsByAccount.get(account_id) === next) {
      chainsByAccount.delete(account_id);
    }
  });
};

/**
 * A client that is not draining its socket is ended rather than buffered; it reconnects with
 * `Last-Event-ID` and replay covers the gap.
 */
const writeChunk = (stream: AccountEventStream, chunk: string): boolean => {
  if (stream.closed) {
    return false;
  }
  const { response } = stream;
  if (!response.writable || response.writableEnded) {
    closeAccountEventStream(stream);
    return false;
  }
  try {
    if (!response.write(chunk)) {
      closeAccountEventStream(stream);
      return false;
    }
    return true;
  } catch {
    closeAccountEventStream(stream);
    return false;
  }
};

const writeState = (stream: AccountEventStream, unread_count: number): void => {
  const data: DTOAccountNotificationStreamState = {
    unread_count,
    last_read_at: stream.cutoff?.toISOString() ?? null,
  };
  writeChunk(stream, formatSseEvent({ event: ACCOUNT_NOTIFICATION_STREAM_EVENT.state, data }));
};

const writeRead = (stream: AccountEventStream, data: DTOAccountNotificationStreamRead): void => {
  writeChunk(stream, formatSseEvent({ event: ACCOUNT_NOTIFICATION_STREAM_EVENT.read, data }));
};

const rememberDelivered = (stream: AccountEventStream, id: number): void => {
  stream.highWaterId = Math.max(stream.highWaterId, id);
  stream.recentIds.add(id);
  if (stream.recentIds.size > RECENT_IDS_LIMIT) {
    const oldest = stream.recentIds.values().next();
    if (oldest.done !== true) {
      stream.recentIds.delete(oldest.value);
    }
  }
};

const writeCreated = (
  stream: AccountEventStream,
  row: AccountNotification,
  unread_count: number
): void => {
  if (stream.recentIds.has(row.id)) {
    return;
  }
  const data: DTOAccountNotificationStreamCreated = {
    notification: accountNotificationToJson(row, stream.cutoff),
    unread_count,
  };
  const event = ACCOUNT_NOTIFICATION_STREAM_EVENT.created;
  if (writeChunk(stream, formatSseEvent({ event, data, id: row.id }))) {
    rememberDelivered(stream, row.id);
  }
};

/** One count per distinct cutoff for the duration of one piece of work. */
const createUnreadCounter = (account_id: number): ((cutoff: Date | null) => Promise<number>) => {
  const counts = new Map<number | null, Promise<number>>();
  return (cutoff) => {
    const key = cutoff?.getTime() ?? null;
    let count = counts.get(key);
    if (count === undefined) {
      count = getAccountNotificationService().countUnread(account_id, cutoff);
      counts.set(key, count);
    }
    return count;
  };
};

const raiseHighWaterToLatest = async (stream: AccountEventStream): Promise<void> => {
  const maxId = await getAccountNotificationService().getMaxIdForAccount(stream.account_id);
  stream.highWaterId = Math.max(stream.highWaterId, maxId ?? 0);
};

/**
 * Sends every notification after `afterId`, or one `notification.resync` when there are more than
 * the replay limit. Only `notification.created` carries an SSE id, so it is the only event that
 * replays.
 */
const replayAfter = async (
  stream: AccountEventStream,
  afterId: number,
  unread_count: number
): Promise<void> => {
  const rows = await getAccountNotificationService().listForAccountAfterId(
    stream.account_id,
    afterId,
    ACCOUNT_NOTIFICATIONS_REPLAY_LIMIT + 1
  );
  if (rows.length > ACCOUNT_NOTIFICATIONS_REPLAY_LIMIT) {
    const data: DTOAccountNotificationStreamResync = { reason: 'replay_limit' };
    writeChunk(stream, formatSseEvent({ event: ACCOUNT_NOTIFICATION_STREAM_EVENT.resync, data }));
    await raiseHighWaterToLatest(stream);
    return;
  }
  for (const row of rows) {
    writeCreated(stream, row, unread_count);
  }
};

const startStream = async (
  stream: AccountEventStream,
  lastEventId: number | null
): Promise<void> => {
  try {
    const unreadCount = await getAccountNotificationService().countUnread(
      stream.account_id,
      stream.cutoff
    );
    writeState(stream, unreadCount);
    if (lastEventId === null) {
      await raiseHighWaterToLatest(stream);
    } else {
      await replayAfter(stream, lastEventId, unreadCount);
    }
  } catch (error) {
    loggerService.logError('Failed to start account event stream', error);
    closeAccountEventStream(stream);
  }
};

const deliverSignal = async (
  account_id: number,
  signal: AccountNotificationSignal
): Promise<void> => {
  if (getOpenStreams(account_id).length === 0) {
    return;
  }
  const countUnread = createUnreadCounter(account_id);

  switch (signal.kind) {
    case 'created': {
      const ids = signal.pairs.map(([, notification_id]) => notification_id);
      const rows = await getAccountNotificationService().getManyByIdsForAccount(account_id, ids);
      if (rows.length === 0) {
        return;
      }
      const deliveries = await Promise.all(
        getOpenStreams(account_id).map(async (stream) => ({
          stream,
          unreadCount: await countUnread(stream.cutoff),
        }))
      );
      // Rows can commit out of id order across workers, so delivery follows the ids in the event
      // and never filters on the high-water mark.
      for (const { stream, unreadCount } of deliveries) {
        for (const row of rows) {
          writeCreated(stream, row, unreadCount);
        }
      }
      return;
    }
    case 'read_all': {
      const cutoff = new Date(signal.last_read_at);
      if (Number.isNaN(cutoff.getTime())) {
        return;
      }
      for (const stream of getOpenStreams(account_id)) {
        stream.cutoff = cutoff;
      }
      const unreadCount = await countUnread(cutoff);
      for (const stream of getOpenStreams(account_id)) {
        writeRead(stream, {
          scope: 'all',
          last_read_at: signal.last_read_at,
          unread_count: unreadCount,
        });
      }
      return;
    }
    case 'read_one': {
      const deliveries = await Promise.all(
        getOpenStreams(account_id).map(async (stream) => ({
          stream,
          unreadCount: await countUnread(stream.cutoff),
        }))
      );
      for (const { stream, unreadCount } of deliveries) {
        writeRead(stream, {
          scope: 'one',
          notification_id: signal.notification_id,
          unread_count: unreadCount,
        });
      }
      return;
    }
  }
};

/**
 * Events published while this pod's subscriber was disconnected never arrived, including read
 * changes, so each stream replays from its high-water mark and then gets a fresh state snapshot.
 */
const recoverAccount = async (account_id: number): Promise<void> => {
  if (getOpenStreams(account_id).length === 0) {
    return;
  }
  const account = await getAccountService().get(account_id);
  if (account === null) {
    for (const stream of getOpenStreams(account_id)) {
      closeAccountEventStream(stream);
    }
    return;
  }
  const cutoff = account.notifications_last_read_at ?? null;
  for (const stream of getOpenStreams(account_id)) {
    stream.cutoff = cutoff;
  }
  const unreadCount = await getAccountNotificationService().countUnread(account_id, cutoff);
  for (const stream of getOpenStreams(account_id)) {
    await replayAfter(stream, stream.highWaterId, unreadCount);
  }
  for (const stream of getOpenStreams(account_id)) {
    writeState(stream, unreadCount);
  }
};

const handleAccountEvent = (event: AccountEvent): void => {
  if (!streamsByAccount.has(event.account_id)) {
    return;
  }
  const signal = toAccountNotificationSignal(event);
  if (signal === null) {
    // Includes the reserved `playback.*` namespace and notification types newer than this build.
    if (!loggedUnhandledTypes.has(event.type)) {
      loggedUnhandledTypes.add(event.type);
      loggerService.debug('Ignoring account event with no stream handler', { type: event.type });
    }
    return;
  }
  enqueueForAccount(event.account_id, () => deliverSignal(event.account_id, signal));
};

const handleRecovered = (): void => {
  for (const account_id of Array.from(streamsByAccount.keys())) {
    enqueueForAccount(account_id, () => recoverAccount(account_id));
  }
};

const getLifetimeMs = (tokenExpiresAt: number | undefined): number => {
  if (tokenExpiresAt === undefined) {
    return ACCOUNT_EVENT_STREAM_MAX_LIFETIME_MS;
  }
  return Math.max(
    0,
    Math.min(ACCOUNT_EVENT_STREAM_MAX_LIFETIME_MS, tokenExpiresAt * 1000 - Date.now())
  );
};

/** Subscribes this pod to account events. Returns at once; Redis connects in the background. */
export function startAccountEventStreamHub(): void {
  if (subscription !== null) {
    return;
  }
  hubClosed = false;
  subscription = subscribeAccountEvents({
    onEvent: handleAccountEvent,
    onRecovered: handleRecovered,
  });
}

/**
 * Ends every open stream and closes the subscription. Call it before `server.close`, which waits
 * for open connections. Safe to call twice.
 */
export async function closeAccountEventStreamHub(): Promise<void> {
  hubClosed = true;
  for (const streams of Array.from(streamsByAccount.values())) {
    for (const stream of Array.from(streams)) {
      closeAccountEventStream(stream);
    }
  }
  const current = subscription;
  subscription = null;
  if (current !== null) {
    await current.close();
  }
}

export function getAccountEventStreamAdmission(account_id: number): AccountEventStreamAdmission {
  if (hubClosed) {
    return 'closed';
  }
  const openCount = streamsByAccount.get(account_id)?.size ?? 0;
  return openCount >= ACCOUNT_EVENT_STREAM_MAX_PER_ACCOUNT ? 'limit' : 'open';
}

/**
 * Registers a response whose headers are already sent. Writes the retry line at once, then the
 * state snapshot and any replay on the account's queue, ahead of later live events.
 */
export function openAccountEventStream(params: {
  account_id: number;
  response: AccountEventStreamResponse;
  cutoff: Date | null;
  lastEventId: number | null;
  /** Epoch seconds; the stream ends then if that is sooner than the lifetime cap. */
  tokenExpiresAt?: number;
}): AccountEventStream {
  const stream: AccountEventStream = {
    account_id: params.account_id,
    response: params.response,
    cutoff: params.cutoff,
    highWaterId: params.lastEventId ?? 0,
    recentIds: new Set(),
    heartbeat: null,
    endTimer: null,
    closed: false,
  };

  let streams = streamsByAccount.get(params.account_id);
  if (streams === undefined) {
    streams = new Set();
    streamsByAccount.set(params.account_id, streams);
  }
  streams.add(stream);

  stream.heartbeat = setInterval(() => {
    writeChunk(stream, formatSseComment('ping'));
  }, ACCOUNT_EVENTS_STREAM_HEARTBEAT_MS);
  stream.endTimer = setTimeout(() => {
    closeAccountEventStream(stream);
  }, getLifetimeMs(params.tokenExpiresAt));

  if (writeChunk(stream, formatSseRetry(ACCOUNT_EVENT_STREAM_RETRY_MS))) {
    enqueueForAccount(params.account_id, () => startStream(stream, params.lastEventId));
  }
  return stream;
}

/** Ends the response, clears its timers, and removes it from the hub. Safe to call twice. */
export function closeAccountEventStream(stream: AccountEventStream): void {
  if (stream.closed) {
    return;
  }
  stream.closed = true;
  if (stream.heartbeat !== null) {
    clearInterval(stream.heartbeat);
    stream.heartbeat = null;
  }
  if (stream.endTimer !== null) {
    clearTimeout(stream.endTimer);
    stream.endTimer = null;
  }

  const streams = streamsByAccount.get(stream.account_id);
  streams?.delete(stream);
  if (streams?.size === 0) {
    streamsByAccount.delete(stream.account_id);
  }

  if (!stream.response.writableEnded) {
    try {
      stream.response.end();
    } catch {
      // The socket is already gone; there is nothing left to end.
    }
  }
}
