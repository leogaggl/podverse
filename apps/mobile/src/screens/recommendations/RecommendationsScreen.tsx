import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import type { DTOAccountRecommendation, RecommendationChip } from '@podverse/helpers';
import {
  isRecommendationChip,
  isTasteProfileTrackingAllowed,
  primaryChannelListArtworkUrl,
} from '@podverse/helpers';

import { useAuthPrompt } from '../../auth/AuthPromptContext';
import { useAuth } from '../../auth/AuthProvider';
import type { AuthRequestDeps } from '../../auth/authRequestWithRefresh';
import { requestWithMobileAuthRefresh } from '../../auth/authRequestWithRefresh';
import { Button, CoverImage, FillList, ListRow } from '../../components/primitives';
import { CallToActionSection } from '../../components/state/CallToActionSection';
import { ListEmpty } from '../../components/state/ListEmpty';
import { LoadingSection } from '../../components/state/LoadingSection';
import { RetryableError } from '../../components/state/RetryableError';
import type { BrowseStackParamList } from '../../navigation';
import {
  BROWSE_STACK_ROUTES,
  buildAlbumDetailParams,
  buildArtistDetailParams,
  buildPodcastDetailParams,
  getEnclosingTabNavigation,
  MORE_STACK_ROUTES,
} from '../../navigation';
import { getTasteProfileAgreementCurrentVersion } from '../../tasteProfileConsent/tasteProfileConsentGate';
import { LIST_ROW_ARTWORK_SIZE } from '../../theme/screenLayout';
import { typography } from '../../theme/typography';
import { useTheme } from '../../theme/useTheme';
import { MediaTypeSelector } from '../home/MediaTypeSelector';

const CHIP_STORAGE_KEY = 'recommendations.chip';
const CHIPS = ['podcasts', 'albums', 'artists'] as const satisfies readonly RecommendationChip[];

const CHIP_LABEL_KEYS: Record<RecommendationChip, string> = {
  albums: 'media.music.albums',
  artists: 'media.music.artists',
  podcasts: 'media.podcast.podcasts',
};

const coverStyles = StyleSheet.create({
  image: {
    height: LIST_ROW_ARTWORK_SIZE,
    width: LIST_ROW_ARTWORK_SIZE,
  },
});

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; items: DTOAccountRecommendation[] };

function openShow(
  navigation: NativeStackNavigationProp<BrowseStackParamList, 'BrowseRoot'>,
  chip: RecommendationChip,
  item: DTOAccountRecommendation
) {
  const idText = item.channel.id_text;
  const previewTitle = item.channel.title;
  const previewImageUrl = primaryChannelListArtworkUrl(item.channel.channel_images);
  if (chip === 'albums') {
    navigation.navigate(
      BROWSE_STACK_ROUTES.AlbumDetail,
      buildAlbumDetailParams({ albumId: idText, previewImageUrl, previewTitle })
    );
    return;
  }
  if (chip === 'artists') {
    navigation.navigate(
      BROWSE_STACK_ROUTES.ArtistDetail,
      buildArtistDetailParams({ artistId: idText, previewImageUrl, previewTitle })
    );
    return;
  }
  navigation.navigate(
    BROWSE_STACK_ROUTES.PodcastDetail,
    buildPodcastDetailParams({ podcastId: idText, previewImageUrl, previewTitle })
  );
}

