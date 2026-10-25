import { useRemotePlayerDisplay } from '../../../hooks/useRemotePlayerDisplay';
import { RemoteLiveLabel } from '../CrossDevice/RemoteLiveLabel';
import { MediaPlayerProgress } from '../Sliders/MediaPlayerProgress';

import styles from '../../../styles/components/MediaPlayer/Mobile/MediaPlayerControlsMobile.module.scss';

export const MediaPlayerControlsMobile = () => {
  const remote = useRemotePlayerDisplay();
  const showProgress = remote === null || remote.controls.showsProgress;

  return (
    <div className={styles.controls}>
      {showProgress ? <MediaPlayerProgress /> : <RemoteLiveLabel />}
    </div>
  );
};
