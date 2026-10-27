import { useRemotePlayerDisplay } from '../../../hooks/useRemotePlayerDisplay';
import { RemoteLiveLabel } from '../CrossDevice/RemoteLiveLabel';
import { MediaPlayerProgress } from '../Sliders/MediaPlayerProgress';

import styles from '../../../styles/components/MediaPlayer/Mobile/MediaPlayerControlsMobile.module.scss';

export const MediaPlayerControlsMobile = () => {
  const remote = useRemotePlayerDisplay();
  const showProgress = remote === null || remote.controls.showsProgress;

  if (showProgress) {
    return <MediaPlayerProgress layoutVariant="edge" />;
  }

  return (
    <div className={styles.liveEdge}>
      <RemoteLiveLabel />
    </div>
  );
};
