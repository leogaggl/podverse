import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import type { DTOAccount } from '@podverse/helpers';
import { DATABASE_CONSTANTS, SharableStatusEnum } from '@podverse/helpers';

import { requestWithMobileAuthRefresh, useAuth } from '../../auth';
import { FormActions, FormField, OptionChipGroup, TextField } from '../../components/form';
import { MobileScreenContainer } from '../../components/screen/MobileScreenContainer';
import { ListEmpty } from '../../components/state/ListEmpty';
import { accountRepository } from '../../data';
import { resolveSupportedLocale } from '../../i18n/locale';
import {
  applyAccountProfileUpdate,
  buildAccountProfileUpdatePayload,
  toSharableStatus,
} from '../../lib/account/profileUpdate';
import { OFFLINE_UNAVAILABLE_MESSAGE_KEY } from '../../lib/offlineModeViews';
import { handleRateLimitMessage } from '../../lib/rateLimit/handleRateLimitMessage';
import { useMembershipGate } from '../../membership/MembershipGateProvider';
import type { MoreStackParamList } from '../../navigation';
import { useOfflineMode } from '../../prefs/offlineMode';
import { formActionsTopGap } from '../../theme/screenLayout';
import { typography } from '../../theme/typography';
import { useTheme } from '../../theme/useTheme';

type MyProfileEditScreenProps = NativeStackScreenProps<MoreStackParamList, 'MoreProfileEdit'>;

function currentAccountLocale(account: DTOAccount, language: string): string {
  const stored = account.account_settings?.account_settings_locale?.locale;
  if (stored !== undefined && stored !== '') {
    return stored;
  }
  return resolveSupportedLocale(language);
}

function sharableHelpKey(status: SharableStatusEnum): string {
  if (status === SharableStatusEnum.Public) {
    return 'settings.profile.sharable_status_public_description';
  }
  if (status === SharableStatusEnum.Unlisted) {
    return 'settings.profile.sharable_status_unlisted_description';
  }
  return 'settings.profile.sharable_status_private_description';
}

export function MyProfileEditScreen({ navigation }: MyProfileEditScreenProps) {
  const { i18n, t } = useTranslation();
  const { styles: themeStyles, tokens } = useTheme();
  const { accessToken, account, clearSession, refreshToken, setAccount, setTokens } = useAuth();
  const { handleGateError } = useMembershipGate();
  const { enabled: offlineModeEnabled } = useOfflineMode();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [sharableStatus, setSharableStatus] = useState(SharableStatusEnum.Private);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seeded = useRef(false);
  const savingRef = useRef(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        actions: {
          marginTop: formActionsTopGap(tokens.spacing),
        },
        error: {
          ...typography.body,
          color: themeStyles.textSecondary.color,
          marginTop: tokens.spacing.md,
        },
        field: {
          gap: tokens.spacing.sm,
        },
        fields: {
          gap: tokens.spacing.lg,
        },
        help: {
          ...typography.prose,
          color: themeStyles.textSecondary.color,
        },
      }),
    [themeStyles, tokens],
  );

  const sharableOptions = useMemo(
    () => [
      {
        label: t('misc.sharable_status.public'),
        testID: 'my-profile-edit-sharable-public',
        value: SharableStatusEnum.Public,
      },
      {
        label: t('misc.sharable_status.unlisted'),
        testID: 'my-profile-edit-sharable-unlisted',
        value: SharableStatusEnum.Unlisted,
      },
      {
        label: t('misc.sharable_status.private'),
        testID: 'my-profile-edit-sharable-private',
        value: SharableStatusEnum.Private,
      },
    ],
    [t],
  );

  useEffect(() => {
    if (seeded.current || account === null) {
      return;
    }
    seeded.current = true;
    setDisplayName(account.account_profile?.display_name ?? '');
    setBio(account.account_profile?.bio ?? '');
    setSharableStatus(toSharableStatus(account.sharable_status_id));
  }, [account]);

  const save = async () => {
    if (savingRef.current || account === null) {
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError(null);
    const payload = buildAccountProfileUpdatePayload({
      bio,
      displayName,
      locale: currentAccountLocale(account, i18n.language),
      sharableStatus,
    });
    try {
      await requestWithMobileAuthRefresh(
        { accessToken, clearSession, refreshToken, setTokens },
        (api) => api.reqAccountUpdate(payload),
      );
      const merged = applyAccountProfileUpdate(account, payload);
      setAccount(merged);
      try {
        await accountRepository.saveSnapshot(merged);
      } catch (snapshotError) {
        console.warn('Could not store the updated account profile', snapshotError);
      }
      navigation.goBack();
    } catch (saveError) {
      if (!handleGateError(saveError)) {
        setError(handleRateLimitMessage(saveError, t) ?? t('errors.generic'));
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (offlineModeEnabled) {
    return (
      <MobileScreenContainer testID="my-profile-edit-screen">
        <ListEmpty
          messageKey={OFFLINE_UNAVAILABLE_MESSAGE_KEY}
          testID="my-profile-edit-offline"
        />
      </MobileScreenContainer>
    );
  }

  return (
    <MobileScreenContainer testID="my-profile-edit-screen">
      <View style={styles.fields}>
        <View style={styles.field}>
          <TextField
            accessibilityLabel={t('settings.profile.display_name')}
            eyebrow={t('settings.profile.display_name')}
            onChangeText={(value) => {
              setDisplayName(value.slice(0, DATABASE_CONSTANTS.varchar_normal));
            }}
            placeholder={t('misc.anonymous')}
            testID="my-profile-edit-display-name"
            value={displayName}
          />
          <Text style={styles.help}>{t('settings.profile.display_name_description')}</Text>
        </View>
        <View style={styles.field}>
          <TextField
            accessibilityLabel={t('settings.profile.bio')}
            eyebrow={t('settings.profile.bio')}
            multiline
            onChangeText={(value) => {
              setBio(value.slice(0, DATABASE_CONSTANTS.varchar_long));
            }}
            placeholder={t('settings.profile.bio_placeholder')}
            testID="my-profile-edit-bio"
            value={bio}
          />
          <Text style={styles.help}>{t('settings.profile.bio_description')}</Text>
        </View>
        <FormField
          label={t('settings.profile.sharable_status')}
          testID="my-profile-edit-visibility"
        >
          <View style={styles.field}>
            <OptionChipGroup
              onChange={setSharableStatus}
              options={sharableOptions}
              value={sharableStatus}
            />
            <Text style={styles.help}>{t(sharableHelpKey(sharableStatus))}</Text>
          </View>
        </FormField>
      </View>
      {error !== null ? (
        <Text accessibilityLiveRegion="polite" style={styles.error} testID="my-profile-edit-error">
          {error}
        </Text>
      ) : null}
      <FormActions
        actions={[
          {
            disabled: saving || account === null,
            label: saving ? t('misc.saving') : t('misc.save'),
            loading: saving,
            onPress: () => {
              void save();
            },
            testID: 'my-profile-edit-save',
          },
        ]}
        style={styles.actions}
      />
    </MobileScreenContainer>
  );
}
