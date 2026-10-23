'use client';

import { useTranslations } from 'next-intl';

import { Button, Modal } from '@podverse/ui';

type ModalRevokeApiKeyProps = {
  isOpen: boolean;
  isSubmitting: boolean;
  name: string;
  onClose: () => void;
  onConfirm: () => void;
};

export function ModalRevokeApiKey({
  isOpen,
  isSubmitting,
  name,
  onClose,
  onConfirm,
}: ModalRevokeApiKeyProps) {
  const t = useTranslations('settings.developer');
  const tMisc = useTranslations('misc');

  const requestClose = () => {
    if (isSubmitting) {
      return;
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={requestClose}
      closeButtonAriaLabel={tMisc('close_modal')}
      header={t('revoke_title')}
      ariaLabel={t('revoke_title')}
    >
      <Modal.Body>
        <p>{t('revoke_body', { name })}</p>
        <Modal.Actions>
          <Button type="button" onClick={requestClose} variant="secondary" disabled={isSubmitting}>
            {tMisc('cancel')}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            variant="primary"
            isLoading={isSubmitting}
            disabled={isSubmitting}
          >
            {t('revoke')}
          </Button>
        </Modal.Actions>
      </Modal.Body>
    </Modal>
  );
}
