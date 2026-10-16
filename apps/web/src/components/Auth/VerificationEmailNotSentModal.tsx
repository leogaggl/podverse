'use client';

import { useTranslations } from 'next-intl';

import { Button, Modal } from '@podverse/ui';

import { useConfig } from '../../contexts/Config';

import styles from '../../styles/components/Auth/VerificationEmailNotSentModal.module.scss';

type VerificationEmailNotSentModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const messageAroundEmail = (
  message: string,
  email: string
): { after: string; before: string } | null => {
  if (email === '') {
    return null;
  }
  const index = message.indexOf(email);
  if (index < 0) {
    return null;
  }
  return {
    before: message.slice(0, index),
    after: message.slice(index + email.length),
  };
};

export const VerificationEmailNotSentModal = ({
  isOpen,
  onClose,
}: VerificationEmailNotSentModalProps) => {
  const tAuthentication = useTranslations('authentication');
  const tMisc = useTranslations('misc');
  const contactEmail = useConfig().public.account.contactEmail;
  const hasContact = contactEmail !== '';
  const body = hasContact
    ? tAuthentication('verification_email_not_sent_body', { email: contactEmail })
    : tAuthentication('verification_email_not_sent_body_no_contact');
  const parts = hasContact ? messageAroundEmail(body, contactEmail) : null;

  return (
    <Modal
      ariaLabel={tAuthentication('verification_email_not_sent_title')}
      closeButtonAriaLabel={tMisc('close_modal')}
      header={tAuthentication('verification_email_not_sent_title')}
      isOpen={isOpen}
      onClose={onClose}
    >
      <Modal.Body>
        <p className={styles.message}>
          {parts === null ? (
            body
          ) : (
            <>
              {parts.before}
              <a className={styles.emailLink} href={`mailto:${contactEmail}`}>
                {contactEmail}
              </a>
              {parts.after}
            </>
          )}
        </p>
      </Modal.Body>
      <Modal.Actions>
        <Button onClick={onClose} type="button" variant="primary">
          {tMisc('close')}
        </Button>
      </Modal.Actions>
    </Modal>
  );
};
