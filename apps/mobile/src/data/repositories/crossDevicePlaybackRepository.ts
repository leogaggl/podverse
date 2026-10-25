import type {
  PlaybackCommandSendBody,
  PlaybackCommandSendResponse,
  PlaybackPresenceResponse,
  PlaybackStartFailedReason,
  PlaybackStatePublishBody,
  PlaybackStatePublishResponse,
} from '@podverse/helpers/accountPlaybackStream';

import { requestWithMobileAuthRefresh } from '../../auth/authRequestWithRefresh';
import type { MobileAuthRequestContext } from './types';

/**
 * Cross-device playback requests. These are live signals: nothing is cached or queued, and a
 * request that fails is not replayed.
 */
export const crossDevicePlaybackRepository = {
  checkIn: async (context: MobileAuthRequestContext): Promise<PlaybackPresenceResponse> => {
    return requestWithMobileAuthRefresh(context, async (apiRequestService) =>
      apiRequestService.reqAccountPlaybackCheckIn()
    );
  },

  publishState: async (
    context: MobileAuthRequestContext,
    body: PlaybackStatePublishBody
  ): Promise<PlaybackStatePublishResponse> => {
    return requestWithMobileAuthRefresh(context, async (apiRequestService) =>
      apiRequestService.reqAccountPlaybackPublishState(body)
    );
  },

  sendCommand: async (
    context: MobileAuthRequestContext,
    body: PlaybackCommandSendBody
  ): Promise<PlaybackCommandSendResponse> => {
    return requestWithMobileAuthRefresh(context, async (apiRequestService) =>
      apiRequestService.reqAccountPlaybackSendCommand(body)
    );
  },

  reportStartFailed: async (
    context: MobileAuthRequestContext,
    params: { commandIdText: string; reason: PlaybackStartFailedReason }
  ): Promise<void> => {
    await requestWithMobileAuthRefresh(context, async (apiRequestService) =>
      apiRequestService.reqAccountPlaybackReportStartFailed({
        commandIdText: params.commandIdText,
        body: { reason: params.reason },
      })
    );
  },
};
