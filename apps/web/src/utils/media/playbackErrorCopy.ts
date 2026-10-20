import { addByRSSPlaybackIdentity } from '../../hooks/playbackHandoffState';
import type { AddByRSSProtectedMediaFailure } from '../addByRSS/protectedMedia';

/**
 * Why web could not play the loaded item. Exhaustive with {@link playbackErrorMessageKeys}.
 * The four credentials kinds explain a password-protected Add by RSS file. `host-blocked` covers a
 * blocked host, a missing file, and a format the browser rejected, which a media element reports
 * as the same code.
 */
export type WebPlaybackErrorKind =
  | 'network'
  | 'decode'
  | 'unsupported'
  | 'file-not-found'
  | 'host-http'
  | 'host-blocked'
  | 'invalid-source'
  | 'unknown'
  | 'credentials-required'
  | 'credentials-rejected'
  | 'credentials-withheld-insecure'
  | 'credentials-withheld-other-domain';

export const WEB_PLAYBACK_ERROR_KINDS = [
  'network',
  'decode',
  'unsupported',
  'file-not-found',
  'host-http',
  'host-blocked',
  'invalid-source',
  'unknown',
  'credentials-required',
  'credentials-rejected',
  'credentials-withheld-insecure',
  'credentials-withheld-other-domain',
] as const satisfies readonly WebPlaybackErrorKind[];

export type MPPlaybackError = {
  kind: WebPlaybackErrorKind;
  /** The loaded item's identity when it failed. */
  identity: string;
  mediaUrl: string | null;
  code: string;
  httpStatus?: number;
  message: string;
};

/** Leaf keys under the `action_error` catalog namespace. */
export type PlaybackErrorBodyKey =
  | 'playback_network'
  | 'playback_decode'
  | 'playback_unsupported'
  | 'playback_file_not_found'
  | 'playback_host_http'
  | 'playback_host_blocked'
  | 'playback_invalid_source'
  | 'playback_unknown'
  | 'playback_credentials_required'
  | 'playback_credentials_rejected'
  | 'playback_credentials_withheld_insecure'
  | 'playback_credentials_withheld_other_domain';

export type PlaybackErrorMessageKeys = {
  a11yKey: 'playback_a11y';
  bodyKey: PlaybackErrorBodyKey;
  titleKey: 'playback_title';
};

const playbackTitle = {
  a11yKey: 'playback_a11y',
  titleKey: 'playback_title',
} as const;

/**
 * One title and body per kind. Exhaustive, so a new kind cannot ship without copy.
 */
export const playbackErrorMessageKeys = (kind: WebPlaybackErrorKind): PlaybackErrorMessageKeys => {
  switch (kind) {
    case 'network':
      return { ...playbackTitle, bodyKey: 'playback_network' };
    case 'decode':
      return { ...playbackTitle, bodyKey: 'playback_decode' };
    case 'unsupported':
      return { ...playbackTitle, bodyKey: 'playback_unsupported' };
    case 'file-not-found':
      return { ...playbackTitle, bodyKey: 'playback_file_not_found' };
    case 'host-http':
      return { ...playbackTitle, bodyKey: 'playback_host_http' };
    case 'host-blocked':
      return { ...playbackTitle, bodyKey: 'playback_host_blocked' };
    case 'invalid-source':
      return { ...playbackTitle, bodyKey: 'playback_invalid_source' };
    case 'unknown':
      return { ...playbackTitle, bodyKey: 'playback_unknown' };
    case 'credentials-required':
      return { ...playbackTitle, bodyKey: 'playback_credentials_required' };
    case 'credentials-rejected':
      return { ...playbackTitle, bodyKey: 'playback_credentials_rejected' };
    case 'credentials-withheld-insecure':
      return { ...playbackTitle, bodyKey: 'playback_credentials_withheld_insecure' };
    case 'credentials-withheld-other-domain':
      return { ...playbackTitle, bodyKey: 'playback_credentials_withheld_other_domain' };
  }
};

const MEDIA_ERR_ABORTED = 1;
const MEDIA_ERR_NETWORK = 2;
const MEDIA_ERR_DECODE = 3;
const MEDIA_ERR_SRC_NOT_SUPPORTED = 4;

/**
 * The media element's `error.code`. `null` for an aborted load, which is not a failure to explain.
 * Code 4 is `host-blocked`: a blocked host, a missing file, and a rejected format all use it.
 */
