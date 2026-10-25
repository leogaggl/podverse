**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# Profile route redirects to /profiles only for a missing or hidden account

`/profile/[id_text]` wraps its whole body in a try/catch that redirects to `/profiles` on any
error. A missing or private account, a 5xx, a network failure, and a failed `/auth/me` all land on
the profiles list with no error shown. This plan narrows that catch to the account load and to an
API 404 alone: a missing or private account still redirects to `/profiles`, and every other error
reaches the error page. The redirect to `/my-profile` for the viewer's own profile stays.

## Rows

R26, R27, R29, R30, R31, R32, R33

## Runs after

10

## Files

apps/web/src/app/profile/[id_text]/page.tsx
apps/web/src/app/profile/[id_text]/page.test.ts
apps/web/e2e/seo-profile-sharable-status.spec.ts
release-notes/scratchpad.md

## Contract this plan relies on (plan 10)

`getAccountForSeoPage` in `apps/web/src/lib/seo/fetchers.ts` runs
`reqAccountGetByIdText({ id_text })` through `loadOrNotFound`. An API 404 throws the Next.js
not-found signal (`notFound()`); every other error is rethrown unchanged. React `cache` memoizes
the rejection, so `generateMetadata` and the page body see the same signal for one id.

## What the API answers

`AccountController.getByIdText` in `apps/api/src/controllers/account/account.ts` answers 404
(`handleReturnDataOrNotFound(res, null, 'Account')`) when the account does not exist, and also
when it is private and the viewer is not its owner. It answers 200 with the account for the owner
(even when private) and for public or unlisted accounts. It never answers 200 with `null` (R31).
The id is validated only as a required string, so a malformed id answers 404.

## Decisions settled here

- **A missing or hidden account redirects to `/profiles` (R33, operator review D5).** Only an API
  404 for the account redirects. A 5xx, network failure, timeout, 400, 401, 403, or 410 for the
  account, and any failure of `/auth/me`, is rethrown and shows the error page. This is the one
  exception to plan 11's rule against redirecting for a missing entity, and plan 11's rule names
  it.
- **How the page sees the 404.** `getAccountForSeoPage` stays wrapped by `loadOrNotFound`
  (operator review D2), so by the time the page catches, the axios 404 has already become the
  Next.js not-found signal; `getErrorResponseStatus` no longer applies. The page catches around
  that one call and asks Next.js itself whether the caught error is the not-found signal:
  `isHTTPAccessFallbackError(error) && getAccessFallbackHTTPStatus(error) === 404`, imported from
  `next/dist/client/components/http-access-fallback/http-access-fallback`. These are the guards
  Next.js uses internally to route the signal; `next/navigation` exports no public detector in
  16.4.3, and `unstable_rethrow` cannot tell a not-found signal from a redirect. The deep import
  works because `next` has no package `exports` map and `apps/web` uses `moduleResolution:
  bundler`; `apps/web` already deep-imports `next/dist/shared/lib/app-router-context.shared-runtime`.
  If a Next.js upgrade moves the module, the type check fails rather than the page silently
  rendering Not Found. Rejected: comparing `error.digest` to a string literal (copies a Next.js
  internal format), a profile `not-found.tsx` that calls `redirect()` (redirecting from a
  not-found boundary is not a supported Next.js path), and calling
  `ssrApiRequestService.reqAccountGetByIdText` directly with `getErrorResponseStatus` (breaks D2
  and loses the request shared with `generateMetadata` through `cache`).
- **The catch covers only the account load.** The `/my-profile` redirect and `reqAuthMe()` run
  outside it, so the old `NEXT_REDIRECT` digest check goes away: nothing catches a redirect signal.
  `redirect(ROUTES.PROFILES)` inside the catch throws its own redirect signal out of the page.
- **No redirect cycle.** `/profiles` is a list page that loads no single account, so it cannot
  redirect back.
- **R32:** `if (!ssrAccount) redirect('/profiles')` cannot run (`apiRequest<T>` resolves `T` or
  throws), so it is removed. The `if (ssrLoggedInAccount)` guard goes too: `reqAuthMe` resolves a
  `DTOAccount` or throws. The `/profiles` redirect now lives in the catch, and the `/my-profile`
  redirect is a real redirect for an existing account.
- **R30:** `generateMetadata` keeps its try/catch and `buildNoindexMetadata('Profile')` fallback
  unchanged. Its catch also receives the not-found signal.
- **`/auth/me` failure is rethrown.** `getSSRAuthService()` has already confirmed the session
  before `reqAuthMe()` runs, so a failure there is an unexpected API error and reaches the error
  page like any other (R5).

## Implementation

### 1. `apps/web/src/app/profile/[id_text]/page.tsx`

Imports. Add the Next.js guards between the `next` type import and `next/navigation`, and add the
routes constant first in the relative-import group:

```tsx
import type { Metadata } from 'next';
import {
  getAccessFallbackHTTPStatus,
  isHTTPAccessFallbackError,
} from 'next/dist/client/components/http-access-fallback/http-access-fallback';
import { redirect } from 'next/navigation';

import { buildProfilePath, SharableStatusEnum } from '@podverse/helpers';

import { ROUTES } from '../../../constants/routes';
import { buildNoindexMetadata } from '../../../lib/seo/buildNoindexMetadata';
```

The remaining relative imports stay as they are.

Leave `ProfilePageProps`, `isProfileIndexable`, `resolveProfileTitle`, and `generateMetadata`
exactly as they are. Add this helper after `resolveProfileTitle`:

