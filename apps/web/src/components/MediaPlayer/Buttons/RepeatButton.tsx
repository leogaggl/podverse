import { useTranslations } from 'next-intl';
import { FaRepeat } from 'react-icons/fa6';

import { toggleAutoQueueRepeat } from '@podverse/playback-core';

import { useAutoQueue } from '../../../contexts/AutoQueue';
import { useAutoQueueLoadResources } from '../../../hooks/useAutoQueueLoadResources';

import styles from '../../../styles/components/MediaPlayer/Buttons/RepeatButton.module.scss';

export const RepeatButton = () => {
  const tMediaPlayer = useTranslations('media_player');
  const { autoQueueConfig, setAutoQueueConfig, setAutoQueueResources, setAutoQueueActiveRow } =
    useAutoQueue();
  const autoQueueLoadResources = useAutoQueueLoadResources();

  const onClick = () => {
    const nextConfig = toggleAutoQueueRepeat(autoQueueConfig);
    setAutoQueueActiveRow(0);
    setAutoQueueResources({});
    setAutoQueueConfig(nextConfig);
    void autoQueueLoadResources({ config: nextConfig, resources: {} });
  };

  return (
    <button
      className={`${styles.repeatButton} ${autoQueueConfig.repeat ? styles.active : ''}`}
      onClick={onClick}
      type="button"
      aria-label={tMediaPlayer('repeat.toggle_repeat')}
      aria-pressed={autoQueueConfig.repeat}
      title={
        autoQueueConfig.repeat
          ? tMediaPlayer('repeat.repeat_enabled')
          : tMediaPlayer('repeat.repeat_disabled')
      }
    >
      <FaRepeat aria-hidden />
    </button>
  );
};
