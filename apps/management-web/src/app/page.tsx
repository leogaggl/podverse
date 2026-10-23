'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { FormEvent } from 'react';
import { Suspense, useEffect, useState } from 'react';

import type { AuthSessionEndedNotice } from '@podverse/helpers/authSessionNotice';
import {
  Alert,
  AuthCard,
  AuthCardHeader,
  Button,
  CenterContainer,
  StackForm,
  TextInput,
} from '@podverse/ui';

import { ManagementLoadingSpinnerOverlay } from '../components/LoadingSpinner/ManagementLoadingSpinnerOverlay';
import { getConfig } from '../config';
import {
  isAuthSessionEndedNotice,
  sessionEndedNoticeMessageKey,
} from '../lib/auth/sessionEndedNotice';
import { getManagementAuthResult, login } from '../lib/requests/auth';
import { ROUTES } from '../lib/routes';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function loginFailureMessage(error: unknown, fallback: string): string {
  if (isRecord(error) && 'response' in error && isRecord(error.response)) {
    const data = error.response.data;
    if (isRecord(data) && typeof data.message === 'string' && data.message.length > 0) {
      return data.message;
    }
    return fallback;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

function LoginCheckingAuth() {
  return (
    <CenterContainer>
      <ManagementLoadingSpinnerOverlay isLoading />
    </CenterContainer>
  );
}

function LoginPage() {
  const t = useTranslations('auth');
  const searchParams = useSearchParams();
  const queryNoticeValue = searchParams.get('notice');
  const noticeFromQuery =
    queryNoticeValue !== null && isAuthSessionEndedNotice(queryNoticeValue)
      ? queryNoticeValue
      : null;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resultNotice, setResultNotice] = useState<AuthSessionEndedNotice | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      const result = await getManagementAuthResult();
      if (cancelled) {
        return;
      }
      if (result.user !== null) {
        router.push(ROUTES.DASHBOARD);
        return;
      }
      setResultNotice(result.notice);
      setCheckingAuth(false);
    };

    void checkAuth();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login({ email, password });
      router.push(ROUTES.DASHBOARD);
    } catch (err: unknown) {
      setError(loginFailureMessage(err, t('invalidCredentialsDefault')));
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return <LoginCheckingAuth />;
  }

  const notice = resultNotice ?? noticeFromQuery;

  return (
    <CenterContainer>
      <AuthCard>
        <AuthCardHeader
          title={getConfig().public.brand.name ?? t('defaultBrandName')}
          subtitle={t('signInSubtitle')}
        />

        {notice !== null ? (
          <Alert>
            <span role="status">{t(sessionEndedNoticeMessageKey(notice))}</span>
          </Alert>
        ) : null}

        <StackForm onSubmit={handleSubmit}>
          <Alert>{error}</Alert>

          <TextInput
            id="email"
            eyebrow={t('usernameOrEmail')}
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />

          <TextInput
            id="password"
            eyebrow={t('password')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />

          <Button block type="submit" disabled={loading}>
            {loading ? t('signingIn') : t('signIn')}
          </Button>
        </StackForm>
      </AuthCard>
    </CenterContainer>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<LoginCheckingAuth />}>
      <LoginPage />
    </Suspense>
  );
}
