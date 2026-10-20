import { compatChannelDto, compatChannelImageDtos } from '../compat/partytime/channel.js';
import type { FeedObject } from '../types/partytime.js';
import type { AddByRSSMappedFeed } from './types.js';

/** The title and artwork an add-by-RSS feed shows for itself. Null when the feed has none. */
export type AddByRSSChannelMetadata = {
  title: string | null;
  imageUrl: string | null;
};

type AddByRSSChannelMetadataSource = {
  channel: Pick<AddByRSSMappedFeed['channel'], 'channel' | 'images'>;
};

const nonEmptyTrimmed = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
};

/** The channel title, and the first channel image (iTunes image first, then RSS image). */
export const getAddByRSSChannelMetadata = (
  mappedFeed: AddByRSSChannelMetadataSource
): AddByRSSChannelMetadata => ({
  title: nonEmptyTrimmed(mappedFeed.channel.channel.title),
  imageUrl: nonEmptyTrimmed(mappedFeed.channel.images[0]?.url),
});

/** The same selection from a raw parse, without mapping its items. */
export const getAddByRSSChannelMetadataFromParsedFeed = (
  parsedFeed: FeedObject
): AddByRSSChannelMetadata =>
  getAddByRSSChannelMetadata({
    channel: {
      channel: compatChannelDto(parsedFeed),
      images: compatChannelImageDtos(parsedFeed),
    },
  });
