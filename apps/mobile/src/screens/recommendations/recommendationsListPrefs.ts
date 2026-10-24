import type { RecommendationChip, SortPrefScope } from '@podverse/helpers';
import { pickSortPrefToken } from '@podverse/helpers';

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
