import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../theme/useTheme';
import type { TextFieldRef } from './TextField';
import { TextField } from './TextField';

export type SearchFieldProps = {
  accessibilityLabel: string;
  onChangeText: (value: string) => void;
  onSubmit?: () => void;
  placeholder: string;
  testID?: string;
  value: string;
  inputRef?: TextFieldRef;
};

/**
 * Directory search on top of `TextField`: compact pill, a leading magnifying glass, a search
 * return key, and an X at the right edge while `value` is non-empty. The X is named with the
 * shared Clear Search string. Pressing it clears the value and leaves the field focused. The
 * whole pill focuses, including the glass.
 */
export function SearchField({
  accessibilityLabel,
  inputRef,
  onChangeText,
  onSubmit,
  placeholder,
  testID,
  value,
}: SearchFieldProps) {
  const { t } = useTranslation();
  const { styles: themeStyles } = useTheme();

  return (
    <TextField
      accessibilityLabel={accessibilityLabel}
      autoCapitalize="none"
      autoCorrect={false}
      clearAccessibilityLabel={t('misc.clear_search')}
      clearTestID={testID !== undefined ? `${testID}-clear` : undefined}
      inputRef={inputRef}
      leading={<Ionicons color={themeStyles.textSecondary.color} name="search" size={18} />}
      onChangeText={onChangeText}
      onSubmitEditing={onSubmit}
      placeholder={placeholder}
      returnKeyType="search"
      testID={testID}
      value={value}
    />
  );
}
