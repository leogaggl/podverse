'use client';

import { useTranslations } from 'next-intl';
import React from 'react';

import { MainHeader } from '@podverse/ui';

import { usePlaylistsPageContext } from './PlaylistsPageContext';

export const PlaylistsPageHeader: React.FC = () => {
  const tFeatures = useTranslations('features');
  const { listScope } = usePlaylistsPageContext();
  const title =
    listScope === 'browse' ? tFeatures('browse.browse') : tFeatures('playlist.playlists');

  return <MainHeader title={title} />;
};
