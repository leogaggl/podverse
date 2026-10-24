'use client';

import { useTranslations } from 'next-intl';

import { Button, Modal } from '@podverse/ui';

import styles from '../../../../styles/components/Modal/ModalTasteProfileUnhide.module.scss';

type ModalTasteProfileUnhideProps = {
  target: { idText: string; title: string } | null;
  onCancel: () => void;
  onRemoveOnly: () => void;
  onAddBack: () => void;
};

export function ModalTasteProfileUnhide({
  target,
  onCancel,
  onRemoveOnly,
  onAddBack,
}: ModalTasteProfileUnhideProps) {
  const t = useTranslations('taste_profile');
  const tMisc = useTranslations('misc');

  return (
    <Modal
      isOpen={target !== null}
      onClose={onCancel}
      closeButtonAriaLabel={tMisc('close_modal')}
      header={t('unhide_dialog_title')}
      ariaLabel={t('unhide_dialog_title')}
    >
      <Modal.Body>
        <p className={styles.message}>{t('unhide_dialog_body', { title: target?.title ?? '' })}</p>
        <Modal.Actions>
          <Button type="button" variant="secondary" onClick={onCancel}>
            {tMisc('cancel')}
          </Button>
          <Button type="button" variant="secondary" onClick={onRemoveOnly}>
            {t('unhide_remove_only')}
          </Button>
          <Button type="button" variant="primary" onClick={onAddBack}>
            {t('unhide_add_back')}
          </Button>
        </Modal.Actions>
      </Modal.Body>
    </Modal>
  );
}
