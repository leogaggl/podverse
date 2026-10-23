/**
 * Decides which publisher feeds a content feed (an album today) is verified to belong to. A link
 * needs both feeds to reference each other: the content feed's podcast:publisher names the
 * publisher's guid, and the publisher feed's podcast:remoteItem names the content feed's guid.
 * When either pointer carries a feedUrl, it must match the other feed's URLs, so a feed that
 * squats a real publisher's guid cannot claim its albums. No network and no database; feed
 * lifecycle is checked by the caller before feeds reach this module.
 */

import { parseHttpOrHttpsUrl } from '@podverse/helpers-validation';

export type PublisherClaim = {
  feedGuid: string;
  feedUrl: string | null;
  /** The itemGuid attribute inside podcast:publisher. A valid claim has none. */
  itemGuid: string | null;
  /** The content item whose own podcast:publisher made the claim; null at channel level. */
  itemId: number | null;
  /** That item's guid, read with the claim. Null when itemId is null or the item is gone. */
  claimItemGuid: string | null;
};

export type ClaimantFeed = {
  channelId: number;
  podcastGuid: string | null;
  feedUrls: readonly string[];
  /** In channel_publisher_remote_item id order. */
  claims: readonly PublisherClaim[];
};

export type PublisherRemoteItemRef = {
  feedGuid: string;
  feedUrl: string | null;
  itemGuid: string | null;
};

export type PublisherFeedRefs = {
  channelId: number;
  podcastGuid: string | null;
  feedUrls: readonly string[];
  /** The publisher's remote items that name the claimant's guid. */
  remoteItems: readonly PublisherRemoteItemRef[];
};

export type VerifiedPublisherLinkRow = {
  publisherChannelId: number;
  itemId: number | null;
  claimPosition: number;
};

/** `channel_verified_publisher.claim_position` is a smallint. */
const MAX_CLAIM_POSITION = 32767;

/**
 * The part of a feed URL two references must share to name the same feed: host (lowercased),
 * a non-default port, the path without one trailing slash, and the query string as is. The
 * scheme, userinfo, and fragment are ignored. The query is kept because two feeds on one host
 * can differ only by query. Returns null for a URL that is not http(s).
 */
export function feedUrlMatchKey(url: string): string | null {
  const parsed = parseHttpOrHttpsUrl(url);
  if (parsed === null) {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  const port = parsed.port === '' ? '' : `:${parsed.port}`;
  const path =
    parsed.pathname.length > 1 && parsed.pathname.endsWith('/')
      ? parsed.pathname.slice(0, -1)
      : parsed.pathname;
  return `${host}${port}${path}${parsed.search}`;
}

export function feedUrlMatchesAny(url: string, urls: readonly string[]): boolean {
  const key = feedUrlMatchKey(url);
  if (key === null) {
    return false;
  }
  return urls.some((candidate) => feedUrlMatchKey(candidate) === key);
}

function normalizedGuid(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  return trimmed === '' ? null : trimmed;
}

function presentUrl(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function scopeKey(itemId: number | null): string {
  return itemId === null ? 'channel' : `item:${itemId}`;
}

function publisherListsClaimant(
  publisher: PublisherFeedRefs,
  claimantGuid: string,
  claimantFeedUrls: readonly string[],
  claimedItemGuid: string | null
): boolean {
  return publisher.remoteItems.some((remoteItem) => {
    if (normalizedGuid(remoteItem.feedGuid) !== claimantGuid) {
      return false;
    }
    if (normalizedGuid(remoteItem.itemGuid) !== claimedItemGuid) {
      return false;
    }
    const remoteFeedUrl = presentUrl(remoteItem.feedUrl);
    return remoteFeedUrl === null || feedUrlMatchesAny(remoteFeedUrl, claimantFeedUrls);
  });
}

/**
 * Verified links for one content feed, in claim order and unique by publisher and item. A
 * claim's position is its index among the claimant's claims in the same scope (channel level,
 * or one item), counting claims that do not verify. A publisher claimed twice in one scope keeps
 * its lowest position. Medium is not checked on either side.
 */
export function computeVerifiedPublisherLinks(
  claimant: ClaimantFeed,
  publishers: readonly PublisherFeedRefs[]
): VerifiedPublisherLinkRow[] {
  const claimantGuid = normalizedGuid(claimant.podcastGuid);
  if (claimantGuid === null) {
    return [];
  }

  const positionByScope = new Map<string, number>();
  const linked = new Set<string>();
  const rows: VerifiedPublisherLinkRow[] = [];

  for (const claim of claimant.claims) {
    const scope = scopeKey(claim.itemId);
    const claimPosition = positionByScope.get(scope) ?? 0;
    positionByScope.set(scope, claimPosition + 1);

    if (claimPosition > MAX_CLAIM_POSITION || normalizedGuid(claim.itemGuid) !== null) {
      continue;
    }
    const claimGuid = normalizedGuid(claim.feedGuid);
    if (claimGuid === null) {
      continue;
    }
    let claimedItemGuid: string | null = null;
    if (claim.itemId !== null) {
      claimedItemGuid = normalizedGuid(claim.claimItemGuid);
      if (claimedItemGuid === null) {
        continue;
      }
    }
    const claimFeedUrl = presentUrl(claim.feedUrl);

    for (const publisher of publishers) {
      if (publisher.channelId === claimant.channelId) {
        continue;
      }
      if (normalizedGuid(publisher.podcastGuid) !== claimGuid) {
        continue;
      }
      if (claimFeedUrl !== null && !feedUrlMatchesAny(claimFeedUrl, publisher.feedUrls)) {
        continue;
      }
      if (!publisherListsClaimant(publisher, claimantGuid, claimant.feedUrls, claimedItemGuid)) {
        continue;
      }
      const linkKey = `${publisher.channelId}|${scope}`;
      if (linked.has(linkKey)) {
        continue;
      }
      linked.add(linkKey);
      rows.push({ publisherChannelId: publisher.channelId, itemId: claim.itemId, claimPosition });
    }
  }

  return rows;
}
