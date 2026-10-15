import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'auth.accessToken';
const REFRESH_TOKEN_KEY = 'auth.refreshToken';

type AuthTokenKey = 'accessToken' | 'refreshToken';

/**
 * Readable after the first unlock since boot so CarPlay / background sync can authenticate while
 * the phone is locked in a pocket. Every call passes the same options so reads find what writes
 * stored.
 */
const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

const resolveStorageKey = (key: AuthTokenKey): string => {
  if (key === 'accessToken') {
    return ACCESS_TOKEN_KEY;
  }

  return REFRESH_TOKEN_KEY;
};

export type SecureTokenReadResult =
  { status: 'ok'; value: string | null } | { status: 'unavailable'; error: unknown };

/**
 * Read a token. `unavailable` means the store could not be opened (e.g. still locked before first
 * unlock) — callers must not treat that as signed-out or call `clearSession`.
 */
export const readSecureTokenResult = async (key: AuthTokenKey): Promise<SecureTokenReadResult> => {
  try {
    const value = await SecureStore.getItemAsync(resolveStorageKey(key), SECURE_STORE_OPTIONS);
    return { status: 'ok', value };
  } catch (error) {
    return { status: 'unavailable', error };
  }
};

export const readSecureToken = async (key: AuthTokenKey): Promise<string | null> => {
  const result = await readSecureTokenResult(key);
  if (result.status === 'unavailable') {
    throw result.error instanceof Error
      ? result.error
      : new Error('SecureStore unavailable while reading auth token');
  }
  return result.value;
};

export const writeSecureToken = async (key: AuthTokenKey, value: string): Promise<void> => {
  await SecureStore.setItemAsync(resolveStorageKey(key), value, SECURE_STORE_OPTIONS);
};

export const deleteSecureToken = async (key: AuthTokenKey): Promise<void> => {
  await SecureStore.deleteItemAsync(resolveStorageKey(key), SECURE_STORE_OPTIONS);
};

export const clearAllSecureTokens = async (): Promise<void> => {
  await Promise.all([deleteSecureToken('accessToken'), deleteSecureToken('refreshToken')]);
};
