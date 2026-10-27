import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { AuthRequestDeps } from '../auth/authRequestWithRefresh';
import { ConfirmDialog } from '../components/feedback/ConfirmDialog';
import type { FirstSubscribePushChoice } from '../lib/notifications/applyFirstSubscribePushChoice';
import { applyFirstSubscribePushChoice } from '../lib/notifications/applyFirstSubscribePushChoice';
import { hasAnsweredFirstSubscribePushPrompt } from '../prefs/subscribePushPromptPrefs';

type PendingPrompt = {
  promise: Promise<FirstSubscribePushChoice>;
  resolve: (choice: FirstSubscribePushChoice) => void;
};

/**
 * Asks once per account on this device whether Subscribe should enable system push.
 * Both answers continue the subscribe; Enable Push / In-App Only are the two actions.
 */
export function useFirstSubscribePushPrompt() {
  const { t } = useTranslation();
  const [dialogVisible, setDialogVisible] = useState(false);
  const pendingRef = useRef<PendingPrompt | null>(null);

  const askIfNeeded = useCallback(
    async (accountIdText: string): Promise<FirstSubscribePushChoice | null> => {
      if (await hasAnsweredFirstSubscribePushPrompt(accountIdText)) {
        return null;
      }

      if (pendingRef.current !== null) {
        return pendingRef.current.promise;
      }

      let resolveChoice: (choice: FirstSubscribePushChoice) => void = () => {};
      const promise = new Promise<FirstSubscribePushChoice>((resolve) => {
        resolveChoice = resolve;
      });
      pendingRef.current = { promise, resolve: resolveChoice };
      setDialogVisible(true);
      return promise;
    },
    []
  );

  const finishPrompt = useCallback((choice: FirstSubscribePushChoice) => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    setDialogVisible(false);
    if (pending !== null) {
      pending.resolve(choice);
    }
  }, []);

  const applyAfterFollow = useCallback(
    async (params: {
      accountIdText: string;
      auth: AuthRequestDeps;
      channelIdText: string;
      choice: FirstSubscribePushChoice | null;
      locale: string;
    }): Promise<void> => {
      if (params.choice === null) {
        return;
      }
      await applyFirstSubscribePushChoice({
        accountIdText: params.accountIdText,
        auth: params.auth,
        channelIdText: params.channelIdText,
        choice: params.choice,
        locale: params.locale,
      });
    },
    []
  );

  const dialog = (
    <ConfirmDialog
      body={t('settings.notifications.first_subscribe_push_body')}
      cancelLabel={t('settings.notifications.first_subscribe_in_app_only')}
      cancelTestID="first-subscribe-push-in-app-only"
      confirmLabel={t('settings.notifications.first_subscribe_enable_push')}
      confirmTestID="first-subscribe-push-enable"
      onCancel={() => {
        finishPrompt('in_app_only');
      }}
      onConfirm={() => {
        finishPrompt('enable_push');
      }}
      testID="first-subscribe-push-dialog"
      title={t('settings.notifications.first_subscribe_push_title')}
      visible={dialogVisible}
    />
  );

  return { askIfNeeded, applyAfterFollow, dialog };
}
