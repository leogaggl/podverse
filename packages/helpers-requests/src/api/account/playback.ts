import type {
  PlaybackCommandSendBody,
  PlaybackCommandSendResponse,
  PlaybackErrorCode,
  PlaybackPresenceResponse,
  PlaybackStartFailedBody,
  PlaybackStatePublishBody,
  PlaybackStatePublishResponse,
} from '@podverse/helpers';
import { PLAYBACK_ERROR_CODES } from '@podverse/helpers';

import type { ApiRequestService } from '../_request.js';

/** Checks this device in and returns this device's session id, the devices, and the state. */
export const reqAccountPlaybackCheckIn = (
  api: ApiRequestService
): Promise<PlaybackPresenceResponse> => {
  return api.apiRequest<PlaybackPresenceResponse>({
    path: '/account/playback/presence',
    method: 'POST',
    config: { withCredentials: true },
  });
};

/** Publishes the playing device's state, or claims the active slot with `claim: true`. */
export const reqAccountPlaybackPublishState = (
  api: ApiRequestService,
  body: PlaybackStatePublishBody
): Promise<PlaybackStatePublishResponse> => {
  return api.apiRequest<PlaybackStatePublishResponse>({
    path: '/account/playback/state',
    method: 'POST',
    data: body,
    config: { withCredentials: true },
  });
};

/** Sends one target-state command; it reaches the target device's streams once or not at all. */
export const reqAccountPlaybackSendCommand = (
  api: ApiRequestService,
  body: PlaybackCommandSendBody
): Promise<PlaybackCommandSendResponse> => {
  return api.apiRequest<PlaybackCommandSendResponse>({
    path: '/account/playback/commands',
    method: 'POST',
    data: body,
    config: { withCredentials: true },
  });
};

/** The command's target reports that it could not start audio; the sender's streams are told. */
export const reqAccountPlaybackReportStartFailed = async (
  api: ApiRequestService,
  params: { commandIdText: string; body: PlaybackStartFailedBody }
): Promise<void> => {
  await api.apiRequest<void>({
    path: `/account/playback/commands/${encodeURIComponent(params.commandIdText)}/start-failed`,
    method: 'POST',
    data: params.body,
    config: { withCredentials: true },
  });
};

export interface PlaybackApiError {
  code: PlaybackErrorCode;
  /** Present on `playback_not_active_device`. */
  activeSessionIdText?: string | null;
}

const PLAYBACK_API_ERROR_STATUSES = [400, 409, 503];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPlaybackErrorCode(value: unknown): value is PlaybackErrorCode {
  return Object.values(PLAYBACK_ERROR_CODES).some((code) => code === value);
}

/** Reads a thrown request error (axios-style `error.response`), or null when it is not a playback error. */
export function parsePlaybackApiError(error: unknown): PlaybackApiError | null {
  if (!isRecord(error)) {
    return null;
  }

  const response = error.response;
  if (
    !isRecord(response) ||
    typeof response.status !== 'number' ||
    !PLAYBACK_API_ERROR_STATUSES.includes(response.status)
  ) {
    return null;
  }

  const data = response.data;
  if (!isRecord(data) || !isPlaybackErrorCode(data.code)) {
    return null;
  }

  if (data.code !== PLAYBACK_ERROR_CODES.notActiveDevice) {
    return { code: data.code };
  }

  const activeSessionIdText = data.active_session_id_text;
  return {
    code: data.code,
    activeSessionIdText:
      typeof activeSessionIdText === 'string' && activeSessionIdText !== ''
        ? activeSessionIdText
        : null,
  };
}
