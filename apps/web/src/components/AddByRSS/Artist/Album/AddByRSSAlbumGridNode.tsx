'use client';

import React from 'react';

import type { AddByRSSFeedRecord } from '../../../../utils/addByRSS/types';
import { albumListItemFromAddByRSSFeed } from '../../../../utils/subscribed/channelListItems';
import { CommonAlbumListGridNode } from '../../../Common/Artist/Album/CommonAlbumGridNode';

type AddByRSSAlbumGridNodeProps = {
  feed: AddByRSSFeedRecord;
};

export const AddByRSSAlbumGridNode: React.FC<AddByRSSAlbumGridNodeProps> = ({ feed }) => {
  return <CommonAlbumListGridNode item={albumListItemFromAddByRSSFeed(feed)} />;
};
