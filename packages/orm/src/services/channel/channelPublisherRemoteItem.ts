import type { ChannelPublisher } from '@orm/entities/channel/channelPublisher.js';
import { ChannelPublisherRemoteItem } from '@orm/entities/channel/channelPublisherRemoteItem.js';
import { BaseRemoteItemsService } from '@orm/services/base/baseRemoteItemsService.js';
import type { EntityManager } from 'typeorm';

import type { RemoteItemDto } from '@podverse/helpers';
import { filterInvalidFeedUuids } from '@podverse/helpers';

export class ChannelPublisherRemoteItemService extends BaseRemoteItemsService<
  ChannelPublisherRemoteItem,
  'channel_publisher'
> {
  constructor(transactionalEntityManager?: EntityManager) {
    super(ChannelPublisherRemoteItem, 'channel_publisher', transactionalEntityManager);
  }

  async getAll(channel_publisher: ChannelPublisher): Promise<ChannelPublisherRemoteItem[]> {
    return super.getAll(channel_publisher);
  }

  async update(
    channel_publisher: ChannelPublisher,
    dto: RemoteItemDto
  ): Promise<ChannelPublisherRemoteItem> {
    return super.update(channel_publisher, dto);
  }

  /**
   * Replaces the channel-level claims (item_id null) with `dtos`, in feed order. Deleting first
   * keeps ids in feed order, and the lowest id is the primary publisher. Item-level claims are
   * left alone.
   *
   * `update` upserts by feed_guid, feed_url, and item_guid within the parent and ignores
   * item_id. Insert an item-level claim with item_id set instead of calling `update`: the same
   * guid would otherwise reuse that row for a channel-level claim.
   */
  async updateMany(
    channel_publisher: ChannelPublisher,
    dtos: RemoteItemDto[]
  ): Promise<ChannelPublisherRemoteItem[]> {
    const filteredDtos = filterInvalidFeedUuids(dtos);
    const existing = (await this.getAll(channel_publisher)).filter(
      (claim) => claim.item_id === null
    );
    if (existing.length > 0) {
      await this.repositoryReadWrite.remove(existing);
    }

    const results: ChannelPublisherRemoteItem[] = [];
    for (const dto of filteredDtos) {
      const entity = await this.update(channel_publisher, dto);
      results.push(entity);
    }
    return results;
  }
}
