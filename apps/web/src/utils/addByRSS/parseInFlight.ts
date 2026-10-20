import { toAddByRSSFeedChangedUrl } from './feedChangedEvent';

/**
 * Feeds with a parse already started in this page. Shared by the add flow and the background
 * first-parse so a feed the user just queued is not parsed a second time.
 */
const inFlight = new Set<string>();

/** Records that this page is already parsing `feedUrl`. */
export const markAddByRSSParseInFlight = (feedUrl: string): void => {
  inFlight.add(toAddByRSSFeedChangedUrl(feedUrl));
};

/**
 * Claims the parse slot for `feedUrl`. False when a parse is already in flight, so the caller
 * leaves that parse to finish.
 */
export const claimAddByRSSParseInFlight = (feedUrl: string): boolean => {
  const key = toAddByRSSFeedChangedUrl(feedUrl);
  if (inFlight.has(key)) {
    return false;
  }
  inFlight.add(key);
  return true;
};

/** Lets a later parse start after this one failed before it was queued. */
export const releaseAddByRSSParseInFlight = (feedUrl: string): void => {
  inFlight.delete(toAddByRSSFeedChangedUrl(feedUrl));
};
