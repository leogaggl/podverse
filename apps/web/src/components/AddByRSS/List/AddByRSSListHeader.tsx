'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import React from 'react';

import { Button, MainHeader } from '@podverse/ui';

import { ROUTES } from '../../../constants/routes';
import type { ViewSelectedOption } from '../../ViewSelector/ViewSelector';
import { ViewSelector } from '../../ViewSelector/ViewSelector';

type AddByRSSListHeaderProps = {
  title: string;
  isUpdating: boolean;
  onCheckUpdates: () => void;
  checkUpdatesLabel: string;
  viewSelected: ViewSelectedOption;
  setViewSelected: (view: ViewSelectedOption) => void;
  showViewSelector?: boolean;
  extraButtons?: React.ReactNode;
};

export const AddByRSSListHeader: React.FC<AddByRSSListHeaderProps> = ({
  title,
  isUpdating,
  onCheckUpdates,
  checkUpdatesLabel,
  viewSelected,
  setViewSelected,
  showViewSelector = true,
  extraButtons = null,
}) => {
  const router = useRouter();
  const tFeatures = useTranslations('features');
  const buttonsNode = (
    <>
      <Button onClick={() => router.push(ROUTES.ADD_BY_RSS_ADD)} variant="mini">
        {tFeatures('add_feed.add_feed')}
      </Button>
      <Button onClick={onCheckUpdates} isLoading={isUpdating} variant="mini">
        {checkUpdatesLabel}
      </Button>
      {extraButtons}
      {showViewSelector ? (
        <ViewSelector viewSelected={viewSelected} setViewSelected={setViewSelected} />
      ) : null}
    </>
  );

  return <MainHeader title={title} buttonsNode={buttonsNode} />;
};
