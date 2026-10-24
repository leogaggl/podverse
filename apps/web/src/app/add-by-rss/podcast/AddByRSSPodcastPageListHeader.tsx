'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import type { ChipRowItem } from '@podverse/ui';

import { CommonDetailListHeader } from '../../../components/Common/List/CommonDetailListHeader';

export type AddByRSSPodcastPageTabKey = 'episodes' | 'boosts' | 'about' | 'settings';

type AddByRSSPodcastPageListHeaderProps = {
  selectedKey: AddByRSSPodcastPageTabKey;
  onSelect: (key: AddByRSSPodcastPageTabKey) => void;
  canShowBoosts?: boolean;
  trailing?: ReactNode;
};

export function AddByRSSPodcastPageListHeader({
  selectedKey,
  onSelect,
  canShowBoosts = false,
  trailing,
}: AddByRSSPodcastPageListHeaderProps) {
  const tMedia = useTranslations('media');
  const tInfo = useTranslations('info');
  const tSettings = useTranslations('settings');
  const tValue = useTranslations('value');

  const items: ChipRowItem<AddByRSSPodcastPageTabKey>[] = [
    {
      key: 'episodes',
      label: tMedia('podcast.episodes'),
    },
    {
      key: 'boosts',
      label: tValue('boost'),
    },
    {
      key: 'about',
      label: tInfo('about'),
      hideDesktop: true,
    },
    {
      key: 'settings',
      label: tSettings('settings'),
    },
  ];
  const visibleItems = canShowBoosts ? items : items.filter((item) => item.key !== 'boosts');

  return (
    <CommonDetailListHeader
      items={visibleItems}
      onSelect={onSelect}
      selectedKey={selectedKey}
      testId="add-by-rss-podcast-detail-chips"
      trailing={trailing}
    />
  );
}
