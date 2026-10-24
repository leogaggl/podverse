import type { DTOTasteProfileAgreement } from '@podverse/helpers';

import type { ApiRequestService } from '../_request.js';

export async function reqLegalTasteProfileAgreement(
  api: ApiRequestService
): Promise<DTOTasteProfileAgreement> {
  return api.apiRequest<DTOTasteProfileAgreement>({
    path: '/legal/taste-profile-agreement',
    method: 'GET',
    config: {
      withCredentials: true,
    },
  });
}
