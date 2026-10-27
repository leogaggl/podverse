'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Button, MainHeader } from '@podverse/ui';

import { ROUTES } from '../../../constants/routes';
import type { AddByRSSListSortOrder } from '../../../contexts/AddByRSSListContext';
import { ListSortChip } from '../../ListSortChip/ListSortChip';
import type { MediaListChipsConfig } from '../../MediaListChips/MediaListChips';
import { MediaListChips } from '../../MediaListChips/MediaListChips';
import type { ViewSelectedOption } from '../../ViewSelector/ViewSelector';
import { ViewSelector } from '../../ViewSelector/ViewSelector';

type AddByRSSListHeaderProps = {
  title: string;
};

type AddByRSSListToolbarProps = {
  chipsConfig: MediaListChipsConfig;
  isUpdating: boolean;
  onCheckUpdates: () => void;
  sort?: {
    value: AddByRSSListSortOrder;
    onChange: (value: AddByRSSListSortOrder) => void;
  };
  view?: {
    viewSelected: ViewSelectedOption;
    setViewSelected: (view: ViewSelectedOption) => void;
  };
};

export function AddByRSSListHeader({ title }: AddByRSSListHeaderProps) {
  return <MainHeader title={title} />;
}

export function AddByRSSListToolbar({
  chipsConfig,
  isUpdating,
  onCheckUpdates,
  sort,
  view,
}: AddByRSSListToolbarProps) {
  const router = useRouter();
  const tFeatures = useTranslations('features');
  const tFilters = useTranslations('filters');
  const sortOptions: readonly { value: AddByRSSListSortOrder; label: string }[] = [
    { value: 'recent', label: tFilters('sort.recent') },
    { value: 'oldest', label: tFilters('sort.oldest') },
  ];
  const trailing =
    sort === undefined && view === undefined ? undefined : (
      <>
        {sort !== undefined ? (
          <ListSortChip
            onChange={(next) => {
              sort.onChange(next);
            }}
            options={sortOptions}
            range={null}
            testId="add-by-rss-sort"
            value={sort.value}
          />
        ) : null}
        {view !== undefined ? (
          <ViewSelector setViewSelected={view.setViewSelected} viewSelected={view.viewSelected} />
        ) : null}
      </>
    );

  return (
    <MediaListChips
      {...chipsConfig}
      actions={
        <>
          <Button onClick={() => router.push(ROUTES.ADD_BY_RSS_ADD)} variant="mini">
            {tFeatures('add_feed.add_feed')}
          </Button>
          <Button isLoading={isUpdating} onClick={onCheckUpdates} variant="mini">
            {tFeatures('add_by_rss.check_updates')}
          </Button>
        </>
      }
      actionsTestId="add-by-rss-list-actions"
      trailing={trailing}
    />
  );
}
