'use client';

import { useTranslations } from 'next-intl';

import { KeyboardInstruction } from './KeyboardInstruction';

export function KeyboardPlayPause() {
  const t = useTranslations('settings.keyboard');

  return (
    <KeyboardInstruction
      keys={t('keys_space')}
      label={t('shortcut_play_pause_label')}
      description={t('shortcut_play_pause_detail')}
    />
  );
}
