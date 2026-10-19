import type { ApiRequestService } from '../_request.js';

export type IdentityResolveRequest = {
  channel_id_texts?: string[];
  item_id_texts?: string[];
  podcast_index_ids?: number[];
};

export type IdentityResolveIdMove = {
  from_id_text: string;
  to_id_text: string;
};

export type IdentityResolvePodcastIndexMove = {
  from: number;
  to_channel_id_text: string;
};

export type IdentityResolveResponse = {
  channels: IdentityResolveIdMove[];
  items: IdentityResolveIdMove[];
  podcast_index_ids: IdentityResolvePodcastIndexMove[];
};

export async function reqIdentityResolve(api: ApiRequestService, body: IdentityResolveRequest) {
  return api.apiRequest<IdentityResolveResponse>({
    path: '/identity/resolve',
    method: 'POST',
    data: body,
  });
}
