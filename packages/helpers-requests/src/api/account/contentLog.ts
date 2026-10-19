import type { DTOAccountContentLog } from '@podverse/helpers';

import type { ApiRequestService } from '../_request.js';

export const reqAccountContentLog = (
  api: ApiRequestService,
  params: { type: 'removed_content' }
): Promise<DTOAccountContentLog[]> => {
  const query = new URLSearchParams({ type: params.type });
  return api
    .apiRequest<{ rows: DTOAccountContentLog[] }>({
      path: `/account/content-log?${query.toString()}`,
      method: 'GET',
      config: {
        withCredentials: true,
      },
    })
    .then((response) => response.rows);
};
