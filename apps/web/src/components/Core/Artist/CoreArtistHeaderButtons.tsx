'use client';

import React from 'react';

import type { DTOChannel } from '@podverse/helpers';

import { HeaderButtons } from '../../Media/Header/HeaderButtons';

type CoreArtistHeaderButtonsProps = {
  channel: DTOChannel;
  artistAlbums?: readonly DTOChannel[];
};

export const CoreArtistHeaderButtons: React.FC<CoreArtistHeaderButtonsProps> = ({
  channel,
  artistAlbums,
}) => {
  return (
    <HeaderButtons
      channel={channel}
      shareArgs={{ item: null, clip: null, item_chapter: null, item_soundbite: null }}
      kind="artist"
      artistAlbums={artistAlbums}
    />
  );
};
