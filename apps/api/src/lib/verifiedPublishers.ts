import type { DTOVerifiedPublisher } from '@podverse/helpers';
import type { Channel, Item } from '@podverse/orm';
import { ChannelVerifiedPublisherService } from '@podverse/orm';

const channelVerifiedPublisherService = new ChannelVerifiedPublisherService();

function distinctIntegerIds(values: readonly number[]): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const value of values) {
    if (!Number.isInteger(value) || seen.has(value)) {
      continue;
    }
    seen.add(value);
    ids.push(value);
  }
  return ids;
}

/**
 * Sets `verified_publishers` on every channel and item passed, and on each item's embedded
 * channel when it is loaded: channel-wide publishers on channels, item-only publishers on items.
 * Objects with no links get `[]`. One query per call.
 */
export async function attachVerifiedPublishers(args: {
  channels?: Iterable<Channel | null | undefined>;
  items?: Iterable<Item | null | undefined>;
}): Promise<void> {
  const channels: Channel[] = [];
  const items: Item[] = [];

  if (args.channels !== undefined) {
    for (const channel of args.channels) {
      if (channel !== null && channel !== undefined) {
        channels.push(channel);
      }
    }
  }

  if (args.items !== undefined) {
    for (const item of args.items) {
      if (item === null || item === undefined) {
        continue;
      }
      items.push(item);
      if (item.channel !== null && item.channel !== undefined) {
        channels.push(item.channel);
      }
    }
  }

  const byChannel = new Map<number, DTOVerifiedPublisher[]>();
  const byItem = new Map<number, DTOVerifiedPublisher[]>();
  const channelIds = distinctIntegerIds(channels.map((channel) => channel.id));
  const itemIds = distinctIntegerIds(items.map((item) => item.id));

  if (channelIds.length > 0 || itemIds.length > 0) {
    const rows = await channelVerifiedPublisherService.getPublisherSummaries({
      channelIds,
      itemIds,
    });
    for (const row of rows) {
      if (row.itemId === null) {
        const list = byChannel.get(row.channelId) ?? [];
        list.push(row.publisher);
        byChannel.set(row.channelId, list);
      } else {
        const list = byItem.get(row.itemId) ?? [];
        list.push(row.publisher);
        byItem.set(row.itemId, list);
      }
    }
  }

  for (const channel of channels) {
    channel.verified_publishers = byChannel.get(channel.id) ?? [];
  }
  for (const item of items) {
    item.verified_publishers = byItem.get(item.id) ?? [];
  }
}

/**
 * For items listed under one channel, which carry no embedded channel: sets each item's
 * item-only `verified_publishers` and its `channel_wide_verified_publishers` from `channel`.
 * One query per call.
 */
export async function attachChannelListVerifiedPublishers(args: {
  channel: Channel;
  items: readonly (Item | null | undefined)[];
}): Promise<void> {
  await attachVerifiedPublishers({ channels: [args.channel], items: args.items });
  const channelWide = args.channel.verified_publishers ?? [];
  for (const item of args.items) {
    if (item === null || item === undefined) {
      continue;
    }
    item.channel_wide_verified_publishers = channelWide;
  }
}

type MediaResourceLike = {
  item?: Item | null;
  clip?: { item?: Item | null } | null;
  item_soundbite?: { item?: Item | null } | null;
};

/** The items a queue or playlist resource plays: its item, its clip's item, or its soundbite's item. */
export function itemsOfMediaResources(
  resources: Iterable<MediaResourceLike | null | undefined>
): Item[] {
  const items: Item[] = [];
  for (const resource of resources) {
    if (resource === null || resource === undefined) {
      continue;
    }
    if (resource.item !== null && resource.item !== undefined) {
      items.push(resource.item);
    }
    const clipItem = resource.clip?.item;
    if (clipItem !== null && clipItem !== undefined) {
      items.push(clipItem);
    }
    const soundbiteItem = resource.item_soundbite?.item;
    if (soundbiteItem !== null && soundbiteItem !== undefined) {
      items.push(soundbiteItem);
    }
  }
  return items;
}
