'use client';

import { useTranslations } from 'next-intl';

import styles from '../../../styles/components/MediaPlayer/CrossDevice/RemoteLiveLabel.module.scss';

export const RemoteLiveLabel: React.FC = () => {
  const tMedia = useTranslations('media');
  return (
    <div className={styles.remoteLiveLabel} data-testid="media-player-remote-live-label">
      <span className={styles.text}>{tMedia('livestream.live')}</span>
    </div>
  );
};
