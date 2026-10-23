import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuthPrompt } from '../../auth/AuthPromptContext';
import { useAuth } from '../../auth/AuthProvider';
import type { PendingForcedLogoutNotice } from '../../auth/forcedLogoutNotice';
import {
  clearForcedLogoutNotice,
  readPendingForcedLogoutNotice,
} from '../../auth/forcedLogoutNotice';
import { forcedLogoutReasonKey } from '../../auth/forcedLogoutNoticeCopy';
import { ConfirmDialog } from './ConfirmDialog';

/**
 * Tells the user, once, that the server ended their session — they did not sign out themselves.
 * It names the server's reason when one was given.
 *
 * Worth interrupting for because the failure is silent otherwise: a signed-out device still browses
 * and subscribes normally, but those subscriptions are local-only, and signing back into an existing
 * account replaces the local list with the account's. Someone who carries on unaware loses that work
 * at the next login.
 *
 * The marker is written by `clearSession` and only ever for a server 401, so this cannot fire for a
 * device that is merely offline. The last reason stays in place while the dialog closes so the
 * sentence cannot change during the fade.
 */
export function ForcedLogoutNotice() {
  const { t } = useTranslation();
  const { status } = useAuth();
  const { onRequestLogin } = useAuthPrompt();
  const [isVisible, setIsVisible] = useState(false);
  const [pending, setPending] = useState<PendingForcedLogoutNotice | null>(null);

  useEffect(() => {
    // `anonymous` is the settled signed-out state; `unknown` still has hydrate in flight, and
    // `authenticated` means they already have credentials and need no warning.
    if (status !== 'anonymous') {
      setIsVisible(false);
      return;
    }

    let isMounted = true;
    void (async () => {
      try {
        const nextPending = await readPendingForcedLogoutNotice();
        if (!isMounted || nextPending === null) {
          return;
        }
        setPending(nextPending);
        setIsVisible(true);
      } catch (error) {
        console.warn('Failed to read the forced-logout notice', error);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [status]);

  const acknowledge = useCallback(async () => {
    setIsVisible(false);
    try {
      await clearForcedLogoutNotice();
    } catch (error) {
      console.warn('Failed to clear the forced-logout notice', error);
    }
  }, []);

  const onDismiss = useCallback(() => {
    void acknowledge();
  }, [acknowledge]);

  const onLogIn = useCallback(() => {
    void acknowledge();
    onRequestLogin();
  }, [acknowledge, onRequestLogin]);

  const reasonNotice = pending === null ? null : pending.notice;

  return (
    <ConfirmDialog
      body={`${t(forcedLogoutReasonKey(reasonNotice))} ${t('authentication.forced_logout_body')}`}
      cancelLabel={t('authentication.forced_logout_dismiss')}
      cancelTestID="forced-logout-dismiss"
      confirmLabel={t('authentication.login')}
      confirmTestID="forced-logout-login"
      onCancel={onDismiss}
      onConfirm={onLogIn}
      testID="forced-logout-modal"
      title={t('authentication.forced_logout_title')}
      visible={isVisible}
    />
  );
}
