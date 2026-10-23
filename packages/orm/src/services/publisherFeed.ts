import { AppDataSourceRead } from '@orm/db/index.js';
import { Channel } from '@orm/entities/channel/channel.js';
import type { ChannelRemoteItem } from '@orm/entities/channel/channelRemoteItem.js';
import { Item } from '@orm/entities/item/item.js';
import { ItemFlagStatusStatusEnum } from '@orm/entities/item/itemFlagStatus.js';
import type { FindOptionsWhere } from 'typeorm';
import { In, IsNull, Not } from 'typeorm';

import { channelGetOneRelations, ChannelService } from './channel/channel.js';
import { ChannelVerifiedPublisherService } from './channel/channelVerifiedPublisher.js';
import { FeedService } from './feed/feed.js';
import { itemGetManyRelationsWithChannel } from './item/item.js';
import {
  feedUrlsForPublisherAlbumUrlLookup,
  isPublisherAlbumRemoteRef,
  partitionPublisherAlbumRefs,
} from './publisherFeed.helpers.js';

/** Newest-first cap for tracks on one publisher feed. */
export const PUBLISHER_FEED_TRACKS_MAX = 500;

export type PublisherFeedRemoteItemsResult = {
  channel: Channel | null;
  /** Verified albums, artist feed order. */
  verifiedAlbums: Channel[];
  /** Album references to parsed-nothing feeds, for Podcast Index enrichment. */
  notYetAddedAlbumRefs: ChannelRemoteItem[];
  /** Tracks on verified albums plus item-credited tracks, newest first. */
  tracks: Item[];
};

function albumGuidKey(ref: ChannelRemoteItem): string {
  return typeof ref.feed_guid === 'string' ? ref.feed_guid.trim().toLowerCase() : '';
}

export class PublisherFeedService {
  /**
   * Parsed channels (a row in channel_about) for the album references' guids, keyed by
   * lowercased trimmed podcast_guid.
   */
  private async loadParsedChannelIdsByGuid(
    channelService: ChannelService,
    albumRefs: readonly ChannelRemoteItem[]
  ): Promise<Map<string, number>> {
    const guids: string[] = [];
    const seen = new Set<string>();
    for (const ref of albumRefs) {
      const guid = typeof ref.feed_guid === 'string' ? ref.feed_guid.trim() : '';
      const key = guid.toLowerCase();
      if (key.length === 0 || seen.has(key)) {
        continue;
      }
      seen.add(key);
      guids.push(guid);
    }

    const parsedChannelIdByGuid = new Map<string, number>();
    if (guids.length === 0) {
      return parsedChannelIdByGuid;
    }

    const channels = await channelService.getAllByPodcastGuids(
      { relations: { channel_about: true } },
      guids
    );
    for (const matched of channels) {
      if (!matched.channel_about || !matched.podcast_guid) {
        continue;
      }
      const key = matched.podcast_guid.trim().toLowerCase();
      if (key.length === 0 || parsedChannelIdByGuid.has(key)) {
        continue;
      }
      parsedChannelIdByGuid.set(key, matched.id);
    }
    return parsedChannelIdByGuid;
  }

  /**
   * Parsed channels for album references that did not match by guid, keyed by the reference's
   * trimmed feed URL. The lookup is the stored feed URL, then the channel's channel_about.
   */
  private async loadParsedChannelIdsByFeedUrl(
    channelService: ChannelService,
    albumRefs: readonly ChannelRemoteItem[],
    parsedChannelIdByGuid: ReadonlyMap<string, number>
  ): Promise<Map<string, number>> {
    const unmatched = albumRefs.filter((ref) => {
      const guid = albumGuidKey(ref);
      return guid.length === 0 || !parsedChannelIdByGuid.has(guid);
    });
    const feedUrls = feedUrlsForPublisherAlbumUrlLookup(unmatched);
    const parsedChannelIdByFeedUrl = new Map<string, number>();
    if (feedUrls.length === 0) {
      return parsedChannelIdByFeedUrl;
    }

    const feedService = new FeedService();
    for (const feedUrl of feedUrls) {
      const feed = await feedService.getByUrl({ url: feedUrl });
      const channelId = feed?.channel?.id;
      if (channelId === undefined || channelId === null) {
        continue;
      }
      const channel = await channelService.get(channelId, {
        channel_about: true,
        channel_images: true,
      });
      if (channel?.channel_about) {
        parsedChannelIdByFeedUrl.set(feedUrl, channel.id);
      }
    }
    return parsedChannelIdByFeedUrl;
  }

