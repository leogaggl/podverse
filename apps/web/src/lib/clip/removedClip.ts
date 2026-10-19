export const CLIP_REMOVED_REQUEST_HEADER = 'x-podverse-clip-removed';

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

/** True when the clip API answered 410 because the episode was removed. */
export function isRemovedClipHttpError(error: unknown): boolean {
  const response = responseOf(error);
  if (response?.status !== 410 || typeof response.data !== 'object' || response.data === null) {
    return false;
  }
  return Reflect.get(response.data, 'removed') === true;
}
