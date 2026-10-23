import { AppDataSourceRead, AppDataSourceReadWrite } from '@orm/db/index.js';
import { ChannelMergeMode, ChannelMergeStatus } from '@orm/entities/channel/channelMerge.js';
import { ChannelVerifiedPublisher } from '@orm/entities/channel/channelVerifiedPublisher.js';
import { FeedLifecycleStateKeyEnum } from '@orm/entities/feed/feedLifecycleStateType.js';
import type {
  ClaimantFeed,
  PublisherClaim,
  PublisherFeedRefs,
  PublisherRemoteItemRef,
  VerifiedPublisherLinkRow,
} from '@orm/lib/verifiedPublisherMatch.js';
import { computeVerifiedPublisherLinks } from '@orm/lib/verifiedPublisherMatch.js';
import type { EntityManager, Repository } from 'typeorm';
import { In, IsNull } from 'typeorm';

import type { DTOVerifiedPublisher } from '@podverse/helpers';

/** `pg_advisory_xact_lock(namespace, channel_id)` key space for one content channel's links. */
export const VERIFIED_PUBLISHER_ADVISORY_LOCK_NAMESPACE = 744;

/** A feed with no lifecycle row counts as active. */
const LINKABLE_LIFECYCLE_STATE_KEYS: readonly string[] = [
  FeedLifecycleStateKeyEnum.Active,
  FeedLifecycleStateKeyEnum.PendingArchive,
];

const LIFECYCLE_JOIN_SQL = `
LEFT JOIN feed_lifecycle_state lifecycle ON lifecycle.feed_id = feed.id
LEFT JOIN feed_lifecycle_state_type lifecycle_type
  ON lifecycle_type.id = lifecycle.feed_lifecycle_state_type_id
`;

const CLAIMANT_SQL = `
SELECT channel.id AS channel_id,
       channel.podcast_guid::text AS podcast_guid,
       lifecycle_type.state_key AS state_key
FROM channel
INNER JOIN feed ON feed.id = channel.feed_id
${LIFECYCLE_JOIN_SQL}
WHERE channel.id = $1
`;

const CLAIMS_SQL = `
SELECT claim.feed_guid::text AS feed_guid,
       claim.feed_url AS feed_url,
       claim.item_guid AS item_guid,
       claim.item_id AS item_id,
       claim_item.guid AS claim_item_guid
FROM channel_publisher publisher
INNER JOIN channel_publisher_remote_item claim ON claim.channel_publisher_id = publisher.id
LEFT JOIN item claim_item
  ON claim_item.id = claim.item_id
 AND claim_item.channel_id = publisher.channel_id
WHERE publisher.channel_id = $1
ORDER BY claim.id
`;

const POSSIBLE_PUBLISHERS_SQL = `
SELECT channel.id AS channel_id, channel.podcast_guid::text AS podcast_guid
FROM channel
INNER JOIN feed ON feed.id = channel.feed_id
${LIFECYCLE_JOIN_SQL}
WHERE channel.podcast_guid = ANY($1::uuid[])
  AND channel.id <> $2
  AND (lifecycle_type.state_key IS NULL OR lifecycle_type.state_key = ANY($3::text[]))
ORDER BY channel.id
`;

const PUBLISHER_REMOTE_ITEMS_SQL = `
SELECT channel_id, feed_guid::text AS feed_guid, feed_url, item_guid
FROM channel_remote_item
WHERE channel_id = ANY($1::int[])
  AND feed_guid = $2::uuid
ORDER BY id
`;

const FEED_URLS_SQL = `
SELECT channel.id AS channel_id, feed.url AS url
FROM channel
INNER JOIN feed ON feed.id = channel.feed_id
WHERE channel.id = ANY($1::int[])
UNION ALL
SELECT merge.to_channel_id AS channel_id, feed.url AS url
FROM channel_merge merge
INNER JOIN channel merged_channel ON merged_channel.id = merge.from_channel_id
INNER JOIN feed ON feed.id = merged_channel.feed_id
WHERE merge.to_channel_id = ANY($1::int[])
  AND merge.status = $2
  AND merge.mode = $3
`;

