import type {
  LocalSeedContentTarget,
  LocalSeedNotificationCatalog,
  LocalSeedNotificationDraft,
  LocalSeedNotificationKey,
  LocalSeedPublisherChannelNotice,
} from '@workers/commands/dev/localUserContentSeedLib.js';
import {
  buildLocalSeedNotificationDrafts,
  CLIPS_PER_ACCOUNT,
  DUMMY_AV_PLAYLIST_TITLE,
  DUMMY_MUSIC_PLAYLIST_TITLE,
  dummyClipTitle,
  dummyClipWindow,
  FOLLOWS_AV_COUNT,
  FOLLOWS_MUSIC_COUNT,
  ITEMS_PER_CHANNEL,
  LOCAL_SEED_MUSIC_FEED_IDS,
  LOCAL_SEED_NOTIFICATION_KEYS,
  LOCAL_SEED_PODCASTING20_FEED_IDS,
  LOCAL_SEED_PUBLISHER_ALBUM_FEED_ID,
  LOCAL_SEED_PUBLISHER_MUSIC_FEED_ID,
  LOCAL_SEED_PUBLISHER_PREVIEW_FEED_ID,
  LOCAL_USER_CONTENT_SEED_EMAILS,
  pickRotated,
  PLAYLIST_ITEM_COUNT,
  readLocalSeedKey,
} from '@workers/commands/dev/localUserContentSeedLib.js';
import type { CommandLineArgs } from '@workers/commands/index.js';
import { parsePodcastIndexFeedDirectly } from '@workers/commands/parser/rss/parseFeed.js';
import { getLoggerService } from '@workers/factories/loggerService.js';
import { getPodcastIndexService } from '@workers/factories/podcastIndexService.js';
import { podcastIndexFeedId } from '@workers/lib/podcastIndex/podcastIndexFeedId.js';

import { MediumEnum, SharableStatusEnum } from '@podverse/helpers';
import type { Channel, ChannelImage, Item, ItemImage } from '@podverse/orm';
import {
  AccountFollowingChannelService,
  AccountNotificationService,
  AccountService,
  ChannelService,
  ClipService,
  FeedService,
  ItemService,
  PlaylistResourceService,
  PlaylistService,
} from '@podverse/orm';

function channelIdTexts(channels: Channel[]): string[] {
  const idTexts: string[] = [];
  for (const channel of channels) {
    if (channel.id_text !== null && channel.id_text !== undefined && channel.id_text !== '') {
      idTexts.push(channel.id_text);
    }
  }
  return idTexts;
}

async function collectRecentItems(
  itemService: ItemService,
  channels: Channel[],
  maxItems: number
): Promise<Item[]> {
  const collected: Item[] = [];
  const seen = new Set<number>();
  for (const channel of channels) {
    const batch = await itemService.getManyByChannel(channel, {
      order: { pub_date: 'DESC' },
      take: ITEMS_PER_CHANNEL,
    });
    for (const item of batch) {
      if (item.id_text === null || item.id_text === undefined || item.id_text === '') {
        continue;
      }
      if (seen.has(item.id)) {
        continue;
      }
      seen.add(item.id);
      collected.push(item);
      if (collected.length >= maxItems) {
        return collected;
      }
    }
  }
  return collected;
}

function playlistHasItem(existingItemKeys: Set<string>, item: Item): boolean {
  if (item.id_text !== null && item.id_text !== undefined && existingItemKeys.has(item.id_text)) {
    return true;
  }
  return existingItemKeys.has(String(item.id));
}

const CHANNEL_LIST_TAKE = 500;