export const mediaErrorKind = (code: number): WebPlaybackErrorKind | null => {
  switch (code) {
    case MEDIA_ERR_ABORTED:
      return null;
    case MEDIA_ERR_NETWORK:
      return 'network';
    case MEDIA_ERR_DECODE:
      return 'decode';
    case MEDIA_ERR_SRC_NOT_SUPPORTED:
      return 'host-blocked';
    default:
      return 'unknown';
  }
};

export const mediaErrorCodeLabel = (code: number): string => {
  switch (code) {
    case MEDIA_ERR_ABORTED:
      return 'MEDIA_ERR_ABORTED';
    case MEDIA_ERR_NETWORK:
      return 'MEDIA_ERR_NETWORK';
    case MEDIA_ERR_DECODE:
      return 'MEDIA_ERR_DECODE';
    case MEDIA_ERR_SRC_NOT_SUPPORTED:
      return 'MEDIA_ERR_SRC_NOT_SUPPORTED';
    default:
      return String(code);
  }
};

const errorName = (error: unknown): string => (error instanceof Error ? error.name : '');

/**
 * A rejected `play()`. Autoplay policy and a superseded play are not failures. `NotSupportedError`
 * is the same outcome as media error code 4.
 */
export const playRejectionKind = (error: unknown): WebPlaybackErrorKind | null => {
  const name = errorName(error);
  if (name === 'NotAllowedError' || name === 'AbortError') {
    return null;
  }
  if (name === 'NotSupportedError') {
    return 'host-blocked';
  }
  return name === '' ? null : 'unknown';
};

export const playRejectionDetail = (error: unknown): { code: string; message: string } => ({
  code: errorName(error),
  message: error instanceof Error ? error.message : '',
});

export const credentialsFailureKind = (
  failure: AddByRSSProtectedMediaFailure
): WebPlaybackErrorKind => {
  switch (failure) {
    case 'media_needs_credentials':
      return 'credentials-required';
    case 'media_other_domain':
      return 'credentials-withheld-other-domain';
  }
};

/** A credentials explanation replaces the media-element kind. */
export const resolveReportedPlaybackKind = (params: {
  mediaKind: WebPlaybackErrorKind;
  credentialsFailure: AddByRSSProtectedMediaFailure | null;
}): WebPlaybackErrorKind =>
  params.credentialsFailure === null
    ? params.mediaKind
    : credentialsFailureKind(params.credentialsFailure);

/**
 * The identity an error is compared against. Add by RSS uses its hash. A directory item uses
 * `id_text`, then a clip, then a soundbite.
 */
export const playbackErrorIdentity = (params: {
  addByRssResourceData?: Record<string, unknown> | null;
  itemIdText?: string | null;
  clipIdText?: string | null;
  soundbiteIdText?: string | null;
}): string | null => {
  if (params.addByRssResourceData) {
    const addByRssIdentity = addByRSSPlaybackIdentity(params.addByRssResourceData);
    if (addByRssIdentity !== null) {
      return addByRssIdentity;
    }
  }
  const itemIdText = params.itemIdText?.trim();
  if (itemIdText) {
    return itemIdText;
  }
  const clipIdText = params.clipIdText?.trim();
  if (clipIdText) {
    return clipIdText;
  }
  const soundbiteIdText = params.soundbiteIdText?.trim();
  if (soundbiteIdText) {
    return soundbiteIdText;
  }
  return null;
};

/**
 * `http` or `https` with no username or password. Anything else stays out of a new tab.
 */
export const openablePlaybackMediaUrl = (mediaUrl: string | null): string | null => {
  if (mediaUrl === null || mediaUrl.trim() === '') {
    return null;
  }
  try {
    const url = new URL(mediaUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    if (url.username !== '' || url.password !== '') {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
};

export type PlaybackErrorReduction =
  | { type: 'report'; error: MPPlaybackError }
  | { type: 'identity'; identity: string | null }
  | { type: 'playing' }
  | { type: 'retry' };

/** An error stays while the same item is loaded, and clears when it plays, retries, or changes. */
export const reducePlaybackError = (
  current: MPPlaybackError | null,
  event: PlaybackErrorReduction
): MPPlaybackError | null => {
  switch (event.type) {
    case 'report':
      return event.error;
    case 'identity':
      if (current !== null && current.identity !== event.identity) {
        return null;
      }
      return current;
    case 'playing':
    case 'retry':
      return null;
  }
};

/**
 * A media error is not the track ending. The queue stays where it is, and nothing else loads.
 */
export const shouldAdvanceQueueAfterEnded = (params: {
  mediaErrorCode: number | null;
  playbackError: MPPlaybackError | null;
}): boolean => params.mediaErrorCode === null && params.playbackError === null;
