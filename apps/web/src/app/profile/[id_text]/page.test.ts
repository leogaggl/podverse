import { AxiosError } from 'axios';
import { notFound } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getAccountForSeoPageMock, reqAuthMeMock, authState } = vi.hoisted(() => ({
  getAccountForSeoPageMock: vi.fn(),
  reqAuthMeMock: vi.fn(),
  authState: { isValidAuthSession: false },
}));

vi.mock('../../../lib/seo/fetchers', () => ({
  getAccountForSeoPage: getAccountForSeoPageMock,
}));

vi.mock('../../../utils/auth/ssrAuth', () => ({
  getSSRAuthService: async () => ({
    isValidAuthSession: authState.isValidAuthSession,
    ssrApiRequestService: { reqAuthMe: reqAuthMeMock },
  }),
}));

vi.mock('../../../lib/seo/buildStaticPageMetadata', () => ({
  buildStaticPageMetadata: vi.fn(),
}));

import ProfilePage from './page';

const PROFILES_REDIRECT_DIGEST = 'NEXT_REDIRECT;replace;/profiles;307;';
const MY_PROFILE_REDIRECT_DIGEST = 'NEXT_REDIRECT;replace;/my-profile;307;';

const renderProfilePage = (idText: string) =>
  ProfilePage({ params: Promise.resolve({ id_text: idText }) });

describe('ProfilePage', () => {
  beforeEach(() => {
    getAccountForSeoPageMock.mockReset();
    reqAuthMeMock.mockReset();
    authState.isValidAuthSession = false;
  });

  it('When the account fetch throws the Next.js not-found signal, the page redirects to the profiles list.', async () => {
    getAccountForSeoPageMock.mockImplementation(async () => notFound());

    await expect(renderProfilePage('missing01')).rejects.toMatchObject({
      digest: PROFILES_REDIRECT_DIGEST,
    });
  });

  it('When the account fetch fails with a server error, the page rethrows that error unchanged.', async () => {
    const error = new AxiosError('Request failed', 'ERR_BAD_RESPONSE');
    getAccountForSeoPageMock.mockRejectedValue(error);

    await expect(renderProfilePage('broken01')).rejects.toBe(error);
  });

  it('When the account fetch fails with a network error, the page rethrows that error unchanged.', async () => {
    const error = new AxiosError('Network Error', 'ERR_NETWORK');
    getAccountForSeoPageMock.mockRejectedValue(error);

    await expect(renderProfilePage('broken01')).rejects.toBe(error);
  });

  it('When a signed-in viewer opens their own profile, the page redirects to /my-profile.', async () => {
    authState.isValidAuthSession = true;
    getAccountForSeoPageMock.mockResolvedValue({ id: 7 });
    reqAuthMeMock.mockResolvedValue({ id: 7 });

    await expect(renderProfilePage('owner0001')).rejects.toMatchObject({
      digest: MY_PROFILE_REDIRECT_DIGEST,
    });
  });

  it('When /auth/me fails for a signed-in viewer, the page rethrows that error instead of redirecting.', async () => {
    const error = new AxiosError('Request failed', 'ERR_BAD_RESPONSE');
    authState.isValidAuthSession = true;
    getAccountForSeoPageMock.mockResolvedValue({ id: 7 });
    reqAuthMeMock.mockRejectedValue(error);

    await expect(renderProfilePage('owner0001')).rejects.toBe(error);
  });
});
