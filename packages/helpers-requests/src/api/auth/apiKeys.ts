import type {
  AccountApiKeyCreateBody,
  DTOAccountApiKey,
  DTOAccountApiKeyCreated,
} from '@podverse/helpers';

import type { ApiRequestService } from '../_request.js';
import type { ApiMessageResponse } from '../_response.js';

export const reqAuthApiKeys = (api: ApiRequestService): Promise<DTOAccountApiKey[]> =>
  api
    .apiRequest<{ rows: DTOAccountApiKey[] }>({
      path: '/auth/api-keys',
      method: 'GET',
      config: { withCredentials: true },
    })
    .then((response) => response.rows);

export const reqAuthApiKeyCreate = (
  api: ApiRequestService,
  body: AccountApiKeyCreateBody
): Promise<DTOAccountApiKeyCreated> =>
  api.apiRequest<DTOAccountApiKeyCreated>({
    path: '/auth/api-keys',
    method: 'POST',
    data: body,
    config: { withCredentials: true },
  });

export const reqAuthApiKeyRevoke = (
  api: ApiRequestService,
  apiKeyIdText: string
): Promise<ApiMessageResponse> =>
  api.apiRequest<ApiMessageResponse>({
    path: `/auth/api-keys/${encodeURIComponent(apiKeyIdText)}`,
    method: 'DELETE',
    config: { withCredentials: true },
  });
