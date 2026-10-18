import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import type { MediaTypePreference } from '@podverse/helpers';

import { useAuth } from '../../auth/AuthProvider';
import { syncPlaybackPreferenceToAccount } from '../../auth/syncAccountPrefs';
import { OptionChipGroup, SettingsSwitchRow } from '../../components/form';
import { Card } from '../../components/primitives/Card';
import { MobileScreenContainer } from '../../components/screen/MobileScreenContainer';
import {
  readAutoQueuePrefs,
  writeAutoQueueRandomPref,
  writeAutoQueueRepeatPref,
} from '../../prefs/autoQueuePrefs';
import {
  DEFAULT_PLAYBACK_MEDIA_TYPE,
  readPlaybackMediaTypePref,
  writePlaybackMediaTypePref,
} from '../../prefs/preferredMediaType';
import { settingsCardGap, settingsCardInnerGap } from '../../theme/screenLayout';
import { typography } from '../../theme/typography';
import { useTheme } from '../../theme/useTheme';

const PLAYBACK_MEDIA_OPTIONS: readonly MediaTypePreference[] = ['video', 'audio'];

export function MoreSettingsPlaybackScreen() {
  const { t } = useTranslation();
  const { accessToken, clearSession, refreshToken, setAccount, setTokens } = useAuth();
  const { styles: themeStyles, tokens } = useTheme();
  const [playbackMediaType, setPlaybackMediaType] = useState<MediaTypePreference>(
    DEFAULT_PLAYBACK_MEDIA_TYPE
  );
  const [autoQueueRandom, setAutoQueueRandom] = useState<boolean>(false);
  const [autoQueueRepeat, setAutoQueueRepeat] = useState<boolean>(false);
  const [errorMessageKey, setErrorMessageKey] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      const [storedPlaybackMediaType, autoQueuePrefs] = await Promise.all([
        readPlaybackMediaTypePref(),
        readAutoQueuePrefs(),
      ]);

      if (!isMounted) {
        return;
      }

      setPlaybackMediaType(storedPlaybackMediaType);
      setAutoQueueRandom(autoQueuePrefs.random);
      setAutoQueueRepeat(autoQueuePrefs.repeat);
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const handlePlaybackMediaTypeChange = useCallback(
    async (mediaType: MediaTypePreference) => {
      setErrorMessageKey(null);
      setPlaybackMediaType(mediaType);
      try {
        await writePlaybackMediaTypePref(mediaType);
        await syncPlaybackPreferenceToAccount({
          auth: { accessToken, clearSession, refreshToken, setTokens },
          preferredMediaType: mediaType,
          setAccount,
        });
      } catch {
        setErrorMessageKey('errors.generic');
      }
    },
    [accessToken, clearSession, refreshToken, setAccount, setTokens]
  );

  const handleAutoQueueRandomToggle = useCallback(async (enabled: boolean) => {
    setAutoQueueRandom(enabled);
    await writeAutoQueueRandomPref(enabled);
  }, []);

  const handleAutoQueueRepeatToggle = useCallback(async (enabled: boolean) => {
    setAutoQueueRepeat(enabled);
    await writeAutoQueueRepeatPref(enabled);
  }, []);

  const playbackMediaOptions = useMemo(
    () =>
      PLAYBACK_MEDIA_OPTIONS.map((mediaTypeOption) => ({
        label: t(`settings.preferred_media_type.${mediaTypeOption}`),
        testID: `more-settings-playback-${mediaTypeOption}`,
        value: mediaTypeOption,
      })),
    [t]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        cardHeading: {
          paddingHorizontal: tokens.spacing.lg,
          paddingTop: tokens.spacing.lg,
        },
        cardStack: {
          gap: settingsCardGap(tokens.spacing),
        },
        packedCard: {
          gap: settingsCardInnerGap(tokens.spacing),
          padding: tokens.spacing.lg,
        },
        sectionDescription: {
          ...typography.body,
          color: themeStyles.textSecondary.color,
        },
        sectionHeading: {
          color: themeStyles.textPrimary.color,
          fontSize: 16,
          fontWeight: '700',
        },
        warningText: {
          ...typography.body,
          color: themeStyles.textSecondary.color,
          marginTop: tokens.spacing.sm,
        },
      }),
    [themeStyles, tokens]
  );

  return (
    <MobileScreenContainer testID="more-settings-playback-screen">
      <View style={styles.cardStack}>
        <Card padded={false} testID="more-settings-playback-card">
          <View style={styles.packedCard}>
            <Text style={styles.sectionHeading}>{t('settings.preferred_media_type.label')}</Text>
            <Text style={styles.sectionDescription}>
              {t('settings.preferred_media_type.description')}
            </Text>
            <OptionChipGroup
              onChange={(mediaType) => {
                void handlePlaybackMediaTypeChange(mediaType);
              }}
              options={playbackMediaOptions}
              testID="more-settings-playback-chips"
              value={playbackMediaType}
            />
          </View>
        </Card>

        <Card padded={false} testID="more-settings-auto-queue-card">
          <Text style={[styles.sectionHeading, styles.cardHeading]}>
            {t('media_player.auto_queue')}
          </Text>
          <SettingsSwitchRow
            onValueChange={(nextValue) => {
              void handleAutoQueueRandomToggle(nextValue);
            }}
            testID="more-settings-auto-queue-random"
            title={t('media_player.shuffle.toggle_shuffle')}
            value={autoQueueRandom}
          />
          <SettingsSwitchRow
            onValueChange={(nextValue) => {
              void handleAutoQueueRepeatToggle(nextValue);
            }}
            testID="more-settings-auto-queue-repeat"
            title={t('media_player.repeat.toggle_repeat')}
            value={autoQueueRepeat}
          />
        </Card>

        {errorMessageKey !== null ? (
          <Text style={styles.warningText} testID="more-settings-error">
            {t(errorMessageKey)}
          </Text>
        ) : null}
      </View>
    </MobileScreenContainer>
  );
}
