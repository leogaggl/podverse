'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { SortDirection, StatsBarChartDatum } from '@podverse/ui';
import {
  Alert,
  Breadcrumbs,
  Button,
  ButtonTabs,
  Card,
  FlexBetween,
  ManagementPageShell,
  SectionBlock,
  SectionHeading,
  StatsBarChart,
  StatSummaryGrid,
  Table,
  TableWithFilter,
  useTableFilterState,
} from '@podverse/ui';

import { ManagementLoadingSpinnerOverlayStatus } from '../../../components/LoadingSpinner/ManagementLoadingSpinnerOverlay';
import { ManagementProbeChromeGate } from '../../../components/ManagementProbeChromeGate/ManagementProbeChromeGate';
import { useManagementTableChrome } from '../../../components/Table/managementTableChrome';
import { managementSearchParamsObject } from '../../../lib/managementTableUrl';
import type { CurrentUser } from '../../../lib/requests/auth';
import { getCurrentUser } from '../../../lib/requests/auth';
import type { EntityType, StatsDetail, StatsRange, StatsRow } from '../../../lib/requests/stats';
import { reqStatsDetail, reqStatsSearch, reqStatsTop } from '../../../lib/requests/stats';
import { ROUTES } from '../../../lib/routes';
import { resolveManagementTableEmptyState } from '../../../lib/tableEmptyState';

function entityTypeLabel(t: (key: string) => string, et: EntityType): string {
  if (et === 'channel') {
    return t('entityTypes.channel');
  }
  if (et === 'item') {
    return t('entityTypes.item');
  }
  if (et === 'clip') {
    return t('entityTypes.clip');
  }
  if (et === 'playlist') {
    return t('entityTypes.playlist');
  }
  return t('entityTypes.account');
}

function rangeLabel(t: (key: string) => string, r: StatsRange): string {
  if (r === 'day') {
    return t('ranges.day');
  }
  if (r === 'week') {
    return t('ranges.week');
  }
  if (r === 'month') {
    return t('ranges.month');
  }
  return t('ranges.allTime');
}

function parseEntityParam(value: string | null): EntityType {
  if (
    value === 'channel' ||
    value === 'item' ||
    value === 'clip' ||
    value === 'playlist' ||
    value === 'account'
  ) {
    return value;
  }
  return 'channel';
}

function parseRangeParam(value: string | null): StatsRange {
  if (value === 'day' || value === 'week' || value === 'month' || value === 'all-time') {
    return value;
  }
  return 'all-time';
}

const ENTITY_TYPES: EntityType[] = ['channel', 'item', 'clip', 'playlist', 'account'];

const RANGES: StatsRange[] = ['day', 'week', 'month', 'all-time'];

const STATS_COLUMN_IDS = ['title', 'range_count', 'all_time_count'] as const;

function sortStatsRows(rows: StatsRow[], sortKey: string, order: SortDirection): StatsRow[] {
  const dir = order === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (sortKey === 'range_count') {
      const va = a.range_count;
      const vb = b.range_count;
      return va > vb ? dir : va < vb ? -dir : 0;
    }
    if (sortKey === 'all_time_count') {
      const va = a.all_time_count;
      const vb = b.all_time_count;
      return va > vb ? dir : va < vb ? -dir : 0;
    }
    const av = a.title ?? '';
    const bv = b.title ?? '';
    return av.localeCompare(bv) * dir;
  });
}

type DetailData = {
  id: number;
  title: string | null;
  daily: StatsBarChartDatum[];
  overview: { label: string; value: number }[];
};

export type StatsPageClientProps = {
  initialUser: CurrentUser;
};

