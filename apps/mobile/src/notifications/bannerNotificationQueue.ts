import type { DTOAccountNotification } from '@podverse/helpers';

/** How long the visible card stays before it leaves on its own. */
export const BANNER_NOTIFICATION_VISIBLE_MS = 5_000;

/** Waiting cards behind the one on screen. A further arrival drops the oldest. */
export const BANNER_NOTIFICATION_WAITING_LIMIT = 3;

export type BannerNotificationQueueItem = {
  id: number;
  title: string;
  body: string | null;
  notification: DTOAccountNotification;
};

export type BannerNotificationQueueState = {
  visible: BannerNotificationQueueItem | null;
  waiting: readonly BannerNotificationQueueItem[];
};

export const EMPTY_BANNER_NOTIFICATION_QUEUE: BannerNotificationQueueState = {
  visible: null,
  waiting: [],
};

const isQueued = (state: BannerNotificationQueueState, id: number): boolean => {
  if (state.visible !== null && state.visible.id === id) {
    return true;
  }
  return state.waiting.some((item) => item.id === id);
};

/**
 * One card is visible. Up to three more wait, in arrival order. A further arrival drops the
 * oldest waiting card and keeps the newest. An arrival never replaces the card on screen.
 * An id that is already visible or waiting leaves the state untouched.
 */
export function enqueueBannerNotification(
  state: BannerNotificationQueueState,
  item: BannerNotificationQueueItem
): BannerNotificationQueueState {
  if (isQueued(state, item.id)) {
    return state;
  }
  if (state.visible === null) {
    return { visible: item, waiting: state.waiting };
  }
  if (state.waiting.length < BANNER_NOTIFICATION_WAITING_LIMIT) {
    return { visible: state.visible, waiting: [...state.waiting, item] };
  }
  return {
    visible: state.visible,
    waiting: [...state.waiting.slice(1), item],
  };
}

/** The next waiting card becomes visible. An empty queue is returned unchanged. */
export function dismissVisibleBannerNotification(
  state: BannerNotificationQueueState
): BannerNotificationQueueState {
  if (state.visible === null) {
    return state;
  }
  const next = state.waiting[0];
  if (next === undefined) {
    return { visible: null, waiting: state.waiting };
  }
  return {
    visible: next,
    waiting: state.waiting.slice(1),
  };
}

/**
 * Removing the visible id promotes the next waiting card. Removing a waiting id keeps the
 * others in order. An unknown id leaves the state untouched.
 */
export function removeBannerNotification(
  state: BannerNotificationQueueState,
  id: number
): BannerNotificationQueueState {
  if (state.visible !== null && state.visible.id === id) {
    return dismissVisibleBannerNotification(state);
  }
  if (!state.waiting.some((item) => item.id === id)) {
    return state;
  }
  return {
    visible: state.visible,
    waiting: state.waiting.filter((item) => item.id !== id),
  };
}

export function clearBannerNotificationQueue(): BannerNotificationQueueState {
  return EMPTY_BANNER_NOTIFICATION_QUEUE;
}
