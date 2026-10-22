'use client';

import React from 'react';

import type { AddByRSSFeedRecord } from '../../../utils/addByRSS/types';
import { artistListItemFromAddByRSSFeed } from '../../../utils/subscribed/channelListItems';
import { CommonArtistListRow } from '../../Common/Artist/CommonArtistRow';

type AddByRSSArtistRowProps = {
  feed: AddByRSSFeedRecord;
};

export const AddByRSSArtistRow: React.FC<AddByRSSArtistRowProps> = ({ feed }) => {
  return <CommonArtistListRow item={artistListItemFromAddByRSSFeed(feed)} />;
};
