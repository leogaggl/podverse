import type { DTOAccountSession } from '@podverse/helpers';

import type { AuthRequestDeps } from './authRequestWithRefresh';
import { requestWithMobileAuthRefresh } from './authRequestWithRefresh';

/**
 * Sessions on the signed-in account. The list changes from other devices, so the screen fetches
 * it when it opens and does not write it to device storage.
 */
export const fetchAccountSessions = (deps: AuthRequestDeps): Promise<DTOAccountSession[]> =>
  requestWithMobileAuthRefresh(deps, (api) => api.reqAuthSessions());

export const endAccountSession = async (
  deps: AuthRequestDeps,
  sessionIdText: string
): Promise<void> => {
  await requestWithMobileAuthRefresh(deps, (api) => api.reqAuthSessionRevoke(sessionIdText));
};

export const endOtherAccountSessions = (deps: AuthRequestDeps): Promise<number> =>
  requestWithMobileAuthRefresh(deps, (api) => api.reqAuthSessionsRevokeOthers());
