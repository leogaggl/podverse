import type { Page, Response } from '@playwright/test';
import { expect, test } from '@playwright/test';

import {
  decodeE2eJwtPayload,
  endOtherSessions,
  loginSessionsUser,
  readJwtCookie,
  signE2eJwt,
  withAppDb,
} from './helpers/accountSessions';
import { actionAndCapture, capturePageLoad } from './helpers/stepScreenshots';

const SERVER_RENDERED_PAGE = '/browse';
const DAY_SECONDS = 24 * 60 * 60;
const YEAR_SECONDS = 365 * DAY_SECONDS;

function stringClaim(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string' || value === '') {
    throw new Error(`The token has no ${key} claim`);
  }
  return value;
}

function numberClaim(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  if (typeof value !== 'number') {
    throw new Error(`The token has no ${key} claim`);
  }
  return value;
}

async function jwtSetCookieTokens(response: Response): Promise<string[]> {
  const headers = await response.headersArray();
  return headers
    .filter((header) => header.name.toLowerCase() === 'set-cookie')
    .map((header) => header.value)
    .filter((value) => value.startsWith('jwt='))
    .map((value) => (value.split(';')[0] ?? '').slice('jwt='.length));
}

async function sessionLastSeenAgeSeconds(sessionIdText: string): Promise<number> {
  return withAppDb(async (client) => {
    const result = await client.query(
      `SELECT EXTRACT(EPOCH FROM (now() - last_seen_at))::text AS age_seconds
       FROM account_session
       WHERE id_text = $1`,
      [sessionIdText]
    );
    const ageSeconds: unknown = result.rows[0]?.age_seconds;
    if (typeof ageSeconds !== 'string') {
      throw new Error(`No account_session row for ${sessionIdText}`);
    }
    return Number(ageSeconds);
  });
}

async function expectSignedInNavbar(page: Page): Promise<void> {
  const chrome = page.locator('[data-appearance="web"]');
  await chrome.getByRole('button', { name: 'Account' }).click();
  await expect(page.getByRole('menuitem', { name: 'Logout' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Login' })).toHaveCount(0);
}

test.describe('Web session cookie renewal', () => {
  test('A session last renewed two days ago is renewed by a server-rendered page visit.', async ({
    baseURL,
    context,
    page,
  }, testInfo) => {
    let sessionIdText = '';
    let agedToken = '';

    await test.step('Log in as the sessions user and end every other session.', async () => {
      await loginSessionsUser(page.request);
      await endOtherSessions(page.request);
    });

    await test.step('Age the session row and put a two-day-old web token in the browser.', async () => {
      const loginPayload = decodeE2eJwtPayload(await readJwtCookie(context));
      sessionIdText = stringClaim(loginPayload, 'sid');

      await withAppDb(async (client) => {
        const updated = await client.query(
          `UPDATE account_session
           SET last_seen_at = now() - interval '2 days'
           WHERE id_text = $1`,
          [sessionIdText]
        );
        expect(updated.rowCount).toBe(1);
      });

      const iat = Math.floor(Date.now() / 1000) - 2 * DAY_SECONDS;
      agedToken = signE2eJwt({
        id: numberClaim(loginPayload, 'id'),
        id_text: stringClaim(loginPayload, 'id_text'),
        sid: sessionIdText,
        token_use: 'web',
        iat,
        exp: iat + YEAR_SECONDS,
      });
      if (baseURL === undefined) {
        throw new Error('The web E2E project has no baseURL');
      }
      await context.clearCookies({ name: 'jwt' });
      await context.addCookies([
        { name: 'jwt', value: agedToken, url: baseURL, httpOnly: true, sameSite: 'Strict' },
      ]);
    });

    await actionAndCapture(
      page,
      testInfo,
      'The server-rendered page visit renews the session cookie and renders signed in.',
      async () => {
        const response = await page.goto(SERVER_RENDERED_PAGE);
        if (response === null) {
          throw new Error(`No document response for ${SERVER_RENDERED_PAGE}`);
        }

        const renewedTokens = await jwtSetCookieTokens(response);
        expect(renewedTokens).toHaveLength(1);
        const renewedToken = renewedTokens[0] ?? '';
        expect(renewedToken).not.toBe('');
        expect(renewedToken).not.toBe(agedToken);

        expect(await readJwtCookie(context)).toBe(renewedToken);
        const renewedPayload = decodeE2eJwtPayload(renewedToken);
        expect(stringClaim(renewedPayload, 'sid')).toBe(sessionIdText);
        const renewedIatAgeSeconds = Date.now() / 1000 - numberClaim(renewedPayload, 'iat');
        expect(renewedIatAgeSeconds).toBeLessThan(60);

        expect(await sessionLastSeenAgeSeconds(sessionIdText)).toBeLessThan(60);

        await expectSignedInNavbar(page);
      },
      page.getByRole('menuitem', { name: 'Logout' })
    );
  });

  test('A fresh session cookie makes no renewal call on a server-rendered page visit.', async ({
    page,
  }, testInfo) => {
    await test.step('Log in as the sessions user and end every other session.', async () => {
      await loginSessionsUser(page.request);
      await endOtherSessions(page.request);
    });

    await test.step('Open a server-rendered page and verify the document sets no jwt cookie.', async () => {
      const response = await page.goto(SERVER_RENDERED_PAGE);
      if (response === null) {
        throw new Error(`No document response for ${SERVER_RENDERED_PAGE}`);
      }
      expect(await jwtSetCookieTokens(response)).toEqual([]);
      await expectSignedInNavbar(page);

      await capturePageLoad(
        page,
        testInfo,
        'The page renders signed in with the login cookie unchanged.',
        page.getByRole('menuitem', { name: 'Logout' })
      );
    });
  });
});
