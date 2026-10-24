'use client';

import { useTranslations } from 'next-intl';

export const ContentPeopleHeader = () => {
  const tInfo = useTranslations('info');

  return <h3>{tInfo('people.people')}</h3>;
};
