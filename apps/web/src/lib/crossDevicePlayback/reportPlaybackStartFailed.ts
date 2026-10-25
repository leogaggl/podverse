import type { PlaybackStartFailedReason } from '@podverse/helpers';

import { getApiRequestService } from '../../factories/apiRequestService';

export function reportPlaybackStartFailed(
  commandIdText: string,
  reason: PlaybackStartFailedReason
): void {
  void getApiRequestService()
    .reqAccountPlaybackReportStartFailed({ commandIdText, body: { reason } })
    .catch(() => {
      // The command record may have expired.
    });
}
