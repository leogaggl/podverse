import { useTranslation } from 'react-i18next';

import { useOfflineMode } from '../../prefs/offlineMode';
import { SettingsRowDescription, SettingsSwitchRow } from '../form';

/**
 * Offline Mode switch for More → Features. Sits at the top of the Features card; when on, the
 * description appears under the row so the user knows what the mode does before leaving More.
 *
 * Reflects the user's pref and nothing else. A switch that also read the network state would
 * invite the user to turn off something they never turned on, and would flip under them.
 */
export function OfflineModeFeaturesHeader() {
  const { t } = useTranslation();
  const { enabled, setEnabled } = useOfflineMode();
  const title = t('settings.offline_mode.title');

  return (
    <SettingsSwitchRow
      accessibilityLabel={title}
      onValueChange={(next) => {
        void setEnabled(next);
      }}
      switchTestID="more-offline-mode-switch"
      testID="more-offline-mode-row"
      title={title}
      value={enabled}
    >
      {enabled ? (
        <SettingsRowDescription testID="more-offline-mode-description">
          {t('settings.offline_mode.description')}
        </SettingsRowDescription>
      ) : undefined}
    </SettingsSwitchRow>
  );
}
