import type { JSX } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import {
  clearCrossDevicePlaybackCommandFailure,
  clearCrossDevicePlaybackTransferFailure,
} from '../../playback/crossDevice/crossDevicePlaybackStore';
import {
  selectPlaybackDeviceEntries,
  transferFailureMessageKey,
} from '../../playback/crossDevice/crossDevicePlayerDisplay';
import {
  useCrossDevicePlaybackView,
  usePlaybackDeviceLabel,
} from '../../playback/crossDevice/useCrossDevicePlayerDisplay';
import { ConfirmDialog } from './ConfirmDialog';

/**
 * App-wide notices for cross-device transfers and remote controls that did not reach the other
 * device.
 */
export function CrossDevicePlaybackNotice(): JSX.Element {
  const view = useCrossDevicePlaybackView();
  const deviceLabel = usePlaybackDeviceLabel();
  const { t } = useTranslation();
  const entries = useMemo(() => selectPlaybackDeviceEntries(view), [view]);
  /** Last label seen for a session id, including devices that have since left the list. */
  const knownLabelsRef = useRef(new Map<string, string>());

  useEffect(() => {
    for (const entry of entries) {
      knownLabelsRef.current.set(entry.device.session_id_text, deviceLabel(entry));
    }
  }, [entries, deviceLabel]);

  const transferFailure = view.transferFailure;
  let device = '';
  if (transferFailure !== null) {
    const sessionIdText = transferFailure.targetSessionIdText;
    const entry =
      entries.find((candidate) => candidate.device.session_id_text === sessionIdText) ?? null;
    device =
      entry !== null
        ? deviceLabel(entry)
        : (knownLabelsRef.current.get(sessionIdText) ?? deviceLabel(null));
  }

  return (
    <>
      <ConfirmDialog
        body={
          transferFailure === null
            ? ''
            : t(transferFailureMessageKey(transferFailure.reason), { device })
        }
        cancelLabel={t('misc.dismiss')}
        cancelTestID="playback-transfer-failed-dismiss"
        onCancel={clearCrossDevicePlaybackTransferFailure}
        testID="playback-transfer-failed-dialog"
        title={t('media_player.devices.transfer_failed_title')}
        visible={transferFailure !== null}
      />
      <ConfirmDialog
        body={t('media_player.devices.command_failed_body')}
        cancelLabel={t('misc.dismiss')}
        cancelTestID="playback-command-failed-dismiss"
        onCancel={clearCrossDevicePlaybackCommandFailure}
        testID="playback-command-failed-dialog"
        title={t('media_player.devices.command_failed_title')}
        visible={transferFailure === null && view.commandFailure !== null}
      />
    </>
  );
}
