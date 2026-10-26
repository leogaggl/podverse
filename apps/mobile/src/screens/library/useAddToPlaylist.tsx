import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import { CommonActions, useNavigation } from '@react-navigation/native';
import type { ReactNode } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, Text } from 'react-native';

import type { AddByRSSResourceData, DTOPlaylist } from '@podverse/helpers';

import { useAuth } from '../../auth/AuthProvider';
import type { FormAction } from '../../components/form';
import { FormActions } from '../../components/form';
import { AppOverlay, OverlayPanel, OverlayScrim } from '../../components/overlay';
import { ListError } from '../../components/state/ListError';
import { ListLoading } from '../../components/state/ListLoading';
import { playlistRepository } from '../../data';
import { useLoadMoreOnEndReached } from '../../hooks/useLoadMoreOnEndReached';
import { stopPropagation } from '../../lib/gesture/stopPropagation';
import {
  appendUniqueBy,
  canLoadNextPage,
  LIST_END_REACHED_THRESHOLD,
  listResponseHasMore,
} from '../../lib/pagination/pagedList';
import { useMembershipGate } from '../../membership/MembershipGateProvider';
import { useAccessTier } from '../../membership/useAccessTier';
import { LIBRARY_STACK_ROUTES } from '../../navigation';
import { formActionsTopGap } from '../../theme/screenLayout';
import { useTheme } from '../../theme/useTheme';

/**
 * A resource the user wants to insert at the first position in a playlist.
 */
export type AddToPlaylistTarget =
  | { kind: 'item' | 'clip' | 'soundbite'; idText: string; medium: 'av' | 'music' }
  | { kind: 'add-by-rss'; medium: 'av' | 'music'; resourceData: AddByRSSResourceData };

const FIRST_PAGE = 1;

type UseAddToPlaylist = {
  /** Opens the picker for a resource. No-op when unauthenticated. */
  requestAddToPlaylist: (target: AddToPlaylistTarget) => void;
  /** Render once in the host screen tree; drives the picker sheet + notices. */
  addToPlaylistSheet: ReactNode;
};

/**
 * Shared "Add to playlist" affordance. Returns an imperative opener plus a bottom-sheet
 * element the caller renders once. The sheet lists owned playlists for the target medium and adds
 * the resource to the top of the selected playlist.
 */
