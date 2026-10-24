import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { MenuListItem, MenuListSection } from '../../components/screen/MenuListScreen';
import { MenuListScreen } from '../../components/screen/MenuListScreen';
import type { MoreStackParamList } from '../../navigation';
import { MORE_STACK_ROUTES } from '../../navigation';
import { AdvancedUnifiedPush } from './AdvancedUnifiedPush';

/** Diagnostics and other tools most listeners never need, kept off the More root. */
export function MoreAdvancedScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<MoreStackParamList>>();

  const sections = useMemo<MenuListSection[]>(() => {
    const tools: MenuListItem[] = [
      {
        onPress: () => {
          navigation.navigate(MORE_STACK_ROUTES.MoreCustomApi);
        },
        subtitle: t('custom_api.menu_subtitle'),
        testID: 'more-advanced-custom-api',
        title: t('custom_api.title'),
      },
      {
        onPress: () => {
          navigation.navigate(MORE_STACK_ROUTES.MoreErrorLog);
        },
        subtitle: t('error_log.menu_subtitle'),
        testID: 'more-advanced-error-log',
        title: t('error_log.title'),
      },
    ];
    const removed: MenuListItem[] = [
      {
        onPress: () => {
          navigation.navigate(MORE_STACK_ROUTES.MoreRemovedContent);
        },
        subtitle: t('removed_content.menu_subtitle'),
        testID: 'more-advanced-removed-content',
        title: t('removed_content.title'),
      },
    ];

    return [
      { items: tools, key: 'tools' },
      {
        header: <AdvancedUnifiedPush />,
        items: [],
        key: 'notifications',
        title: t('settings.notifications.notifications'),
      },
      { items: removed, key: 'removed' },
    ];
  }, [navigation, t]);

  return <MenuListScreen sections={sections} testID="more-advanced-screen" />;
}
