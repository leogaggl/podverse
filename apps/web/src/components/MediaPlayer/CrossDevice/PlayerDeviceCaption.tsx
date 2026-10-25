'use client';

import { useTranslations } from 'next-intl';

import type { PlaybackDeviceListEntry, PlaybackStatus } from '@podverse/helpers';

import { useCrossDevicePlaybackSnapshot } from '../../../contexts/CrossDevicePlayback';
import { usePlaybackDevices } from '../../../hooks/usePlaybackDevices';
import type { PlayerDeviceCaption as PlayerDeviceCaptionModel } from '../../../lib/crossDevicePlayback/remotePlayerDisplay';
import { resolvePlayerDeviceCaption } from '../../../lib/crossDevicePlayback/remotePlayerDisplay';

import styles from '../../../styles/components/MediaPlayer/CrossDevice/PlayerDeviceCaption.module.scss';

type DeviceCaptionTranslator = {
  (key: 'cross_device.playing_in_another_tab'): string;
  (
    key:
      | 'cross_device.sending_to_device'
      | 'cross_device.playing_on_device'
      | 'cross_device.paused_on_device'
      | 'cross_device.starting_on_device',
    values: { device: string }
  ): string;
};

function otherDeviceCaption(
  status: PlaybackStatus,
  device: string,
  t: DeviceCaptionTranslator
): string {
  switch (status) {
    case 'playing':
      return t('cross_device.playing_on_device', { device });
    case 'paused':
      return t('cross_device.paused_on_device', { device });
    case 'loading':
      return t('cross_device.starting_on_device', { device });
    default: {
      const _unhandled: never = status;
      return _unhandled;
    }
  }
}

function playerDeviceCaptionText(
  caption: PlayerDeviceCaptionModel,
  formatName: (entry: PlaybackDeviceListEntry | null) => string,
  t: DeviceCaptionTranslator
): string {
  switch (caption.kind) {
    case 'sending':
      return t('cross_device.sending_to_device', { device: formatName(caption.entry) });
    case 'other_tab':
      return t('cross_device.playing_in_another_tab');
    case 'other_device':
      return otherDeviceCaption(caption.status, formatName(caption.entry), t);
    default: {
      const _unhandled: never = caption;
      return _unhandled;
    }
  }
}

export const PlayerDeviceCaption: React.FC = () => {
  const availability = useCrossDevicePlaybackSnapshot((snapshot) => snapshot.availability);
  const role = useCrossDevicePlaybackSnapshot((snapshot) => snapshot.role);
  const thisSessionIdText = useCrossDevicePlaybackSnapshot(
    (snapshot) => snapshot.thisSessionIdText
  );
  const activeSessionIdText = useCrossDevicePlaybackSnapshot(
    (snapshot) => snapshot.displayState?.active_session_id_text ?? null
  );
  const status = useCrossDevicePlaybackSnapshot(
    (snapshot) => snapshot.displayState?.status ?? null
  );
  const pendingTransferTargetSessionIdText = useCrossDevicePlaybackSnapshot(
    (snapshot) => snapshot.pendingTransfer?.targetSessionIdText ?? null
  );
  const { entries, formatName } = usePlaybackDevices();
  const t = useTranslations('media_player');
  const caption = resolvePlayerDeviceCaption({
    availability,
    role,
    thisSessionIdText,
    activeSessionIdText,
    status,
    pendingTransferTargetSessionIdText,
    entries,
  });

  if (caption === null) {
    return null;
  }

  return (
    <div className={styles.caption} data-testid="media-player-device-caption">
      {playerDeviceCaptionText(caption, formatName, t)}
    </div>
  );
};
