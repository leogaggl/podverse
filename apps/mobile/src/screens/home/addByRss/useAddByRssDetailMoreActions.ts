import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { DTOItem } from '@podverse/helpers/dto';

import type { MediaRowMoreAction } from '../../../components/player/MediaRowActions';
import { buildMediaRowMoreActions } from '../../../components/player/MediaRowActions';
import { downloadActionLabelKey, runDownloadAction } from '../../../downloads/downloadAction';
import { useDownloadAction } from '../../../downloads/useDownloads';
import { useActionError } from '../../../feedback/ActionErrorProvider';
import type { QueueActionPosition } from '../useHomeRowPlayback';

/**
 * More menu for an Add by RSS item page: Queue Next, Queue Last, Add to Playlist, Mark as
 * Played, and Download when the item is downloadable. Add by RSS pages are not shareable,
 * so Share is not offered.
 */
export function useAddByRssDetailMoreActions(input: {
  downloadItem: DTOItem | null;
  idSuffix: string;
  onAddToPlaylistPress: () => void;
  onMarkAsPlayedPress: () => void;
  onQueuePress: (position: QueueActionPosition) => void;
}): MediaRowMoreAction[] {
  const { downloadItem, idSuffix, onAddToPlaylistPress, onMarkAsPlayedPress, onQueuePress } = input;
  const { t } = useTranslation();
  const {
    errorReason,
    isDownloadable,
    remove: removeDownload,
    start: startDownload,
    status: downloadStatus,
  } = useDownloadAction(downloadItem ?? undefined);
  const { openDownloadError } = useActionError();

  return useMemo(
    () =>
      buildMediaRowMoreActions(
        t,
        {
          onAddToPlaylist: onAddToPlaylistPress,
          onMarkAsPlayed: onMarkAsPlayedPress,
          onQueueLast: () => {
            onQueuePress('last');
          },
          onQueueNext: () => {
            onQueuePress('next');
          },
          onDownload: isDownloadable
            ? () => {
                if (downloadStatus === 'failed') {
                  openDownloadError(errorReason, startDownload);
                  return;
                }
                runDownloadAction({
                  remove: removeDownload,
                  start: startDownload,
                  status: downloadStatus,
                });
              }
            : undefined,
        },
        {
          downloadLabelKey: isDownloadable ? downloadActionLabelKey(downloadStatus) : undefined,
          downloadTone: downloadStatus === 'complete' ? 'danger' : undefined,
          idSuffix,
        }
      ),
    [
      downloadStatus,
      errorReason,
      idSuffix,
      isDownloadable,
      onAddToPlaylistPress,
      onMarkAsPlayedPress,
      onQueuePress,
      openDownloadError,
      removeDownload,
      startDownload,
      t,
    ]
  );
}
