import { getMobileConfig } from '../config';
import { clearAutoDownloadRegistrationOnSignOut } from '../downloads/autoDownloadRegistrationSync';
import { unregisterFcmDeviceForAccount } from '../push/fcmDeviceSync';
import {
  isUnifiedPushRegisteredOnDevice,
  readUnifiedPushMode,
  unregisterUnifiedPushDeviceForAccount,
} from '../push/unifiedPushDeviceSync';
import type { ClearSession } from './forcedLogoutNotice';
import { createMobileApiRequestService } from './mobileApi';

type LogoutWithMobileRevokeParams = {
  accessToken: string | null;
  clearSession: ClearSession;
  refreshToken: string | null;
};

export const logoutWithMobileRevoke = async ({
  accessToken,
  clearSession,
  refreshToken,
}: LogoutWithMobileRevokeParams): Promise<void> => {
  try {
    try {
      await clearAutoDownloadRegistrationOnSignOut(accessToken);
    } catch (error) {
      console.warn('Failed to clear auto-download registration during logout', error);
    }

    try {
      const pushProvider = getMobileConfig().pushProvider;
      if (pushProvider === 'fcm') {
        await unregisterFcmDeviceForAccount({ accessToken });
      }
      const clearUnifiedPush =
        pushProvider === 'unifiedpush' ||
        (await readUnifiedPushMode()) !== null ||
        (await isUnifiedPushRegisteredOnDevice());
      if (clearUnifiedPush) {
        await unregisterUnifiedPushDeviceForAccount({ accessToken, clearMode: true });
      }
    } catch (error) {
      console.warn('Failed to deregister push device during logout', error);
    }

    if (refreshToken !== null) {
      const apiRequestService = createMobileApiRequestService();
      if (apiRequestService !== null) {
        // Use ApiRequestService methods — standalone reqAuthMobileRevoke is not
        // re-exported from @podverse/helpers-requests.
        await apiRequestService.reqAuthMobileRevoke(refreshToken);
      }
    }
  } finally {
    await clearSession('user_logout');
  }
};
