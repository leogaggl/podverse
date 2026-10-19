import type { DTOItem } from '@podverse/helpers';
import type { ApiListResponse } from '@podverse/helpers-requests';

export type ChannelItemListResult =
  { kind: 'ok'; response: ApiListResponse<DTOItem> } | { kind: 'archived' } | { kind: 'missing' };

function responseOf(error: unknown): { status: number; data: unknown } | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }
  const response = Reflect.get(error, 'response');
  if (typeof response !== 'object' || response === null) {
    return null;
  }
  const status = Reflect.get(response, 'status');
  if (typeof status !== 'number') {
    return null;
  }
  return { status, data: Reflect.get(response, 'data') };
}

function isArchivedGone(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const gone = Reflect.get(data, 'gone');
  if (typeof gone !== 'object' || gone === null) {
    return false;
  }
  return Reflect.get(gone, 'reason') === 'archived';
}

/**
 * Episode lists answer 410 with `gone.reason` `archived` when the show has left the directory,
 * and 404 when the show is missing or not ready to list. Any other failure stays an error.
 */
export async function loadChannelItemList(
  load: () => Promise<ApiListResponse<DTOItem>>
): Promise<ChannelItemListResult> {
  try {
    const response = await load();
    return { kind: 'ok', response };
  } catch (error) {
    const response = responseOf(error);
    if (response?.status === 404) {
      return { kind: 'missing' };
    }
    if (response?.status === 410 && isArchivedGone(response.data)) {
      return { kind: 'archived' };
    }
    throw error;
  }
}
