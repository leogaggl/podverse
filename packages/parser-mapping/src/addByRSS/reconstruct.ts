/**
 * Reconstruct add-by-RSS index items from queue/playlist resource data.
 * Used when client-side storage (IndexedDB) doesn't have the item,
 * e.g., when accessing a queue from a different device.
 */

import type { AddByRSSResourceData, AddByRSSResourceDataImageEntry } from '@podverse/helpers';
import { getItemItunesEpisodeTypeEnumValue } from '@podverse/helpers';

import type {
  AddByRSSItemIndexItem,
  AddByRSSLivestreamIndexItem,
  AddByRSSMappedFeed,
} from './types.js';

function isAddByRSSResourceDataImageEntry(value: unknown): value is AddByRSSResourceDataImageEntry {
  return (
    typeof value === 'object' && value !== null && 'url' in value && typeof value.url === 'string'
  );
}

function imageEntriesFromResourceData(value: unknown): AddByRSSResourceDataImageEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (entry): entry is AddByRSSResourceDataImageEntry =>
      isAddByRSSResourceDataImageEntry(entry) && entry.url !== ''
  );
}

function channelImageUrlFromResourceData(resourceData: AddByRSSResourceData): string | undefined {
  const [first] = imageEntriesFromResourceData(resourceData.channel_images);
  return first?.url;
}

function trimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** `feed_url` as stored. Resource data carries it canonical, which keeps the feed-form hash. */
function feedUrlFromResourceData(resourceData: AddByRSSResourceData): string | undefined {
  const feedUrl = trimmedString(resourceData['feed_url']);
  return feedUrl !== '' ? feedUrl : undefined;
}

function msFromIsoString(value: unknown): number {
  if (typeof value !== 'string' || value === '') {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Reconstruct an AddByRSSItemIndexItem from stored resource data (bundle).
 * Used when client-side storage doesn't have the item (e.g., different device).
 *
 * @param resourceData - The add_by_rss_resource_data from queue/playlist API
 * @returns Reconstructed index item, or null if bundle data is missing
 */
export function reconstructAddByRSSItemFromResourceData(
  resourceData: AddByRSSResourceData
): AddByRSSItemIndexItem | null {
  const bundle = resourceData.bundle as AddByRSSMappedFeed['items'][number] | undefined;
  if (!bundle) {
    return null;
  }

  return toItemIndexItem(resourceData, bundle);
}

function toItemIndexItem(
  resourceData: AddByRSSResourceData,
  bundle: AddByRSSMappedFeed['items'][number]
): AddByRSSItemIndexItem {
  const channelIdText = trimmedString(resourceData.channel_id_text);
  const itemGuid = trimmedString(resourceData.guid);
  const feedUrl = feedUrlFromResourceData(resourceData);
  return {
    id: `${channelIdText}-${itemGuid}`,
    idText: trimmedString(resourceData.id_text),
    itemGuid,
    channelIdText,
    ...(feedUrl !== undefined ? { feedUrl } : {}),
    channelTitle: typeof resourceData.channel_title === 'string' ? resourceData.channel_title : '',
    channelImageUrl: channelImageUrlFromResourceData(resourceData),
    mediumId: typeof resourceData.medium_id === 'number' ? resourceData.medium_id : null,
    bundle,
    pubDateMs: msFromIsoString(resourceData.pub_date),
  };
}

/**
 * An episode index item built from the resource data alone, for a row whose feed this device has
 * not parsed and that carries no `bundle`. It holds what the player needs to start: the enclosure,
 * title, channel title, channel and item artwork, duration, pub date, medium, feed URL, and guid.
 * Notes, chapters, transcripts, and value tags arrive once the feed is parsed.
 *
 * `buildAddByRSSResourceData` on the result hashes the same as `resourceData`. Returns null when
 * there is no `enclosure_url`, since nothing could play.
 */
export function buildMinimalAddByRSSItemFromResourceData(
  resourceData: AddByRSSResourceData
): AddByRSSItemIndexItem | null {
  const enclosureUrl = trimmedString(resourceData['enclosure_url']);
  if (enclosureUrl === '') {
    return null;
  }
  const itemGuid = trimmedString(resourceData.guid);
  const title = trimmedString(resourceData.title);
  const pubDateMs = msFromIsoString(resourceData.pub_date);
  const duration = resourceData['duration'];

  const bundle: AddByRSSMappedFeed['items'][number] = {
    item: {
      guid: itemGuid !== '' ? itemGuid : null,
      guid_enclosure_url: null,
      pub_date: pubDateMs > 0 ? new Date(pubDateMs) : null,
      title: title !== '' ? title : null,
    },
    about: {
      duration: null,
      explicit: false,
      website_link_url: null,
      item_itunes_episode_type: getItemItunesEpisodeTypeEnumValue('full'),
    },
    chaptersFeed: null,
    chat: null,
    description: null,
    enclosures: [
      {
        item_enclosure: {
          type: '',
          length: typeof duration === 'number' && Number.isFinite(duration) ? duration : null,
          bitrate: null,
          height: null,
          language: null,
          title: null,
          rel: null,
          codecs: null,
          item_enclosure_default: true,
        },
        item_enclosure_integrity: null,
        item_enclosure_sources: [{ uri: enclosureUrl, content_type: null }],
      },
    ],
    images: imageEntriesFromResourceData(resourceData.item_images),
    license: null,
    location: null,
    people: [],
    season: null,
    seasonEpisode: null,
    socialInteract: [],
    soundbites: [],
    transcripts: [],
    txt: [],
    value: [],
  };

  return toItemIndexItem(resourceData, bundle);
}

/**
 * Reconstruct an AddByRSSLivestreamIndexItem from stored resource data.
 * Used when client-side storage doesn't have the item (e.g., different device).
 *
 * @param resourceData - The add_by_rss_resource_data from queue/playlist API
 * @returns Reconstructed livestream index item, or null if liveItem/item data is missing
 */
export function reconstructAddByRSSLivestreamFromResourceData(
  resourceData: AddByRSSResourceData
): AddByRSSLivestreamIndexItem | null {
  const liveItem = resourceData.liveItem as
    AddByRSSMappedFeed['liveItems'][number]['liveItem'] | undefined;
  const livestreamItem = resourceData.livestream_item as
    AddByRSSMappedFeed['liveItems'][number]['item'] | undefined;

  if (!liveItem || !livestreamItem) {
    return null;
  }

  const channelIdText = trimmedString(resourceData.channel_id_text);
  const itemGuid = trimmedString(resourceData.guid);
  const feedUrl = feedUrlFromResourceData(resourceData);

  return {
    id: `${channelIdText}-${itemGuid}`,
    idText: trimmedString(resourceData.id_text),
    itemGuid,
    channelIdText,
    ...(feedUrl !== undefined ? { feedUrl } : {}),
    channelTitle: typeof resourceData.channel_title === 'string' ? resourceData.channel_title : '',
    channelImageUrl: channelImageUrlFromResourceData(resourceData),
    mediumId: typeof resourceData.medium_id === 'number' ? resourceData.medium_id : null,
    liveItem,
    item: livestreamItem,
    startTimeMs: msFromIsoString(resourceData.start_time),
  };
}
