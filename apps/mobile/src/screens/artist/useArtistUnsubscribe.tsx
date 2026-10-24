import type { ReactElement } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { requestWithMobileAuthRefresh } from '../../auth';
import { useAuth } from '../../auth/AuthProvider';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { addByRssRepository } from '../../data/repositories/addByRssRepository';
import { subscriptionsRepository } from '../../data/repositories/subscriptionsRepository';
import type { MobileAuthRequestContext } from '../../data/repositories/types';
import { useOfflineMode } from '../../prefs/offlineMode';
import { buildAddByRssArtistAlbums } from '../home/addByRss/addByRssArtistAlbums';
import type { ArtistFollowTarget, ArtistUnsubscribeChoice } from './artistUnsubscribeTargets';
import {
  artistUnsubscribeTargets,
  followedAddByRssArtistAlbums,
  followedDirectoryArtistAlbums,
  unsubscribeArtistBodyKey,
} from './artistUnsubscribeTargets';

export type ArtistUnsubscribeRequest =
  | {
      source: 'directory';
      idText: string;
      title: string;
      /** The verified albums the screen already loaded; omit to fetch them. */
      verifiedAlbumIdTexts?: readonly string[];
    }
  | { source: 'addByRss'; feedUrl: string; title: string };

export type ArtistUnsubscribeResult =
  { status: 'cancelled' } | { status: 'done'; serverError: boolean };

type DialogContent = { title: string; albumCount: number };

/**
 * The albums by this artist that this device follows. Directory albums are the artist's verified
 * albums; offline mode with nothing passed in has none to count.
 */
const loadFollowedArtistAlbums = async (
  request: ArtistUnsubscribeRequest,
  authContext: MobileAuthRequestContext,
  offlineModeEnabled: boolean
): Promise<ArtistFollowTarget[]> => {
  const readSubscribedDirectoryIdTexts = async (): Promise<ReadonlySet<string>> =>
    new Set(await subscriptionsRepository.listDirectoryIdTexts());

  if (request.source === 'directory') {
    let verifiedAlbumIdTexts: readonly string[];
    if (request.verifiedAlbumIdTexts !== undefined) {
      verifiedAlbumIdTexts = request.verifiedAlbumIdTexts;
    } else if (offlineModeEnabled) {
      verifiedAlbumIdTexts = [];
    } else {
      const response = await requestWithMobileAuthRefresh(authContext, async (api) =>
        api.reqPublisherFeedGetRemoteItemsForChannel(request.idText)
      );
      verifiedAlbumIdTexts = response.channelsAdded.map((row) => row.id_text);
    }
    if (verifiedAlbumIdTexts.length === 0) {
      return [];
    }
    return followedDirectoryArtistAlbums({
      artistIdText: request.idText,
      verifiedAlbumIdTexts,
      subscribedDirectoryIdTexts: await readSubscribedDirectoryIdTexts(),
    });
  }

  const [listings, feeds] = await Promise.all([
    addByRssRepository.listListedFeeds(request.feedUrl),
    addByRssRepository.listFeedsWithRefs(),
  ]);
  const artist = feeds.find((entry) => entry.feed.feedUrl === request.feedUrl);
  if (artist === undefined) {
    return [];
  }
  const { albums } = buildAddByRssArtistAlbums({ artist, feeds, listings });
  if (albums.length === 0) {
    return [];
  }
  return followedAddByRssArtistAlbums({
    artistFeedUrl: request.feedUrl,
    albums,
    subscribedDirectoryIdTexts: await readSubscribedDirectoryIdTexts(),
  });
};

/**
 * Unsubscribe from an artist, asking first whether to end the follows of its albums too when this
 * device follows any. The host renders `artistUnsubscribeDialog` once. The dialog closes on a
 * choice and the writes run after, so the host's own busy state covers the wait.
 */