export async function devSeedLocalUserContent(_args: CommandLineArgs) {
  const logger = getLoggerService();
  const accountService = new AccountService();
  const channelService = new ChannelService();
  const itemService = new ItemService();
  const followingService = new AccountFollowingChannelService();
  const clipService = new ClipService();
  const playlistService = new PlaylistService();
  const playlistResourceService = new PlaylistResourceService();
  const feedService = new FeedService();
  const notificationService = new AccountNotificationService();

  await ensureLocalSeedFeeds(feedService, channelService);

  const avChannels = await channelService.getMany({ order: { id: 'ASC' }, take: 5000 }, 'av', null);
  const musicChannels = await channelService.getMany(
    { order: { id: 'ASC' }, take: 5000 },
    'music',
    null
  );
  const seedLibrary = avChannels.length > 0 || musicChannels.length > 0;
  if (!seedLibrary) {
    logger.warn(
      '[devSeedLocalUserContent] No public parsed channels. ' +
        'Follows, clips, and playlists were skipped.'
    );
  }

  const notificationCatalog = await loadNotificationCatalog(channelService, itemService);
  const notificationDrafts = buildLocalSeedNotificationDrafts(notificationCatalog);
  const draftedKeys = new Set(notificationDrafts.map((draft) => draft.localSeedKey));
  for (const key of LOCAL_SEED_NOTIFICATION_KEYS) {
    if (!draftedKeys.has(key)) {
      logger.warn(`[devSeedLocalUserContent] Skipped notification ${key}: ${skipReason(key)}.`);
    }
  }

  let accountsSeeded = 0;
  let followCount = 0;
  let clipCount = 0;
  let playlistCount = 0;
  let notificationCount = 0;

  for (const email of LOCAL_USER_CONTENT_SEED_EMAILS) {
    const account = await accountService.getByEmail(email);
    if (account === null) {
      logger.warn(
        `[devSeedLocalUserContent] Account missing: ${email}. Re-run make local_db_init.`
      );
      continue;
    }

    if (seedLibrary) {
      const avFollows = pickRotated(avChannels, account.id, FOLLOWS_AV_COUNT);
      const musicFollows = pickRotated(musicChannels, account.id + 3, FOLLOWS_MUSIC_COUNT);
      const followIdTexts = uniqueIdTexts([
        ...channelIdTexts(avFollows),
        ...channelIdTexts(musicFollows),
        ...publisherFollowIdTexts(notificationCatalog),
      ]);
      if (followIdTexts.length > 0) {
        const followResults = await followingService.followChannelsBulk(account.id, followIdTexts);
        followCount += followResults.filter((row) => row.outcome !== 'not_found').length;
      }

      const clipItems = await collectRecentItems(itemService, avFollows, CLIPS_PER_ACCOUNT);
      const existingClips = await clipService.getManyByAccount(account.id);

      for (const item of clipItems) {
        if (item.id_text === null || item.id_text === undefined) {
          continue;
        }
        const title = dummyClipTitle(item.id_text);
        const existing = existingClips.find((clip) => clip.title === title);
        const window = dummyClipWindow(account.id, item.id);
        const clipDto = {
          description: 'Local dummy clip for profile and clip lists.',
          end_time: String(window.end),
          item_id_text: item.id_text,
          sharable_status_id: SharableStatusEnum.Public,
          start_time: String(window.start),
          title,
        };
        if (existing?.id_text !== null && existing?.id_text !== undefined) {
          await clipService.update(account.id, existing.id_text, clipDto);
        } else {
          await clipService.create(account.id, clipDto);
        }
        clipCount += 1;
      }

      const avPlaylistItems = await collectRecentItems(itemService, avFollows, PLAYLIST_ITEM_COUNT);
      playlistCount += await ensureDummyPlaylist({
        accountId: account.id,
        items: avPlaylistItems,
        mediumId: MediumEnum.AV,
        playlistResourceService,
        playlistService,
        title: DUMMY_AV_PLAYLIST_TITLE,
      });

      if (musicFollows.length > 0) {
        const musicPlaylistItems = await collectRecentItems(
          itemService,
          musicFollows,
          PLAYLIST_ITEM_COUNT
        );
        playlistCount += await ensureDummyPlaylist({
          accountId: account.id,
          items: musicPlaylistItems,
          mediumId: MediumEnum.Music,
          playlistResourceService,
          playlistService,
          title: DUMMY_MUSIC_PLAYLIST_TITLE,
        });
      }
    }

    notificationCount += await replaceLocalSeedNotifications(
      notificationService,
      account.id,
      notificationDrafts
    );
    accountsSeeded += 1;
  }

  logger.info(
    `[devSeedLocalUserContent] Done. Accounts: ${accountsSeeded}, follows: ${followCount}, ` +
      `clips: ${clipCount}, playlists: ${playlistCount}, notifications: ${notificationCount}.`
  );
}

