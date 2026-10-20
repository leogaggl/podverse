import type { ParseRSSFeedForAddByRSSResult } from '@podverse/parser';
import { getAddByRSSChannelMetadataFromParsedFeed } from '@podverse/parser-mapping';

export type AddByRSSFollowMetadata = {
  title?: string;
  image_url?: string;
};

/**
 * What a parse says the follow row should show. Only a `parsed` result carries a feed, and only
 * non-empty values are returned, so a feed without a title never blanks the stored one.
 */
export const addByRSSFollowMetadataFromParse = (
  result: ParseRSSFeedForAddByRSSResult | undefined
): AddByRSSFollowMetadata | null => {
  if (result?.status !== 'parsed') {
    return null;
  }

  const { title, imageUrl } = getAddByRSSChannelMetadataFromParsedFeed(result.parsedFeed);
  const metadata: AddByRSSFollowMetadata = {
    ...(title !== null ? { title } : {}),
    ...(imageUrl !== null ? { image_url: imageUrl } : {}),
  };
  return metadata.title === undefined && metadata.image_url === undefined ? null : metadata;
};

/** Writes the parse's title and artwork to the follow row. A failure is reported, never thrown. */
export const applyAddByRSSFollowMetadata = async (params: {
  accountId: number;
  feedUrl: string;
  result: ParseRSSFeedForAddByRSSResult | undefined;
  setFeedMetadata: (
    accountId: number,
    feedUrl: string,
    metadata: AddByRSSFollowMetadata
  ) => Promise<void>;
  onError: (error: unknown) => void;
}): Promise<void> => {
  const metadata = addByRSSFollowMetadataFromParse(params.result);
  if (metadata === null) {
    return;
  }

  try {
    await params.setFeedMetadata(params.accountId, params.feedUrl, metadata);
  } catch (error) {
    params.onError(error);
  }
};
