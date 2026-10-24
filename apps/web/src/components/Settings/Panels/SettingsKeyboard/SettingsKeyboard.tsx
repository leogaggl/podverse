'use client';

import { useTranslations } from 'next-intl';

import { FormStack } from '@podverse/ui';

import { SettingsSection } from '../../SettingsSection';
import { KeyboardPlayPause } from './KeyboardPlayPause';
import { KeyboardSeek } from './KeyboardSeek';
import { KeyboardVolume } from './KeyboardVolume';

export function SettingsKeyboard() {
  const t = useTranslations('settings.keyboard');

  return (
    <SettingsSection>
      <FormStack>
        <p>{t('intro')}</p>
        <KeyboardPlayPause />
        <KeyboardSeek />
        <KeyboardVolume />
      </FormStack>
    </SettingsSection>
  );
}
