import type { AddByRSSResourceType } from '@podverse/helpers';

import type { AddByRssDetailTab } from '../../../prefs/detailListPrefs';

export const ADD_BY_RSS_SECTION_LABEL_KEYS: Record<AddByRssDetailTab, string> = {
  about: 'info.about',
  albums: 'media.music.albums',
  downloaded: 'features.download.downloaded',
  episodes: 'media.podcast.episodes',
  funding: 'info.funding',
  people: 'info.people.people',
  tracks: 'media.music.tracks',
};

export const isAddByRssMusicFeed = (resourceType: AddByRSSResourceType): boolean =>
  resourceType === 'artists' || resourceType === 'albums' || resourceType === 'tracks';

export const addByRssItemsTab = (isMusicFeed: boolean): AddByRssDetailTab =>
  isMusicFeed ? 'tracks' : 'episodes';

export const isAddByRssSortableSection = (section: AddByRssDetailTab): boolean =>
  section === 'episodes' || section === 'tracks';

export const isAddByRssFilterableSection = (section: AddByRssDetailTab): boolean =>
  section === 'albums' ||
  section === 'episodes' ||
  section === 'tracks' ||
  section === 'downloaded';

/**
 * Podcast feeds offer Episodes, Downloaded, and About, then Funding and People when the feed
 * lists them. Artist feeds offer Albums, Tracks, and About; album and track feeds offer Tracks
 * and About. Music feeds then add Funding and People, and never Downloaded.
 */
export const resolveAddByRssSections = ({
  hasFunding,
  hasPeople,
  isArtistFeed,
  isMusicFeed,
}: {
  hasFunding: boolean;
  hasPeople: boolean;
  isArtistFeed: boolean;
  isMusicFeed: boolean;
}): AddByRssDetailTab[] => {
  const sections: AddByRssDetailTab[] = isArtistFeed
    ? ['albums', 'tracks', 'about']
    : isMusicFeed
      ? ['tracks', 'about']
      : ['episodes', 'downloaded', 'about'];
  if (hasFunding) {
    sections.push('funding');
  }
  if (hasPeople) {
    sections.push('people');
  }
  return sections;
};

/**
 * An artist feed opens on Albums, offline or not. A podcast feed opens on Downloaded when Offline
 * Mode is on. Otherwise the items chip.
 */
export const resolveAddByRssInitialSection = ({
  isArtistFeed,
  isMusicFeed,
  offline,
}: {
  isArtistFeed: boolean;
  isMusicFeed: boolean;
  offline: boolean;
}): AddByRssDetailTab => {
  if (isArtistFeed) {
    return 'albums';
  }
  return offline && !isMusicFeed ? 'downloaded' : addByRssItemsTab(isMusicFeed);
};
