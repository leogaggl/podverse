import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { FeedParseStatusInput } from '@podverse/helpers';
import { buildFeedParseStatusLines, formatDateTimeAbbrev } from '@podverse/helpers';

import { resolveSupportedLocale } from '../../i18n/locale';

/**
 * Parse-history lines for a feed settings card.
 *
 * Null means there is no log to describe, which is an empty card rather than "never parsed".
 */
export function useFeedParseStatusLines(times: FeedParseStatusInput | null): string[] {
  const { i18n, t } = useTranslation();
  const locale = resolveSupportedLocale(i18n.language);
  const timesIsNull = times === null;
  const lastFailedParseTime = times === null ? null : times.lastFailedParseTime;
  const lastFinishedParseTime = times === null ? null : times.lastFinishedParseTime;

  return useMemo(() => {
    if (timesIsNull) {
      return [];
    }
    return buildFeedParseStatusLines(
      { lastFailedParseTime, lastFinishedParseTime },
      (iso) => formatDateTimeAbbrev(iso, locale),
      {
        lastFailedParse: (date) => t('settings.feed.last_failed_parse', { date }),
        lastParsed: (date) => t('settings.feed.last_parsed', { date }),
        neverFullyParsed: t('settings.feed.never_fully_parsed'),
      }
    ).lines;
  }, [lastFailedParseTime, lastFinishedParseTime, locale, t, timesIsNull]);
}
