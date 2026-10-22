'use client';

import { useTranslations } from 'next-intl';
import React, { useRef } from 'react';

import type { DTOChannel } from '@podverse/helpers';
import type { QueryParamsSubscribedMusicType } from '@podverse/helpers-requests';
import { CallToActionMessage } from '@podverse/ui';

import { useModals } from '../../../contexts/Modals';
import { checkBackNavFlag } from '../../../contexts/Navigation';
import { useSkipInitialEffect } from '../../../hooks/useSkipInitialEffect';
import { scrollMainToTop } from '../../../utils/scroll';
import { CommonArtistListNodes } from '../../Common/Artist/CommonArtistNodes';
import type { ArtistListItem } from '../../Common/Artist/types';
import { Pagination } from '../../Pagination/Pagination';
import type { ViewSelectedOption } from '../../ViewSelector/ViewSelector';
import { CoreArtistNodes } from './CoreArtistNodes';

import styles from '../../../styles/components/Common/List/Podcasts/ListPodcasts.module.scss';

type Props = {
  page: number;
  setPage: (page: number) => void;
  channels: DTOChannel[];
  totalPages: number;
  showSubscribeMessage: boolean;
  type: QueryParamsSubscribedMusicType;
  viewSelected: ViewSelectedOption;
  /** When set, these rows replace the channel mapping. */
  items?: ArtistListItem[];
};

export const CoreArtists: React.FC<Props> = ({
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
      <CoreArtistNodes channels={channels} viewSelected={viewSelected} />
    ) : (
      <CommonArtistListNodes items={items} viewSelected={viewSelected} />
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
