'use client';

import { useTranslations } from 'next-intl';
import React, { useRef } from 'react';

import type { DTOChannel } from '@podverse/helpers';
import type { QueryParamsSubscribedMusicType } from '@podverse/helpers-requests';
import { CallToActionMessage } from '@podverse/ui';

import { useModals } from '../../../../contexts/Modals';
import { checkBackNavFlag } from '../../../../contexts/Navigation';
import { useSkipInitialEffect } from '../../../../hooks/useSkipInitialEffect';
import { scrollMainToTop } from '../../../../utils/scroll';
import { CommonAlbumListNodes } from '../../../Common/Artist/Album/CommonAlbumNodes';
import type { AlbumListItem } from '../../../Common/Artist/Album/types';
import { Pagination } from '../../../Pagination/Pagination';
import type { ViewSelectedOption } from '../../../ViewSelector/ViewSelector';
import { CoreAlbumNodes } from './CoreAlbumNodes';

import styles from '../../../../styles/components/Common/List/Podcasts/ListPodcasts.module.scss';

type Props = {
  page: number;
  setPage: (page: number) => void;
  channels: DTOChannel[];
  totalPages: number;
  showSubscribeMessage: boolean;
  type: QueryParamsSubscribedMusicType;
  viewSelected: ViewSelectedOption;
  /** When set, these rows replace the channel mapping. */
  items?: AlbumListItem[];
};

export const CoreAlbums: React.FC<Props> = ({
  page,
  setPage,
  channels,
  totalPages,
  showSubscribeMessage,
  viewSelected,
  items,
}) => {
  const tInstructions = useTranslations('instructions');
  const tAuthentication = useTranslations('authentication');
  const { setModalAuthLogin } = useModals();

  // Skip scroll on the first effect run when returning via back navigation.
  const skipScrollOnceRef = useRef(checkBackNavFlag());

  const scrollTarget = items ?? channels;

  useSkipInitialEffect(() => {
    // Skip scroll-to-top once if this is a back navigation
    if (skipScrollOnceRef.current) {
      skipScrollOnceRef.current = false;
      return;
    }
    scrollMainToTop();
  }, [scrollTarget]);

  const showCallToAction = showSubscribeMessage;
  const showPagination = !showSubscribeMessage;

  const listNodes =
    items === undefined ? (
      <CoreAlbumNodes channels={channels} viewSelected={viewSelected} />
    ) : (
      <CommonAlbumListNodes items={items} viewSelected={viewSelected} />
    );

  return (
    <>
      {showCallToAction && (
        <CallToActionMessage
          message={tInstructions('login_for_subscriptions')}
          buttonLabel={tAuthentication('login')}
          onButtonClick={() => setModalAuthLogin({ isOpen: true })}
        />
      )}
      {showPagination && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          setPage={setPage}
          paginationControlsClassName={styles.paginationControls}
        >
          {listNodes}
        </Pagination>
      )}
    </>
  );
};
