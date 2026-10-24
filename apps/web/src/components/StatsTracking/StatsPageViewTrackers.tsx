'use client';

import { useEffect } from 'react';

import { useAccount } from '../../contexts/Account';
import { trackStatsPlaylistOpen } from '../../utils/statsTracking/statsTracking';

export function StatsPlaylistPageView(props: { playlistIdText: string }) {
  const { loggedInAccount } = useAccount();

  useEffect(() => {
    if (!loggedInAccount) {
      return;
    }
    trackStatsPlaylistOpen(props.playlistIdText);
  }, [loggedInAccount, props.playlistIdText]);

  return null;
}
