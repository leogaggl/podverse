import { FontAwesome6 } from '@expo/vector-icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/useTheme';
import type { ButtonSize } from '../primitives/Button';
import { Button } from '../primitives/Button';

type PlayerJumpButtonProps = {
  direction: 'back' | 'forward';
  /** Rotate glyph size; the seconds label tracks it so it stays inside the arrow. */
  glyphSize?: number;
  onPress: () => void;
  seconds: number;
  showSeconds?: boolean;
  size?: ButtonSize;
  testID: string;
};

const DEFAULT_JUMP_GLYPH_SIZE = 30;
/** Seconds label offset from the top of the glyph, as a share of the glyph size. */
const GLYPH_LABEL_TOP_RATIO = 1 / 3;

export function PlayerJumpButton({
  direction,
  glyphSize = DEFAULT_JUMP_GLYPH_SIZE,
  onPress,
  seconds,
  showSeconds = true,
  size = 'lg',
  testID,
}: PlayerJumpButtonProps) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        glyphLabel: {
          color: tokens.button.secondaryColor,
          fontSize: 10,
          fontWeight: '800',
          position: 'absolute',
          top: Math.round(glyphSize * GLYPH_LABEL_TOP_RATIO),
        },
        glyphWrap: {
          alignItems: 'center',
          justifyContent: 'center',
          width: glyphSize,
        },
      }),
    [glyphSize, tokens.button.secondaryColor]
  );

  const directionLabelKey =
    direction === 'back' ? 'media_player.jump_back' : 'media_player.jump_forward';
  const iconName = direction === 'back' ? 'rotate-left' : 'rotate-right';

  return (
    <Button
      accessibilityLabel={t(directionLabelKey, { seconds })}
      icon={
        <View style={styles.glyphWrap}>
          <FontAwesome6
            color={tokens.button.secondaryColor}
            name={iconName}
            size={glyphSize}
            solid
          />
          {showSeconds ? <Text style={styles.glyphLabel}>{Math.abs(seconds)}</Text> : null}
        </View>
      }
      iconOnly
      label={t(directionLabelKey, { seconds })}
      onPress={onPress}
      size={size}
      testID={testID}
      variant="ghost"
    />
  );
}
