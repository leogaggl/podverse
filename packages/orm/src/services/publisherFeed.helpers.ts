/**
 * Pure helpers for artist-album remote-item rows (channel-level podcast:remoteItem
 * without an item_guid): which rows are album references, which feed URLs to look up,
 * and how those references split into verified albums and albums not yet in Podverse.
 */

export type PublisherAlbumRemoteRef = {
  feed_guid: string | null | undefined;
  feed_url: string | null | undefined;
  item_guid: string | null | undefined;
};

export function isPublisherAlbumRemoteRef(ref: PublisherAlbumRemoteRef): boolean {
  if (ref.item_guid) {
    return false;
  }
  const hasGuid = typeof ref.feed_guid === 'string' && ref.feed_guid.trim().length > 0;
  const hasUrl = typeof ref.feed_url === 'string' && ref.feed_url.trim().length > 0;
  return hasGuid || hasUrl;
}

/** Non-empty trimmed feed URLs from album refs that did not match a local channel by guid. */
export function feedUrlsForPublisherAlbumUrlLookup(
  unmatchedAlbumRefs: PublisherAlbumRemoteRef[]
): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const ref of unmatchedAlbumRefs) {
    if (!isPublisherAlbumRemoteRef(ref)) {
      continue;
    }
    const url = typeof ref.feed_url === 'string' ? ref.feed_url.trim() : '';
    if (url.length === 0 || seen.has(url)) {
      continue;
    }
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

export type PublisherAlbumMatchMaps = {
  /** Lowercased trimmed podcast_guid → parsed Podverse channel id. */
  parsedChannelIdByGuid: ReadonlyMap<string, number>;
  /** Trimmed feed URL → parsed Podverse channel id. */
  parsedChannelIdByFeedUrl: ReadonlyMap<string, number>;
};

function albumGuidKey(ref: PublisherAlbumRemoteRef): string {
  return typeof ref.feed_guid === 'string' ? ref.feed_guid.trim().toLowerCase() : '';
}

function albumFeedUrlKey(ref: PublisherAlbumRemoteRef): string {
  return typeof ref.feed_url === 'string' ? ref.feed_url.trim() : '';
}

/**
 * Splits an artist feed's album references (in feed order) into verified albums and albums not
 * yet in Podverse. A reference matching a parsed channel that is not verified is dropped: the
 * album exists but does not name this publisher back.
 */
export function partitionPublisherAlbumRefs<T extends PublisherAlbumRemoteRef>(args: {
  refs: readonly T[];
  matches: PublisherAlbumMatchMaps;
  verifiedAlbumChannelIds: ReadonlySet<number>;
}): { verifiedChannelIds: number[]; notYetAddedRefs: T[] } {
  const verifiedChannelIds: number[] = [];
  const seenVerified = new Set<number>();
  const notYetAddedRefs: T[] = [];
  const seenUnadded = new Set<string>();

  for (const ref of args.refs) {
    if (!isPublisherAlbumRemoteRef(ref)) {
      continue;
    }

    const guid = albumGuidKey(ref);
    const url = albumFeedUrlKey(ref);
    const matchedByGuid =
      guid.length > 0 ? args.matches.parsedChannelIdByGuid.get(guid) : undefined;
    const matchedId =
      matchedByGuid !== undefined
        ? matchedByGuid
        : url.length > 0
          ? args.matches.parsedChannelIdByFeedUrl.get(url)
          : undefined;

    if (matchedId !== undefined) {
      if (args.verifiedAlbumChannelIds.has(matchedId) && !seenVerified.has(matchedId)) {
        seenVerified.add(matchedId);
        verifiedChannelIds.push(matchedId);
      }
      continue;
    }

    const unaddedKey = guid.length > 0 ? `guid:${guid}` : `url:${url}`;
    if (seenUnadded.has(unaddedKey)) {
      continue;
    }
    seenUnadded.add(unaddedKey);
    notYetAddedRefs.push(ref);
  }

  const appendedIds: number[] = [];
  for (const id of args.verifiedAlbumChannelIds) {
    if (!seenVerified.has(id)) {
      appendedIds.push(id);
    }
  }
  appendedIds.sort((left, right) => left - right);
  for (const id of appendedIds) {
    seenVerified.add(id);
    verifiedChannelIds.push(id);
  }

  return { verifiedChannelIds, notYetAddedRefs };
}
