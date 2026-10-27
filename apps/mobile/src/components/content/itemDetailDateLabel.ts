import { formatDateTimeAbbrev } from '@podverse/helpers';

/** Publish date and local time for an item detail header, or null when absent or unparseable. */
export const itemDetailDateLabel = (
  pubDate: Date | string | null | undefined,
  language: string
): string | null => {
  if (pubDate === undefined || pubDate === null) {
    return null;
  }
  if (typeof pubDate === 'string' && pubDate.length === 0) {
    return null;
  }
  const parsed = pubDate instanceof Date ? pubDate : new Date(pubDate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return formatDateTimeAbbrev(parsed, language);
};