  private async loadVerifiedAlbums(verifiedChannelIds: readonly number[]): Promise<Channel[]> {
    if (verifiedChannelIds.length === 0) {
      return [];
    }
    const loaded = await AppDataSourceRead.getRepository(Channel).find({
      where: {
        id: In(verifiedChannelIds),
        channel_about: { id: Not(IsNull()) },
      },
      relations: { channel_about: true, channel_images: true },
    });
    const byId = new Map<number, Channel>();
    for (const album of loaded) {
      byId.set(album.id, album);
    }
    const verifiedAlbums: Channel[] = [];
    for (const id of verifiedChannelIds) {
      const album = byId.get(id);
      if (album !== undefined) {
        verifiedAlbums.push(album);
      }
    }
    return verifiedAlbums;
  }

  private async loadPublisherTracks(
    albumIds: readonly number[],
    creditedItemIds: readonly number[]
  ): Promise<Item[]> {
    if (albumIds.length === 0 && creditedItemIds.length === 0) {
      return [];
    }

    const where: FindOptionsWhere<Item>[] = [];
    if (albumIds.length > 0) {
      where.push({
        channel: {
          id: In(albumIds),
          channel_about: { id: Not(IsNull()) },
        },
        live_item: { id: IsNull() },
        item_flag_status: { id: ItemFlagStatusStatusEnum.Active },
      });
    }
    if (creditedItemIds.length > 0) {
      where.push({
        id: In(creditedItemIds),
        channel: { channel_about: { id: Not(IsNull()) } },
        live_item: { id: IsNull() },
        item_flag_status: { id: ItemFlagStatusStatusEnum.Active },
      });
    }

    return AppDataSourceRead.getRepository(Item).find({
      where,
      relations: itemGetManyRelationsWithChannel,
      order: { pub_date: 'DESC', id: 'DESC' },
      take: PUBLISHER_FEED_TRACKS_MAX,
    });
  }

  async getPublisherFeedRemoteItemsForChannel(
    idOrIdText: string
  ): Promise<PublisherFeedRemoteItemsResult> {
    const channelService = new ChannelService();

    // Artist pages use this channel for About, people, funding, and podroll. It needs the
    // same relations as GET /channel, including feed URL and website.
    const channel = await channelService.getByIdOrIdText(idOrIdText, channelGetOneRelations);
    if (!channel) {
      return {
        channel: null,
        verifiedAlbums: [],
        notYetAddedAlbumRefs: [],
        tracks: [],
      };
    }

    const albumRefs = [...(channel.channel_remote_items ?? [])]
      .sort((left, right) => left.id - right.id)
      .filter((ref) => isPublisherAlbumRemoteRef(ref));
    const catalog = await new ChannelVerifiedPublisherService().getCatalogForPublisher(channel.id);
    const parsedChannelIdByGuid = await this.loadParsedChannelIdsByGuid(channelService, albumRefs);
    const parsedChannelIdByFeedUrl = await this.loadParsedChannelIdsByFeedUrl(
      channelService,
      albumRefs,
      parsedChannelIdByGuid
    );
    const partitioned = partitionPublisherAlbumRefs({
      refs: albumRefs,
      matches: { parsedChannelIdByGuid, parsedChannelIdByFeedUrl },
      verifiedAlbumChannelIds: new Set(catalog.albumChannelIds),
    });
    const verifiedAlbums = await this.loadVerifiedAlbums(partitioned.verifiedChannelIds);
    const loadedAlbumIds = new Set(verifiedAlbums.map((album) => album.id));
    const tracks = await this.loadPublisherTracks(
      catalog.albumChannelIds.filter((id) => loadedAlbumIds.has(id)),
      catalog.creditedItemIds
    );

    return {
      channel,
      verifiedAlbums,
      notYetAddedAlbumRefs: partitioned.notYetAddedRefs,
      tracks,
    };
  }
}
