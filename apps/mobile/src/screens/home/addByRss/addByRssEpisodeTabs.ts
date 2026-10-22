import type { EpisodeTab } from '../../../prefs/detailListPrefs';
import { EPISODE_TABS } from '../../../prefs/detailListPrefs';

/** The episode-page chips an Add by RSS item can have; the others need catalog data. */
export type AddByRssEpisodeTab = Extract<
  EpisodeTab,
  'chapters' | 'people' | 'summary' | 'transcript'
>;

const isAddByRssEpisodeTab = (tab: EpisodeTab): tab is AddByRssEpisodeTab =>
  tab === 'chapters' || tab === 'people' || tab === 'summary' || tab === 'transcript';

/** Chips for one Add by RSS item, in the episode page's order. Summary is always first. */
export const resolveAddByRssEpisodeTabs = (input: {
  hasChapters: boolean;
  hasPeople: boolean;
  hasTranscript: boolean;
}): AddByRssEpisodeTab[] =>
  EPISODE_TABS.filter(isAddByRssEpisodeTab).filter((tab) => {
    switch (tab) {
      case 'summary':
        return true;
      case 'chapters':
        return input.hasChapters;
      case 'transcript':
        return input.hasTranscript;
      case 'people':
        return input.hasPeople;
      default: {
        const unexpected: never = tab;
        return unexpected;
      }
    }
  });
