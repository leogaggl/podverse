'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useMemo, useState } from 'react';

import type { DTOChannel } from '@podverse/helpers';

import { AddByRSSTrackNodes } from '../../../components/AddByRSS/Artist/Album/Track/AddByRSSTrackNodes';
import { CommonAlbumListNodes } from '../../../components/Common/Artist/Album/CommonAlbumNodes';
import { useAccount } from '../../../contexts/Account';
import type { ArtistPageAddByRssData } from '../../../utils/addByRSS/artistPageAddByRss';
import { getArtistPageAddByRssData } from '../../../utils/addByRSS/artistPageAddByRss';
import { onAddByRSSFeedChanged } from '../../../utils/addByRSS/feedChangedEvent';
import { albumListItemFromAddByRSSFeed } from '../../../utils/subscribed/channelListItems';

import styles from '../../../styles/components/Artist/ArtistPageAlbumSections.module.scss';

/**
 * Browser-only albums and tracks for this artist. These stay empty on the server, so the
 * section is absent from the page HTML and from anyone else's view.
 */
function useArtistPageAddByRssData(channel: DTOChannel): ArtistPageAddByRssData | null {
  const { loggedInAccount } = useAccount();
  const accountIdText = loggedInAccount === null ? null : loggedInAccount.id_text;
  const [data, setData] = useState<ArtistPageAddByRssData | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => onAddByRSSFeedChanged(() => setReloadKey((key) => key + 1)), []);

  useEffect(() => {
    if (accountIdText === null) {
      setData(null);
      return;
    }

    let cancelled = false;
    getArtistPageAddByRssData(channel.podcast_guid)
      .then((next) => {
        if (!cancelled) {
          setData(next);
        }
      })
      .catch((error: unknown) => {
        console.error('Add by RSS albums for this artist could not be loaded', error);
        if (!cancelled) {
          setData(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accountIdText, channel.podcast_guid, reloadKey]);

  return data;
}

export function ArtistPageYourAddByRssAlbums({ channel }: { channel: DTOChannel }) {
  const tMedia = useTranslations('media');
  const headingId = useId();
  const data = useArtistPageAddByRssData(channel);
  const albumItems = useMemo(
    () =>
      (data?.albums ?? []).map((source) => ({
        ...albumListItemFromAddByRSSFeed(source.feed),
        showAddByRssMarker: true,
      })),
    [data]
  );

  if (data === null || data.albums.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby={headingId} data-testid="artist-your-add-by-rss-albums">
      <h2 id={headingId} className={styles.heading}>
        {tMedia('music.your_add_by_rss_albums')}
      </h2>
      <CommonAlbumListNodes items={albumItems} viewSelected="rows" />
    </section>
  );
}

export function ArtistPageYourAddByRssTracks({ channel }: { channel: DTOChannel }) {
  const data = useArtistPageAddByRssData(channel);

  if (data === null || data.tracks.length === 0) {
    return null;
  }

  return (
    <section data-testid="artist-your-add-by-rss-tracks">
      <AddByRSSTrackNodes items={data.tracks} viewSelected="rows" showAddByRssMarker />
    </section>
  );
}

export function useArtistPageAddByRssPresence(channel: DTOChannel): {
  hasAlbums: boolean;
  hasTracks: boolean;
} {
  const data = useArtistPageAddByRssData(channel);
  return {
    hasAlbums: (data?.albums.length ?? 0) > 0,
    hasTracks: (data?.tracks.length ?? 0) > 0,
  };
}
