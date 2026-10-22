'use client';

import React from 'react';

import type { AddByRSSFeedRecord } from '../../../utils/addByRSS/types';
import { podcastListItemFromAddByRSSFeed } from '../../../utils/subscribed/channelListItems';
import { CommonPodcastListNodes } from '../../Common/Podcast/CommonPodcastNodes';
import type { ViewSelectedOption } from '../../ViewSelector/ViewSelector';

type AddByRSSPodcastListNodesProps = {
  feeds: AddByRSSFeedRecord[];
  viewSelected: ViewSelectedOption;
};

export const AddByRSSPodcastListNodes: React.FC<AddByRSSPodcastListNodesProps> = ({
  feeds,
  viewSelected,
}) => {
  const items = feeds.map((feed) => podcastListItemFromAddByRSSFeed(feed));

  return <CommonPodcastListNodes items={items} viewSelected={viewSelected} />;
};
