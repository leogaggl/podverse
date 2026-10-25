import type { JSX } from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { PlaybackDeviceListEntry } from '@podverse/helpers/crossDevicePlayback';

import {
  selectCanTransferPlayback,
  selectPlaybackDeviceEntries,
} from '../../playback/crossDevice/crossDevicePlayerDisplay';
import {
  useCrossDevicePlaybackView,
  usePlaybackDeviceLabel,
} from '../../playback/crossDevice/useCrossDevicePlayerDisplay';
import { usePlaybackSession } from '../../playback/PlaybackProvider';
import type { MoreMenuSection } from '../primitives/MoreMenu';
import { MoreMenu } from '../primitives/MoreMenu';

type PlaybackDeviceSheetProps = {
  onCancel: () => void;
  testID: string;
  visible: boolean;
};

const deviceItemTestId = (
  testID: string,
  entry: PlaybackDeviceListEntry,
  otherDeviceIndex: number
): string => {
  if (entry.isThisDevice) {
    return `${testID}-this-device`;
  }
  return `${testID}-device-${otherDeviceIndex}`;
};

/**
 * Lists the member's connected devices and moves playback to the one they choose. This device is
 * first. The playing device is checked. Choosing this device brings playback here; choosing
 * another sends it there. Rows stay disabled for the device that is already playing, while a move
 * is pending, and when there is nothing to move. The menu closes on every choice.
 */
export function PlaybackDeviceSheet({
  onCancel,
  testID,
  visible,
}: PlaybackDeviceSheetProps): JSX.Element {
  const view = useCrossDevicePlaybackView();
  const deviceLabel = usePlaybackDeviceLabel();
  const { t } = useTranslation();
  const { takeOverPlaybackHere, transferPlaybackTo } = usePlaybackSession();
  const entries = useMemo(() => selectPlaybackDeviceEntries(view), [view]);
  const canTransfer = selectCanTransferPlayback(view);
  const isPending = view.transfer !== null;

  const sections = useMemo<MoreMenuSection[]>(() => {
    let otherDeviceIndex = 0;
    const items = entries.map((entry) => {
      const itemTestID = deviceItemTestId(testID, entry, otherDeviceIndex);
      if (!entry.isThisDevice) {
        otherDeviceIndex += 1;
      }
      return {
        disabled: entry.isActive || isPending || !canTransfer,
        key: entry.device.session_id_text,
        label: entry.isThisDevice
          ? t('media_player.devices.this_device_entry', { device: deviceLabel(entry) })
          : deviceLabel(entry),
        onPress: () => {
          if (entry.isThisDevice) {
            void takeOverPlaybackHere();
            return;
          }
          void transferPlaybackTo(entry.device.session_id_text);
        },
        selected: entry.isActive,
        testID: itemTestID,
      };
    });

    return [
      {
        items,
        key: 'devices',
        title: t('media_player.devices.sheet_title'),
      },
    ];
  }, [
    canTransfer,
    deviceLabel,
    entries,
    isPending,
    t,
    takeOverPlaybackHere,
    testID,
    transferPlaybackTo,
  ]);

  return (
    <MoreMenu
      cancelLabel={t('misc.cancel')}
      onCancel={onCancel}
      sections={sections}
      testID={testID}
      visible={visible}
    />
  );
}
