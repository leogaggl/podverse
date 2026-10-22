'use client';

import { useTranslations } from 'next-intl';
import React from 'react';

import {
  QUERY_PARAMS_SUBSCRIBED_PARTIAL_SORT,
  QUERY_PARAMS_SUBSCRIBED_TYPE,
} from '@podverse/helpers-requests';
import { MainHeader } from '@podverse/ui';

import { useSubscribedListHeader } from '../../../hooks/useSubscribedListHeader';
import { useEpisodesPageContext } from './EpisodesPageContext';
import { getEpisodesPageDropdownConfig } from './EpisodesPageDropdownConfig';

export const EpisodesPageHeader: React.FC = () => {
  const { filterParams, scope, setFilterParams, setShowCategoriesModal } = useEpisodesPageContext();
  const { type, sort, range } = filterParams;
  const tSubscriptions = useTranslations('subscriptions');
  const tFeatures = useTranslations('features');
  const tFilters = useTranslations('filters');
  const tCategories = useTranslations('categories');
  const cfg = getEpisodesPageDropdownConfig({ type, sort, tFilters, scope });
  const { buttonsNode } = useSubscribedListHeader({
    ...cfg,
    defaultGlobalSort: 'recent',
    defaultSubscribedSort: 'recent',
    filterParams,
    medium: 'av',
    range,
    setFilterParams,
    setShowCategoriesModal,
    showTypeDropdown: scope === 'browse',
    sort,
    sortValues: QUERY_PARAMS_SUBSCRIBED_PARTIAL_SORT,
    type,
    typeValues: QUERY_PARAMS_SUBSCRIBED_TYPE,
  });
  const pageTitle =
    scope === 'subscribed' ? tSubscriptions('subscribed') : tFeatures('browse.browse');
  const title = filterParams.category
    ? `${pageTitle} > ${tCategories(filterParams.category)}`
    : pageTitle;
  return <MainHeader title={title} buttonsNode={buttonsNode} />;
};
