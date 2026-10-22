'use client';

import React from 'react';

import type { AddByRSSFeedRecord } from '../../../../utils/addByRSS/types';
import { albumListItemFromAddByRSSFeed } from '../../../../utils/subscribed/channelListItems';
import { CommonAlbumListRow } from '../../../Common/Artist/Album/CommonAlbumRow';

type AddByRSSAlbumRowProps = {
  feed: AddByRSSFeedRecord;
};

export const AddByRSSAlbumRow: React.FC<AddByRSSAlbumRowProps> = ({ feed }) => {
  return <CommonAlbumListRow item={albumListItemFromAddByRSSFeed(feed)} />;
};