const CONTENT_CHANNELS_FOR_PUBLISHER_SQL = `
SELECT claimant.channel_id AS channel_id
FROM channel publisher_channel
INNER JOIN channel_publisher_remote_item claim ON claim.feed_guid = publisher_channel.podcast_guid
INNER JOIN channel_publisher claimant ON claimant.id = claim.channel_publisher_id
WHERE publisher_channel.id = $1
UNION
SELECT channel_id
FROM channel_verified_publisher
WHERE publisher_channel_id = $1
`;

const CURRENT_LINKS_SQL = `
SELECT publisher_channel_id, item_id, claim_position
FROM channel_verified_publisher
WHERE channel_id = $1
`;

const CATALOG_FOR_PUBLISHER_SQL = `
SELECT channel_id, item_id
FROM channel_verified_publisher
WHERE publisher_channel_id = $1
ORDER BY channel_id, item_id NULLS FIRST
`;

const PUBLISHER_SUMMARIES_SQL = `
SELECT cvp.channel_id, cvp.item_id, p.id_text, p.title, p.medium_id
FROM channel_verified_publisher cvp
JOIN channel p ON p.id = cvp.publisher_channel_id
JOIN feed pf ON pf.id = p.feed_id
LEFT JOIN feed_lifecycle_state pfls ON pfls.feed_id = pf.id
LEFT JOIN feed_lifecycle_state_type pflst ON pflst.id = pfls.feed_lifecycle_state_type_id
WHERE ((cvp.item_id IS NULL AND cvp.channel_id = ANY($1::int[]))
       OR cvp.item_id = ANY($2::int[]))
  AND (pflst.state_key IS NULL OR pflst.state_key = ANY($3::text[]))
ORDER BY cvp.channel_id, cvp.item_id NULLS FIRST, cvp.claim_position, cvp.id
`;

const DELETE_LINKS_SQL = `DELETE FROM channel_verified_publisher WHERE channel_id = $1`;

const INSERT_LINKS_SQL = `
INSERT INTO channel_verified_publisher (channel_id, publisher_channel_id, item_id, claim_position)
SELECT $1, link.publisher_channel_id, link.item_id, link.claim_position
FROM unnest($2::int[], $3::int[], $4::smallint[])
  AS link(publisher_channel_id, item_id, claim_position)
`;

function isRow(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rowsOf(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRow);
}

function finiteInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) {
      return parsed;
    }
  }
  return null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function claimsOf(value: unknown): PublisherClaim[] {
  const claims: PublisherClaim[] = [];
  for (const row of rowsOf(value)) {
    const feedGuid = stringOrNull(Reflect.get(row, 'feed_guid'));
    if (feedGuid === null) {
      continue;
    }
    claims.push({
      feedGuid,
      feedUrl: stringOrNull(Reflect.get(row, 'feed_url')),
      itemGuid: stringOrNull(Reflect.get(row, 'item_guid')),
      itemId: finiteInteger(Reflect.get(row, 'item_id')),
      claimItemGuid: stringOrNull(Reflect.get(row, 'claim_item_guid')),
    });
  }
  return claims;
}

function linkKey(link: VerifiedPublisherLinkRow): string {
  return `${link.publisherChannelId}|${link.itemId ?? ''}|${link.claimPosition}`;
}

function linksOf(value: unknown): VerifiedPublisherLinkRow[] {
  const links: VerifiedPublisherLinkRow[] = [];
  for (const row of rowsOf(value)) {
    const publisherChannelId = finiteInteger(Reflect.get(row, 'publisher_channel_id'));
    const claimPosition = finiteInteger(Reflect.get(row, 'claim_position'));
    if (publisherChannelId === null || claimPosition === null) {
      continue;
    }
    links.push({
      publisherChannelId,
      itemId: finiteInteger(Reflect.get(row, 'item_id')),
      claimPosition,
    });
  }
  return links;
}

