import * as SecureStore from 'expo-secure-store';

import type { AuthRequestDeps } from '../auth/authRequestWithRefresh';
import { requestWithMobileAuthRefreshIfSignedIn } from '../auth/authRequestWithRefresh';
import { createMobileApiRequestService } from '../auth/mobileApi';
import { unregisterFcmDeviceForAccount } from './fcmDeviceSync';
import { getUnifiedPushRegistrationPayload } from './unifiedPushTransport';

const REGISTERED_UP_ENDPOINT_KEY = 'push.up.registeredEndpoint';
const UP_MODE_KEY = 'push.up.mode';
const UP_USER_AUTH_KEY_KEY = 'push.up.userAuthKey';
const UP_USER_ENDPOINT_KEY = 'push.up.userEndpoint';

export type UnifiedPushMode = 'off' | 'user';

const readSecureValue = async (key: string): Promise<string | null> => {
  return SecureStore.getItemAsync(key);
};

const writeSecureValue = async (key: string, value: string): Promise<void> => {
  await SecureStore.setItemAsync(key, value);
};

const deleteSecureValue = async (key: string): Promise<void> => {
  await SecureStore.deleteItemAsync(key);
};

const clearLocalUnifiedPush = async (clearMode: boolean): Promise<void> => {
  await deleteSecureValue(REGISTERED_UP_ENDPOINT_KEY);
  await deleteSecureValue(UP_USER_AUTH_KEY_KEY);
  await deleteSecureValue(UP_USER_ENDPOINT_KEY);
  if (clearMode) {
    await deleteSecureValue(UP_MODE_KEY);
  }
};

export const readUnifiedPushMode = async (): Promise<UnifiedPushMode | null> => {
  const value = await readSecureValue(UP_MODE_KEY);
  if (value === 'off' || value === 'user') {
    return value;
  }
  return null;
};

export const isUnifiedPushRegisteredOnDevice = async (): Promise<boolean> => {
  const endpoint = await readSecureValue(REGISTERED_UP_ENDPOINT_KEY);
  return endpoint !== null && endpoint !== '';
};

export const rememberRegisteredUnifiedPushEndpoint = async (endpoint: string): Promise<void> => {
  await writeSecureValue(REGISTERED_UP_ENDPOINT_KEY, endpoint);
};

export const forgetRegisteredUnifiedPushEndpoint = async (): Promise<void> => {
  await deleteSecureValue(REGISTERED_UP_ENDPOINT_KEY);
};

const resolveRegistrationPayload = async () => {
  const mode = await readUnifiedPushMode();
  if (mode === 'user') {
    const endpoint = await readSecureValue(UP_USER_ENDPOINT_KEY);
    if (endpoint === null || endpoint === '') {
      return null;
    }
    const authKey = await readSecureValue(UP_USER_AUTH_KEY_KEY);
    return {
      up_auth_key: authKey !== null && authKey !== '' ? authKey : null,
      up_endpoint: endpoint,
    };
  }

  return getUnifiedPushRegistrationPayload();
};

export const registerUnifiedPushDeviceForAccount = async ({
  auth,
  locale,
}: {
  auth: AuthRequestDeps;
  locale: string;
}): Promise<void> => {
  if (auth.accessToken === null) {
    return;
  }

  const payload = await resolveRegistrationPayload();
  if (payload === null) {
    return;
  }

  const previousEndpoint = await readSecureValue(REGISTERED_UP_ENDPOINT_KEY);
  const registered =
    previousEndpoint === null || previousEndpoint === ''
      ? await requestWithMobileAuthRefreshIfSignedIn(auth, (api) =>
          api.reqAccountUPDeviceCreate(payload)
        )
      : await requestWithMobileAuthRefreshIfSignedIn(auth, (api) =>
          api.reqAccountUPDeviceUpdate(payload)
        );
  if (registered === null) {
    return;
  }

  const localeUpdated = await requestWithMobileAuthRefreshIfSignedIn(auth, (api) =>
    api.reqAccountUPDeviceUpdateLocale({ locale })
  );
  if (localeUpdated === null) {
    return;
  }
  await writeSecureValue(REGISTERED_UP_ENDPOINT_KEY, payload.up_endpoint);
};

export const enableUserUnifiedPush = async ({
  auth,
  authKey,
  endpoint,
  locale,
}: {
  auth: AuthRequestDeps;
  authKey: string | null;
  endpoint: string;
  locale: string;
}): Promise<void> => {
  if (auth.accessToken === null) {
    return;
  }

  await writeSecureValue(UP_MODE_KEY, 'user');
  await writeSecureValue(UP_USER_ENDPOINT_KEY, endpoint);
  if (authKey !== null && authKey !== '') {
    await writeSecureValue(UP_USER_AUTH_KEY_KEY, authKey);
  } else {
    await deleteSecureValue(UP_USER_AUTH_KEY_KEY);
  }

  await unregisterFcmDeviceForAccount({ accessToken: auth.accessToken });
  await registerUnifiedPushDeviceForAccount({ auth, locale });
};

export const disableUserUnifiedPush = async ({
  auth,
}: {
  auth: AuthRequestDeps;
}): Promise<void> => {
  await writeSecureValue(UP_MODE_KEY, 'off');
  await unregisterUnifiedPushDeviceForAccount({ accessToken: auth.accessToken });
};

/** Drop a user Unified Push choice so this device can register with its build push provider. */
export const releaseUnifiedPushForPushProvider = async ({
  auth,
}: {
  auth: AuthRequestDeps;
}): Promise<void> => {
  await unregisterUnifiedPushDeviceForAccount({
    accessToken: auth.accessToken,
    clearMode: true,
  });
};

export const unregisterUnifiedPushDeviceForAccount = async ({
  accessToken,
  clearMode = false,
}: {
  accessToken: string | null;
  clearMode?: boolean;
}): Promise<void> => {
  if (accessToken === null) {
    await clearLocalUnifiedPush(clearMode);
    return;
  }

  const api = createMobileApiRequestService(accessToken);
  if (api === null) {
    return;
  }

  await api.reqAccountUPDeviceDeleteAll();
  await clearLocalUnifiedPush(clearMode);
};

export const syncUnifiedPushDeviceLocaleIfRegistered = async ({
  auth,
  locale,
}: {
  auth: AuthRequestDeps;
  locale: string;
}): Promise<void> => {
  if (auth.accessToken === null) {
    return;
  }

  const registeredEndpoint = await readSecureValue(REGISTERED_UP_ENDPOINT_KEY);
  if (registeredEndpoint === null || registeredEndpoint === '') {
    return;
  }

  await requestWithMobileAuthRefreshIfSignedIn(auth, (api) =>
    api.reqAccountUPDeviceUpdateLocale({ locale })
  );
};
