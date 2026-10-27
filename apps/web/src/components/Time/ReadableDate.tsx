'use client';

import { useLocale, useTranslations } from 'next-intl';
import type React from 'react';

import { formatDateTimeAbbrev } from '@podverse/helpers';

type ReadableDateProps = {
  date?: string | null;
};

export const ReadableDate: React.FC<ReadableDateProps> = ({ date }) => {
  const locale = useLocale();
  const tMisc = useTranslations('misc');
  const readableDate = date ? formatDateTimeAbbrev(date, locale) : tMisc('unknown_date');

  return readableDate;
};
