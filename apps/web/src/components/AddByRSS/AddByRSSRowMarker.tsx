'use client';

import { useTranslations } from 'next-intl';
import React from 'react';
import { FaRss } from 'react-icons/fa6';

import styles from '../../styles/components/AddByRSS/AddByRSSRowMarker.module.scss';

export const AddByRSSRowMarker: React.FC = () => {
  const tFeatures = useTranslations('features');
  const label = tFeatures('add_by_rss.label');

  return (
    <span
      className={styles.marker}
      role="img"
      aria-label={label}
      title={label}
      data-testid="add-by-rss-row-marker"
    >
      <FaRss aria-hidden="true" focusable="false" />
    </span>
  );
};
