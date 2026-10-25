'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import React, { useEffect, useState } from 'react';

import {
  getPasswordErrorKey,
  getPasswordRequirementsInfoKey,
} from '@podverse/helpers-validation/client';
import { Button, CenteredMessage, StackForm, TextInput } from '@podverse/ui';

import { getApiRequestService } from '../../factories/apiRequestService';
import { handleRateLimitAlert } from '../../utils/rateLimit/rateLimitAlert';

import styles from '../../styles/components/Auth/AuthResetPasswordForm.module.scss';

type AuthResetPasswordFormProps = {
  token?: string;
};

export const AuthResetPasswordForm: React.FC<AuthResetPasswordFormProps> = ({ token }) => {
  const [password1, setPassword1] = useState('');
  const [password1ErrorKey, setPassword1ErrorKey] = useState<string | undefined>();
  const [password1Touched, setPassword1Touched] = useState(false);
  const [isPasswordResetComplete, setIsPasswordResetComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const tAuthentication = useTranslations('authentication');
  const tMisc = useTranslations('misc');
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    if (!token) {
      router.replace('/');
    }
  }, [token, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      return;
    } // safety
    if (isFormValid) {
      setIsLoading(true);
      try {
        await getApiRequestService().reqAccountResetPassword({ token, password: password1 });
        setIsPasswordResetComplete(true);
      } catch (err) {
        const rateLimitErrorHandled = await handleRateLimitAlert(err, locale, tMisc);
        if (!rateLimitErrorHandled) {
          console.error('Password reset failed:', err);
          alert(tMisc('errors.generic'));
        }
      }
    }
    setIsLoading(false);
  };

  const handlePassword1Blur = () => {
    if (password1Touched && password1.trim() !== '') {
      setPassword1ErrorKey(getPasswordErrorKey(password1) || undefined);
    }
  };

  const onPassword1Change = (value: string) => {
    setPassword1(value);
    setPassword1Touched(value !== '');
    if (password1ErrorKey) {
      const key = getPasswordErrorKey(value);
      if (!key) {
        setPassword1ErrorKey(undefined);
      }
    }
    if (value === '') {
      setPassword1ErrorKey(undefined);
    }
  };

  const isFormValid = !!token && !getPasswordErrorKey(password1) && !!password1;

  if (!token) {
    return null;
  }

  if (isPasswordResetComplete) {
    return (
      <CenteredMessage live="status">
        {tAuthentication('reset_password_complete_message')}
      </CenteredMessage>
    );
  }

  return (
    <div className={styles.authResetPasswordForm}>
      <StackForm onSubmit={handleSubmit}>
        <TextInput
          type="password"
          name="password1"
          value={password1}
          onChange={(e) => onPassword1Change(e.target.value)}
          onBlur={handlePassword1Blur}
          placeholder={tAuthentication('password_hint')}
          eyebrow={tAuthentication('password')}
          infoError={password1ErrorKey ? tAuthentication(password1ErrorKey) : undefined}
        />
        <div className={styles.passwordInfo}>
          {tAuthentication(getPasswordRequirementsInfoKey())}
        </div>
        <div className={styles.buttons}>
          <Button type="button" onClick={() => router.push('/')} variant="secondary">
            {tMisc('cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={!isFormValid || isLoading}
            isLoading={isLoading}
          >
            {tMisc('submit')}
          </Button>
        </div>
      </StackForm>
    </div>
  );
};
