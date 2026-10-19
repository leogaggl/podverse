'use client';

import { useTranslations } from 'next-intl';
import React from 'react';

import type { DTOChannel, DTOItem, QueryParamsQueueMedium } from '@podverse/helpers';
import {
  buildArtistPath,
  buildMusicLivestreamPath,
  buildPodcastLivestreamPath,
  buildPodcastPath,
  isDescriptionTruncated,
} from '@podverse/helpers';

import { BoostMessagesSection } from '../../../../components/Boost/messages/BoostMessagesSection';
import { useBoostMessagesView } from '../../../../components/Boost/messages/useBoostMessagesView';
import { ContentPeopleRows } from '../../../../components/Content/About/ContentPeopleRows';
import { CoreEpisodeSummary } from '../../../../components/Core/Podcast/Episodes/CoreEpisodeSummary';
import { DetailListWrapper } from '../../../../components/List/DetailListWrapper';
import { WebLoadingSpinnerOverlay } from '../../../../components/LoadingSpinner/WebLoadingSpinnerOverlay';
import { useDescriptionClockPlayback } from '../../../../hooks/useDescriptionClockPlayback';
import { useLivestreamPageContext } from './LivestreamPageContext';

type LivestreamPageListProps = {
  ssrChannel: DTOChannel;
  ssrItem: DTOItem;
  medium: QueryParamsQueueMedium;
  ssrCanShowBoosts: boolean;
};

export const LivestreamPageList: React.FC<LivestreamPageListProps> = ({
  ssrChannel,
  ssrItem,
  medium,
  ssrCanShowBoosts,
}) => {
  const tV4VBoostMessages = useTranslations('v4v.boost_messages');
  const { filterParams, isLoading } = useLivestreamPageContext();
  const { type } = filterParams;
  const clock = useDescriptionClockPlayback({
    channel: ssrChannel,
    item: ssrItem,
    kind: 'item',
    livestream: true,
  });
  const { boostsPageFetcher, breadcrumbLinkResolver, refreshTrigger } = useBoostMessagesView({
    channel: ssrChannel,
    itemGuid: ssrItem.guid ?? null,
    scopeType: 'livestream',
    channelIdText: ssrChannel.id_text ?? null,
    ssrCanShowBoosts,
    resolveChannelHref: (channelIdText) =>
      medium === 'music' ? buildArtistPath(channelIdText) : buildPodcastPath(channelIdText),
    resolveItemHref: (itemIdText) =>
      medium === 'music'
        ? buildMusicLivestreamPath(itemIdText)
        : buildPodcastLivestreamPath(itemIdText),
  });

  return (
    <DetailListWrapper>
      {type === 'summary' && (
        <CoreEpisodeSummary
          description={ssrItem.item_description?.value}
          descriptionClockLabel={clock.descriptionClockLabel}
          onDescriptionClock={clock.onDescriptionClock}
          isTruncated={isDescriptionTruncated(ssrItem.item_description)}
          fullNotesUrl={ssrItem.item_about?.website_link_url}
        />
      )}
      {type === 'people' && <ContentPeopleRows item_persons={ssrItem.item_persons} />}
      {type === 'boosts' && boostsPageFetcher !== null && (
        <BoostMessagesSection
          heading={tV4VBoostMessages('title')}
          pageFetcher={boostsPageFetcher}
          breadcrumbLinkResolver={breadcrumbLinkResolver}
          refreshTrigger={refreshTrigger}
        />
      )}
      <WebLoadingSpinnerOverlay isLoading={isLoading} />
    </DetailListWrapper>
  );
};
