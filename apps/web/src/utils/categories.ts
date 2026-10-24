import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

import type { DTOCategory } from '@podverse/helpers';
import type { QueryParamsGlobalSort } from '@podverse/helpers-requests';
import { QUERY_PARAMS_GLOBAL_SORT_VALUES } from '@podverse/helpers-requests';

type OnClickCategoryParams<T extends object> = {
  category: DTOCategory;
  setFilterParams: (params: T) => void;
  filterParams: T;
  setIsCategoryListOpen: (isOpen: boolean) => void;
  linkPath?: string;
  router: AppRouterInstance;
};

export const onClickCategory = <T extends { sort?: string }>({
  category,
  setFilterParams,
  filterParams,
  setIsCategoryListOpen,
  linkPath,
  router,
}: OnClickCategoryParams<T>) => {
  if (category?.mapping_key) {
    const currentSort = filterParams.sort;
    const isValidSort =
      currentSort && (QUERY_PARAMS_GLOBAL_SORT_VALUES as readonly string[]).includes(currentSort);
    setFilterParams({
      ...filterParams,
      type: 'category',
      sort: isValidSort ? (currentSort as QueryParamsGlobalSort) : 'recent',
      category: category.mapping_key,
      page: 1,
    } as T);
    setIsCategoryListOpen(false);
    const categoryQuery = `category=${category.mapping_key}`;
    const target =
      linkPath === undefined
        ? `?${categoryQuery}`
        : `${linkPath}${linkPath.includes('?') ? '&' : '?'}${categoryQuery}`;
    router.replace(target);
  }
};

type OnClickAllCategoriesParams<T extends { category: string | null; page: number; type: string }> =
  {
    filterParams: T;
    setFilterParams: (params: T) => void;
    setIsCategoryListOpen: (isOpen: boolean) => void;
  };

/** Clears the category: the list returns to the global directory on page 1. */
export const onClickAllCategories = <
  T extends { category: string | null; page: number; type: string },
>({
  filterParams,
  setFilterParams,
  setIsCategoryListOpen,
}: OnClickAllCategoriesParams<T>) => {
  setFilterParams({ ...filterParams, type: 'global', category: null, page: 1 });
  setIsCategoryListOpen(false);
};
