'use client';

import { useCallback, useRef } from 'react';

import { useMediaPlayer } from '../contexts/MediaPlayer';
import {
  classifyAddByRSSProtectedMediaFailure,
  findAddByRSSFeedForItem,
  logAddByRSSProtectedMediaFailure,
} from '../utils/addByRSS/protectedMedia';
import { decideBlockedHostPlayback } from '../utils/media/blockedHostPlayback';
import type { MPPlaybackError } from '../utils/media/playbackErrorCopy';
import {
  playbackErrorIdentity,
  resolveReportedPlaybackKind,
} from '../utils/media/playbackErrorCopy';

export type AddByRSSMediaFailureParams = {
  channelIdText?: string | null;
  itemIdText?: string | null;
  mediaUrl: string | null | undefined;
  mediaErrorCode?: number | null;
  /** The media-element failure. A credentials result replaces its kind. */
  fallback: MPPlaybackError;
  /** Loads a resolved final URL in place. Set only when a redirect can be played directly. */
  onResolvedPlaybackUrl?: (url: string) => void;
};

/**
 * Records an add-by-RSS playback failure. A password-protected feed explains the failure when
 * credentials account for it; otherwise the media-element kind is kept. The same item and URL are
 * logged once, since a media element can report the same failed load more than once.
 */
export function useAddByRSSMediaFailureNotice(): (params: AddByRSSMediaFailureParams) => void {
  const mediaPlayer = useMediaPlayer();
  const mediaPlayerRef = useRef(mediaPlayer);
  mediaPlayerRef.current = mediaPlayer;
  const loggedNoticeKeyRef = useRef<string | null>(null);

  return useCallback((params: AddByRSSMediaFailureParams) => {
    void (async () => {
      try {
        const feed = await findAddByRSSFeedForItem(params);
        const player = mediaPlayerRef.current;
        const identityNow = playbackErrorIdentity({
          addByRssResourceData: player.mpAddByRSS?.resourceData ?? null,
          itemIdText: player.mpItem?.id_text ?? null,
          clipIdText: player.mpClip?.id_text ?? null,
          soundbiteIdText: player.mpItemSoundbite?.id_text ?? null,
        });
        if (identityNow !== params.fallback.identity) {
          return;
        }
        const failure = classifyAddByRSSProtectedMediaFailure(feed, params.mediaUrl);
        if (feed && failure) {
          const noticeKey = `${params.itemIdText ?? ''}|${params.mediaUrl ?? ''}|${failure}`;
          if (loggedNoticeKeyRef.current !== noticeKey) {
            loggedNoticeKeyRef.current = noticeKey;
            logAddByRSSProtectedMediaFailure({
              surface: 'playback',
              failure,
              feed,
              mediaUrl: params.mediaUrl,
              mediaErrorCode: params.mediaErrorCode,
            });
          }
          player.reportPlaybackError({
            ...params.fallback,
            kind: resolveReportedPlaybackKind({
              mediaKind: params.fallback.kind,
              credentialsFailure: failure,
            }),
          });
          return;
        }
        const decision = await decideBlockedHostPlayback({
          kind: params.fallback.kind,
          mediaUrl: params.fallback.mediaUrl,
          identity: params.fallback.identity,
          credentialsProtected: feed?.requiresCredentials === true,
        });
        const identityAfterResolve = playbackErrorIdentity({
          addByRssResourceData: mediaPlayerRef.current.mpAddByRSS?.resourceData ?? null,
          itemIdText: mediaPlayerRef.current.mpItem?.id_text ?? null,
          clipIdText: mediaPlayerRef.current.mpClip?.id_text ?? null,
          soundbiteIdText: mediaPlayerRef.current.mpItemSoundbite?.id_text ?? null,
        });
        if (identityAfterResolve !== params.fallback.identity) {
          return;
        }
        if (decision.type === 'reload') {
          params.onResolvedPlaybackUrl?.(decision.url);
          return;
        }
        if (decision.type === 'report') {
          mediaPlayerRef.current.reportPlaybackError({
            ...params.fallback,
            kind: decision.kind,
            message: decision.detail,
            ...(decision.httpStatus === undefined ? {} : { httpStatus: decision.httpStatus }),
          });
          return;
        }
        mediaPlayerRef.current.reportPlaybackError(params.fallback);
      } catch (error) {
        console.error('Add by RSS playback failure could not be classified', error);
        mediaPlayerRef.current.reportPlaybackError(params.fallback);
      }
    })();
  }, []);
}
