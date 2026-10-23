'use client';

import { useTranslations } from 'next-intl';
import React, { useCallback, useEffect } from 'react';

import { Button, Modal } from '@podverse/ui';

import { unsubscribeArtistBodyKey } from '../../../lib/artistUnsubscribe';

type UnsubscribeArtistModalProps = {
  albumCount: number;
  artistTitle: string;
  /** Which action is running; null when idle. */
  busyAction: 'artist_only' | 'artist_and_albums' | null;
  isOpen: boolean;
  onArtistAndAlbums: () => void;
  onArtistOnly: () => void;
  onCancel: () => void;
};

export const UnsubscribeArtistModal: React.FC<UnsubscribeArtistModalProps> = ({
  albumCount,
  artistTitle,
  busyAction,
  isOpen,
  onArtistAndAlbums,
  onArtistOnly,
  onCancel,
}) => {
  const tFeatures = useTranslations('features');
  const tMisc = useTranslations('misc');
  const title = tFeatures('unsubscribe_artist.title', { artist: artistTitle });
  const busy = busyAction !== null;

  const cancel = useCallback(() => {
    if (busyAction !== null) {
      return;
    }
    onCancel();
  }, [busyAction, onCancel]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      cancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, cancel]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={cancel}
      closeButtonAriaLabel={tMisc('close_modal')}
      header={title}
      ariaLabel={title}
    >
      <Modal.Body>
        <p>{tFeatures(unsubscribeArtistBodyKey(albumCount), { count: albumCount })}</p>
      </Modal.Body>
      <Modal.Actions>
        <Button variant="secondary" onClick={cancel} disabled={busy}>
          {tMisc('cancel')}
        </Button>
        <Button
          variant="secondary"
          onClick={onArtistOnly}
          isLoading={busyAction === 'artist_only'}
          disabled={busyAction === 'artist_and_albums'}
        >
          {tFeatures('unsubscribe_artist.artist_only')}
        </Button>
        <Button
          onClick={onArtistAndAlbums}
          isLoading={busyAction === 'artist_and_albums'}
          disabled={busyAction === 'artist_only'}
        >
          {tFeatures('unsubscribe_artist.artist_and_albums')}
        </Button>
      </Modal.Actions>
    </Modal>
  );
};
