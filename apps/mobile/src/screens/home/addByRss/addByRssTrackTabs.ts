import type { TrackTab } from '../../../prefs/detailListPrefs';
import { TRACK_TABS } from '../../../prefs/detailListPrefs';

/** The track-page chips an Add by RSS item can have; Funding needs catalog data. */
export type AddByRssTrackTab = Extract<TrackTab, 'people' | 'summary' | 'transcript'>;

const isAddByRssTrackTab = (tab: TrackTab): tab is AddByRssTrackTab =>
  tab === 'people' || tab === 'summary' || tab === 'transcript';

/** Chips for one Add by RSS track, in the track page's order. Summary is always first. */
export const resolveAddByRssTrackTabs = (input: {
  hasPeople: boolean;
  hasTranscript: boolean;
}): AddByRssTrackTab[] =>
  TRACK_TABS.filter(isAddByRssTrackTab).filter((tab) => {
    switch (tab) {
      case 'summary':
        return true;
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
