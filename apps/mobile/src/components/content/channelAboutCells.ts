import { isDescriptionTruncated } from '@podverse/helpers';

export type ChannelAboutCell = {
  feedUrl: string | null;
  /** Podverse shortened the stored description. */
  isTruncated: boolean;
  key: string;
  kind: 'description';
  text: string | null;
  websiteUrl: string | null;
};

const nonEmpty = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined || value.length === 0) {
    return null;
  }
  return value;
};

/**
 * About body: description prose, plus RSS and website when the channel published them. A payload
 * without the full value falls back to its stored preview.
 */
export type ChannelAboutSource = {
  channel_about?: { website_link_url?: string | null } | null;
  channel_description?: {
    value?: string | null;
    preview?: string | null;
    is_truncated?: boolean;
  } | null;
  feed?: { url?: string | null } | null;
};

export const buildChannelAboutCells = (channel: ChannelAboutSource | null): ChannelAboutCell[] => {
  const description =
    nonEmpty(channel?.channel_description?.value) ??
    nonEmpty(channel?.channel_description?.preview);
  const feedUrl = nonEmpty(channel?.feed?.url);
  const websiteUrl = nonEmpty(channel?.channel_about?.website_link_url);
  const hasLinks = feedUrl !== null || websiteUrl !== null;
  if (description === null && !hasLinks) {
    return [];
  }

  return [
    {
      feedUrl,
      isTruncated: description !== null && isDescriptionTruncated(channel?.channel_description),
      key: 'description',
      kind: 'description',
      text: description,
      websiteUrl,
    },
  ];
};
