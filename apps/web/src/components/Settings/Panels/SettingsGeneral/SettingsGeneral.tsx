'use client';

import { FormStack } from '@podverse/ui';

import { SettingsLocaleSelector } from './SettingsLocaleSelector';
import { SettingsMediaTypeSelector } from './SettingsMediaTypeSelector';
import { SettingsThemeSelector } from './SettingsThemeSelector';

export function SettingsGeneral() {
  return (
    <FormStack>
      <SettingsLocaleSelector />
      <SettingsThemeSelector />
      <SettingsMediaTypeSelector />
    </FormStack>
  );
}
