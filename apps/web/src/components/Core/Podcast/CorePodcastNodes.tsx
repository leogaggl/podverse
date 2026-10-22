'use client';

import React from 'react';

import type { ChannelUnseenBadge, DTOChannel } from '@podverse/helpers';

import { podcastListItemFromChannel } from '../../../utils/subscribed/channelListItems';
import { CommonPodcastListNodes } from '../../Common/Podcast/CommonPodcastNodes';
import type { ViewSelectedOption } from '../../ViewSelector/ViewSelector';

interface Params {
  channels: DTOChannel[];
  viewSelected: ViewSelectedOption;
  /** Keyed by channel id_text. Omitted by lists where unseen counts do not apply. */
  unseenBadges?: ReadonlyMap<string, ChannelUnseenBadge>;
}

export function CorePodcastNodes({
  channels,
  unseenBadges,
  viewSelected,
}: Params): React.ReactNode {
  const items = channels.map((channel) =>
    podcastListItemFromChannel(channel, unseenBadges?.get(channel.id_text) ?? null)
  );

  return <CommonPodcastListNodes items={items} viewSelected={viewSelected} />;
}
