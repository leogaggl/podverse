import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import {
  FULL_PLAYER_SPEED_LABEL_SIZE,
  FULL_PLAYER_UTILITY_ICON_SIZE,
  FULL_PLAYER_UTILITY_ROW_HEIGHT,
} from '../../screens/player/fullPlayerLayout';
import { useTheme } from '../../theme/useTheme';
import { Button } from '../primitives/Button';

type FullPlayerUtilityRowProps = {
  /** Music swaps the speed control for shuffle and repeat; it always plays at 1x. */
  isMusicNowPlaying: boolean;
  isRepeatEnabled: boolean;
  isShuffleEnabled: boolean;
  onOpenMore: () => void;
  onOpenSleepTimer: () => void;
  onOpenSpeed: () => void;
  onToggleRepeat: () => void;
  onToggleShuffle: () => void;
  playbackRate: number;
};

const formatRate = (rate: number): string => {
  if (rate % 1 === 0) {
    return `${Math.round(rate)}x`;
  }
  return `${rate.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}x`;
};

/**
 * Secondary player controls in equal-width slots on one centerline. Audio and video show sleep
 * timer, playback speed, and More; the rate reads as plain text so it never competes with the
 * transport circle above it. Music shows sleep timer, shuffle, repeat, and More.
 */
export function FullPlayerUtilityRow({
  isMusicNowPlaying,
  isRepeatEnabled,
  isShuffleEnabled,
  onOpenMore,
  onOpenSleepTimer,
  onOpenSpeed,
  onToggleRepeat,
  onToggleShuffle,
  playbackRate,
}: FullPlayerUtilityRowProps) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const iconColor = tokens.button.secondaryColor;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          alignItems: 'center',
          flexDirection: 'row',
          height: FULL_PLAYER_UTILITY_ROW_HEIGHT,
          width: '100%',
        },
        slot: {
          alignItems: 'center',
          flex: 1,
          flexDirection: 'row',
          justifyContent: 'center',
        },
        speedLabel: {
          color: tokens.button.secondaryColor,
          fontSize: FULL_PLAYER_SPEED_LABEL_SIZE,
          fontWeight: '600',
          lineHeight: FULL_PLAYER_SPEED_LABEL_SIZE + 4,
        },
      }),
    [tokens.button.secondaryColor]
  );

  const rateLabel = formatRate(playbackRate);

  return (
    <View style={styles.row} testID="full-player-utility-row">
      <View style={styles.slot}>
        <Button
          accessibilityLabel={t('media_player.sleep_timer.sleep_timer')}
          icon={
            <Ionicons color={iconColor} name="moon-outline" size={FULL_PLAYER_UTILITY_ICON_SIZE} />
          }
          iconOnly
          label={t('media_player.sleep_timer.sleep_timer')}
          onPress={onOpenSleepTimer}
          size="lg"
          testID="full-player-sleep-timer"
          variant="ghost"
        />
      </View>
      {isMusicNowPlaying ? (
        <>
          <View style={styles.slot}>
            <Button
              accessibilityLabel={t('media_player.shuffle.toggle_shuffle')}
              icon={
                <Ionicons
                  color={iconColor}
                  name={isShuffleEnabled ? 'shuffle' : 'shuffle-outline'}
                  size={FULL_PLAYER_UTILITY_ICON_SIZE}
                />
              }
              iconOnly
              label={t('media_player.shuffle.toggle_shuffle')}
              onPress={onToggleShuffle}
              size="lg"
              testID="full-player-shuffle"
              variant={isShuffleEnabled ? 'secondary' : 'ghost'}
            />
          </View>
          <View style={styles.slot}>
            <Button
              accessibilityLabel={t('media_player.repeat.toggle_repeat')}
              icon={
                <Ionicons
                  color={iconColor}
                  name={isRepeatEnabled ? 'repeat' : 'repeat-outline'}
                  size={FULL_PLAYER_UTILITY_ICON_SIZE}
                />
              }
              iconOnly
              label={t('media_player.repeat.toggle_repeat')}
              onPress={onToggleRepeat}
              size="lg"
              testID="full-player-repeat"
              variant={isRepeatEnabled ? 'secondary' : 'ghost'}
            />
          </View>
        </>
      ) : (
        <View style={styles.slot}>
          <Button
            accessibilityLabel={t('media_player.playback_speed.playback_speed_with_value', {
              speed: rateLabel,
            })}
            icon={<Text style={styles.speedLabel}>{rateLabel}</Text>}
            iconOnly
            label={rateLabel}
            onPress={onOpenSpeed}
            size="lg"
            testID="full-player-speed"
            variant="ghost"
          />
        </View>
      )}
      <View style={styles.slot}>
        <Button
          accessibilityLabel={t('media.more_options')}
          icon={
            <Ionicons
              color={iconColor}
              name="ellipsis-horizontal"
              size={FULL_PLAYER_UTILITY_ICON_SIZE}
            />
          }
          iconOnly
          label={t('media.more_options')}
          onPress={onOpenMore}
          size="lg"
          testID="full-player-more"
          variant="ghost"
        />
      </View>
    </View>
  );
}
