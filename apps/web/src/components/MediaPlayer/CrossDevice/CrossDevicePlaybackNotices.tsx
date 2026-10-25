'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';

import { Button, Modal } from '@podverse/ui';

import {
  useCrossDevicePlayback,
  useCrossDevicePlaybackSnapshot,
} from '../../../contexts/CrossDevicePlayback';
import { usePlaybackDevices } from '../../../hooks/usePlaybackDevices';
import type { TransferFailureReason } from '../../../lib/crossDevicePlayback/crossDevicePlaybackStore';
import { showToast } from '../../Toast/Toast';

type TransferFailureTranslator = {
  (
    key:
      | 'cross_device.transfer_failed.autoplay_blocked'
      | 'cross_device.transfer_failed.load_failed'
      | 'cross_device.transfer_failed.no_response'
      | 'cross_device.transfer_failed.not_connected'
      | 'cross_device.transfer_failed.request_failed',
    values: { device: string }
  ): string;
};

function transferFailureMessage(
  reason: TransferFailureReason,
  device: string,
  t: TransferFailureTranslator
): string {
  switch (reason) {
    case 'autoplay_blocked':
      return t('cross_device.transfer_failed.autoplay_blocked', { device });
    case 'load_failed':
      return t('cross_device.transfer_failed.load_failed', { device });
    case 'no_response':
      return t('cross_device.transfer_failed.no_response', { device });
    case 'not_connected':
      return t('cross_device.transfer_failed.not_connected', { device });
    case 'request_failed':
      return t('cross_device.transfer_failed.request_failed', { device });
    default: {
      const _unhandled: never = reason;
      return _unhandled;
    }
  }
}

function CrossDevicePlaybackNoticesReady() {
  const { confirmTapToPlay, dismissTapToPlay, dismissTransferFailure } = useCrossDevicePlayback();
  const tapToPlay = useCrossDevicePlaybackSnapshot((snapshot) => snapshot.tapToPlay);
  const transferFailure = useCrossDevicePlaybackSnapshot((snapshot) => snapshot.transferFailure);
  const { entries, formatName } = usePlaybackDevices();
  const tMediaPlayer = useTranslations('media_player');
  const tMisc = useTranslations('misc');
  const entriesRef = useRef(entries);
  const formatNameRef = useRef(formatName);
  const tRef = useRef(tMediaPlayer);
  entriesRef.current = entries;
  formatNameRef.current = formatName;
  tRef.current = tMediaPlayer;

  useEffect(() => {
    if (transferFailure === null) {
      return;
    }
    const entry =
      entriesRef.current.find(
        (deviceEntry) => deviceEntry.device.session_id_text === transferFailure.targetSessionIdText
      ) ?? null;
    showToast(
      transferFailureMessage(transferFailure.reason, formatNameRef.current(entry), tRef.current),
      'error'
    );
    dismissTransferFailure();
  }, [transferFailure, dismissTransferFailure]);

  return (
    <Modal
      ariaLabel={tMediaPlayer('cross_device.tap_to_play.title')}
      closeButtonAriaLabel={tMisc('close_modal')}
      header={tMediaPlayer('cross_device.tap_to_play.title')}
      isOpen={tapToPlay !== null}
      onClose={dismissTapToPlay}
    >
      <Modal.Body>
        <p>{tMediaPlayer('cross_device.tap_to_play.body')}</p>
      </Modal.Body>
      <Modal.Actions>
        <Button onClick={dismissTapToPlay} type="button" variant="secondary">
          {tMediaPlayer('cross_device.tap_to_play.dismiss_action')}
        </Button>
        <Button onClick={confirmTapToPlay} type="button" variant="primary">
          {tMediaPlayer('cross_device.tap_to_play.play_action')}
        </Button>
      </Modal.Actions>
    </Modal>
  );
}

export const CrossDevicePlaybackNotices: React.FC = () => {
  const availability = useCrossDevicePlaybackSnapshot((snapshot) => snapshot.availability);
  return availability === 'ready' ? <CrossDevicePlaybackNoticesReady /> : null;
};
