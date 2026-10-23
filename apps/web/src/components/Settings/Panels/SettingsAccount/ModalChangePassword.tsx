'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { FormEvent } from 'react';
import { useRef, useState } from 'react';

import {
  ACCOUNT_CHANGE_PASSWORD_ERROR_CODES,
  getErrorResponseBodyCode,
  getErrorResponseStatus,
} from '@podverse/helpers';
import {
  getPasswordErrorKey,
  getPasswordRequirementsInfoKey,
} from '@podverse/helpers-validation/client';
import { Button, Modal, StackForm, TextInput } from '@podverse/ui';

import { getApiRequestService } from '../../../../factories/apiRequestService';
import { handleRateLimitAlert } from '../../../../utils/rateLimit/rateLimitAlert';
import { showToast } from '../../../Toast/Toast';

import styles from '../../../../styles/components/Modal/ModalChangePassword.module.scss';

type ModalChangePasswordProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function ModalChangePassword({ isOpen, onClose }: ModalChangePasswordProps) {
  const tSettings = useTranslations('settings');
  const tAuthentication = useTranslations('authentication');
  const tMisc = useTranslations('misc');
  const locale = useLocale();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [currentPasswordError, setCurrentPasswordError] = useState<string | undefined>();
  const [newPasswordError, setNewPasswordError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const handleClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setCurrentPasswordError(undefined);
    setNewPasswordError(undefined);
    setFormError(undefined);
    onClose();
  };

  const onCurrentPasswordChange = (value: string) => {
    setCurrentPassword(value);
    setCurrentPasswordError(undefined);
    setFormError(undefined);
  };

  const onNewPasswordChange = (value: string) => {
    setNewPassword(value);
    setNewPasswordError(undefined);
    setFormError(undefined);
  };

  const handleNewPasswordBlur = () => {
    if (newPassword !== '' && getPasswordErrorKey(newPassword) !== undefined) {
      setNewPasswordError(tAuthentication('invalid_password'));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) {
      return;
    }
    if (currentPassword.trim() === '' || newPassword.trim() === '') {
      setFormError(tSettings('account.change_password.missing_field'));
      return;
    }
    if (getPasswordErrorKey(newPassword) !== undefined) {
      setNewPasswordError(tAuthentication('invalid_password'));
      return;
    }

    setCurrentPasswordError(undefined);
    setNewPasswordError(undefined);
    setFormError(undefined);
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      await getApiRequestService().reqAccountChangePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      handleClose();
      showToast(tSettings('account.change_password.success'), 'success');
    } catch (error: unknown) {
      const handled = await handleRateLimitAlert(error, locale, tMisc);
      if (handled) {
        return;
      }
      const status = getErrorResponseStatus(error);
      const code = getErrorResponseBodyCode(error);
      if (status === 401) {
        return;
      }
      if (code === ACCOUNT_CHANGE_PASSWORD_ERROR_CODES.CURRENT_PASSWORD_INCORRECT) {
        setCurrentPasswordError(tSettings('account.change_password.current_incorrect'));
        return;
      }
      if (code === ACCOUNT_CHANGE_PASSWORD_ERROR_CODES.INVALID_NEW_PASSWORD) {
        setNewPasswordError(tAuthentication('invalid_password'));
        return;
      }
      if (status === 400 && code === undefined) {
        setFormError(tSettings('account.change_password.missing_field'));
        return;
      }
      setFormError(tSettings('account.change_password.error'));
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const isSubmitDisabled =
    isSubmitting || currentPassword.trim() === '' || getPasswordErrorKey(newPassword) !== undefined;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      closeButtonAriaLabel={tMisc('close_modal')}
      header={tSettings('account.change_password.heading')}
      ariaLabel={tSettings('account.change_password.heading')}
    >
      <Modal.Body>
        <StackForm onSubmit={handleSubmit}>
          <p className={styles.message}>{tSettings('account.change_password.description')}</p>
          <TextInput
            type="password"
            name="currentPassword"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => onCurrentPasswordChange(event.target.value)}
            placeholder={tSettings('account.change_password.current_password_placeholder')}
            eyebrow={tSettings('account.change_password.current_password')}
            infoError={currentPasswordError}
            aria-invalid={currentPasswordError !== undefined}
            autoFocus
          />
          <TextInput
            type="password"
            name="newPassword"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => onNewPasswordChange(event.target.value)}
            onBlur={handleNewPasswordBlur}
            placeholder={tAuthentication('password_hint')}
            eyebrow={tSettings('account.change_password.new_password')}
            infoError={newPasswordError}
            aria-invalid={newPasswordError !== undefined}
          />
          <p className={styles.message}>{tAuthentication(getPasswordRequirementsInfoKey())}</p>
          {formError !== undefined ? (
            <p role="alert" className={styles.formError}>
              {formError}
            </p>
          ) : null}
          <Modal.Actions>
            <Button type="button" variant="secondary" onClick={handleClose} disabled={isSubmitting}>
              {tMisc('cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              disabled={isSubmitDisabled}
            >
              {tSettings('account.change_password.submit')}
            </Button>
          </Modal.Actions>
        </StackForm>
      </Modal.Body>
    </Modal>
  );
}
