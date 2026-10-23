import type { DTOChannel } from './channel/channel.js';
import type { DTOItem } from './item/item.js';
import type { EpisodeByGuidResponse } from './podcast-index/episodeByGuid.js';
import type { PodcastBatchByFeedGuidResponse } from './podcast-index/podcastBatchByFeedGuid.js';

export interface RemoteItemsResponse {
  channelsAdded: DTOChannel[];
  channelsUnadded: PodcastBatchByFeedGuidResponse['feeds'];
  itemsAdded: DTOItem[];
  itemsUnadded: EpisodeByGuidResponse['episode'][];
}

export type RemoteItemGeneric = {
  feed_guid: string;
  feed_url: string | null;
  item_guid: string | null;
};

export interface PublisherRemoteItemsResponse {
  channel: DTOChannel;
  /** Albums verified to this publisher (both feeds reference each other), in the publisher feed's order. */
  channelsAdded: DTOChannel[];
  /**
   * Albums the publisher feed lists that Podverse has not parsed, as Podcast Index feeds.
   * References Podcast Index does not know are left out.
   */
  channelsUnadded: PodcastBatchByFeedGuidResponse['feeds'];
  /** Tracks on the verified albums, plus tracks credited to this publisher alone, newest first. */
  itemsAdded: DTOItem[];
  /** Always empty. Item references in a publisher feed are not shown; nothing can verify them. */
  itemsUnadded: NonNullable<EpisodeByGuidResponse['episode']>[];
}
