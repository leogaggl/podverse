import { MediaPlayerSegmentStrip } from '../SegmentStrip/MediaPlayerSegmentStrip';
import { MediaPlayerButtonsMobile } from './MediaPlayerButtonsMobile';
import { MediaPlayerControlsMobile } from './MediaPlayerControlsMobile';
import { MediaPlayerInfoMobile } from './MediaPlayerInfoMobile';

import styles from '../../../styles/components/MediaPlayer/Mobile/MediaPlayerMobile.module.scss';

export const MediaPlayerMobile = () => {
  return (
    <div className={styles.playerMobile}>
      <MediaPlayerSegmentStrip variant="mobile" />
      <div className={styles.infoSection}>
        <MediaPlayerInfoMobile />
        <MediaPlayerButtonsMobile />
      </div>
      <MediaPlayerControlsMobile />
    </div>
  );
};
