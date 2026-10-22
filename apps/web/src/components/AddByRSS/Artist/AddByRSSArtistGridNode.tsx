'use client';

import React from 'react';

import type { AddByRSSFeedRecord } from '../../../utils/addByRSS/types';
import { artistListItemFromAddByRSSFeed } from '../../../utils/subscribed/channelListItems';
import { CommonArtistListGridNode } from '../../Common/Artist/CommonArtistGridNode';

type AddByRSSArtistGridNodeProps = {
  feed: AddByRSSFeedRecord;
};

export const AddByRSSArtistGridNode: React.FC<AddByRSSArtistGridNodeProps> = ({ feed }) => {
  return <CommonArtistListGridNode item={artistListItemFromAddByRSSFeed(feed)} />;
};
