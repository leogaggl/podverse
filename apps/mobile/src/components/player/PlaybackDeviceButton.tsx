import { Ionicons } from '@expo/vector-icons';
import type { JSX } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GestureResponderEvent } from 'react-native';

import { stopPropagation } from '../../lib/gesture/stopPropagation';
import { selectPlaybackDeviceEntries } from '../../playback/crossDevice/crossDevicePlayerDisplay';
import {
  useCrossDevicePlaybackView,
  usePlaybackDeviceLabel,
  usePlaybackDeviceSwitchVisible,
} from '../../playback/crossDevice/useCrossDevicePlayerDisplay';
import { FULL_PLAYER_UTILITY_ICON_SIZE } from '../../screens/player/fullPlayerLayout';
import { useTheme } from '../../theme/useTheme';
import { Button } from '../primitives/Button';
import { PlaybackDeviceSheet } from './PlaybackDeviceSheet';

type PlaybackDeviceButtonProps = {
  testID: string;
};

/**
 * Opens the device menu on the full player when two or more of the member's devices are
 * connected. Size matches the utility row (`lg`, utility glyph size). A pending move keeps
 * those bounds and shows the button spinner.
 */
export function PlaybackDeviceButton({ testID }: PlaybackDeviceButtonProps): JSX.Element | null {
  const isVisible = usePlaybackDeviceSwitchVisible();
  const view = useCrossDevicePlaybackView();
  const deviceLabel = usePlaybackDeviceLabel();
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const [isSheetVisible, setIsSheetVisible] = useState(false);

  const closeSheet = useCallback(() => {
    setIsSheetVisible(false);
  }, []);

  useEffect(() => {
    if (!isVisible) {
      closeSheet();
    }
  }, [closeSheet, isVisible]);

  if (!isVisible) {
    return null;
  }

  const iconSize = FULL_PLAYER_UTILITY_ICON_SIZE;
  const transfer = view.transfer;
  const isPending = transfer !== null;
  const targetEntry =
    transfer === null
      ? null
      : (selectPlaybackDeviceEntries(view).find(
          (entry) => entry.device.session_id_text === transfer.targetSessionIdText
        ) ?? null);
  const label = isPending
    ? t('media_player.devices.switch_device_pending', { device: deviceLabel(targetEntry) })
    : t('media_player.devices.switch_device');

  const handlePress = (event: GestureResponderEvent) => {
    stopPropagation(event);
    setIsSheetVisible(true);
  };

  return (
    <>
      <Button
        accessibilityLabel={label}
        icon={
          <Ionicons
            color={tokens.button.secondaryColor}
            name="swap-horizontal-outline"
            size={iconSize}
          />
        }
        iconOnly
        label={label}
        loading={isPending}
        onPress={handlePress}
        size="lg"
        testID={testID}
        variant="ghost"
      />
      <PlaybackDeviceSheet
        onCancel={closeSheet}
        testID={`${testID}-sheet`}
        visible={isSheetVisible}
      />
    </>
  );
}
