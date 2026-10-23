'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

import { Modal } from '@podverse/ui';

import type { ArtistLineLink } from '../../../lib/artistPublishers';

import styles from '../../../styles/components/MediaPlayer/Modal/MediaPlayerArtistChooser.module.scss';

type MediaPlayerArtistChooserProps = {
  links: readonly ArtistLineLink[];
  onClose: () => void;
  onOpenArtist: (href: string) => void;
};

export const MediaPlayerArtistChooser = ({
  links,
  onClose,
  onOpenArtist,
}: MediaPlayerArtistChooserProps) => {
  const tMedia = useTranslations('media');
  const tMisc = useTranslations('misc');
  const firstButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  if (typeof document === 'undefined') {
    return null;
  }

  return ReactDOM.createPortal(
    <Modal
      ariaLabel={tMedia('music.artists')}
      closeButtonAriaLabel={tMisc('close_modal')}
      header={tMedia('music.artists')}
      isOpen
      onClose={onClose}
    >
      <Modal.Body>
        <ul className={styles.list}>
          {links.map((link, index) => (
            <li key={link.idText}>
              <button
                ref={index === 0 ? firstButtonRef : undefined}
                className={styles.artistButton}
                type="button"
                onClick={() => onOpenArtist(link.href)}
              >
                {link.title}
              </button>
            </li>
          ))}
        </ul>
      </Modal.Body>
    </Modal>,
    document.body
  );
};
