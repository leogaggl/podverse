'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import type { AccountSessionClientType, DTOAccountSession } from '@podverse/helpers';
import { formatDateAbbrev } from '@podverse/helpers';
import { getStatusCodeFromError } from '@podverse/helpers-requests';
import { Button, LoadingSpinner } from '@podverse/ui';

import { useAccount } from '../../../../contexts/Account';
import { getApiRequestService } from '../../../../factories/apiRequestService';
import { signOutThisBrowser } from '../../../../lib/auth/signOutThisBrowser';
import { handleRateLimitAlert } from '../../../../utils/rateLimit/rateLimitAlert';
import { showToast } from '../../../Toast/Toast';
import { SettingsSection } from '../../SettingsSection';
import { ModalSignOutOtherDevices } from './ModalSignOutOtherDevices';

import styles from '../../../../styles/components/Settings/Panels/SettingsAccount/SettingsSessions.module.scss';

type LoadState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; rows: DTOAccountSession[] };

function clientTypeLabelKey(
  clientType: AccountSessionClientType
): 'client_type_web' | 'client_type_mobile' {
  switch (clientType) {
    case 'web':
      return 'client_type_web';
    case 'mobile':
      return 'client_type_mobile';
  }
}

function withCurrentSessionFirst(rows: DTOAccountSession[]): DTOAccountSession[] {
  const currentIndex = rows.findIndex((row) => row.is_current);
  if (currentIndex <= 0) {
    return rows;
  }
  const current = rows[currentIndex];
  if (current === undefined) {
    return rows;
  }
  return [current, ...rows.slice(0, currentIndex), ...rows.slice(currentIndex + 1)];
}

function sessionDeviceName(
  row: DTOAccountSession,
  labelForClientType: (clientType: AccountSessionClientType) => string
): string {
  if (row.device_label !== null && row.device_label !== '') {
    return row.device_label;
  }
  return labelForClientType(row.client_type);
}

function responseStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null || !('response' in error)) {
    return null;
  }
  const response = error.response;
  if (typeof response !== 'object' || response === null || !('status' in response)) {
    return null;
  }
  return typeof response.status === 'number' ? response.status : null;
}

function httpStatus(error: unknown): number | null {
  return getStatusCodeFromError(error) ?? responseStatus(error);
}

export function SettingsSessions() {
  const t = useTranslations('settings.account.sessions');
  const tMisc = useTranslations('misc');
  const locale = useLocale();
  const { loggedInAccount } = useAccount();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);
  const [isSignOutOthersOpen, setIsSignOutOthersOpen] = useState(false);
  const [isRevokingOthers, setIsRevokingOthers] = useState(false);
  const [endingIds, setEndingIds] = useState<ReadonlySet<string>>(() => new Set());
  const endingIdsRef = useRef(new Set<string>());
  const revokingOthersRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    void (async () => {
      try {
        const rows = await getApiRequestService().reqAuthSessions();
        if (!cancelled) {
          setState({ status: 'ready', rows: withCurrentSessionFirst(rows) });
        }
      } catch (error) {
        console.warn('Could not load signed-in devices', error);
        if (!cancelled) {
          setState({ status: 'error' });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const setEnding = (idText: string, ending: boolean) => {
    if (ending) {
      endingIdsRef.current.add(idText);
    } else {
      endingIdsRef.current.delete(idText);
    }
    setEndingIds(new Set(endingIdsRef.current));
  };

  const removeSession = (idText: string) => {
    setState((current) => {
      if (current.status !== 'ready') {
        return current;
      }
      return {
        status: 'ready',
        rows: current.rows.filter((row) => row.id_text !== idText),
      };
    });
  };

  const handleSignOut = async (row: DTOAccountSession) => {
    if (endingIdsRef.current.has(row.id_text) || revokingOthersRef.current) {
      return;
    }
    setEnding(row.id_text, true);
    try {
      if (row.is_current) {
        await signOutThisBrowser(loggedInAccount?.id_text);
        return;
      }
      await getApiRequestService().reqAuthSessionRevoke(row.id_text);
      removeSession(row.id_text);
      showToast(t('sign_out_success'), 'success');
    } catch (error: unknown) {
      if (httpStatus(error) === 404) {
        removeSession(row.id_text);
        return;
      }
      const rateLimitErrorHandled = await handleRateLimitAlert(error, locale, tMisc);
      if (!rateLimitErrorHandled) {
        showToast(t('sign_out_error'), 'error');
      }
    } finally {
      if (!row.is_current) {
        setEnding(row.id_text, false);
      }
    }
  };

  const handleRevokeOthers = async () => {
    if (revokingOthersRef.current || endingIdsRef.current.size > 0) {
      return;
    }
    revokingOthersRef.current = true;
    setIsRevokingOthers(true);
    try {
      await getApiRequestService().reqAuthSessionsRevokeOthers();
      setState((current) => {
        if (current.status !== 'ready') {
          return current;
        }
        return {
          status: 'ready',
          rows: current.rows.filter((row) => row.is_current),
        };
      });
      setIsSignOutOthersOpen(false);
      showToast(t('sign_out_all_other_success'), 'success');
    } catch (error: unknown) {
      const rateLimitErrorHandled = await handleRateLimitAlert(error, locale, tMisc);
      if (!rateLimitErrorHandled) {
        showToast(t('sign_out_all_other_error'), 'error');
      }
    } finally {
      revokingOthersRef.current = false;
      setIsRevokingOthers(false);
    }
  };

  const hasOtherDevice =
    state.status === 'ready' && state.rows.some((row) => row.is_current === false);

  return (
    <SettingsSection>
      <h3 id="settings-sessions-heading">{t('heading')}</h3>
      <p>{t('description')}</p>
      {state.status === 'loading' ? (
        <LoadingSpinner ariaLabel={tMisc('loading')} size="medium" />
      ) : null}
      {state.status === 'error' ? (
        <>
          <p role="alert">{t('load_error')}</p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setReloadToken((token) => token + 1)}
          >
            {tMisc('try_again')}
          </Button>
        </>
      ) : null}
      {state.status === 'ready' ? (
        <>
          <ul className={styles.rows} aria-labelledby="settings-sessions-heading">
            {state.rows.map((row) => {
              const name = sessionDeviceName(row, (clientType) =>
                t(clientTypeLabelKey(clientType))
              );
              const ending = endingIds.has(row.id_text);
              return (
                <li key={row.id_text} className={styles.row}>
                  <div className={styles.rowText}>
                    <span className={styles.name}>{name}</span>
                    <span className={styles.meta}>
                      {row.is_current
                        ? t('this_device')
                        : t('last_used', { date: formatDateAbbrev(row.last_seen_at, locale) })}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    aria-label={t('sign_out_device_aria', { device: name })}
                    isLoading={ending}
                    disabled={ending}
                    onClick={() => {
                      void handleSignOut(row);
                    }}
                  >
                    {t('sign_out')}
                  </Button>
                </li>
              );
            })}
          </ul>
          {hasOtherDevice ? (
            <Button type="button" variant="secondary" onClick={() => setIsSignOutOthersOpen(true)}>
              {t('sign_out_all_other')}
            </Button>
          ) : null}
          <ModalSignOutOtherDevices
            isOpen={isSignOutOthersOpen}
            isSubmitting={isRevokingOthers}
            onClose={() => setIsSignOutOthersOpen(false)}
            onConfirm={() => {
              void handleRevokeOthers();
            }}
          />
        </>
      ) : null}
    </SettingsSection>
  );
}
