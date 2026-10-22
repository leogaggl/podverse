'use client';

import React from 'react';

import type { DTOChannel } from '@podverse/helpers';

import { albumListItemFromChannel } from '../../../../utils/subscribed/channelListItems';
import { CommonAlbumListNodes } from '../../../Common/Artist/Album/CommonAlbumNodes';
import type { ViewSelectedOption } from '../../../ViewSelector/ViewSelector';

interface Params {
  channels: DTOChannel[];
  viewSelected: ViewSelectedOption;
}

export function CoreAlbumNodes({ channels, viewSelected }: Params): React.ReactNode {
  const items = channels.map((channel) => albumListItemFromChannel(channel));

  return <CommonAlbumListNodes items={items} viewSelected={viewSelected} />;
}
