import type { DTOPlaybackCommand } from '@podverse/helpers';
import { PLAYBACK_ERROR_CODES } from '@podverse/helpers';
import { parseMembershipGateError, parsePlaybackApiError } from '@podverse/helpers-requests';

import { getApiRequestService } from '../../factories/apiRequestService';
import type { OptimisticPlaybackPatch } from './crossDevicePlaybackStore';
import { crossDevicePlaybackStore } from './crossDevicePlaybackStore';
import { requestPlaybackCheckIn } from './playbackCheckInRequest';

function optimisticPatchForCommand(command: DTOPlaybackCommand): OptimisticPlaybackPatch | null {
  switch (command.type) {
    case 'play':
      return { status: 'playing' };
    case 'pause':
      return { status: 'paused' };
    case 'seek':
      return { position_seconds: command.position_seconds };
    case 'set_rate':
      return { rate: command.rate };
    case 'play_item':
    case 'next':
    case 'previous':
    case 'take_over':
      return null;
  }
}

/**
 * Sends one target-state command to the playing device, with no target session. Play, pause,
 * seek, and speed patch the displayed state first; a failure clears that patch. Never throws.
 */
export async function sendPlaybackCommand(command: DTOPlaybackCommand): Promise<void> {
  const patch = optimisticPatchForCommand(command);
  if (patch !== null) {
    crossDevicePlaybackStore.setOptimisticPatch(patch);
  }

  try {
    await getApiRequestService().reqAccountPlaybackSendCommand({ command });
  } catch (error: unknown) {
    crossDevicePlaybackStore.clearOptimisticPatch();
    if (parseMembershipGateError(error) !== null) {
      crossDevicePlaybackStore.markUnavailable();
      return;
    }
    const code = parsePlaybackApiError(error)?.code;
    if (
      code === PLAYBACK_ERROR_CODES.noActiveDevice ||
      code === PLAYBACK_ERROR_CODES.deviceNotConnected
    ) {
      requestPlaybackCheckIn();
    }
  }
}