async function ensureLocalSeedFeeds(
  feedService: FeedService,
  channelService: ChannelService
): Promise<void> {
  const logger = getLoggerService();
  for (const podcastIndexId of LOCAL_SEED_PODCASTING20_FEED_IDS) {
    await ensureParsedFeed(feedService, podcastIndexId, `podcasting-2.0 ${podcastIndexId}`);
  }
  for (const podcastIndexId of LOCAL_SEED_MUSIC_FEED_IDS) {
    await ensureParsedFeed(feedService, podcastIndexId, `music ${podcastIndexId}`);
  }

  await ensureParsedFeed(
    feedService,
    LOCAL_SEED_PUBLISHER_MUSIC_FEED_ID,
    `publisher-music ${LOCAL_SEED_PUBLISHER_MUSIC_FEED_ID}`
  );
  await ensureParsedFeed(
    feedService,
    LOCAL_SEED_PUBLISHER_ALBUM_FEED_ID,
    `publisher album ${LOCAL_SEED_PUBLISHER_ALBUM_FEED_ID}`
  );

  const videoChannels = await channelService.getMany(
    { order: { id: 'ASC' }, take: 1 },
    'videos',
    null
  );
  if (videoChannels.length === 0) {
    const videoId = await firstPodcastIndexMediumId('video');
    if (videoId === null) {
      logger.warn(
        '[devSeedLocalUserContent] No video feed from Podcast Index. ' +
          'new-video rows will be skipped.'
      );
    } else {
      await ensureParsedFeed(feedService, videoId, `video ${videoId}`);
    }
  }
}