export function StatsPageClient({ initialUser }: StatsPageClientProps) {
  const tc = useTranslations('common');
  const tNav = useTranslations('nav');
  const ts = useTranslations('statsPage');
  const tsTable = useTranslations('tableShared');
  const chrome = useManagementTableChrome();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const basePath = pathname !== null && pathname !== '' ? pathname : ROUTES.STATS;

  const entityType = parseEntityParam(searchParams.get('entity'));
  const range = parseRangeParam(searchParams.get('range'));
  const pageNum = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10));
  const urlSearch = searchParams.get('search') ?? '';

  const [user, setUser] = useState<CurrentUser>(initialUser);
  const [rows, setRows] = useState<StatsRow[]>([]);
  const [total, setTotal] = useState(0);
  /** Start true so first paint does not treat total 0 / empty rows as definitive system-empty before reqStatsTop runs. */
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [probeStatsUnscopedExist, setProbeStatsUnscopedExist] = useState<boolean | undefined>(
    undefined
  );

  const [sortBy, setSortBy] = useState<string>('range_count');
  const [sortOrder, setSortOrder] = useState<SortDirection>('desc');

  const pageSize = 25;

  const currentQueryParams = useMemo(
    () => managementSearchParamsObject(searchParams),
    [searchParams]
  );

  const filter = useTableFilterState({
    allColumnIds: [...STATS_COLUMN_IDS],
    basePath,
    currentQueryParams,
    initialColumns: [...STATS_COLUMN_IDS],
    initialSearch: urlSearch,
    searchSyncParams: { page: '1' },
  });

  const replaceUrlParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      const p = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === '') {
          p.delete(k);
        } else {
          p.set(k, v);
        }
      }
      const qs = p.toString();
      router.push(qs !== '' ? `${basePath}?${qs}` : basePath);
    },
    [basePath, router, searchParams]
  );

  useEffect(() => {
    const needsEntity = searchParams.get('entity') === null;
    const needsRange = searchParams.get('range') === null;
    if (needsEntity || needsRange) {
      const p = new URLSearchParams(searchParams.toString());
      if (needsEntity) {
        p.set('entity', 'channel');
      }
      if (needsRange) {
        p.set('range', 'all-time');
      }
      router.replace(`${basePath}?${p.toString()}`);
    }
  }, [basePath, router, searchParams]);

  useEffect(() => {
    let cancelled = false;
    const verify = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!cancelled && currentUser) {
          setUser(currentUser);
        }
      } catch {
        // Session fallback will redirect via layout
      }
    };
    void verify();
    return () => {
      cancelled = true;
    };
  }, []);

  const searchParamsKey = searchParams.toString();

  useEffect(() => {
    let cancelled = false;
    const entity = parseEntityParam(searchParams.get('entity'));
    const rangeResolved = parseRangeParam(searchParams.get('range'));
    const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10));
    const search = searchParams.get('search') ?? '';
    const searching = search.trim() !== '';

    const run = async () => {
      setLoading(true);
      setError(null);
      setDetail(null);
      try {
        const result = searching
          ? await reqStatsSearch(entity, search.trim(), rangeResolved, page, pageSize)
          : await reqStatsTop(entity, rangeResolved, page, pageSize);
        if (!cancelled) {
          setRows(result.rows);
          setTotal(result.total);
        }
      } catch {
        if (!cancelled) {
          setError(ts('failedToLoad'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [pageSize, searchParams, searchParamsKey, ts]);

  useEffect(() => {
    if (loading || error !== null) {
      return;
    }
    const search = urlSearch.trim();
    if (search === '') {
      setProbeStatsUnscopedExist(undefined);
      return;
    }
    if (rows.length > 0) {
      setProbeStatsUnscopedExist(true);
      return;
    }
    let cancelled = false;
    void reqStatsTop(entityType, range, 1, 1).then((r) => {
      if (!cancelled) {
        setProbeStatsUnscopedExist(r.total > 0);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [loading, error, entityType, range, urlSearch, rows.length]);

  const handleEntityTypeChange = useCallback(
    (newType: EntityType) => {
      replaceUrlParams({ entity: newType, page: '1' });
    },
    [replaceUrlParams]
  );

  const handleRangeChange = useCallback(
    (newRange: StatsRange) => {
      replaceUrlParams({ range: newRange, page: '1' });
    },
    [replaceUrlParams]
  );

  const handleRowClick = async (row: StatsRow) => {
    setDetailLoading(true);
    try {
      const data: StatsDetail = await reqStatsDetail(entityType, row.id);
      const overview = [
        { label: ts('ranges.day'), value: data.day_count },
        { label: ts('ranges.week'), value: data.week_count },
        { label: ts('ranges.month'), value: data.month_count },
        { label: ts('ranges.allTime'), value: data.all_time_count },
      ];
      const daily = data.daily.map((point) => ({
        label: point.day,
        value: point.listener_count,
      }));
      setDetail({ id: data.id, title: data.title, daily, overview });
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const entityButtonTabs = useMemo(
    () =>
      ENTITY_TYPES.map((et) => ({
        key: et,
        label:
          et === 'channel'
            ? ts('entityTypes.channel')
            : et === 'item'
              ? ts('entityTypes.item')
              : et === 'clip'
                ? ts('entityTypes.clip')
                : et === 'playlist'
                  ? ts('entityTypes.playlist')
                  : ts('entityTypes.account'),
        onClick: () => {
          handleEntityTypeChange(et);
        },
      })),
    [handleEntityTypeChange, ts]
  );

  const rangeButtonTabs = useMemo(
    () =>
      RANGES.map((r) => ({
        key: r,
        label: rangeLabel(ts, r),
        onClick: () => {
          handleRangeChange(r);
        },
      })),
    [handleRangeChange, ts]
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const chartData: StatsBarChartDatum[] = rows.slice(0, 10).map((row) => ({
    label: truncateTitle(row.title ?? ts('idValue', { id: row.id }), 20),
    value: row.range_count,
  }));

  const selectedEntityLabel = entityTypeLabel(ts, entityType);
  const rangeLabelResolved = rangeLabel(ts, range);

  const detailSummaryItems = useMemo(() => {
    if (!detail) {
      return [];
    }
    return detail.overview.map((stat) => ({
      label: stat.label,
      value: stat.value.toLocaleString(),
    }));
  }, [detail]);

  const sortedRows = useMemo(
    () => sortStatsRows(rows, sortBy, sortOrder),
    [rows, sortBy, sortOrder]
  );

  const hasStatsDataInSystem =
    loading || error !== null
      ? undefined
      : urlSearch.trim() === ''
        ? total > 0
        : probeStatsUnscopedExist === undefined
          ? undefined
          : probeStatsUnscopedExist;

  const probingStatsExistence =
    !loading &&
    error === null &&
    urlSearch.trim() !== '' &&
    rows.length === 0 &&
    probeStatsUnscopedExist === undefined;

  const statsSystemEmpty =
    !loading && error === null && sortedRows.length === 0 && hasStatsDataInSystem === false;

  const statsTableEmptyState = resolveManagementTableEmptyState({
    filteredEmptyMessage: tsTable('noResults'),
    hasDataInSystem: hasStatsDataInSystem,
    hasVisibleRows: sortedRows.length > 0,
    systemEmptyMessage: chrome.systemEmptyMessage,
  });

  const columns = useMemo(
    () => [
      {
        header: '#',
        id: 'rank',
        label: '#',
        sortable: false,
      },
      {
        header: ts('table.title'),
        id: 'title',
        label: ts('table.title'),
        sortAriaLabel: chrome.sortAriaForColumn(String(ts('table.title'))),
        sortKey: 'title',
      },
      {
        header: ts('table.rangeViews', { range: rangeLabelResolved }),
        id: 'range_count',
        label: ts('table.rangeViews', { range: rangeLabelResolved }),
        sortAriaLabel: chrome.sortAriaForColumn(
          String(ts('table.rangeViews', { range: rangeLabelResolved }))
        ),
        sortKey: 'range_count',
      },
      {
        header: ts('ranges.allTime'),
        id: 'all_time_count',
        label: ts('ranges.allTime'),
        sortAriaLabel: chrome.sortAriaForColumn(String(ts('ranges.allTime'))),
        sortKey: 'all_time_count',
      },
    ],
    [chrome, rangeLabelResolved, ts]
  );

  if (!user) {
    return null;
  }

  return (
    <ManagementPageShell
      title={ts('title')}
      headerBreadcrumbs={
        <Breadcrumbs
          LinkComponent={Link}
          navAriaLabel={tc('breadcrumbNav')}
          items={[{ href: ROUTES.DASHBOARD, label: tNav('dashboard') }, { label: ts('title') }]}
        />
      }
    >
      {statsSystemEmpty ? (
        <p role="status">{chrome.systemEmptyMessage}</p>
      ) : (
        <ManagementProbeChromeGate
          bypassWhileError={error !== null}
          loading={loading}
          probingExistence={probingStatsExistence}
        >
          <>
            <SectionBlock>
              <ButtonTabs buttonTabs={entityButtonTabs} selectedKey={entityType} />
            </SectionBlock>

            <SectionBlock>
              <ButtonTabs buttonTabs={rangeButtonTabs} selectedKey={range} />
            </SectionBlock>

            <SectionBlock>
              <SectionHeading level={3}>
                {ts('topChartHeading', { entity: selectedEntityLabel, range: rangeLabelResolved })}
              </SectionHeading>
              <StatsBarChart
                data={chartData}
                emptyMessage={error ?? ts('noStatsDataForRange')}
                loading={loading}
                loadingLabel={ts('loadingChart')}
                valueLabel={ts('views')}
              />
            </SectionBlock>

            <ManagementLoadingSpinnerOverlayStatus
              isLoading={detailLoading}
              message={ts('loadingDetail')}
            />
            {error !== null && <Alert>{error}</Alert>}
            {error === null && (
              <TableWithFilter<StatsRow>
                columns={columns}
                emptyState={statsTableEmptyState}
                filter={filter}
                filterableColumnIds={[...STATS_COLUMN_IDS]}
                getRowKey={(row) => String(row.id)}
                labels={chrome.filterLabels}
                pagination={{
                  currentPage: pageNum,
                  nextLabel: tc('paginationNextButton'),
                  onPageChange: (newPage) => {
                    replaceUrlParams({ page: String(newPage) });
                  },
                  pageIndicatorLabel: tc('paginationPageOf', {
                    currentPage: pageNum,
                    totalPages,
                  }),
                  prevLabel: tc('paginationPrevButton'),
                  totalPages,
                }}
                paginationMode="page"
                renderCells={(row, index) => (
                  <>
                    <Table.Cell>{(pageNum - 1) * pageSize + index + 1}</Table.Cell>
                    <Table.Cell>{row.title ?? ts('idValue', { id: row.id })}</Table.Cell>
                    <Table.Cell>{row.range_count.toLocaleString()}</Table.Cell>
                    <Table.Cell>{row.all_time_count.toLocaleString()}</Table.Cell>
                  </>
                )}
                rows={sortedRows}
                selectedRowKey={detail !== null ? String(detail.id) : undefined}
                sortBy={sortBy}
                sortOrder={sortOrder}
                sortableColumnIds={[...STATS_COLUMN_IDS]}
                onRowClick={(row) => {
                  void handleRowClick(row);
                }}
                onSortChange={(key, order) => {
                  setSortBy(key);
                  setSortOrder(order);
                }}
              />
            )}
            {detail !== null && !detailLoading ? (
              <div style={{ marginTop: 'var(--spacing-2xl)' }}>
                <Card variant="bordered">
                  <FlexBetween>
                    <SectionHeading level={3}>
                      {detail.title ?? ts('idValue', { id: detail.id })}
                    </SectionHeading>
                    <Button type="button" variant="mini" onClick={() => setDetail(null)}>
                      {ts('close')}
                    </Button>
                  </FlexBetween>

                  <StatSummaryGrid items={detailSummaryItems} />

                  <SectionHeading level={4}>{ts('detail.dailyBreakdown')}</SectionHeading>
                  <StatsBarChart
                    data={detail.daily}
                    emptyMessage={ts('noStatsDataForRange')}
                    loadingLabel={ts('loadingChart')}
                    valueLabel={ts('views')}
                    xTickInterval="preserveStartEnd"
                  />
                </Card>
              </div>
            ) : null}
          </>
        </ManagementProbeChromeGate>
      )}
    </ManagementPageShell>
  );
}

function truncateTitle(title: string, maxLen: number): string {
  if (title.length <= maxLen) return title;
  return title.slice(0, maxLen - 1) + '\u2026';
}
