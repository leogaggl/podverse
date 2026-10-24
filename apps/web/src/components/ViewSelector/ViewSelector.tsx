'use client';

import { useTranslations } from 'next-intl';
import { FaGear } from 'react-icons/fa6';

import { MenuChip } from '@podverse/ui';

export type ViewSelectedOption = 'grid' | 'rows';

type ViewSelectorProps = {
  viewSelected: ViewSelectedOption;
  setViewSelected: (view: ViewSelectedOption) => void;
};

export function ViewSelector({ viewSelected, setViewSelected }: ViewSelectorProps) {
  const tLayouts = useTranslations('layouts');

  return (
    <MenuChip
      icon={<FaGear />}
      label={tLayouts('change_layout_view')}
      onSelect={setViewSelected}
      options={[
        { value: 'grid', label: tLayouts('grid_view') },
        { value: 'rows', label: tLayouts('list_view') },
      ]}
      position="right"
      testId="view-selector"
      value={viewSelected}
    />
  );
}
