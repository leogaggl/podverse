'use client';

import { useTranslations } from 'next-intl';

import { Button, Modal } from '@podverse/ui';

type ModalSignOutOtherDevicesProps = {
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function ModalSignOutOtherDevices({
  isOpen,
  isSubmitting,
  onClose,
  onConfirm,
}: ModalSignOutOtherDevicesProps) {
  const t = useTranslations('settings.account.sessions');
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
      header={t('sign_out_all_other')}
      ariaLabel={t('sign_out_all_other')}
    >
      <Modal.Body>
        <p>{t('sign_out_all_other_body')}</p>
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
            {t('sign_out')}
          </Button>
        </Modal.Actions>
      </Modal.Body>
    </Modal>
  );
}