function sameLinks(
  current: readonly VerifiedPublisherLinkRow[],
  computed: readonly VerifiedPublisherLinkRow[]
): boolean {
  if (current.length !== computed.length) {
    return false;
  }
  const currentKeys = new Set(current.map(linkKey));
  return computed.every((link) => currentKeys.has(linkKey(link)));
}

function publisherTitle(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  return undefined;
}

function nullableItemId(value: unknown): number | null | undefined {
  if (value === null || value === undefined) {
    return null;
  }
  const itemId = finiteInteger(value);
  return itemId === null ? undefined : itemId;
}

export type VerifiedPublisherSummaryRow = {
  channelId: number;
  /** Null for a channel-wide credit. */
  itemId: number | null;
  publisher: DTOVerifiedPublisher;
};

function catalogOf(value: unknown): { albumChannelIds: number[]; creditedItemIds: number[] } {
  const albumChannelIds: number[] = [];
  const creditedItemIds: number[] = [];
  const albumIds = new Set<number>();
  const itemIds = new Set<number>();
  for (const row of rowsOf(value)) {
    const channelId = finiteInteger(Reflect.get(row, 'channel_id'));
    const itemId = nullableItemId(Reflect.get(row, 'item_id'));
    if (channelId === null || itemId === undefined) {
      continue;
    }
    if (itemId === null) {
      if (albumIds.has(channelId)) {
        continue;
      }
      albumIds.add(channelId);
      albumChannelIds.push(channelId);
      continue;
    }
    if (itemIds.has(itemId)) {
      continue;
    }
    itemIds.add(itemId);
    creditedItemIds.push(itemId);
  }
  return { albumChannelIds, creditedItemIds };
}

function publisherSummariesOf(value: unknown): VerifiedPublisherSummaryRow[] {
  const summaries: VerifiedPublisherSummaryRow[] = [];
  for (const row of rowsOf(value)) {
    const channelId = finiteInteger(Reflect.get(row, 'channel_id'));
    const mediumId = finiteInteger(Reflect.get(row, 'medium_id'));
    const idText = Reflect.get(row, 'id_text');
    const title = publisherTitle(Reflect.get(row, 'title'));
    const itemId = nullableItemId(Reflect.get(row, 'item_id'));
    if (
      channelId === null ||
      mediumId === null ||
      typeof idText !== 'string' ||
      title === undefined ||
      itemId === undefined
    ) {
      continue;
    }
    summaries.push({
      channelId,
      itemId,
      publisher: {
        id_text: idText,
        title,
        medium_id: mediumId,
      },
    });
  }
  return summaries;
}

function lifecycleAllowsLinks(stateKey: string | null): boolean {
  return stateKey === null || LINKABLE_LIFECYCLE_STATE_KEYS.includes(stateKey);
}

async function loadFeedUrls(
  manager: EntityManager,
  channelIds: readonly number[]
): Promise<Map<number, string[]>> {
  const urlsByChannelId = new Map<number, string[]>();
  const result: unknown = await manager.query(FEED_URLS_SQL, [
    channelIds,
    ChannelMergeStatus.Applied,
    ChannelMergeMode.Absorb,
  ]);
  for (const row of rowsOf(result)) {
    const channelId = finiteInteger(Reflect.get(row, 'channel_id'));
    const url = stringOrNull(Reflect.get(row, 'url'));
    if (channelId === null || url === null) {
      continue;
    }
    const urls = urlsByChannelId.get(channelId) ?? [];
    urls.push(url);
    urlsByChannelId.set(channelId, urls);
  }
  return urlsByChannelId;
}

/**
 * Reads both sides of every claim the content channel makes and applies the match rule. Returns
 * no links for a channel that does not exist, has no guid or no claims, or whose feed is not
 * active or pending archive.
 */
