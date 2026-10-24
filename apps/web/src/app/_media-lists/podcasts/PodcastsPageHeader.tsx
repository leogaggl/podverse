'use client';

import { useTranslations } from 'next-intl';
import React from 'react';

import {
  QUERY_PARAMS_SUBSCRIBED_FULL_SORT,
  QUERY_PARAMS_SUBSCRIBED_TYPE,
} from '@podverse/helpers-requests';
import { MainHeader } from '@podverse/ui';

import { useSubscribedListHeader } from '../../../hooks/useSubscribedListHeader';
import { usePodcastsPageContext } from './PodcastsPageContext';
import {
  getPodcastsPageDropdownConfig,
  podcastsListViewModeScope,
} from './PodcastsPageDropdownConfig';

export const PodcastsPageHeader: React.FC = () => {
  const { filterParams, scope, setFilterParams, setShowCategoriesModal } = usePodcastsPageContext();
  const { type, sort, range } = filterParams;
  const tSubscriptions = useTranslations('subscriptions');
  const tFeatures = useTranslations('features');
  const tFilters = useTranslations('filters');
  const tCategories = useTranslations('categories');
  const cfg = getPodcastsPageDropdownConfig({ scope, type, sort, tFilters });
  const pageTitle =
    scope === 'subscribed' ? tSubscriptions('subscribed') : tFeatures('browse.browse');
  const { buttonsNode } = useSubscribedListHeader({
    ...cfg,
    defaultGlobalSort: 'recent',
    defaultSubscribedSort: 'a_z',
    filterParams,
    medium: 'av',
    range,
    setFilterParams,
    setShowCategoriesModal,
    showTypeDropdown: scope === 'browse',
    sort,
    sortValues: QUERY_PARAMS_SUBSCRIBED_FULL_SORT,
    type,
    typeValues: QUERY_PARAMS_SUBSCRIBED_TYPE,
    viewModeScope: podcastsListViewModeScope(scope),
  });
  const title = filterParams.category
    ? `${pageTitle} > ${tCategories(filterParams.category)}`
    : pageTitle;

  return <MainHeader title={title} buttonsNode={buttonsNode} />;
};
