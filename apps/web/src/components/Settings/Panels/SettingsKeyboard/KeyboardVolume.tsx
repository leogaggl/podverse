'use client';

import { useTranslations } from 'next-intl';

import { KeyboardInstruction } from './KeyboardInstruction';

export function KeyboardVolume() {
  const t = useTranslations('settings.keyboard');

  return (
    <KeyboardInstruction
      keys={t('keys_arrows_volume')}
      label={t('shortcut_volume_label')}
      description={t('shortcut_volume_detail')}
    />
  );
}
