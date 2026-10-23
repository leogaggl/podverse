import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { stopPropagation } from '../../lib/gesture/stopPropagation';
import { formActionsTopGap } from '../../theme/screenLayout';
import { typography } from '../../theme/typography';
import { useTheme } from '../../theme/useTheme';
import type { FormAction } from '../form/FormActions';
import { FormActions } from '../form/FormActions';
import { AppOverlay, OverlayScrim } from '../overlay';

/**
 * Presentational dialog: title + body with one dismiss action, an optional confirm action, and an
 * optional second confirm. Top to bottom: confirm, second confirm, dismiss.
 * All copy arrives already localized so each host owns wording and test IDs.
 */
export type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  body: string;
  cancelLabel: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm?: () => void;
  testID: string;
  cancelTestID: string;
  confirmTestID?: string;
  /** A second confirm between the first and cancel. Shown only with all three set and a first confirm. */
  secondaryConfirmLabel?: string;
  onSecondaryConfirm?: () => void;
  secondaryConfirmTestID?: string;
};

export function ConfirmDialog({
  visible,
  title,
  body,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  testID,
  cancelTestID,
  confirmTestID,
  secondaryConfirmLabel,
  onSecondaryConfirm,
  secondaryConfirmTestID,
}: ConfirmDialogProps) {
  const { styles: themeStyles, tokens } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        actions: {
          marginTop: formActionsTopGap(tokens.spacing),
        },
        // Neutral dimming scrim (not a theme color); mirrors the standard platform dialog backdrop.
        backdrop: {
          alignItems: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          flex: 1,
          justifyContent: 'center',
          padding: tokens.spacing.xl,
        },
        body: {
          ...typography.prose,
          color: themeStyles.textSecondary.color,
        },
        contents: {
          flex: 1,
        },
        dialog: {
          backgroundColor: themeStyles.screen.backgroundColor,
          borderColor: themeStyles.border.borderColor,
          borderRadius: tokens.radii.md,
          borderWidth: 1,
          maxWidth: 420,
          padding: tokens.spacing.xl,
          width: '100%',
        },
        title: {
          ...typography.heading,
          color: themeStyles.textPrimary.color,
          fontWeight: '700',
          marginBottom: tokens.spacing.md,
        },
      }),
    [themeStyles, tokens]
  );

  const cancelAction: FormAction = {
    label: cancelLabel,
    onPress: onCancel,
    testID: cancelTestID,
    variant: 'secondary',
  };
  const confirmAction: FormAction | undefined =
    confirmLabel !== undefined && confirmTestID !== undefined && onConfirm !== undefined
      ? { label: confirmLabel, onPress: onConfirm, testID: confirmTestID }
      : undefined;
  const secondaryConfirmAction: FormAction | undefined =
    confirmAction !== undefined &&
    secondaryConfirmLabel !== undefined &&
    secondaryConfirmTestID !== undefined &&
    onSecondaryConfirm !== undefined
      ? {
          label: secondaryConfirmLabel,
          onPress: onSecondaryConfirm,
          testID: secondaryConfirmTestID,
          variant: 'outline',
        }
      : undefined;
  const actions: readonly FormAction[] = [
    confirmAction,
    secondaryConfirmAction,
    cancelAction,
  ].filter((action): action is FormAction => action !== undefined);

  return (
    <AppOverlay animation="fade" onRequestClose={onCancel} visible={visible}>
      <OverlayScrim style={styles.contents}>
        {/* The scrim is a sighted-only shortcut for the cancel button, so it stays out of the
            accessibility tree; `accessibilityViewIsModal` keeps VoiceOver inside the dialog rather
            than letting it wander onto the screen behind. */}
        <Pressable accessible={false} onPress={onCancel} style={styles.backdrop}>
          <Pressable
            accessibilityViewIsModal
            accessibilityRole="alert"
            onPress={stopPropagation}
            style={styles.dialog}
            testID={testID}
          >
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.body}>{body}</Text>
            <FormActions actions={actions} style={styles.actions} />
          </Pressable>
        </Pressable>
      </OverlayScrim>
    </AppOverlay>
  );
}
