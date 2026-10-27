import type { RecommendationChip, SortPrefScope } from '@podverse/helpers';
import { pickSortPrefToken, recommendationsListViewModeScope } from '@podverse/helpers';

import type { HomeViewMode } from '../../prefs/homeListPrefs';
import { DEFAULT_HOME_VIEW_MODE, HOME_VIEW_MODES } from '../../prefs/homeListPrefs';
import { readSortPref, writeSortPref } from '../../prefs/sortPrefs';

/** Same scope web uses for the Recommendations chip (`mediaType` on list `recommendations`). */
const RECOMMENDATIONS_SCOPE: SortPrefScope = { kind: 'list', name: 'recommendations' };

const CHIPS = ['podcasts', 'albums', 'artists'] as const satisfies readonly RecommendationChip[];

const DEFAULT_CHIP: RecommendationChip = 'podcasts';

export const readRecommendationChip = async (): Promise<RecommendationChip> => {
  const stored = await readSortPref(RECOMMENDATIONS_SCOPE);
  return pickSortPrefToken(stored?.mediaType, CHIPS, DEFAULT_CHIP);
};

/** Podcasts is the default, so choosing it drops the stored token. */
export const writeRecommendationChip = async (chip: RecommendationChip): Promise<void> => {
  await writeSortPref(RECOMMENDATIONS_SCOPE, {
    mediaType: chip === DEFAULT_CHIP ? undefined : chip,
  });
};

const isHomeViewMode = (value: string): value is HomeViewMode => {
  return HOME_VIEW_MODES.some((mode) => mode === value);
};

/** List vs grid for one Recommendations chip. Podcasts on Home and Browse stay on their own keys. */
export const readRecommendationViewMode = async (
  chip: RecommendationChip
): Promise<HomeViewMode> => {
  const stored = await readSortPref(recommendationsListViewModeScope(chip));
  if (stored?.viewMode !== undefined && isHomeViewMode(stored.viewMode)) {
    return stored.viewMode;
  }
  return DEFAULT_HOME_VIEW_MODE;
};

export const writeRecommendationViewMode = async (
  chip: RecommendationChip,
  viewMode: HomeViewMode
): Promise<void> => {
  await writeSortPref(recommendationsListViewModeScope(chip), { viewMode });
};
