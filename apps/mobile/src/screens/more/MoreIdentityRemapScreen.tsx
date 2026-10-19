import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { HelperNote } from '../../components/feedback/HelperNote';
import { Button } from '../../components/primitives';
import { MobileScreenContainer } from '../../components/screen/MobileScreenContainer';
import { downloadsRepository } from '../../data/repositories/downloadsRepository';
import { subscriptionsRepository } from '../../data/repositories/subscriptionsRepository';
import {
  E2E_IDENTITY_REMAP_FILE_PATH,
  E2E_MERGED_SURVIVOR_CHANNEL_ID_TEXT,
  E2E_MERGED_SURVIVOR_ITEM_ID_TEXT,
} from '../../lib/e2e/e2eSeedConstants';
import { plantIdentityRemapFixture } from '../../lib/e2e/plantIdentityRemapFixture';
import { useSync } from '../../sync';
import { useTheme } from '../../theme/useTheme';

type RemapStatus = {
  downloadItemIdText: string;
  downloadPath: string;
  downloadStatus: string;
  subscribedIdText: string;
};

const emptyStatus = (): RemapStatus => ({
  downloadItemIdText: '',
  downloadPath: '',
  downloadStatus: '',
  subscribedIdText: '',
});

/**
 * E2E-only harness. Product screens do not grow a merged-show button. Maestro plants a local
 * follow and a finished download here, then asks sync to follow the surviving show.
 */
export function MoreIdentityRemapScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { requestSync, state } = useSync();
  const [status, setStatus] = useState<RemapStatus>(emptyStatus);
  const [busy, setBusy] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        stack: {
          gap: tokens.spacing.lg,
        },
      }),
    [tokens]
  );

  const readStatus = useCallback(async () => {
    const subscriptions = await subscriptionsRepository.list();
    const survivor = subscriptions.find(
      (row) => row.idText === E2E_MERGED_SURVIVOR_CHANNEL_ID_TEXT
    );
    const download = await downloadsRepository.getByItemIdText(E2E_MERGED_SURVIVOR_ITEM_ID_TEXT);
    const kept = download?.filePath === E2E_IDENTITY_REMAP_FILE_PATH ? download : null;
    setStatus({
      downloadItemIdText: kept?.itemIdText ?? '',
      downloadPath: kept?.filePath ?? '',
      downloadStatus: kept?.status ?? '',
      subscribedIdText: survivor?.idText ?? '',
    });
  }, []);

  useEffect(() => {
    if (state.status === 'idle') {
      void readStatus();
    }
  }, [readStatus, state.status]);

  const prepare = useCallback(async () => {
    setBusy(true);
    try {
      await plantIdentityRemapFixture();
      requestSync('pull-to-refresh');
    } finally {
      setBusy(false);
    }
  }, [requestSync]);

  return (
    <MobileScreenContainer testID="identity-remap-screen">
      <View style={styles.stack}>
        <HelperNote message={t('e2e.identity_remap_intro')} />
        <Button
          disabled={busy}
          fullWidth
          label={t('e2e.identity_remap_prepare')}
          onPress={() => {
            void prepare();
          }}
          testID="identity-remap-prepare"
        />
        <Text testID="identity-remap-subscribed">{status.subscribedIdText}</Text>
        <Text testID="identity-remap-download-item">{status.downloadItemIdText}</Text>
        <Text testID="identity-remap-download-path">{status.downloadPath}</Text>
        <Text testID="identity-remap-download-status">{status.downloadStatus}</Text>
      </View>
    </MobileScreenContainer>
  );
}
