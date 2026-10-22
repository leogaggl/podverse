import type { AddByRSSResourceType } from '@podverse/helpers';

import type { AddByRssDetailTab } from '../../../prefs/detailListPrefs';

export const ADD_BY_RSS_SECTION_LABEL_KEYS: Record<AddByRssDetailTab, string> = {
  about: 'info.about',
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
  section === 'episodes' || section === 'tracks' || section === 'downloaded';

/**
 * Podcast feeds offer Episodes, Downloaded, and About, then Funding and People when the feed
 * lists them. Music feeds offer Tracks and About, then Funding and People, and no Downloaded.
 */
export const resolveAddByRssSections = ({
  hasFunding,
  hasPeople,
  isMusicFeed,
}: {
  hasFunding: boolean;
  hasPeople: boolean;
  isMusicFeed: boolean;
}): AddByRssDetailTab[] => {
  const sections: AddByRssDetailTab[] = isMusicFeed
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

/** Downloaded when Offline Mode is on for a podcast feed; otherwise the items chip. */
export const resolveAddByRssInitialSection = ({
  isMusicFeed,
  offline,
}: {
  isMusicFeed: boolean;
  offline: boolean;
}): AddByRssDetailTab => (offline && !isMusicFeed ? 'downloaded' : addByRssItemsTab(isMusicFeed));
