import type { DTOAccountSession } from '@podverse/helpers';

import type { ManagementApiRequestService } from './apiRequestService.js';

export const listAuthSessions = (
  service: ManagementApiRequestService
): Promise<DTOAccountSession[]> =>
  service
    .apiRequest<{ rows: DTOAccountSession[] }>({ path: '/auth/sessions', method: 'GET' })
    .then((response) => response.rows);

export const revokeAuthSession = (
  service: ManagementApiRequestService,
  sessionIdText: string
): Promise<{ message: string }> =>
  service.apiRequest<{ message: string }>({
    path: `/auth/sessions/${encodeURIComponent(sessionIdText)}`,
    method: 'DELETE',
  });

export const revokeOtherAuthSessions = (service: ManagementApiRequestService): Promise<number> =>
  service
    .apiRequest<{ revoked_count: number }>({
      path: '/auth/sessions/revoke-others',
      method: 'POST',
    })
    .then((response) => response.revoked_count);
