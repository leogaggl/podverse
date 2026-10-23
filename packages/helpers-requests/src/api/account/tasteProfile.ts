import type {
  DTOAccountTasteProfileHiddenList,
  DTOAccountTasteProfileList,
  DTOAccountTasteProfileShowState,
} from '@podverse/helpers';

import type { ApiRequestService } from '../_request.js';

function tasteProfileQuery(params: { page?: number; limit?: number }): string {
  const query = new URLSearchParams();
  if (params.page !== undefined) {
    query.set('page', String(params.page));
  }
  if (params.limit !== undefined) {
    query.set('limit', String(params.limit));
  }
  const queryString = query.toString();
  return queryString === '' ? '' : `?${queryString}`;
}

export const reqAccountTasteProfile = (
  api: ApiRequestService,
  params: { page?: number; limit?: number }
): Promise<DTOAccountTasteProfileList> => {
  return api
    .apiRequest<{ data: DTOAccountTasteProfileList }>({
      path: `/account/taste-profile${tasteProfileQuery(params)}`,
      method: 'GET',
      config: {
        withCredentials: true,
      },
    })
    .then((response) => response.data);
};

export const reqAccountTasteProfileHidden = (
  api: ApiRequestService,
  params: { page?: number; limit?: number }
): Promise<DTOAccountTasteProfileHiddenList> => {
  return api
    .apiRequest<{ data: DTOAccountTasteProfileHiddenList }>({
      path: `/account/taste-profile/hidden${tasteProfileQuery(params)}`,
      method: 'GET',
      config: {
        withCredentials: true,
      },
    })
    .then((response) => response.data);
};

export const reqAccountTasteProfileHide = (
  api: ApiRequestService,
  params: { channel_id_text: string }
): Promise<DTOAccountTasteProfileShowState> => {
  return api
    .apiRequest<{ data: DTOAccountTasteProfileShowState }>({
      path: '/account/taste-profile/hide',
      method: 'POST',
      data: params,
      config: {
        withCredentials: true,
      },
    })
    .then((response) => response.data);
};

export const reqAccountTasteProfileUnhide = (
  api: ApiRequestService,
  params: { channel_id_text: string; add_to_taste_profile: boolean }
): Promise<DTOAccountTasteProfileShowState> => {
  return api
    .apiRequest<{ data: DTOAccountTasteProfileShowState }>({
      path: '/account/taste-profile/unhide',
      method: 'POST',
      data: params,
      config: {
        withCredentials: true,
      },
    })
    .then((response) => response.data);
};
