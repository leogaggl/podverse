'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import type { ChipRowItem } from '@podverse/ui';

import { CommonDetailListHeader } from '../../../components/Common/List/CommonDetailListHeader';

export type AddByRSSAlbumPageTabKey = 'tracks' | 'boosts' | 'about' | 'settings';

type AddByRSSAlbumPageListHeaderProps = {
  selectedKey: AddByRSSAlbumPageTabKey;
  onSelect: (key: AddByRSSAlbumPageTabKey) => void;
  canShowBoosts?: boolean;
  trailing?: ReactNode;
};

export function AddByRSSAlbumPageListHeader({
  selectedKey,
  onSelect,
  canShowBoosts = false,
  trailing,
}: AddByRSSAlbumPageListHeaderProps) {
  const tMedia = useTranslations('media');
  const tInfo = useTranslations('info');
  const tSettings = useTranslations('settings');
  const tValue = useTranslations('value');

  const items: ChipRowItem<AddByRSSAlbumPageTabKey>[] = [
    {
      key: 'tracks',
      label: tMedia('music.tracks'),
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
      testId="add-by-rss-album-detail-chips"
      trailing={trailing}
    />
  );
}
