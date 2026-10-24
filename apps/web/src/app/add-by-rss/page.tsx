import { AddByRSSArtistsPageClient } from '../../components/AddByRSS/List/AddByRSSArtistsPageClient';
import { AddByRSSEpisodesPageClient } from '../../components/AddByRSS/List/AddByRSSEpisodesPageClient';
import { AddByRSSListClient } from '../../components/AddByRSS/List/AddByRSSListClient';
import { AddByRSSLivestreamsPageClient } from '../../components/AddByRSS/List/AddByRSSLivestreamsPageClient';
import { AddByRSSTracksPageClient } from '../../components/AddByRSS/List/AddByRSSTracksPageClient';
import type { MediaListChipsConfig } from '../../components/MediaListChips/MediaListChips';
import {
  ADD_BY_RSS_CHIPS,
  DEFAULT_MEDIA_LIST_CHIP,
  MEDIA_LIST_CHIP_QUERY_PARAM,
  readStoredMediaListChip,
  resolveMediaListChip,
} from '../../utils/mediaListChips';
import type { MediaListSearchParams } from '../_media-lists/mediaListSsr';
import { getMediaListSsr } from '../_media-lists/mediaListSsr';

type AddByRSSPageProps = { searchParams: Promise<MediaListSearchParams> };

export default async function AddByRSSPage({ searchParams }: AddByRSSPageProps) {
  const params = await searchParams;
  const ssr = await getMediaListSsr();
  const { chip, urlChip } = resolveMediaListChip({
    chips: ADD_BY_RSS_CHIPS,
    urlValue: params[MEDIA_LIST_CHIP_QUERY_PARAM],
    storedValue: readStoredMediaListChip(ssr.localSettings, 'add-by-rss'),
    defaultChip: DEFAULT_MEDIA_LIST_CHIP,
  });
  const chipsConfig: MediaListChipsConfig = {
    page: 'add-by-rss',
    chips: ADD_BY_RSS_CHIPS,
    selected: chip,
    urlChip,
  };

  switch (chip) {
    case 'podcasts':
      return (
        <AddByRSSListClient key="podcasts" chipsConfig={chipsConfig} resourceType="podcasts" />
      );
    case 'episodes':
      return <AddByRSSEpisodesPageClient key="episodes" chipsConfig={chipsConfig} />;
    case 'artists':
      return <AddByRSSArtistsPageClient key="artists" chipsConfig={chipsConfig} />;
    case 'albums':
      return <AddByRSSListClient key="albums" chipsConfig={chipsConfig} resourceType="albums" />;
    case 'tracks':
      return <AddByRSSTracksPageClient key="tracks" chipsConfig={chipsConfig} />;
    case 'livestreams':
      return <AddByRSSLivestreamsPageClient key="livestreams" chipsConfig={chipsConfig} />;
    default: {
      const _exhaustive: never = chip;
      return _exhaustive;
    }
  }
}
