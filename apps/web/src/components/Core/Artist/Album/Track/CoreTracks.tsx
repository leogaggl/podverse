'use client';

import { useTranslations } from 'next-intl';
import React, { useRef } from 'react';

import type { DTOChannel, DTOItem } from '@podverse/helpers';
import { CallToActionMessage } from '@podverse/ui';

import { useModals } from '../../../../../contexts/Modals';
import { checkBackNavFlag } from '../../../../../contexts/Navigation';
import { useSkipInitialEffect } from '../../../../../hooks/useSkipInitialEffect';
import { scrollMainToTop } from '../../../../../utils/scroll';
import type { SubscribedItemEntry } from '../../../../../utils/subscribed/mergeSubscribedItems';
import { Pagination } from '../../../../Pagination/Pagination';
import { SubscribedTrackNodes } from '../../../../Subscribed/SubscribedTrackNodes';
import type { ViewSelectedOption } from '../../../../ViewSelector/ViewSelector';
import { CoreTrackNodes } from './CoreTrackNodes';

import styles from '../../../../../styles/components/Common/List/Podcasts/Episodes/ListEpisodes.module.scss';

type Props = {
  page: number;
  setPage: (page: number) => void;
  channel: DTOChannel | null;
  items: DTOItem[];
  totalPages: number;
  showSubscribeMessage?: boolean;
  viewSelected: ViewSelectedOption;
  showChannelInfo?: boolean;
  entries?: readonly SubscribedItemEntry[];
};

export const CoreTracks: React.FC<Props> = ({
  page,
  setPage,
  channel,
  items,
  totalPages,
  showSubscribeMessage,
  viewSelected,
  showChannelInfo,
  entries,
}) => {
  const tInstructions = useTranslations('instructions');
  const tAuthentication = useTranslations('authentication');
  const { setModalAuthLogin } = useModals();

  // Skip scroll on the first effect run when returning via back navigation.
  const skipScrollOnceRef = useRef(checkBackNavFlag());

  useSkipInitialEffect(() => {
    // Skip scroll-to-top once if this is a back navigation
    if (skipScrollOnceRef.current) {
      skipScrollOnceRef.current = false;
      return;
    }
    scrollMainToTop();
  }, [entries ?? items]);

  const showCallToAction = showSubscribeMessage;
  const showPagination = !showSubscribeMessage;

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
          {entries !== undefined ? (
            <SubscribedTrackNodes
              entries={entries}
              viewSelected={viewSelected}
              showChannelInfo={showChannelInfo}
            />
          ) : (
            <CoreTrackNodes
              channel={channel}
              items={items}
              viewSelected={viewSelected}
              showChannelInfo={showChannelInfo}
            />
          )}
        </Pagination>
      )}
    </>
  );
};