```tsx
/**
 * A missing account, or one private to the viewer, sends the visitor to the profiles list.
 * `getAccountForSeoPage` turns the API 404 into the Next.js not-found signal; every other failure
 * propagates to the error page.
 */
const getAccountOrRedirectToProfiles = async (idText: string) => {
  try {
    return await getAccountForSeoPage(idText);
  } catch (error) {
    if (isHTTPAccessFallbackError(error) && getAccessFallbackHTTPStatus(error) === 404) {
      redirect(ROUTES.PROFILES);
    }
    throw error;
  }
};
```

Do not add a return type; `redirect` returns `never`, so the helper resolves the account type.
Replace `ProfilePage` with:

```tsx
export default async function ProfilePage({ params }: ProfilePageProps) {
  const { id_text } = await params;

  const { isValidAuthSession, ssrApiRequestService } = await getSSRAuthService();
  const ssrAccount = await getAccountOrRedirectToProfiles(id_text);

  if (isValidAuthSession) {
    const ssrLoggedInAccount = await ssrApiRequestService.reqAuthMe();
    if (ssrLoggedInAccount.id === ssrAccount.id) {
      redirect(ROUTES.MY_PROFILE);
    }
  }

  // Import ProfileClient dynamically to avoid circular dependencies
  const { ProfilePageClient } = await import('./ProfilePageClient');

  return <ProfilePageClient ssrAccount={ssrAccount} />;
}
```

`ROUTES.PROFILES` is `'/profiles'` and `ROUTES.MY_PROFILE` is `'/my-profile'` in
`apps/web/src/constants/routes.ts`.

### 2. `apps/web/src/app/profile/[id_text]/page.test.ts` (new)

Vitest, colocated like `apps/web/src/app/api/resolve-media-url/route.test.ts`. Use the real
`next/navigation` (do not mock it), so the test proves the page recognizes the signal Next.js
actually throws and emits a real redirect signal. Mock the page's server dependencies with hoisted
mocks; vi.mock factories are not type-checked against the module, so no type assertions are
needed:

```typescript
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
```

The `buildStaticPageMetadata` mock keeps `apps/web/src/config` (observability and runtime config)
out of the import graph; `generateMetadata` is not under test here.

In `beforeEach`, reset both mocks and set `authState.isValidAuthSession = false`. Cases, with
sentence-style titles:

1. When the account fetch throws the Next.js not-found signal, the page redirects to the profiles
   list. `getAccountForSeoPageMock.mockImplementation(async () => notFound())`;
   `await expect(renderProfilePage('missing01')).rejects.toMatchObject({ digest:
   PROFILES_REDIRECT_DIGEST })`.
1. When the account fetch fails with a server error, the page rethrows that error unchanged.
   `const error = new AxiosError('Request failed', 'ERR_BAD_RESPONSE');`
   `getAccountForSeoPageMock.mockRejectedValue(error)`;
   `await expect(renderProfilePage('broken01')).rejects.toBe(error)`.
1. When the account fetch fails with a network error, the page rethrows that error unchanged.
   Same shape with `new AxiosError('Network Error', 'ERR_NETWORK')`.
1. When a signed-in viewer opens their own profile, the page redirects to `/my-profile`.
   `authState.isValidAuthSession = true`; the account mock resolves `{ id: 7 }`; `reqAuthMeMock`
   resolves `{ id: 7 }`; `rejects.toMatchObject({ digest: MY_PROFILE_REDIRECT_DIGEST })`.
1. When `/auth/me` fails for a signed-in viewer, the page rethrows that error instead of
   redirecting. `authState.isValidAuthSession = true`; the account mock resolves `{ id: 7 }`;
   `reqAuthMeMock.mockRejectedValue(error)` with a fresh `AxiosError`; `rejects.toBe(error)`.

Do not test the success render; it loads `ProfilePageClient` and its client tree.

### 3. `apps/web/e2e/seo-profile-sharable-status.spec.ts`

Replace the second test, which accepted either a redirect to `/profiles` or noindex HTML, with one
that pins the redirect. Keep the first test unchanged. The placeholder id is not seeded, so the
API answers 404 for it, the same answer a private account gets.

```typescript
  test('a non-public or missing profile redirects to the profiles list', async ({ request }) => {
    const response = await request.get(`/profile/${E2E_SEO_PRIVATE_PROFILE_PLACEHOLDER_ID_TEXT}`, {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(307);
    const location = response.headers().location;
    expect(location).toBeDefined();
    expect(new URL(location, 'http://localhost').pathname).toBe('/profiles');
  });
```

If the status is a different 3xx to `/profiles`, or the page answers 404 with the not-found text,
report it as a finding in the final message. Do not loosen the assertion.

## Tests

- Unit: `apps/web/src/app/profile/[id_text]/page.test.ts` (new). The Next.js not-found signal from
  the account fetch redirects to `/profiles`. A 5xx or network failure from the account fetch, and a
  `/auth/me` failure, are rethrown unchanged. Your own profile redirects to `/my-profile`.
- Playwright: `apps/web/e2e/seo-profile-sharable-status.spec.ts` (updated). A missing or private
  profile answers 307 to `/profiles`. A public profile stays indexable. The spec is already in
  `makefiles/local/e2e-spec-order-web.txt`.

## Release scratchpad

```markdown
## Profile pages show the error page for API failures

- Surfaces: web
- Change: `/profile/[id_text]` still redirects to `/profiles` when the account does not exist or
  is private to the viewer (the API answers 404). Every other failure now shows the error page:
  a 5xx, network failure, timeout, or other non-404 answer for the account, and a failed
  `/auth/me` for a signed-in viewer. Before, all of these redirected to `/profiles` with no error
  shown. Opening your own profile still redirects to `/my-profile`.
- Who notices: visitors hitting a profile while the API is failing now see the error page instead
  of a silent jump to the profiles list; operators see those failures in logs and error reporting
- Operator steps: none
```
