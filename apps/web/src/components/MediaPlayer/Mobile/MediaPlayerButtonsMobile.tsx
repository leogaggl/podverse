'use client';

import { useRemotePlayerDisplay } from '../../../hooks/useRemotePlayerDisplay';
import { JumpBackButtonMobile } from '../Buttons/JumpBackButtonMobile';
import { JumpForwardButtonMobile } from '../Buttons/JumpForwardButtonMobile';
import { PlaybackDevicesButton } from '../Buttons/PlaybackDevicesButton';
import { PlayButtonMobile } from '../Buttons/PlayButtonMobile';

import styles from '../../../styles/components/MediaPlayer/Mobile/MediaPlayerButtonsMobile.module.scss';

/**
 * Narrow now-playing bar. Play, jump, and device switch stay here. Add, Share, More,
 * track skip, and the other secondary controls are on the full-screen player.
 */
export const MediaPlayerButtonsMobile = () => {
  const remote = useRemotePlayerDisplay();
  const showJumpButtons = remote === null || remote.controls.canSkip;

  return (
    <div className={styles.buttons}>
      {showJumpButtons && (
        <>
          <JumpBackButtonMobile />
          <JumpForwardButtonMobile />
        </>
      )}
      <PlayButtonMobile />
      <PlaybackDevicesButton />
    </div>
  );
};
