'use client';

import { useTranslations } from 'next-intl';

export const ContentAboutHeader = () => {
  const tInfo = useTranslations('info');

  return <h3>{tInfo('about')}</h3>;
};
