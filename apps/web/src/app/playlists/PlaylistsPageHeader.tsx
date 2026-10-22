'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import React from 'react';
import { FaPlus } from 'react-icons/fa6';

import { Button, MainHeader } from '@podverse/ui';

import { usePlaylistsPageContext } from './PlaylistsPageContext';

import styles from '../../styles/app/playlists/PlaylistsHeader.module.scss';

export const PlaylistsPageHeader: React.FC = () => {
  const tFeatures = useTranslations('features');
  const router = useRouter();
  const { listScope } = usePlaylistsPageContext();

  const buttonsNode =
    listScope === 'browse' ? null : (
      <>
        <Button variant="mini" onClick={() => router.push('/playlist/create')}>
          {tFeatures('playlist.create_playlist')}
          <FaPlus className={styles.icon} />
        </Button>
      </>
    );

  const title =
    listScope === 'browse' ? tFeatures('browse.browse') : tFeatures('playlist.playlists');

  return <MainHeader title={title} buttonsNode={buttonsNode} />;
};
