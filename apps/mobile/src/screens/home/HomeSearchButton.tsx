import { useTranslation } from 'react-i18next';

import { HeaderBarAction } from '../../components/screen/HeaderBarAction';

type HomeSearchButtonProps = {
  onPress: () => void;
};

/**
 * Home title-bar search. Home is the only screen with this control. The press raises Search from
 * the bottom over the tabs. A down caret on Search dismisses it.
 */
export function HomeSearchButton({ onPress }: HomeSearchButtonProps) {
  const { t } = useTranslation();

  return (
    <HeaderBarAction
      accessibilityLabel={t('features.search.search')}
      icon="search"
      onPress={onPress}
      testID="home-search"
    />
  );
}
