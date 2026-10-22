import { cookies } from 'next/headers';

import { getSSRAuthService } from '../../utils/auth/ssrAuth';
import type { LocalSettingsState } from '../../utils/localSettings/localSettings';
import { getParsedLocalSettings } from '../../utils/localSettings/localSettings';

export type MediaListSearchParams = Record<string, string | string[] | undefined>;

type SsrApiRequestService = Awaited<ReturnType<typeof getSSRAuthService>>['ssrApiRequestService'];

export type MediaListSsr = {
  canLoadPrivateSsrData: boolean;
  localSettings: LocalSettingsState;
  ssrApiRequestService: SsrApiRequestService;
};

/** Reads the session and the local-settings cookie once for a chips page render. */
export async function getMediaListSsr(): Promise<MediaListSsr> {
  const { isValidAuthSession, termsAcceptanceRequired, ssrApiRequestService } =
    await getSSRAuthService();
  const canLoadPrivateSsrData = isValidAuthSession && !termsAcceptanceRequired;
  const localSettings = getParsedLocalSettings(await cookies());
  return { canLoadPrivateSsrData, localSettings, ssrApiRequestService };
}

/** First value when a query key is repeated. */
export function firstMediaListSearchParam(
  searchParams: MediaListSearchParams,
  key: string
): string | undefined {
  const value = searchParams[key];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}
