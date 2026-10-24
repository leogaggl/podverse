'use client';

import { useTranslations } from 'next-intl';
import React from 'react';

import type { QueryParamsLiveItemType } from '@podverse/helpers-requests';
import type { ChipRowItem } from '@podverse/ui';

import { CommonDetailListHeader } from '../../../../components/Common/List/CommonDetailListHeader';
import { useLivestreamPageContext } from './LivestreamPageContext';

type LivestreamPageListHeaderProps = {
  ssrCanShowBoosts: boolean;
  ssrHasPeople: boolean;
};

export const LivestreamPageListHeader: React.FC<LivestreamPageListHeaderProps> = ({
  ssrCanShowBoosts,
  ssrHasPeople,
}) => {
  const { filterParams, setFilterParams } = useLivestreamPageContext();
  const { type } = filterParams;
  const tInfo = useTranslations('info');
  const tValue = useTranslations('value');

  const items: ChipRowItem<QueryParamsLiveItemType>[] = [
    {
      key: 'summary',
      label: tInfo('summary.summary'),
    },
  ];

  if (ssrCanShowBoosts) {
    items.push({
      key: 'boosts',
      label: tValue('boost'),
    });
  }

  if (ssrHasPeople) {
    items.push({
      key: 'people',
      label: tInfo('people.people'),
    });
  }

  return (
    <CommonDetailListHeader
      items={items}
      onSelect={(nextType) => {
        setFilterParams({ ...filterParams, type: nextType });
      }}
      selectedKey={type}
      testId="livestream-detail-chips"
    />
  );
};