async function loadVerifiedPublisherLinks(
  manager: EntityManager,
  channelId: number
): Promise<VerifiedPublisherLinkRow[]> {
  const claimantRow = rowsOf(await manager.query(CLAIMANT_SQL, [channelId]))[0];
  if (claimantRow === undefined) {
    return [];
  }
  const podcastGuid = stringOrNull(Reflect.get(claimantRow, 'podcast_guid'));
  const stateKey = stringOrNull(Reflect.get(claimantRow, 'state_key'));
  if (podcastGuid === null || !lifecycleAllowsLinks(stateKey)) {
    return [];
  }

  const claims = claimsOf(await manager.query(CLAIMS_SQL, [channelId]));
  if (claims.length === 0) {
    return [];
  }

  const claimGuids = [...new Set(claims.map((claim) => claim.feedGuid))];
  const publisherRows = rowsOf(
    await manager.query(POSSIBLE_PUBLISHERS_SQL, [
      claimGuids,
      channelId,
      LINKABLE_LIFECYCLE_STATE_KEYS,
    ])
  );
  const publisherIds: number[] = [];
  const publisherGuidById = new Map<number, string>();
  for (const row of publisherRows) {
    const publisherId = finiteInteger(Reflect.get(row, 'channel_id'));
    const publisherGuid = stringOrNull(Reflect.get(row, 'podcast_guid'));
    if (publisherId === null || publisherGuid === null) {
      continue;
    }
    publisherIds.push(publisherId);
    publisherGuidById.set(publisherId, publisherGuid);
  }
  if (publisherIds.length === 0) {
    return [];
  }

  const feedUrls = await loadFeedUrls(manager, [channelId, ...publisherIds]);
  const claimant: ClaimantFeed = {
    channelId,
    podcastGuid,
    feedUrls: feedUrls.get(channelId) ?? [],
    claims,
  };

  const remoteItemsByPublisherId = new Map<number, PublisherRemoteItemRef[]>();
  const remoteItemResult: unknown = await manager.query(PUBLISHER_REMOTE_ITEMS_SQL, [
    publisherIds,
    podcastGuid,
  ]);
  for (const row of rowsOf(remoteItemResult)) {
    const publisherId = finiteInteger(Reflect.get(row, 'channel_id'));
    const feedGuid = stringOrNull(Reflect.get(row, 'feed_guid'));
    if (publisherId === null || feedGuid === null) {
      continue;
    }
    const remoteItems = remoteItemsByPublisherId.get(publisherId) ?? [];
    remoteItems.push({
      feedGuid,
      feedUrl: stringOrNull(Reflect.get(row, 'feed_url')),
      itemGuid: stringOrNull(Reflect.get(row, 'item_guid')),
    });
    remoteItemsByPublisherId.set(publisherId, remoteItems);
  }

  const publishers: PublisherFeedRefs[] = publisherIds.map((publisherId) => ({
    channelId: publisherId,
    podcastGuid: publisherGuidById.get(publisherId) ?? null,
    feedUrls: feedUrls.get(publisherId) ?? [],
    remoteItems: remoteItemsByPublisherId.get(publisherId) ?? [],
  }));
  return computeVerifiedPublisherLinks(claimant, publishers);
}

/**
 * Stores and reads `channel_verified_publisher`. Only `recomputeForContentChannel` writes link
 * rows; each write replaces one content channel's rows from what is stored for both feeds.
 */
export class ChannelVerifiedPublisherService {
  protected repositoryRead: Repository<ChannelVerifiedPublisher>;

  constructor() {
    this.repositoryRead = AppDataSourceRead.getRepository(ChannelVerifiedPublisher);
  }

  /**
   * Recomputes the channel's own links as a claimant, then the links of every content channel
   * that names this channel as a publisher or is already linked to it.
   */
  async recomputeForChannel(
    channelId: number
  ): Promise<{ links: number; contentChannelsRechecked: number }> {
    const links = await this.recomputeForContentChannel(channelId);
    const result: unknown = await AppDataSourceReadWrite.manager.query(
      CONTENT_CHANNELS_FOR_PUBLISHER_SQL,
      [channelId]
    );
    const contentChannelIds = [
      ...new Set(
        rowsOf(result)
          .map((row) => finiteInteger(Reflect.get(row, 'channel_id')))
          .filter((id): id is number => id !== null && id !== channelId)
      ),
    ].sort((left, right) => left - right);
    for (const contentChannelId of contentChannelIds) {
      await this.recomputeForContentChannel(contentChannelId);
    }
    return { links, contentChannelsRechecked: contentChannelIds.length };
  }

