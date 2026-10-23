import type { AuthSessionEndedNotice } from '@podverse/helpers/authSessionNotice';
import { parseAuthSessionEndedNotice } from '@podverse/helpers/authSessionNotice';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Reads the signed-out notice from a thrown request error (axios-style
 * `error.response.{status,data}`). Returns null unless the response is a 401 whose body is
 * `{ code: 'session_ended', notice }`. Shared by web and mobile so both read one contract.
 */
export function parseAuthSessionEndedError(error: unknown): AuthSessionEndedNotice | null {
  if (!isRecord(error)) {
    return null;
  }

  const response = error.response;
  if (!isRecord(response) || response.status !== 401) {
    return null;
  }

  return parseAuthSessionEndedNotice(response.data);
}
