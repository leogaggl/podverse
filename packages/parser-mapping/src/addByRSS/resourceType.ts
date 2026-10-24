import type { AddByRSSResourceType } from '@podverse/helpers';
import {
  isAlbumMediumId,
  isArtistMediumId,
  isPodcastMediumId,
  parseMediumId,
} from '@podverse/helpers';

import { compatChannelDto } from '../compat/partytime/channel.js';
import type { FeedObject } from '../types/partytime.js';
import type { AddByRSSMappedFeed } from './types.js';

/** Every Add by RSS resource type. Livestreams are a per-feed flag, not a type. */
export const ADD_BY_RSS_RESOURCE_TYPES: readonly AddByRSSResourceType[] = [
  'podcasts',
  'episodes',
  'artists',
  'albums',
  'tracks',
];

export const isAddByRSSResourceType = (value: string): value is AddByRSSResourceType =>
  ADD_BY_RSS_RESOURCE_TYPES.some((resourceType) => resourceType === value);

/** A stored resource type; any value outside the list reads as podcasts. */
export const toAddByRSSResourceType = (value: string): AddByRSSResourceType =>
  isAddByRSSResourceType(value) ? value : 'podcasts';

/** Artist, then album, then podcast. Every other medium, including a missing one, is podcasts. */
export const getAddByRSSResourceTypeFromMediumId = (
  mediumId: number | null
): AddByRSSResourceType => {
  if (isArtistMediumId(mediumId)) {
    return 'artists';
  }
  if (isAlbumMediumId(mediumId)) {
    return 'albums';
  }
  if (isPodcastMediumId(mediumId)) {
    return 'podcasts';
  }
  return 'podcasts';
};

export const getAddByRSSResourceTypeFromMappedFeed = (
  mappedFeed: AddByRSSMappedFeed | null | undefined
): AddByRSSResourceType =>
  getAddByRSSResourceTypeFromMediumId(parseMediumId(mappedFeed?.channel?.channel?.medium_id));

/** Same classification as `getAddByRSSResourceTypeFromMappedFeed`, read from the parsed feed. */
export const getAddByRSSResourceTypeFromParsedFeed = (
  parsedFeed: FeedObject
): AddByRSSResourceType =>
  getAddByRSSResourceTypeFromMediumId(compatChannelDto(parsedFeed).medium_id);

/** Resource types whose feeds list other feeds the server resolves for the member (artists). */
export const addByRSSResourceTypeListsFeeds = (resourceType: AddByRSSResourceType): boolean =>
  resourceType === 'artists';

export const getAddByRSSDetailRouteSegment = (resourceType: AddByRSSResourceType): string => {
  switch (resourceType) {
    case 'artists':
      return 'artist';
    case 'albums':
      return 'album';
    case 'tracks':
      return 'track';
    case 'podcasts':
      return 'podcast';
    case 'episodes':
      return 'episode';
    default:
      return 'podcast';
  }
};

/** Route segment for item (episode/track) detail; usable for web paths or RN deep links. */
export const getAddByRSSItemRouteSegment = (
  resourceType: 'episodes' | 'tracks'
): 'episode' | 'track' => {
  return resourceType === 'tracks' ? 'track' : 'episode';
};
