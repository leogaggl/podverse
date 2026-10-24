'use client';

import React from 'react';

import type { DTOChannel } from '@podverse/helpers';

import { CommonArtistHeader } from '../../Common/Artist/CommonArtistHeader';
import { CoreArtistHeaderViewDesktop } from './CoreArtistHeaderViewDesktop';
import { CoreArtistHeaderViewTablet } from './CoreArtistHeaderViewTablet';

type CoreArtistHeaderProps = {
  channel: DTOChannel;
  artistAlbums?: readonly DTOChannel[];
};

export const CoreArtistHeader: React.FC<CoreArtistHeaderProps> = ({ channel, artistAlbums }) => {
  return (
    <CommonArtistHeader
      desktop={<CoreArtistHeaderViewDesktop channel={channel} artistAlbums={artistAlbums} />}
      tablet={<CoreArtistHeaderViewTablet channel={channel} artistAlbums={artistAlbums} />}
    />
  );
};
