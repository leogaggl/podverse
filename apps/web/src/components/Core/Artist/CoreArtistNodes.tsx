'use client';

import React from 'react';

import type { DTOChannel } from '@podverse/helpers';

import { artistListItemFromChannel } from '../../../utils/subscribed/channelListItems';
import { CommonArtistListNodes } from '../../Common/Artist/CommonArtistNodes';
import type { ViewSelectedOption } from '../../ViewSelector/ViewSelector';

interface Params {
  channels: DTOChannel[];
  viewSelected: ViewSelectedOption;
}

export function CoreArtistNodes({ channels, viewSelected }: Params): React.ReactNode {
  const items = channels.map((channel) => artistListItemFromChannel(channel));

  return <CommonArtistListNodes items={items} viewSelected={viewSelected} />;
}
