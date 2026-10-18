'use client';

import { useTranslations } from 'next-intl';

import styles from '../../../styles/components/Content/About/ContentAboutHeader.module.scss';

export const ContentPeopleHeader = () => {
  const tInfo = useTranslations('info');

  return <h3 className={styles.header}>{tInfo('people.people')}</h3>;
};
