import type { AuthSessionEndedNotice } from '@podverse/helpers/authSessionNotice';
import { parseAuthSessionEndedNotice } from '@podverse/helpers/authSessionNotice';
import type { CurrentUser } from '@podverse/management-api-requests';
import { ManagementApiRequestService } from '@podverse/management-api-requests';

import './configureManagementApiRequests';

export * from '@podverse/management-api-requests';

export type ManagementAuthResult =
  { user: CurrentUser; notice: null } | { user: null; notice: AuthSessionEndedNotice | null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function responseStatus(error: unknown): number | null {
  if (!isRecord(error) || !isRecord(error.response) || typeof error.response.status !== 'number') {
    return null;
  }
  return error.response.status;
}

function responseData(error: unknown): unknown {
  if (!isRecord(error) || !isRecord(error.response)) {
    return undefined;
  }
  return error.response.data;
}

/**
 * `/auth/me` plus the signed-out notice on a 401. Other failures log and return a null notice
 * so callers that treat a missing user as signed out keep working.
 */
export async function getManagementAuthResult(): Promise<ManagementAuthResult> {
  try {
    const service = new ManagementApiRequestService();
    const user = await service.apiRequest<CurrentUser>({
      path: '/auth/me',
      method: 'GET',
    });
    return { user, notice: null };
  } catch (error) {
    if (responseStatus(error) === 401) {
      return { user: null, notice: parseAuthSessionEndedNotice(responseData(error)) };
    }
    console.error('Error getting current user:', error);
    return { user: null, notice: null };
  }
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const result = await getManagementAuthResult();
  return result.user;
}
