'use client';

import classNames from 'classnames';
import { useTranslations } from 'next-intl';

import { LoadingSpinner } from '@podverse/ui';

import styles from '../../styles/components/MediaListChips/MediaListChips.module.scss';

type MediaListLoadingSpinnerProps = { className?: string };

/** The list area's loading state on the media chip pages: a spinner where the rows go. */
export function MediaListLoadingSpinner({ className }: MediaListLoadingSpinnerProps) {
  const t = useTranslations('misc');
  return (
    <div
      className={classNames(styles.listLoading, className)}
      data-testid="media-list-loading"
      role="status"
    >
      <LoadingSpinner ariaLabel={t('loading')} size="large" />
    </div>
  );
}
