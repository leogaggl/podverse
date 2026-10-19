export enum DescriptionLengthTierEnum {
  Standard = 'standard',
  Extended = 'extended',
  Maximum = 'maximum',
}

export const DESCRIPTION_LENGTH_TIERS: Record<
  DescriptionLengthTierEnum,
  { visibleMax: number; storedMax: number }
> = {
  [DescriptionLengthTierEnum.Standard]: { visibleMax: 10_000, storedMax: 30_000 },
  [DescriptionLengthTierEnum.Extended]: { visibleMax: 25_000, storedMax: 75_000 },
  [DescriptionLengthTierEnum.Maximum]: { visibleMax: 50_000, storedMax: 150_000 },
};

export const DEFAULT_DESCRIPTION_LENGTH_TIER = DescriptionLengthTierEnum.Standard;

// Keep this synced with the database CHECK on item_description.value/channel_description.value.
export const DESCRIPTION_STORED_MAX_CEILING = 150_000;

export const DESCRIPTION_PREVIEW_MAX_LENGTH = 400;

const DESCRIPTION_LENGTH_TIER_SET = new Set<string>([
  DescriptionLengthTierEnum.Standard,
  DescriptionLengthTierEnum.Extended,
  DescriptionLengthTierEnum.Maximum,
]);

export const isDescriptionLengthTier = (value: unknown): value is DescriptionLengthTierEnum =>
  typeof value === 'string' && DESCRIPTION_LENGTH_TIER_SET.has(value);

export const resolveDescriptionLengthTier = (
  override: string | null | undefined
): DescriptionLengthTierEnum => {
  if (override === null || override === undefined) {
    return DEFAULT_DESCRIPTION_LENGTH_TIER;
  }
  return isDescriptionLengthTier(override) ? override : DEFAULT_DESCRIPTION_LENGTH_TIER;
};

export const suggestDescriptionLengthTier = (
  longestSourceLength: number | null
): DescriptionLengthTierEnum | null => {
  if (longestSourceLength === null) {
    return null;
  }

  if (longestSourceLength <= DESCRIPTION_LENGTH_TIERS[DescriptionLengthTierEnum.Standard].visibleMax) {
    return DescriptionLengthTierEnum.Standard;
  }

  if (longestSourceLength <= DESCRIPTION_LENGTH_TIERS[DescriptionLengthTierEnum.Extended].visibleMax) {
    return DescriptionLengthTierEnum.Extended;
  }

  if (longestSourceLength <= DESCRIPTION_LENGTH_TIERS[DescriptionLengthTierEnum.Maximum].visibleMax) {
    return DescriptionLengthTierEnum.Maximum;
  }

  return null;
};
