'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { CenteredMessage, MainColumnStack, MainHeader, MainSidebarLayout } from '@podverse/ui';

import { WebLoadingSpinnerDecorativeMedium } from '../../components/LoadingSpinner/WebLoadingSpinnerDecorative';
import { MainWrapper } from '../../components/Main/MainWrapper';
import { getApiRequestService } from '../../factories/apiRequestService';
import { handleRateLimitAlert } from '../../utils/rateLimit/rateLimitAlert';

type EmailChangeVerifyingPageClientProps = {
  token?: string;
};

export function EmailChangeVerifyingPageClient({ token }: EmailChangeVerifyingPageClientProps) {
  const tAuthentication = useTranslations('authentication');
  const tMisc = useTranslations('misc');
  const locale = useLocale();

  const [isVerifying, setIsVerifying] = useState<boolean>(true);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const verify = async () => {
      if (!token) {
        setIsVerifying(false);
        setIsError(true);
        return;
      }
      try {
        setIsVerifying(true);
        setIsError(false);
        setIsSuccess(false);
        await getApiRequestService().reqAccountChangeEmailAddress({ token });
        setIsSuccess(true);
        // Redirect after 3 seconds (hard reload)
        timeoutId = setTimeout(() => {
          window.location.href = '/';
        }, 3000);
      } catch (err: unknown) {
        const rateLimitHandled = await handleRateLimitAlert(err, locale, tMisc);
        if (!rateLimitHandled) {
          setIsError(true);
        }
      } finally {
        setIsVerifying(false);
      }
    };
    verify();
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  return (
    <>
      <MainHeader title={tAuthentication('change_email_verification')} />
      <MainWrapper>
        <MainSidebarLayout>
          <MainColumnStack>
            {isVerifying ? (
              <CenteredMessage live="status">
                <span>{tAuthentication('changing_email_address')}</span>
                <WebLoadingSpinnerDecorativeMedium />
              </CenteredMessage>
            ) : null}
            {!isVerifying && isSuccess ? (
              <CenteredMessage live="status">
                <span>{tAuthentication('change_email_address_email_success')}</span>
                <span>{tMisc('redirecting')}</span>
              </CenteredMessage>
            ) : null}
            {!isVerifying && isError ? (
              <CenteredMessage live="alert" tone="danger">
                {tAuthentication('change_email_address_email_failed')}
              </CenteredMessage>
            ) : null}
          </MainColumnStack>
        </MainSidebarLayout>
      </MainWrapper>
    </>
  );
}
