import { canonicalAddByRSSFeedUrl } from '@podverse/helpers-validation/client';

const ADD_BY_RSS_FEED_CHANGED_EVENT = 'podverse:add-by-rss-feed-changed';

type AddByRSSFeedChangedDetail = {
  feedUrl: string;
};

const isAddByRSSFeedChangedDetail = (value: unknown): value is AddByRSSFeedChangedDetail =>
  typeof value === 'object' &&
  value !== null &&
  'feedUrl' in value &&
  typeof value.feedUrl === 'string';

/** The form a feed URL takes in change events: canonical, so listeners compare with `===`. */
export const toAddByRSSFeedChangedUrl = (feedUrl: string): string =>
  canonicalAddByRSSFeedUrl(feedUrl) ?? feedUrl.trim();

/** Tells open pages that this browser's stored copy of a feed changed. */
export const emitAddByRSSFeedChanged = (feedUrl: string): void => {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<AddByRSSFeedChangedDetail>(ADD_BY_RSS_FEED_CHANGED_EVENT, {
      detail: { feedUrl: toAddByRSSFeedChangedUrl(feedUrl) },
    })
  );
};

/** Calls `handler` with the canonical feed URL of every change. Returns the unsubscribe. */
export const onAddByRSSFeedChanged = (handler: (feedUrl: string) => void): (() => void) => {
  if (typeof window === 'undefined') {
    return () => undefined;
  }
  const listener = (event: Event) => {
    if (event instanceof CustomEvent && isAddByRSSFeedChangedDetail(event.detail)) {
      handler(event.detail.feedUrl);
    }
  };
  window.addEventListener(ADD_BY_RSS_FEED_CHANGED_EVENT, listener);
  return () => {
    window.removeEventListener(ADD_BY_RSS_FEED_CHANGED_EVENT, listener);
  };
};
