'use client';

import { useTranslations } from 'next-intl';

import { Chip } from '@podverse/ui';

import { MEDIA_LIST_CATEGORIES_LIST_ID } from './CategoriesList';

type CategoriesChipProps = {
  /** Mapping key of the chosen category, or `null` for all categories. */
  category: string | null;
  isListOpen: boolean;
  onToggle: () => void;
};

/** Browse filter chip that shows or hides the category list. */
export function CategoriesChip({ category, isListOpen, onToggle }: CategoriesChipProps) {
  const tCategories = useTranslations('categories');
  const heading = tCategories('categories');
  const hasCategory = category !== null && category !== '';
  const faceLabel = hasCategory ? tCategories(category) : heading;

  return (
    <Chip
      aria-controls={isListOpen ? MEDIA_LIST_CATEGORIES_LIST_ID : undefined}
      aria-expanded={isListOpen}
      aria-label={hasCategory ? `${heading}: ${faceLabel}` : undefined}
      data-testid="media-list-category-chip"
      onClick={onToggle}
      selected={isListOpen || hasCategory}
      variant="filter"
    >
      {faceLabel}
    </Chip>
  );
}