  /**
   * Replaces the content channel's link rows with the computed set, under a per-channel advisory
   * lock so concurrent recomputes of one channel serialize and the last one reads final state.
   * Writes nothing when the stored rows already match. Returns the number of rows now stored.
   */
  async recomputeForContentChannel(channelId: number): Promise<number> {
    return AppDataSourceReadWrite.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1, $2)', [
        VERIFIED_PUBLISHER_ADVISORY_LOCK_NAMESPACE,
        channelId,
      ]);
      const computed = await loadVerifiedPublisherLinks(manager, channelId);
      const current = linksOf(await manager.query(CURRENT_LINKS_SQL, [channelId]));
      if (sameLinks(current, computed)) {
        return computed.length;
      }
      await manager.query(DELETE_LINKS_SQL, [channelId]);
      if (computed.length > 0) {
        await manager.query(INSERT_LINKS_SQL, [
          channelId,
          computed.map((link) => link.publisherChannelId),
          computed.map((link) => link.itemId),
          computed.map((link) => link.claimPosition),
        ]);
      }
      return computed.length;
    });
  }

  /** The links the content channel would have now, without locking or writing. */
  async computeForContentChannel(channelId: number): Promise<VerifiedPublisherLinkRow[]> {
    return loadVerifiedPublisherLinks(AppDataSourceRead.manager, channelId);
  }

  /** Whether the publisher is verified on the whole content channel (not one item). */
  async isVerified(publisherChannelId: number, channelId: number): Promise<boolean> {
    return this.repositoryRead.exists({
      where: {
        publisher_channel_id: publisherChannelId,
        channel_id: channelId,
        item_id: IsNull(),
      },
    });
  }

  /** Rows for the content channels: by channel, channel-level rows first, then claim order. */
  async getForContentChannels(channelIds: number[]): Promise<ChannelVerifiedPublisher[]> {
    if (channelIds.length === 0) {
      return [];
    }
    return this.repositoryRead.find({
      where: { channel_id: In(channelIds) },
      order: {
        channel_id: 'ASC',
        item_id: { direction: 'ASC', nulls: 'FIRST' },
        claim_position: 'ASC',
      },
    });
  }

  /** Channel-level rows naming the publisher, by content channel. */
  async getForPublisher(publisherChannelId: number): Promise<ChannelVerifiedPublisher[]> {
    return this.repositoryRead.find({
      where: { publisher_channel_id: publisherChannelId, item_id: IsNull() },
      order: { channel_id: 'ASC' },
    });
  }

  /**
   * What a publisher is verified on: content channels credited as a whole, and single items
   * credited by an item-level link. Content channels are in channel id order.
   */
  async getCatalogForPublisher(
    publisherChannelId: number
  ): Promise<{ albumChannelIds: number[]; creditedItemIds: number[] }> {
    const result: unknown = await AppDataSourceRead.manager.query(CATALOG_FOR_PUBLISHER_SQL, [
      publisherChannelId,
    ]);
    return catalogOf(result);
  }

  /**
   * Channel-wide links for `channelIds` plus item-only links for `itemIds`, with the publisher's
   * id_text, title, and medium. Publishers whose feed is not active or pending archive are left
   * out. Ordered by channel, then item (channel-wide first), then claim position.
   */
  async getPublisherSummaries(args: {
    channelIds: readonly number[];
    itemIds: readonly number[];
  }): Promise<VerifiedPublisherSummaryRow[]> {
    if (args.channelIds.length === 0 && args.itemIds.length === 0) {
      return [];
    }
    const result: unknown = await AppDataSourceRead.manager.query(PUBLISHER_SUMMARIES_SQL, [
      [...args.channelIds],
      [...args.itemIds],
      [...LINKABLE_LIFECYCLE_STATE_KEYS],
    ]);
    return publisherSummariesOf(result);
  }
}
