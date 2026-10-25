import { MediumEnum } from '@podverse/helpers';

import { useMediaPlayer } from '../../../contexts/MediaPlayer';
import { useQueues } from '../../../contexts/Queue';
import { useRemotePlayerDisplay } from '../../../hooks/useRemotePlayerDisplay';
import { AlternateEnclosureButton } from '../Buttons/AlternateEnclosureButton';
import { ClipButton } from '../Buttons/ClipButton';
import { MuteButton } from '../Buttons/MuteButton';
import { PlaybackDevicesButton } from '../Buttons/PlaybackDevicesButton';
import { PlaylistAddToButton } from '../Buttons/PlaylistAddToButton';
import { RepeatButton } from '../Buttons/RepeatButton';
import { SettingsButton } from '../Buttons/SettingsButton';
import { ShareButton } from '../Buttons/ShareButton';
import { ShuffleButton } from '../Buttons/ShuffleButton';
import { VolumeSlider } from '../Sliders/VolumeSlider';

import styles from '../../../styles/components/MediaPlayer/Desktop/MediaPlayerButtonsDesktop.module.scss';

export const MediaPlayerButtonsDesktop = () => {
  const { mpAddByRSS } = useMediaPlayer();
  const { activeQueue } = useQueues();
  const remote = useRemotePlayerDisplay();
  const medium_id = activeQueue?.medium_id || MediumEnum.AV;
  const showSettings = remote === null || remote.controls.canSetRate;

  return (
    <div className={styles.buttons}>
      <div className={styles.startSection}>
        {remote === null ? (
          <>
            <AlternateEnclosureButton />
            <PlaylistAddToButton />
            <ShareButton />
            {medium_id === MediumEnum.AV && !mpAddByRSS && <ClipButton />}
            <RepeatButton />
            <ShuffleButton />
            <SettingsButton />
          </>
        ) : (
          <>
            <PlaylistAddToButton />
            <ShareButton />
            {showSettings && <SettingsButton />}
          </>
        )}
      </div>
      <div className={styles.endSection}>
        {remote === null ? (
          <>
            <PlaybackDevicesButton />
            <VolumeSlider />
            <MuteButton />
          </>
        ) : (
          <PlaybackDevicesButton />
        )}
      </div>
    </div>
  );
};