async function ensureParsedFeed(
  feedService: FeedService,
  podcastIndexId: number,
  label: string
): Promise<void> {
  const logger = getLoggerService();
  const existing = await feedService.getByPodcastIndexId(podcastIndexId);
  if (existing !== null) {
    return;
  }

  logger.info(`[devSeedLocalUserContent] Parsing Podcast Index feed ${label}.`);
  try {
    await parsePodcastIndexFeedDirectly(podcastIndexId, false, {
      enqueueFollowUpWork: false,
      suppressNewItemSideEffectsPublishedBeforeMs: Date.now(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`[devSeedLocalUserContent] Parse failed for ${label}: ${message}`);
  }
}

async function firstPodcastIndexMediumId(medium: string): Promise<number | null> {
  const logger = getLoggerService();
  try {
    const feeds: unknown = await getPodcastIndexService().podcastsByMedium(medium, 1);
    if (!Array.isArray(feeds)) {
      return null;
    }
    for (const feed of feeds) {
      const id = podcastIndexFeedId(feed);
      if (id !== null) {
        return id;
      }
    }
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`[devSeedLocalUserContent] Podcast Index ${medium} lookup failed: ${message}`);
    return null;
  }
}

async function loadNotificationCatalog(
  channelService: ChannelService,
  itemService: ItemService
): Promise<LocalSeedNotificationCatalog> {
  const list = {
    order: { id: 'ASC' as const },
    relations: { channel_images: true, feed: true },
    take: CHANNEL_LIST_TAKE,
  };
  const podcastChannels = await channelService.getMany(list, 'podcasts', null);
  const videoChannels = await channelService.getMany(list, 'videos', null);
  const musicChannels = await channelService.getMany(list, 'music', null);

  const episode = await firstItemTarget(itemService, podcastChannels);
  const newContent = await differentEpisodeTarget(itemService, podcastChannels, episode);
  const video = await firstItemTarget(itemService, videoChannels);
  const track = await firstItemTarget(itemService, musicChannels);

  const publisher = await channelByPodcastIndexId(
    channelService,
    LOCAL_SEED_PUBLISHER_MUSIC_FEED_ID
  );
  const announcedAlbum = await channelByPodcastIndexId(
    channelService,
    LOCAL_SEED_PUBLISHER_ALBUM_FEED_ID
  );
  const publisherAlbum =
    publisher === null || announcedAlbum === null
      ? null
      : publisherChannelNotice(publisher, announcedAlbum);
  const podcastIndexPreview =
    publisher === null
      ? null
      : await podcastIndexPreviewNotice(publisher, LOCAL_SEED_PUBLISHER_PREVIEW_FEED_ID);

  const channelIds = podcastChannels.map((channel) => channel.id);
  const livestreamStarted = await liveItemTarget(itemService, channelIds, 'live');
  const livestreamScheduled = await liveItemTarget(itemService, channelIds, 'pending');

  return {
    episode,
    livestreamScheduled,
    livestreamStarted,
    newContent,
    podcastIndexPreview,
    publisherAlbum,
    // Podcast Index has no publisher-podcast or publisher-video feed to parse yet.
    // Those notices use the same shape as publisherAlbum when an id is available.
    publisherPodcast: null,
    publisherVideo: null,
    track,
    video,
  };
}

async function firstItemTarget(
  itemService: ItemService,
  channels: Channel[]
): Promise<LocalSeedContentTarget | null> {
  for (const channel of channels) {
    const items = await itemService.getManyByChannel(channel, {
      order: { pub_date: 'DESC' },
      relations: { item_images: true },
      take: 1,
    });
    const item = items[0];
    if (item === undefined) {
      continue;
    }
    const target = contentTarget(channel, item);
    if (target !== null) {
      return target;
    }
  }
  return null;
}

async function liveItemTarget(
  itemService: ItemService,
  channelIds: number[],
  status: 'live' | 'pending'
): Promise<LocalSeedContentTarget | null> {
  const logger = getLoggerService();
  if (channelIds.length === 0) {
    return null;
  }

  const relations = {
    channel: { channel_images: true },
    item_images: true,
  };
  const matched = await itemService.getManyByChannels(channelIds, 'live-item', status, {
    relations,
    take: 1,
  });
  const matchedItem = matched[0];
  if (matchedItem !== undefined) {
    const target = contentTargetFromItem(matchedItem);
    if (target !== null) {
      return target;
    }
  }

  const fallback = await itemService.getManyByChannels(channelIds, 'live-item', null, {
    relations,
    take: 1,
  });
  const fallbackItem = fallback[0];
  if (fallbackItem === undefined) {
    return null;
  }
  const target = contentTargetFromItem(fallbackItem);
  if (target === null) {
    return null;
  }
  const key = status === 'live' ? 'livestream-started' : 'livestream-scheduled';
  logger.warn(`[devSeedLocalUserContent] No ${status} live item. ${key} uses another live item.`);
  return target;
}

function contentTarget(channel: Channel, item: Item): LocalSeedContentTarget | null {
  if (channel.id_text === '' || item.id_text === '') {
    return null;
  }
  return {
    channelIdText: channel.id_text,
    channelTitle: channel.title ?? '',
    imageUrl: firstImageUrl(item.item_images) ?? firstImageUrl(channel.channel_images),
    itemIdText: item.id_text,
    itemTitle: item.title ?? '',
    mediumId: channel.medium_id,
  };
}

function contentTargetFromItem(item: Item): LocalSeedContentTarget | null {
  return contentTarget(item.channel, item);
}

async function channelByPodcastIndexId(
  channelService: ChannelService,
  podcastIndexId: number
): Promise<Channel | null> {
  return channelService.getByPodcastIndexId(podcastIndexId, {
    channel_images: true,
    feed: true,
  });
}

function publisherChannelNotice(
  publisher: Channel,
  announced: Channel
): LocalSeedPublisherChannelNotice | null {
  const announcedTitle = (announced.title ?? '').trim();
  const publisherTitle = (publisher.title ?? '').trim();
  if (
    publisher.id_text === '' ||
    announced.id_text === '' ||
    announcedTitle === '' ||
    publisherTitle === ''
  ) {
    return null;
  }
  return {
    announcedIdText: announced.id_text,
    announcedTitle,
    imageUrl: firstImageUrl(announced.channel_images) ?? firstImageUrl(publisher.channel_images),
    mediumId: publisher.medium_id,
    publisherIdText: publisher.id_text,
    publisherTitle,
  };
}

async function podcastIndexPreviewNotice(
  publisher: Channel,
  podcastIndexId: number
): Promise<LocalSeedPublisherChannelNotice | null> {
  const logger = getLoggerService();
  const publisherTitle = (publisher.title ?? '').trim();
  if (publisher.id_text === '' || publisherTitle === '') {
    return null;
  }

  let response: unknown;
  try {
    response = await getPodcastIndexService().podcastGetById(podcastIndexId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(
      `[devSeedLocalUserContent] Podcast Index lookup failed for preview ${podcastIndexId}: ${message}`
    );
    return null;
  }

  const announcedTitle = readPodcastIndexTitle(response);
  if (announcedTitle === null) {
    logger.warn(`[devSeedLocalUserContent] Podcast Index preview ${podcastIndexId} has no title.`);
    return null;
  }

  return {
    announcedIdText: String(podcastIndexId),
    announcedTitle,
    imageUrl: firstImageUrl(publisher.channel_images),
    mediumId: publisher.medium_id,
    publisherIdText: publisher.id_text,
    publisherTitle,
  };
}

function readPodcastIndexTitle(response: unknown): string | null {
  if (typeof response !== 'object' || response === null) {
    return null;
  }
  const feed: unknown = Reflect.get(response, 'feed');
  if (typeof feed !== 'object' || feed === null) {
    return null;
  }
  const title: unknown = Reflect.get(feed, 'title');
  if (typeof title !== 'string') {
    return null;
  }
  const trimmed = title.trim();
  return trimmed === '' ? null : trimmed;
}

async function differentEpisodeTarget(
  itemService: ItemService,
  channels: Channel[],
  episode: LocalSeedContentTarget | null
): Promise<LocalSeedContentTarget | null> {
  if (episode === null) {
    return null;
  }

  const logger = getLoggerService();
  for (const channel of channels) {
    if (channel.id_text === episode.channelIdText) {
      continue;
    }
    const target = await firstItemTarget(itemService, [channel]);
    if (target !== null) {
      return target;
    }
  }

  const sameShow = channels.find((channel) => channel.id_text === episode.channelIdText);
  if (sameShow === undefined) {
    return null;
  }
  const items = await itemService.getManyByChannel(sameShow, {
    order: { pub_date: 'DESC' },
    relations: { item_images: true },
    take: 2,
  });
  const second = items[1];
  if (second === undefined) {
    return null;
  }
  const target = contentTarget(sameShow, second);
  if (target === null || target.itemIdText === episode.itemIdText) {
    return null;
  }
  logger.warn('[devSeedLocalUserContent] New content uses another episode of the same show.');
  return target;
}

function firstImageUrl(images: Array<ChannelImage | ItemImage> | undefined | null): string | null {
  if (images === undefined || images === null || images.length === 0) {
    return null;
  }
  const url = images[0]?.url;
  if (url === undefined || url.trim() === '') {
    return null;
  }
  return url;
}

async function replaceLocalSeedNotifications(
  notificationService: AccountNotificationService,
  accountId: number,
  drafts: LocalSeedNotificationDraft[]
): Promise<number> {
  await notificationService.deleteLocalSeedRows(accountId);
  if (drafts.length === 0) {
    return 0;
  }

  const created = await notificationService.createMany(
    drafts.map((draft) => ({
      account_id: accountId,
      body: draft.body,
      category: draft.category,
      created_at: draft.createdAt,
      link_path: draft.linkPath,
      payload: draft.payload,
      title: draft.title,
    }))
  );

  for (const row of created) {
    if (readLocalSeedKey(row.payload) !== 'general') {
      continue;
    }
    await notificationService.markReadById(accountId, row.id);
  }

  return created.length;
}

function uniqueIdTexts(idTexts: readonly string[]): string[] {
  const unique: string[] = [];
  for (const idText of idTexts) {
    if (idText !== '' && !unique.includes(idText)) {
      unique.push(idText);
    }
  }
  return unique;
}

function publisherFollowIdTexts(catalog: LocalSeedNotificationCatalog): string[] {
  return uniqueIdTexts([
    catalog.publisherAlbum?.publisherIdText ?? '',
    catalog.publisherPodcast?.publisherIdText ?? '',
    catalog.publisherVideo?.publisherIdText ?? '',
    catalog.podcastIndexPreview?.publisherIdText ?? '',
  ]);
}

function skipReason(key: LocalSeedNotificationKey): string {
  switch (key) {
    case 'new':
      return 'no second episode was available';
    case 'new-podcast':
      return 'no publisher-podcast feed is available from Podcast Index';
    case 'new-video-channel':
      return 'no publisher-video feed is available from Podcast Index';
    case 'new-album':
      return 'the publisher album was not parsed';
    case 'podcast-index-feed':
      return 'the publisher preview was not found on Podcast Index';
    default:
      return 'no parsed feed target';
  }
}

async function ensureDummyPlaylist(params: {
  accountId: number;
  items: Item[];
  mediumId: MediumEnum;
  playlistResourceService: PlaylistResourceService;
  playlistService: PlaylistService;
  title: string;
}): Promise<number> {
  const { accountId, items, mediumId, playlistResourceService, playlistService, title } = params;

  const [ownedPlaylists] = await playlistService.getManyPrivate(accountId, null);
  let playlist = ownedPlaylists.find((row) => row.title === title);
  if (playlist === undefined) {
    playlist = ownedPlaylists.find(
      (row) => row.medium_id === mediumId && row.is_default_likes === false
    );
  }
  if (playlist === undefined) {
    playlist = await playlistService.create(accountId, {
      description: 'Local dummy playlist for profile and playlist lists.',
      medium_id: mediumId,
      sharable_status_id: SharableStatusEnum.Public,
      title,
    });
  }

  if (playlist.id_text === null || playlist.id_text === undefined) {
    return 0;
  }

  const existingResources = await playlistResourceService.getManyByPlaylistIdText(
    playlist.id_text,
    accountId
  );
  const existingItemKeys = new Set<string>();
  for (const resource of existingResources) {
    if (resource.item_id !== null && resource.item_id !== undefined && resource.item_id !== '') {
      existingItemKeys.add(String(resource.item_id));
    }
    if (resource.item?.id_text !== null && resource.item?.id_text !== undefined) {
      existingItemKeys.add(resource.item.id_text);
    }
  }

  for (const item of items) {
    if (item.id_text === null || item.id_text === undefined) {
      continue;
    }
    if (playlistHasItem(existingItemKeys, item)) {
      continue;
    }
    await playlistResourceService.addItemToPlaylistLast(playlist.id_text, item.id_text);
    existingItemKeys.add(item.id_text);
    existingItemKeys.add(String(item.id));
  }

  await playlistService.updateLastUpdatedAndItemCount(playlist.id_text);
  return 1;
}
