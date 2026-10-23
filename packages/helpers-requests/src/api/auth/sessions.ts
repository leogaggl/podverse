import type { DTOAccountSession } from '@podverse/helpers';

import type { ApiRequestService } from '../_request.js';
import type { ApiMessageResponse } from '../_response.js';

export const reqAuthSessions = (api: ApiRequestService): Promise<DTOAccountSession[]> =>
  api
    .apiRequest<{ rows: DTOAccountSession[] }>({
      path: '/auth/sessions',
      method: 'GET',
      config: { withCredentials: true },
    })
    .then((response) => response.rows);

export const reqAuthSessionRevoke = (
  api: ApiRequestService,
  sessionIdText: string
): Promise<ApiMessageResponse> =>
  api.apiRequest<ApiMessageResponse>({
    path: `/auth/sessions/${encodeURIComponent(sessionIdText)}`,
    method: 'DELETE',
    config: { withCredentials: true },
  });

export const reqAuthSessionsRevokeOthers = (api: ApiRequestService): Promise<number> =>
  api
    .apiRequest<{ revoked_count: number }>({
      path: '/auth/sessions/revoke-others',
      method: 'POST',
      config: { withCredentials: true },
    })
    .then((response) => response.revoked_count);
