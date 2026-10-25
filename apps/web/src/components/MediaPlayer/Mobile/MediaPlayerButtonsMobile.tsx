'use client';

import { getQueueMediumIdForChannelMediumId, MediumEnum } from '@podverse/helpers';

import { useQueues } from '../../../contexts/Queue';
import { useRemotePlayerDisplay } from '../../../hooks/useRemotePlayerDisplay';
import { AlternateEnclosureButton } from '../Buttons/AlternateEnclosureButton';
import { JumpBackButtonMobile } from '../Buttons/JumpBackButtonMobile';
import { JumpForwardButtonMobile } from '../Buttons/JumpForwardButtonMobile';
import { PlaybackDevicesButton } from '../Buttons/PlaybackDevicesButton';
import { PlayButtonMobile } from '../Buttons/PlayButtonMobile';
import { SettingsButton } from '../Buttons/SettingsButton';
import { ShareButton } from '../Buttons/ShareButton';
import { TrackNextButtonMobile } from '../Buttons/TrackNextButtonMobile';
import { TrackPreviousButtonMobile } from '../Buttons/TrackPreviousButtonMobile';

import styles from '../../../styles/components/MediaPlayer/Mobile/MediaPlayerButtonsMobile.module.scss';

export const MediaPlayerButtonsMobile = () => {
  const { activeQueue } = useQueues();
  const remote = useRemotePlayerDisplay();
  const medium_id = activeQueue?.medium_id || MediumEnum.AV;
  const showTrackPrevious = remote === null || remote.controls.canTrackPrevious;
  const showTrackNext = remote === null || remote.controls.canTrackNext;
  const showJumpButtons = remote === null || remote.controls.canSkip;
  const showSettings = remote === null || remote.controls.canSetRate;
  const remoteIsMusic =
    remote !== null &&
    getQueueMediumIdForChannelMediumId(remote.resource.medium) === MediumEnum.Music;

  return (
    <div className={styles.buttons}>
      {remote === null && <AlternateEnclosureButton />}
      <PlaybackDevicesButton />
      {showSettings && <SettingsButton />}
      <ShareButton />
      {remote !== null ? (
        remoteIsMusic ? (
          <>
            {showTrackPrevious && <TrackPreviousButtonMobile />}
            {showTrackNext && <TrackNextButtonMobile />}
          </>
        ) : (
          showJumpButtons && (
            <>
              <JumpBackButtonMobile />
              <JumpForwardButtonMobile />
            </>
          )
        )
      ) : (
        <>
          {medium_id === MediumEnum.AV && (
            <>
              <JumpBackButtonMobile />
              <JumpForwardButtonMobile />
            </>
          )}
          {medium_id === MediumEnum.Music && (
            <>
              <TrackPreviousButtonMobile />
              <TrackNextButtonMobile />
            </>
          )}
        </>
      )}
      <PlayButtonMobile />
    </div>
  );
};