export function useArtistUnsubscribe(): {
  artistUnsubscribeDialog: ReactElement;
  unsubscribeArtist: (request: ArtistUnsubscribeRequest) => Promise<ArtistUnsubscribeResult>;
} {
  const { t } = useTranslation();
  const { accessToken, clearSession, refreshToken, setTokens, status } = useAuth();
  const { enabled: offlineModeEnabled } = useOfflineMode();
  const [isDialogVisible, setIsDialogVisible] = useState<boolean>(false);
  // Kept after the dialog hides so its text does not change while it fades out.
  const [dialogContent, setDialogContent] = useState<DialogContent | null>(null);
  const resolverRef = useRef<((choice: ArtistUnsubscribeChoice | null) => void) | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const settleChoice = useCallback((choice: ArtistUnsubscribeChoice | null) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setIsDialogVisible(false);
    resolve?.(choice);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      const resolve = resolverRef.current;
      resolverRef.current = null;
      resolve?.(null);
    };
  }, []);

  const unsubscribeArtist = useCallback(
    async (request: ArtistUnsubscribeRequest): Promise<ArtistUnsubscribeResult> => {
      const authContext: MobileAuthRequestContext = {
        accessToken,
        clearSession,
        refreshToken,
        setTokens,
      };
      const accountSync = status === 'authenticated' ? authContext : undefined;
      const artist: ArtistFollowTarget =
        request.source === 'directory'
          ? { idText: request.idText, source: 'directory' }
          : { idText: request.feedUrl, source: 'addByRss' };

      const unsubscribeArtistOnly = async (): Promise<ArtistUnsubscribeResult> => {
        const { serverError } = await subscriptionsRepository.unsubscribe({
          accountSync,
          idText: artist.idText,
          source: artist.source,
        });
        return { status: 'done', serverError };
      };

      let albums: ArtistFollowTarget[];
      try {
        albums = await loadFollowedArtistAlbums(request, authContext, offlineModeEnabled);
      } catch {
        albums = [];
      }
      if (albums.length === 0) {
        return unsubscribeArtistOnly();
      }
      if (!isMountedRef.current) {
        return { status: 'cancelled' };
      }

      const previousResolve = resolverRef.current;
      resolverRef.current = null;
      previousResolve?.(null);

      const choice = await new Promise<ArtistUnsubscribeChoice | null>((resolve) => {
        resolverRef.current = resolve;
        setDialogContent({ albumCount: albums.length, title: request.title });
        setIsDialogVisible(true);
      });
      if (choice === null) {
        return { status: 'cancelled' };
      }
      if (choice === 'artist_only') {
        return unsubscribeArtistOnly();
      }
      const { serverError } = await subscriptionsRepository.unsubscribeMany({
        accountSync,
        targets: artistUnsubscribeTargets({ artist, albums, choice }),
      });
      return { status: 'done', serverError };
    },
    [accessToken, clearSession, offlineModeEnabled, refreshToken, setTokens, status]
  );

  const albumCount = dialogContent?.albumCount ?? 0;

  return {
    artistUnsubscribeDialog: (
      <ConfirmDialog
        body={
          dialogContent === null
            ? ''
            : t(unsubscribeArtistBodyKey(albumCount), { count: albumCount })
        }
        cancelLabel={dialogContent === null ? '' : t('misc.cancel')}
        cancelTestID="artist-unsubscribe-dialog-cancel"
        confirmLabel={
          dialogContent === null ? '' : t('features.unsubscribe_artist.artist_and_albums')
        }
        confirmTestID="artist-unsubscribe-dialog-artist-and-albums"
        onCancel={() => {
          settleChoice(null);
        }}
        onConfirm={() => {
          settleChoice('artist_and_albums');
        }}
        onSecondaryConfirm={() => {
          settleChoice('artist_only');
        }}
        secondaryConfirmLabel={
          dialogContent === null ? '' : t('features.unsubscribe_artist.artist_only')
        }
        secondaryConfirmTestID="artist-unsubscribe-dialog-artist-only"
        testID="artist-unsubscribe-dialog"
        title={
          dialogContent === null
            ? ''
            : t('features.unsubscribe_artist.title', { artist: dialogContent.title })
        }
        visible={isDialogVisible}
      />
    ),
    unsubscribeArtist,
  };
}
