'use client';

import classNames from 'classnames';
import { useTranslations } from 'next-intl';
import { useId, useMemo } from 'react';

import { LoadingSpinner } from '@podverse/ui';

import { useAccount } from '../../contexts/Account';
import { useLocalSettings } from '../../contexts/LocalSettings';
import { useBackgroundActivity } from '../../hooks/useBackgroundActivity';
import {
  BACKGROUND_ACTIVITY_LABEL_KEYS,
  selectVisibleBackgroundActivity,
} from '../../utils/backgroundActivity/backgroundActivityDisplay';

import styles from '../../styles/components/BackgroundActivity/BackgroundActivityOverlay.module.scss';

/**
 * Bottom-right control that shows running background work, such as Add by RSS feed refreshes.
 * It appears only while that work runs for this account and remembers whether it was left open.
 */
export function BackgroundActivityOverlay() {
  const t = useTranslations('background_activity');
  const entries = useBackgroundActivity();
  const { loggedInAccount } = useAccount();
  const addByRSSFollowCount = loggedInAccount?.account_following_add_by_rss_channels?.length ?? 0;
  const visible = useMemo(
    () => selectVisibleBackgroundActivity(entries, { addByRSSFollowCount }),
    [entries, addByRSSFollowCount]
  );
  const { backgroundActivityExpanded: expanded, setBackgroundActivityExpanded } =
    useLocalSettings();
  const detailsId = useId();
  const announcement = visible
    .map((entry) => t(BACKGROUND_ACTIVITY_LABEL_KEYS[entry.kind]))
    .join('. ');

  return (
    <>
      <div aria-live="polite" className={styles.visuallyHidden} role="status">
        {announcement}
      </div>
      {visible.length > 0 ? (
        <div className={styles.root} data-testid="background-activity-overlay">
          <button
            aria-describedby={expanded ? detailsId : undefined}
            aria-expanded={expanded}
            aria-label={t('title')}
            className={classNames(styles.toggle, expanded && styles.expanded)}
            data-testid="background-activity-toggle"
            onClick={() => setBackgroundActivityExpanded((current) => !current)}
            type="button"
          >
            {expanded ? (
              <span
                className={styles.details}
                data-testid="background-activity-details"
                id={detailsId}
              >
                {visible.map((entry) => (
                  <span className={styles.line} key={entry.kind}>
                    <span className={styles.label}>
                      {t(BACKGROUND_ACTIVITY_LABEL_KEYS[entry.kind])}
                    </span>
                    {entry.total > 0 ? (
                      <span className={styles.count}>
                        {t('progress', { completed: entry.completed, total: entry.total })}
                      </span>
                    ) : null}
                  </span>
                ))}
              </span>
            ) : null}
            <LoadingSpinner className={styles.spinner} decorative size="small" />
          </button>
        </div>
      ) : null}
    </>
  );
}
