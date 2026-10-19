import type { DescriptionLengthTierEnum } from '@podverse/helpers';
import { DATABASE_CONSTANTS, prepareDescriptionForStorage } from '@podverse/helpers';

/** Rows written before descriptions were prepared were cut raw at exactly this length. */
export const LEGACY_DESCRIPTION_CUT_LENGTH = DATABASE_CONSTANTS.varchar_long;

export type DescriptionBackfillPlan = {
  value: string;
  preview: string;
  is_truncated: boolean;
  /** Null means the source length is unknown until the feed is reparsed. */
  source_length: number | null;
  legacyCut: boolean;
};

/**
 * Re-prepares one stored description. A blank row keeps its value and gets an empty preview, so
 * the backfill treats it as done. Running the plan on its own output returns the same value.
 */
export const planDescriptionBackfill = (
  value: string,
  tier: DescriptionLengthTierEnum
): DescriptionBackfillPlan => {
  const legacyCut = value.length === LEGACY_DESCRIPTION_CUT_LENGTH;
  const prepared = prepareDescriptionForStorage(value, tier);

  if (prepared === null) {
    return {
      value,
      preview: '',
      is_truncated: legacyCut,
      source_length: legacyCut ? null : 0,
      legacyCut,
    };
  }

  return {
    value: prepared.value,
    preview: prepared.preview,
    is_truncated: legacyCut || prepared.is_truncated,
    source_length: legacyCut ? null : prepared.source_length,
    legacyCut,
  };
};
