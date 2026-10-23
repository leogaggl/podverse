import { AppDataSourceRead } from '@orm/db/index.js';
import { Channel } from '@orm/entities/channel/channel.js';
import { FeedLifecycleStateKeyEnum } from '@orm/entities/feed/feedLifecycleStateType.js';
import { deriveHttpsAndHttpUrlsFromInput } from '@orm/services/feed/feed.helpers.js';
import type { FindOptionsRelations, Repository } from 'typeorm';
import { In, IsNull, Not } from 'typeorm';

import { isValidReliableUUID } from '@podverse/helpers';

export type AddByRSSListedFeedLookupRef = {
  feedGuid: string;
  feedUrl: string | null;
};

export type AddByRSSDirectoryChannelMatchRow = {
  channelIdText: string;
  title: string | null;
  mediumId: number | null;
};

const DIRECTORY_MATCH_RELATIONS: FindOptionsRelations<Channel> = {
  feed: { feed_lifecycle_state: { feed_lifecycle_state_type: true } },
};

type PendingUrlRef = {
  guidKey: string;
  httpsUrl: string;
  httpUrl: string;
};

function listedFeedGuidKey(feedGuid: string): string {
  return feedGuid.trim().toLowerCase();
}

function hasFeedUrl(feedUrl: string | null): feedUrl is string {
  return feedUrl !== null && feedUrl !== '';
}

/** A feed with no lifecycle row counts as active. */
function feedLifecycleAllowsDirectoryMatch(channel: Channel): boolean {
  const stateKey = channel.feed?.feed_lifecycle_state?.feed_lifecycle_state_type?.state_key;
  if (stateKey === undefined || stateKey === null) {
    return true;
  }
  return (
    stateKey === FeedLifecycleStateKeyEnum.Active ||
    stateKey === FeedLifecycleStateKeyEnum.PendingArchive
  );
}

function toMatchRow(channel: Channel): AddByRSSDirectoryChannelMatchRow {
  return {
    channelIdText: channel.id_text,
    title: channel.title,
    mediumId: channel.medium_id,
  };
}

function reliableGuidKeys(refs: readonly AddByRSSListedFeedLookupRef[]): string[] {
  const keys = new Set<string>();
  for (const ref of refs) {
    const key = listedFeedGuidKey(ref.feedGuid);
    if (isValidReliableUUID(key)) {
      keys.add(key);
    }
  }
  return [...keys];
}

function urlMatchGuidAllowed(podcastGuid: string | null, refGuidKey: string): boolean {
  if (podcastGuid === null) {
    return true;
  }
  return podcastGuid.toLowerCase() === refGuidKey;
}

/** Lowest channel id wins when both URL schemes exist as separate feeds. */
function byAscendingId(channels: readonly Channel[]): Channel[] {
  return [...channels].sort((left, right) => left.id - right.id);
}

function urlMatchForRef(channels: readonly Channel[], pending: PendingUrlRef): Channel | undefined {
  const allowedUrls = new Set([pending.httpsUrl, pending.httpUrl]);
  return channels.find((channel) => {
    const url = channel.feed?.url;
    if (url === undefined || !allowedUrls.has(url)) {
      return false;
    }
    if (!feedLifecycleAllowsDirectoryMatch(channel)) {
      return false;
    }
    return urlMatchGuidAllowed(channel.podcast_guid, pending.guidKey);
  });
}

export class ChannelAddByRSSDirectoryMatchService {
  private readonly repositoryRead: Repository<Channel>;

  constructor() {
    this.repositoryRead = AppDataSourceRead.getRepository(Channel);
  }

  /**
   * Directory channels for feeds an Add by RSS publisher feed lists, keyed by the ref's lowercased
   * guid. Only parsed, publicly visible channels whose feed is active or pending archive match.
   * A guid match wins; otherwise a feed URL match counts when the channel has no guid or the same
   * guid. Reads only.
   */
  async getForListedFeeds(
    refs: readonly AddByRSSListedFeedLookupRef[]
  ): Promise<Map<string, AddByRSSDirectoryChannelMatchRow>> {
    const matches = new Map<string, AddByRSSDirectoryChannelMatchRow>();
    if (refs.length === 0) {
      return matches;
    }

    const guids = reliableGuidKeys(refs);
    if (guids.length > 0) {
      const channels = await this.repositoryRead.find({
        where: {
          podcast_guid: In(guids),
          channel_about: { id: Not(IsNull()) },
          feed: { feed_policy: { public_visible: true } },
        },
        relations: DIRECTORY_MATCH_RELATIONS,
      });
      for (const channel of channels) {
        if (!feedLifecycleAllowsDirectoryMatch(channel)) {
          continue;
        }
        if (typeof channel.podcast_guid !== 'string') {
          continue;
        }
        matches.set(channel.podcast_guid.toLowerCase(), toMatchRow(channel));
      }
    }

    const pending: PendingUrlRef[] = [];
    const variants: string[] = [];
    const seenVariants = new Set<string>();
    for (const ref of refs) {
      const guidKey = listedFeedGuidKey(ref.feedGuid);
      if (matches.has(guidKey) || !hasFeedUrl(ref.feedUrl)) {
        continue;
      }
      const { httpsUrl, httpUrl } = deriveHttpsAndHttpUrlsFromInput(ref.feedUrl);
      pending.push({ guidKey, httpsUrl, httpUrl });
      for (const variant of [httpsUrl, httpUrl]) {
        if (!seenVariants.has(variant)) {
          seenVariants.add(variant);
          variants.push(variant);
        }
      }
    }

    if (variants.length === 0) {
      return matches;
    }

    const channels = byAscendingId(
      await this.repositoryRead.find({
        where: {
          feed: { url: In(variants), feed_policy: { public_visible: true } },
          channel_about: { id: Not(IsNull()) },
        },
        relations: DIRECTORY_MATCH_RELATIONS,
      })
    );

    for (const ref of pending) {
      if (matches.has(ref.guidKey)) {
        continue;
      }
      const channel = urlMatchForRef(channels, ref);
      if (channel !== undefined) {
        matches.set(ref.guidKey, toMatchRow(channel));
      }
    }

    return matches;
  }
}
