import {
  advanceAuthSessionGeneration,
  type AuthRequestDeps,
  rememberAuthCredentials,
} from './authRequestWithRefresh';
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

  rememberAuthCredentials(accessToken, refreshToken);

  return {
    accessToken,
    refreshToken,
    setTokens: async ({ accessToken: nextAccess, refreshToken: nextRefresh }) => {
      rememberAuthCredentials(nextAccess, nextRefresh);
      await Promise.all([
        writeSecureToken('accessToken', nextAccess),
        writeSecureToken('refreshToken', nextRefresh),
      ]);
    },
    clearSession: async () => {
      advanceAuthSessionGeneration();
      await clearAllSecureTokens();
    },
  };
};
