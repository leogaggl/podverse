'use client';

import { useTranslations } from 'next-intl';

import { KeyboardInstruction } from './KeyboardInstruction';

export function KeyboardSeek() {
  const t = useTranslations('settings.keyboard');

  return (
    <KeyboardInstruction
      keys={t('keys_arrows_seek')}
      label={t('shortcut_seek_label')}
      description={t('shortcut_seek_detail')}
    />
  );
}
