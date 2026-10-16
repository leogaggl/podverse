import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { formActionsGap } from '../../theme/screenLayout';
import type { ThemedStylesTheme } from '../../theme/useThemedStyles';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { ButtonVariant } from '../primitives/Button';
import { Button } from '../primitives/Button';

export type FormAction = {
  accessibilityLabel?: string;
  disabled?: boolean;
  label: string;
  loading?: boolean;
  onPress: () => void;
  testID: string;
  variant?: ButtonVariant;
};

export type FormActionsProps = {
  /** Full-width actions in a column. Array order is top to bottom, with the first action on top. */
  actions: readonly FormAction[];
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const createStyles = ({ tokens }: ThemedStylesTheme) =>
  StyleSheet.create({
    column: {
      flexDirection: 'column',
      gap: formActionsGap(tokens.spacing),
    },
  });

function FormActionButton({ action }: { action: FormAction }) {
  return (
    <Button
      accessibilityLabel={action.accessibilityLabel}
      disabled={action.disabled}
      fullWidth
      label={action.label}
      loading={action.loading}
      onPress={action.onPress}
      size="form"
      testID={action.testID}
      variant={action.variant}
    />
  );
}

/**
 * Form decisions. Buttons use `size="form"` so every form, dialog, and checkout that comes through
 * here shares one height and label. Two or more actions are a full-width column in array order,
 * first on top. One action is one full-width button.
 */
export function FormActions({ actions, style, testID }: FormActionsProps) {
  const styles = useThemedStyles(createStyles);
  const onlyAction = actions.length === 1 ? actions[0] : undefined;

  if (onlyAction !== undefined) {
    return (
      <View style={style} testID={testID}>
        <FormActionButton action={onlyAction} />
      </View>
    );
  }

  if (actions.length === 0) {
    return null;
  }

  return (
    <View style={[styles.column, style]} testID={testID}>
      {actions.map((action) => (
        <FormActionButton action={action} key={action.testID} />
      ))}
    </View>
  );
}
