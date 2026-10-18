import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef } from 'react';

import type { DTOBillingStatus } from '@podverse/helpers';

import { useAuth } from '../auth/AuthProvider';
import { createBillingApi } from '../billing/billingApi';
import { accountWithBillingStatus } from '../billing/purchaseStanding';
import { accountRepository } from '../data/repositories/accountRepository';

/**
 * Reloads membership from the primary billing-status endpoint whenever this screen is shown,
 * and writes that standing onto the account snapshot.
 */
export const useMembershipStandingRefresh = (): void => {
  const { accessToken, account, clearSession, refreshToken, setAccount, setTokens } = useAuth();
  const accountRef = useRef(account);
  accountRef.current = account;
  const setAccountRef = useRef(setAccount);
  setAccountRef.current = setAccount;

  useFocusEffect(
    useCallback(() => {
      if (accessToken === null) {
        return;
      }
      let active = true;
      const deps = { accessToken, clearSession, refreshToken, setTokens };
      void (async () => {
        let status: DTOBillingStatus;
        try {
          status = await createBillingApi(deps).getMembershipStatus();
        } catch {
          return;
        }
        const current = accountRef.current;
        if (!active || current === null) {
          return;
        }
        const next = accountWithBillingStatus(current, status);
        setAccountRef.current(next);
        try {
          await accountRepository.saveSnapshot(next);
        } catch {
          // The in-memory account already has the primary standing.
        }
      })();
      return () => {
        active = false;
      };
    }, [accessToken, clearSession, refreshToken, setTokens])
  );
};
