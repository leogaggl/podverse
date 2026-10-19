'use client';

import { useTranslations } from 'next-intl';

import { useConfig } from '../../contexts/Config';

export function DirectoryRemovedNotice() {
  const tInfo = useTranslations('info');
  const config = useConfig();

  return (
    <p>{tInfo('removed.show_not_in_directory', { brand_name: config.public.brand.name })}</p>
  );
}
