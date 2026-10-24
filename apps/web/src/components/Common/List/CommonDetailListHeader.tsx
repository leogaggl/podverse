'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import type { ChipRowItem } from '@podverse/ui';
import { ChipRow } from '@podverse/ui';

export function CommonDetailListHeader<T extends string>({
  items,
  onSelect,
  selectedKey,
  testId,
  trailing,
}: {
  items: readonly ChipRowItem<T>[];
  selectedKey: T | null;
  onSelect: (key: T) => void;
  testId: string;
  trailing?: ReactNode;
}) {
  const tFilters = useTranslations('filters');
  return (
    <ChipRow
      ariaLabel={tFilters('screen.sections_heading')}
      items={items}
      onSelect={onSelect}
      selectedKey={selectedKey}
      testId={testId}
      trailing={trailing}
    />
  );
}
