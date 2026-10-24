'use client';

import { useTranslations } from 'next-intl';

import type { DTOCategory } from '@podverse/helpers';

import { useCategories } from '../../contexts/Categories';

import styles from '../../styles/components/Category/CategoriesList.module.scss';

export const MEDIA_LIST_CATEGORIES_LIST_ID = 'media-list-categories';

type CategoriesListProps = {
  onAllCategoriesClick: () => void;
  onCategoryClick: (category: DTOCategory) => void;
  /** Mapping key of the current category; `null` marks All Categories as current. */
  selectedCategory: string | null;
};

type CategoryListItemsProps = {
  categories: DTOCategory[];
  onCategoryClick: (category: DTOCategory) => void;
  selectedCategory: string | null;
  tCategories: (key: string) => string;
};

function CategoryListItems({
  categories,
  onCategoryClick,
  selectedCategory,
  tCategories,
}: CategoryListItemsProps) {
  return categories.map((category) => {
    const isCurrent = category.mapping_key === selectedCategory;
    return (
      <li key={category.id}>
        <button
          type="button"
          className={styles.categoryButton}
          aria-current={isCurrent ? 'true' : undefined}
          onClick={() => onCategoryClick(category)}
        >
          {category.mapping_key ? tCategories(category.mapping_key) : ''}
        </button>
        {category.children && category.children.length > 0 ? (
          <ul className={styles.categoryList}>
            <CategoryListItems
              categories={category.children}
              onCategoryClick={onCategoryClick}
              selectedCategory={selectedCategory}
              tCategories={tCategories}
            />
          </ul>
        ) : null}
      </li>
    );
  });
}

/** Category picker shown in place of a media list, with All Categories first. */
export const CategoriesList = ({
  onAllCategoriesClick,
  onCategoryClick,
  selectedCategory,
}: CategoriesListProps) => {
  const { categories } = useCategories();
  const tCategories = useTranslations('categories');
  const tFeatures = useTranslations('features');
  const isAllCurrent = selectedCategory === null || selectedCategory === '';

  return (
    <section
      aria-label={tCategories('categories')}
      data-testid="media-list-categories"
      id={MEDIA_LIST_CATEGORIES_LIST_ID}
    >
      <ul className={styles.categoryList}>
        <li>
          <button
            type="button"
            className={styles.categoryButton}
            aria-current={isAllCurrent ? 'true' : undefined}
            onClick={onAllCategoriesClick}
          >
            {tFeatures('browse.category_all')}
          </button>
        </li>
        <CategoryListItems
          categories={categories}
          onCategoryClick={onCategoryClick}
          selectedCategory={selectedCategory}
          tCategories={tCategories}
        />
      </ul>
    </section>
  );
};
