'use client';

import { useTranslations } from 'next-intl';

import type { QueryParamsStatsRange } from '@podverse/helpers-requests';
import { QUERY_PARAMS_STATS_RANGE_VALUES } from '@podverse/helpers-requests';
import { SortChip } from '@podverse/ui';

import { STATS_RANGE_LABEL_KEYS } from '../../utils/dropdownMenuItems';

type ListSortChipProps<TSort extends string> = {
  /** Already-localized sort labels, in menu order. */
  options: readonly { value: TSort; label: string }[];
  value: TSort;
  /** The sort that takes a popularity range ('top'). Omit when no option takes one. */
  rangeSort?: TSort;
  /** Current range; `null` unless `value === rangeSort`. */
  range: QueryParamsStatsRange | null;
  /** `range` is non-null exactly when `sort === rangeSort`. */
  onChange: (sort: TSort, range: QueryParamsStatsRange | null) => void;
  /** Which chip edge the menu lines up with. Omit to keep the sort menu's default (left). */
  position?: 'left' | 'right';
  testId: string;
};

/** List sort chip: the face is the current sort, or the range while Top is selected. */
export function ListSortChip<TSort extends string>({
  options,
  value,
  rangeSort,
  range,
  onChange,
  position,
  testId,
}: ListSortChipProps<TSort>) {
  const tFilters = useTranslations('filters');

  return (
    <SortChip
      heading={tFilters('screen.sort_heading')}
      onChange={onChange}
      options={options}
      range={
        rangeSort === undefined
          ? undefined
          : {
              sort: rangeSort,
              heading: tFilters('screen.range_heading'),
              options: QUERY_PARAMS_STATS_RANGE_VALUES.map((statsRange) => ({
                value: statsRange,
                label: tFilters(STATS_RANGE_LABEL_KEYS[statsRange]),
              })),
              value: range,
            }
      }
      testId={testId}
      value={value}
      {...(position !== undefined ? { position } : {})}
    />
  );
}
