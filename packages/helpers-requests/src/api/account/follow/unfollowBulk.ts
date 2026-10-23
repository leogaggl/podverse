import type { DTOAccount } from '@podverse/helpers';

import type { ApiRequestService } from '../../_request.js';
import { reqAuthMe } from '../../auth/auth.js';

/** Ends many follows in one request, then returns the refreshed account. */
export async function reqAccountUnfollowBulk(
  api: ApiRequestService,
  params: { channel_id_texts?: string[]; add_by_rss_feed_urls?: string[] }
): Promise<DTOAccount> {
  const data: { channel_id_texts?: string[]; add_by_rss_feed_urls?: string[] } = {};
  if (params.channel_id_texts !== undefined) {
    data.channel_id_texts = params.channel_id_texts;
  }
  if (params.add_by_rss_feed_urls !== undefined) {
    data.add_by_rss_feed_urls = params.add_by_rss_feed_urls;
  }

  await api.apiRequest({
    path: '/account/unfollow/bulk',
    method: 'POST',
    data,
    config: { withCredentials: true },
  });

  return reqAuthMe(api);
}
