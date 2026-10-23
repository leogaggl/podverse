'use client';

import { useEffect } from 'react';

import type { AuthSessionEndedNotice } from '@podverse/helpers';

import { getApiRequestService } from '../../factories/apiRequestService';
import { storePendingSessionEndedNotice } from '../../lib/auth/sessionEndedNotice';
import { clearAddByRSSCredentialsForSignOut } from '../../utils/addByRSS/credentialStore';

interface AuthSessionCheckerProps {
  accountIdText: string | null;
  sessionEndedNotice: AuthSessionEndedNotice | null;
  ssrShouldLogout: boolean;
}

export const AuthSessionChecker = ({
  accountIdText,
  sessionEndedNotice,
  ssrShouldLogout,
}: AuthSessionCheckerProps) => {
  useEffect(() => {
    if (ssrShouldLogout) {
      (async () => {
        if (sessionEndedNotice !== null) {
          storePendingSessionEndedNotice(sessionEndedNotice);
          await clearAddByRSSCredentialsForSignOut(accountIdText);
        }
        try {
          await getApiRequestService().reqAuthLogout();
        } catch {
          // Logout clears the cookie even when the session is already ended.
        }
        // The reload renders the signed-out page.
        window.location.reload();
      })();
    }
  }, [accountIdText, sessionEndedNotice, ssrShouldLogout]);

  return null;
};
