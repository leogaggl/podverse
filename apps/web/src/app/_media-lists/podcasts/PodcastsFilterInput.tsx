'use client';

import { useTranslations } from 'next-intl';
import React from 'react';

import { TextInput } from '@podverse/ui';

import { PODCASTS_FILTER_MAX_LENGTH } from './podcastsFilter';

const FILTER_INPUT_ID = 'podcasts-subscribed-filter';

interface PodcastsFilterInputProps {
  onChange: (term: string) => void;
  value: string;
}

/**
 * The subscribed list's title filter.
 *
 * The placeholder is the visible hint. The accessible name stays on the input so the field
 * remains named after the placeholder disappears.
 */
export const PodcastsFilterInput: React.FC<PodcastsFilterInputProps> = ({ onChange, value }) => {
  const tSubscriptions = useTranslations('subscriptions');
  const tMisc = useTranslations('misc');

  return (
    <TextInput
      aria-label={tSubscriptions('filter.label')}
      clearButton={{ ariaLabel: tMisc('clear_filter'), onClear: () => onChange('') }}
      id={FILTER_INPUT_ID}
      maxLength={PODCASTS_FILTER_MAX_LENGTH}
      name={FILTER_INPUT_ID}
      placeholder={tSubscriptions('filter.by_title')}
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
};
