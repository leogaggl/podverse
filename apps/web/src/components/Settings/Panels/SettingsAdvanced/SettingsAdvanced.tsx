'use client';

import { useTranslations } from 'next-intl';

import { Divider } from '@podverse/ui';

import { SettingsSection } from '../../SettingsSection';
import { SettingsRemovedContent } from './SettingsRemovedContent';
import { SettingsUnifiedPush } from './SettingsUnifiedPush';

import styles from '../../../../styles/components/Settings/Panels/SettingsAdvanced/SettingsAdvanced.module.scss';

export function SettingsAdvanced() {
  const tSettings = useTranslations('settings');

  return (
    <>
      <SettingsSection>
        <h3 className={styles.heading}>{tSettings('notifications.notifications')}</h3>
        <SettingsUnifiedPush />
      </SettingsSection>
      <Divider withSpacing />
      <SettingsRemovedContent />
    </>
  );
}