export function RecommendationsScreen() {
  const { t } = useTranslation();
  const { styles: themeStyles, tokens } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<BrowseStackParamList, 'BrowseRoot'>>();
  const { onRequestLogin } = useAuthPrompt();
  const auth = useAuth();
  const [chip, setChip] = useState<RecommendationChip>('podcasts');
  const [chipReady, setChipReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [state, setState] = useState<LoadState>({ status: 'idle' });
  const signedIn = auth.status === 'authenticated' && auth.account !== null;
  const trackingAllowed = isTasteProfileTrackingAllowed(
    auth.account?.account_settings,
    getTasteProfileAgreementCurrentVersion()
  );

  const openSettings = useCallback(() => {
    getEnclosingTabNavigation(navigation)?.navigate('More', {
      screen: MORE_STACK_ROUTES.MoreSettingsTasteProfile,
    });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void AsyncStorage.getItem(CHIP_STORAGE_KEY).then((stored) => {
        if (cancelled) {
          return;
        }
        if (stored !== null && isRecommendationChip(stored)) {
          setChip(stored);
        }
        setChipReady(true);
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      if (!signedIn || !chipReady) {
        setState({ status: 'idle' });
        return;
      }
      let cancelled = false;
      setState({ status: 'loading' });
      const deps: AuthRequestDeps = {
        accessToken: auth.accessToken,
        clearSession: auth.clearSession,
        refreshToken: auth.refreshToken,
        setTokens: auth.setTokens,
      };
      void requestWithMobileAuthRefresh(deps, (api) => api.reqAccountRecommendations({ chip }))
        .then((items) => {
          if (!cancelled) {
            setState({ status: 'ready', items });
          }
        })
        .catch(() => {
          if (!cancelled) {
            setState({ status: 'error' });
          }
        });
      return () => {
        cancelled = true;
      };
    }, [
      auth.accessToken,
      auth.clearSession,
      auth.refreshToken,
      auth.setTokens,
      chip,
      chipReady,
      retryCount,
      signedIn,
    ])
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        note: {
          gap: tokens.spacing.md,
          padding: tokens.spacing.lg,
        },
        noteText: {
          ...typography.body,
          color: themeStyles.textSecondary.color,
        },
        screen: {
          flex: 1,
        },
        strength: {
          ...typography.body,
          color: themeStyles.textPrimary.color,
        },
      }),
    [themeStyles, tokens]
  );

  const selectChip = useCallback((next: RecommendationChip) => {
    setChip(next);
    void AsyncStorage.setItem(CHIP_STORAGE_KEY, next);
  }, []);

  const items = state.status === 'ready' ? state.items : [];
  const header = (
    <View>
      <MediaTypeSelector
        labelKeys={CHIP_LABEL_KEYS}
        onChange={selectChip}
        selectedMediaType={chip}
        testIDPrefix="recommendations"
        types={CHIPS}
      />
      {signedIn && !trackingAllowed && items.length > 0 ? (
        <View style={styles.note}>
          <Text style={styles.noteText}>{t('features.recommendations.paused')}</Text>
          <Button
            label={t('features.recommendations.enable')}
            onPress={openSettings}
            testID="recommendations-taste-profile-settings"
            variant="secondary"
          />
        </View>
      ) : null}
    </View>
  );

  const empty = !signedIn ? (
    <CallToActionSection
      actionLabelKey="authentication.login"
      messageKey="authentication.login_required"
      onAction={onRequestLogin}
      testID="recommendations-auth-required"
    />
  ) : state.status === 'loading' || state.status === 'idle' ? (
    <LoadingSection testID="recommendations-loading" />
  ) : state.status === 'error' ? (
    <RetryableError
      errorKey="features.recommendations.load_error"
      onRetry={() => {
        setRetryCount((count) => count + 1);
      }}
      testID="recommendations-error"
    />
  ) : !trackingAllowed ? (
    <CallToActionSection
      actionLabelKey="features.recommendations.enable"
      messageKey="features.recommendations.need_taste_profile"
      onAction={openSettings}
      testID="recommendations-need-taste-profile"
    />
  ) : (
    <ListEmpty messageKey="features.recommendations.check_back" testID="recommendations-empty" />
  );

  return (
    <View style={styles.screen} testID="recommendations-screen">
      <FillList
        data={items}
        keyExtractor={(item) => item.channel.id_text}
        ListEmptyComponent={empty}
        ListHeaderComponent={header}
        renderItem={({ item }) => {
          const title = item.channel.title?.trim() || t('misc.untitled');
          return (
            <ListRow
              leading={
                <CoverImage
                  decodeEdge={LIST_ROW_ARTWORK_SIZE}
                  opensViewer={false}
                  style={coverStyles.image}
                  uri={primaryChannelListArtworkUrl(item.channel.channel_images)}
                />
              }
              onPress={() => {
                openShow(navigation, chip, item);
              }}
              testID={`recommendations-row-${item.channel.id_text}`}
              title={title}
              trailing={
                <Text
                  accessibilityLabel={t('features.recommendations.strength', {
                    level: item.strength,
                  })}
                  style={styles.strength}
                >
                  {item.strength}
                </Text>
              }
            />
          );
        }}
      />
    </View>
  );
}
