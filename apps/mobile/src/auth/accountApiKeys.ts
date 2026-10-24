import type {
  AccountApiKeyCreateBody,
  DTOAccountApiKey,
  DTOAccountApiKeyCreated,
} from '@podverse/helpers/dto';

import type { AuthRequestDeps } from './authRequestWithRefresh';
import { requestWithMobileAuthRefresh } from './authRequestWithRefresh';

/**
 * API keys on the signed-in account. The list changes from other devices, so callers fetch it
 * when the screen opens and do not write it to device storage.
 */
export const fetchAccountApiKeys = (deps: AuthRequestDeps): Promise<DTOAccountApiKey[]> =>
  requestWithMobileAuthRefresh(deps, (api) => api.reqAuthApiKeys());

/**
 * Creates a key. `token` on the result is shown once by the caller. This function does not log it.
 */
export const createAccountApiKey = (
  deps: AuthRequestDeps,
  body: AccountApiKeyCreateBody
): Promise<DTOAccountApiKeyCreated> =>
  requestWithMobileAuthRefresh(deps, (api) => api.reqAuthApiKeyCreate(body));

export const revokeAccountApiKey = async (
  deps: AuthRequestDeps,
  apiKeyIdText: string
): Promise<void> => {
  await requestWithMobileAuthRefresh(deps, (api) => api.reqAuthApiKeyRevoke(apiKeyIdText));
};
