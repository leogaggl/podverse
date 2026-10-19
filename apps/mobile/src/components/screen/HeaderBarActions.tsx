import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../theme/useTheme';

type HeaderBarActionsProps = {
  children: ReactNode;
};

/**
 * Trailing title-bar slot when a screen has more than one {@link HeaderBarAction}.
 * Siblings are spaced by `tokens.spacing.md`.
 */
export function HeaderBarActions({ children }: HeaderBarActionsProps) {
  const { tokens } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          alignItems: 'center',
          flexDirection: 'row',
          gap: tokens.spacing.sm,
        },
      }),
    [tokens]
  );

  return <View style={styles.row}>{children}</View>;
}
