'use client';

import { useTranslations } from 'next-intl';
import React from 'react';

import type { QueryParamsItemMusicType } from '@podverse/helpers-requests';
import type { ChipRowItem } from '@podverse/ui';
import { Button } from '@podverse/ui';

import { CommonDetailListHeader } from '../../../components/Common/List/CommonDetailListHeader';
import { useTrackPageContext } from './TrackPageContext';

type TrackPageListHeaderProps = {
  ssrHasPeople: boolean;
  ssrHasTranscripts: boolean;
  ssrCanShowBoosts: boolean;
};

export const TrackPageListHeader: React.FC<TrackPageListHeaderProps> = ({
  ssrHasPeople,
  ssrHasTranscripts,
  ssrCanShowBoosts,
}) => {
  const { filterParams, setFilterParams, autoScrollOn, setAutoScrollOn } = useTrackPageContext();
  const { type } = filterParams;
  const tInfo = useTranslations('info');
  const tMisc = useTranslations('misc');
  const tValue = useTranslations('value');

  const items: ChipRowItem<QueryParamsItemMusicType>[] = [
    {
      key: 'summary',
      label: tInfo('summary.summary'),
    },
  ];

  if (ssrHasTranscripts) {
    items.push({
      key: 'transcript',
      label: tInfo('transcript.lyrics'),
    });
  }

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
      testId="track-detail-chips"
      trailing={
        type === 'transcript' ? (
          <Button onClick={() => setAutoScrollOn(!autoScrollOn)} variant="mini">
            {autoScrollOn ? tMisc('autoscroll.autoscroll_on') : tMisc('autoscroll.autoscroll_off')}
          </Button>
        ) : null
      }
    />
  );
};
