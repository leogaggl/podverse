import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { OptionListScreen } from '../../components/form';
import type { MoreStackParamList } from '../../navigation';
import { MORE_STACK_ROUTES } from '../../navigation';
import type { ApiKeyExpirationChoice } from './accountApiKeyRows';
import { API_KEY_EXPIRATION_CHOICES } from './accountApiKeyRows';

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreSettingsDeveloperExpiration'>;

const expirationChoiceLabel = (
  choice: ApiKeyExpirationChoice,
  translate: (key: string) => string
): string => {
  switch (choice) {
    case '30':
      return translate('settings.developer.expiration_30');
    case '90':
      return translate('settings.developer.expiration_90');
    case '365':
      return translate('settings.developer.expiration_365');
    case 'none':
      return translate('settings.developer.no_expiration');
  }
};

export function MoreSettingsDeveloperExpirationScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const expiresIn = route.params.expiresIn;

  const options = useMemo(
    () =>
      API_KEY_EXPIRATION_CHOICES.map((choice) => ({
        label: expirationChoiceLabel(choice, t),
        testID: `more-settings-developer-expiration-${choice}`,
        value: choice,
      })),
    [t]
  );

  const onSelect = useCallback(
    (choice: ApiKeyExpirationChoice) => {
      navigation.navigate(MORE_STACK_ROUTES.MoreSettingsDeveloperCreate, { expiresIn: choice });
    },
    [navigation]
  );

  return (
    <OptionListScreen
      onSelect={onSelect}
      options={options}
      testID="more-settings-developer-expiration-screen"
      value={expiresIn}
    />
  );
}
