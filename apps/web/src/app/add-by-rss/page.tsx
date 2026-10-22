import {
  AddByRSSArtistsPageClient,
} from '../../components/AddByRSS/List/AddByRSSArtistsPageClient';
import {
  AddByRSSEpisodesPageClient,
} from '../../components/AddByRSS/List/AddByRSSEpisodesPageClient';
import { AddByRSSListClient } from '../../components/AddByRSS/List/AddByRSSListClient';
import { AddByRSSLivestreamsPageClient } from '../../components/AddByRSS/List/AddByRSSLivestreamsPageClient';
import { AddByRSSTracksPageClient } from '../../components/AddByRSS/List/AddByRSSTracksPageClient';
import { MediaListChips } from '../../components/MediaListChips/MediaListChips';
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
  const chipsNode = (
    <MediaListChips page="add-by-rss" chips={ADD_BY_RSS_CHIPS} selected={chip} urlChip={urlChip} />
  );

  switch (chip) {
    case 'podcasts':
      return <AddByRSSListClient key="podcasts" resourceType="podcasts" chipsNode={chipsNode} />;
    case 'episodes':
      return <AddByRSSEpisodesPageClient key="episodes" chipsNode={chipsNode} />;
    case 'artists':
      return <AddByRSSArtistsPageClient key="artists" chipsNode={chipsNode} />;
    case 'albums':
      return <AddByRSSListClient key="albums" resourceType="albums" chipsNode={chipsNode} />;
    case 'tracks':
      return <AddByRSSTracksPageClient key="tracks" chipsNode={chipsNode} />;
    case 'livestreams':
      return <AddByRSSLivestreamsPageClient key="livestreams" chipsNode={chipsNode} />;
    default: {
      const _exhaustive: never = chip;
      return _exhaustive;
    }
  }
}
