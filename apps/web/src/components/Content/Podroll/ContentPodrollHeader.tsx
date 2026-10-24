'use client';

import { useTranslations } from 'next-intl';

export const ContentPodrollHeader = () => {
  const tInfo = useTranslations('info');

  return <h3>{tInfo('podroll')}</h3>;
};
