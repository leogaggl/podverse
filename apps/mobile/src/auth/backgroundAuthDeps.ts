import type { AuthRequestDeps } from './authRequestWithRefresh';
import {
  adoptStoredCredentials,
  advanceAuthSessionGeneration,
  getAuthSessionGeneration,
  rememberAccessToken,
  rememberSavedCredentials,
} from './authRequestWithRefresh';
import { markForcedLogout, shouldNotifyForcedLogout } from './forcedLogoutNotice';
import {
  clearAllSecureTokens,
  readSecureTokenResult,
  writeSecureToken,
} from './secureTokenStorage';

/**
 * Auth deps for headless / background work: tokens from SecureStore, writes stay in SecureStore.
 * React state is not updated (there may be no AuthProvider); the next foreground hydrate picks up.
 *
 * Returns null only when both keys are confirmed absent. An unreadable store (locked before first
 * unlock) is not "no session" — callers should retry later rather than treating the user as anonymous.
 */
export const createBackgroundAuthDeps = async (): Promise<AuthRequestDeps | null> => {
  const [accessResult, refreshResult] = await Promise.all([
    readSecureTokenResult('accessToken'),
    readSecureTokenResult('refreshToken'),
  ]);

  if (accessResult.status === 'unavailable' || refreshResult.status === 'unavailable') {
    return null;
  }

  const accessToken = accessResult.value;
  const refreshToken = refreshResult.value;

  if (accessToken === null || accessToken === '' || refreshToken === null || refreshToken === '') {
    return null;
  }

  adoptStoredCredentials(accessToken, refreshToken);

  return {
    accessToken,
    refreshToken,
    setTokens: async ({ accessToken: nextAccess, refreshToken: nextRefresh }) => {
      const generationAtStart = getAuthSessionGeneration();
      rememberAccessToken(nextAccess);
      await Promise.all([
        writeSecureToken('accessToken', nextAccess),
        // The refresh token becomes sendable only once SecureStore holds it, and only for the
        // session the write started in.
        writeSecureToken('refreshToken', nextRefresh).then(() => {
          if (generationAtStart === getAuthSessionGeneration()) {
            rememberSavedCredentials(nextAccess, nextRefresh);
          }
        }),
      ]);
    },
    clearSession: async (reason, notice = null) => {
      advanceAuthSessionGeneration();
      await clearAllSecureTokens();
      // No dialog is on screen for a background refresh. The marker is what the next launch reads.
      if (shouldNotifyForcedLogout(reason)) {
        try {
          await markForcedLogout({ notice });
        } catch (error) {
          console.warn('Failed to record the forced-logout notice', error);
        }
      }
    },
  };
};
