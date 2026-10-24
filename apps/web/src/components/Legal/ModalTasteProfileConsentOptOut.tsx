'use client';

import { useTranslations } from 'next-intl';

import { Button, Modal } from '@podverse/ui';

import styles from '../../styles/components/Modal/ModalTasteProfileConsentOptOut.module.scss';

type ModalTasteProfileConsentOptOutProps = {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ModalTasteProfileConsentOptOut({
  isOpen,
  onCancel,
  onConfirm,
}: ModalTasteProfileConsentOptOutProps) {
  const t = useTranslations('taste_profile_consent');
  const tMisc = useTranslations('misc');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      closeButtonAriaLabel={tMisc('close_modal')}
      header={t('opt_out_confirm_title')}
      ariaLabel={t('opt_out_confirm_title')}
    >
      <Modal.Body>
        <p className={styles.message}>{t('opt_out_confirm_body')}</p>
        <Modal.Actions>
          <Button type="button" variant="secondary" onClick={onCancel}>
            {tMisc('cancel')}
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm}>
            {t('opt_out_confirm_action')}
          </Button>
        </Modal.Actions>
      </Modal.Body>
    </Modal>
  );
}