export function useAddToPlaylist(): UseAddToPlaylist {
  const { t } = useTranslation();
  const { styles: themeStyles, tokens } = useTheme();
  const { accessToken, clearSession, refreshToken, setTokens, status } = useAuth();
  const { evaluateFeature, isTierKnown } = useAccessTier();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { handleGateError, openGate } = useMembershipGate();

  const [target, setTarget] = useState<AddToPlaylistTarget | null>(null);
  const [playlists, setPlaylists] = useState<DTOPlaylist[]>([]);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [hasLoadMoreError, setHasLoadMoreError] = useState<boolean>(false);
  const pageRef = useRef<number>(FIRST_PAGE);
  const generationRef = useRef<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [noticeKey, setNoticeKey] = useState<string | null>(null);

  const authArgs = useMemo(
    () => ({ accessToken, clearSession, refreshToken, setTokens }),
    [accessToken, clearSession, refreshToken, setTokens]
  );

  const loadPlaylists = useCallback(
    async (nextTarget: AddToPlaylistTarget) => {
      const generation = generationRef.current;
      setIsLoading(true);
      setNoticeKey(null);
      try {
        const response = await playlistRepository.listOwned(
          authArgs,
          {
            medium: nextTarget.medium,
            page: FIRST_PAGE,
            range: null,
            sort: 'a_z',
          },
          { refresh: true }
        );
        if (generation !== generationRef.current) {
          return;
        }
        setPlaylists(response.data);
        setHasMore(listResponseHasMore(response.meta, response.data.length));
      } catch {
        if (generation !== generationRef.current) {
          return;
        }
        setPlaylists([]);
        setNoticeKey('errors.generic');
      } finally {
        if (generation === generationRef.current) {
          setIsLoading(false);
        }
      }
    },
    [authArgs]
  );

  const loadNextPlaylistsPage = useCallback(async () => {
    if (target === null) {
      return;
    }

    const generation = generationRef.current;
    const nextPage = pageRef.current + 1;
    setIsLoadingMore(true);
    setHasLoadMoreError(false);
    try {
      const response = await playlistRepository.listOwned(
        authArgs,
        {
          medium: target.medium,
          page: nextPage,
          range: null,
          sort: 'a_z',
        },
        { refresh: true }
      );
      if (generation !== generationRef.current) {
        return;
      }
      setPlaylists((current) =>
        appendUniqueBy(current, response.data, (playlist) => playlist.id_text)
      );
      pageRef.current = nextPage;
      setHasMore(listResponseHasMore(response.meta, response.data.length));
    } catch {
      if (generation !== generationRef.current) {
        return;
      }
      setHasLoadMoreError(true);
    } finally {
      if (generation === generationRef.current) {
        setIsLoadingMore(false);
      }
    }
  }, [authArgs, target]);

  const requestAddToPlaylist = useCallback(
    (next: AddToPlaylistTarget) => {
      if (status !== 'authenticated') {
        return;
      }
      generationRef.current += 1;
      setHasMore(false);
      setIsLoadingMore(false);
      setHasLoadMoreError(false);
      pageRef.current = FIRST_PAGE;
      setTarget(next);
      setNoticeKey(null);
      setPlaylists([]);
      setIsLoading(true);
      void loadPlaylists(next);
    },
    [loadPlaylists, status]
  );

  const closeSheet = useCallback(() => {
    generationRef.current += 1;
    setHasMore(false);
    setIsLoadingMore(false);
    setHasLoadMoreError(false);
    pageRef.current = FIRST_PAGE;
    setTarget(null);
    setNoticeKey(null);
  }, []);

  const handleEndReached = useLoadMoreOnEndReached({
    canLoadMore:
      target !== null &&
      canLoadNextPage({
        hasError: hasLoadMoreError,
        hasMore,
        isLoading,
        isLoadingMore,
      }),
    loadMore: loadNextPlaylistsPage,
  });

  const addToPlaylist = useCallback(
    async (playlist: DTOPlaylist) => {
      if (target === null || isSaving) {
        return;
      }
      setIsSaving(true);
      setNoticeKey(null);
      try {
        if (target.kind === 'clip') {
          await playlistRepository.addClipFirst(authArgs, playlist.id_text, target.idText);
        } else if (target.kind === 'soundbite') {
          await playlistRepository.addSoundbiteFirst(authArgs, playlist.id_text, target.idText);
        } else if (target.kind === 'add-by-rss') {
          await playlistRepository.addAddByRssFirst(
            authArgs,
            playlist.id_text,
            target.resourceData
          );
        } else {
          await playlistRepository.addItemFirst(authArgs, playlist.id_text, target.idText);
        }
        setNoticeKey('features.playlist.added_to_playlist');
      } catch (error) {
        if (handleGateError(error)) {
          closeSheet();
          return;
        }
        setNoticeKey('features.playlist.add_error');
      } finally {
        setIsSaving(false);
      }
    },
    [authArgs, closeSheet, handleGateError, isSaving, target]
  );

  const canOpenPlaylistCreate = useMemo(() => {
    return navigation.getState().routeNames.includes(LIBRARY_STACK_ROUTES.PlaylistCreate);
  }, [navigation]);

  const handleCreatePlaylist = useCallback(() => {
    if (status !== 'authenticated') {
      openGate('needs_account');
      return;
    }
    if (isTierKnown) {
      const access = evaluateFeature('add_by_rss_add');
      if (!access.allowed) {
        openGate(access.reason);
        return;
      }
    }

    closeSheet();
    navigation.dispatch(CommonActions.navigate({ name: LIBRARY_STACK_ROUTES.PlaylistCreate }));
  }, [closeSheet, evaluateFeature, isTierKnown, navigation, openGate, status]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          justifyContent: 'flex-end',
        },
        scrim: {
          ...StyleSheet.absoluteFill,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
        },
        notice: {
          color: themeStyles.textSecondary.color,
          fontSize: 13,
          paddingHorizontal: tokens.spacing.lg,
          paddingVertical: tokens.spacing.md,
        },
        optionRow: {
          borderTopColor: themeStyles.border.borderColor,
          borderTopWidth: 1,
          paddingHorizontal: tokens.spacing.lg,
          paddingVertical: tokens.spacing.md,
        },
        optionText: {
          color: themeStyles.textPrimary.color,
          fontSize: 16,
        },
        optionsScroll: {
          maxHeight: 320,
        },
        sheet: {
          backgroundColor: themeStyles.screen.backgroundColor,
          borderTopLeftRadius: tokens.radii.md,
          borderTopRightRadius: tokens.radii.md,
          paddingBottom: tokens.spacing['2xl'],
          paddingTop: tokens.spacing.sm,
        },
        sheetActions: {
          marginTop: formActionsTopGap(tokens.spacing),
          paddingHorizontal: tokens.spacing.lg,
        },
        sheetTitle: {
          color: themeStyles.textSecondary.color,
          fontSize: 13,
          fontWeight: '600',
          paddingHorizontal: tokens.spacing.lg,
          paddingVertical: tokens.spacing.md,
        },
      }),
    [themeStyles, tokens]
  );

  const playlistListFooter = useMemo(() => {
    if (isLoadingMore) {
      return <ListLoading testID="add-to-playlist-loading-more" />;
    }
    if (hasLoadMoreError) {
      return (
        <ListError
          messageKey="errors.generic"
          onRetry={() => {
            void loadNextPlaylistsPage();
          }}
          testID="add-to-playlist-load-more-error"
        />
      );
    }
    return undefined;
  }, [hasLoadMoreError, isLoadingMore, loadNextPlaylistsPage]);

  const showEmpty = !isLoading && noticeKey === null && playlists.length === 0;
  const closeSheetAction: FormAction = {
    label: t('misc.close'),
    onPress: closeSheet,
    testID: 'add-to-playlist-close',
    variant: 'secondary',
  };
  const playlistSheetActions: readonly FormAction[] = canOpenPlaylistCreate
    ? [
        {
          label: t('features.playlist.create_playlist'),
          onPress: handleCreatePlaylist,
          testID: 'add-to-playlist-create',
          variant: 'secondary',
        },
        closeSheetAction,
      ]
    : [closeSheetAction];

  const addToPlaylistSheet = (
    <AppOverlay animation="slide" onRequestClose={closeSheet} visible={target !== null}>
      <Pressable
        accessibilityLabel={t('misc.close')}
        onPress={closeSheet}
        style={styles.backdrop}
        testID="add-to-playlist-backdrop"
      >
        <OverlayScrim pointerEvents="none" style={styles.scrim} />
        <OverlayPanel>
          <Pressable onPress={stopPropagation} style={styles.sheet} testID="add-to-playlist-sheet">
            <Text style={styles.sheetTitle}>{t('features.playlist.add_to_playlist')}</Text>
            {isLoading ? (
              <Text style={styles.notice} testID="add-to-playlist-loading">
                {t('misc.loading_your_content')}
              </Text>
            ) : null}
            {showEmpty ? (
              <Text style={styles.notice} testID="add-to-playlist-empty">
                {t('features.playlist.my_playlists')}
              </Text>
            ) : null}
            {!isLoading && playlists.length > 0 ? (
              <FlatList
                ListFooterComponent={playlistListFooter}
                data={playlists}
                keyExtractor={(playlist) => playlist.id_text}
                onEndReached={handleEndReached}
                onEndReachedThreshold={LIST_END_REACHED_THRESHOLD}
                renderItem={({ item: playlist }) => (
                  <Pressable
                    accessibilityRole="button"
                    disabled={isSaving}
                    onPress={() => {
                      void addToPlaylist(playlist);
                    }}
                    style={styles.optionRow}
                    testID={`add-to-playlist-option-${playlist.id_text}`}
                  >
                    <Text style={styles.optionText}>{playlist.title ?? playlist.id_text}</Text>
                  </Pressable>
                )}
                style={styles.optionsScroll}
              />
            ) : null}
            {noticeKey !== null ? (
              <Text style={styles.notice} testID="add-to-playlist-notice">
                {t(noticeKey)}
              </Text>
            ) : null}
            <FormActions actions={playlistSheetActions} style={styles.sheetActions} />
          </Pressable>
        </OverlayPanel>
      </Pressable>
    </AppOverlay>
  );

  return { addToPlaylistSheet, requestAddToPlaylist };
}
