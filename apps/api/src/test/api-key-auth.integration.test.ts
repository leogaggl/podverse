import cookieParser from 'cookie-parser';
import express from 'express';
import type { Server } from 'http';
import request from 'supertest';
import type { EntityManager } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { ApiKeyPermissions } from '@podverse/helpers';
import {
  ACCOUNT_ENTITLEMENT_CAPABILITY,
  apiKeyPermissionsForPreset,
  APP_ROUTES,
  CRUD_BITS,
  emptyApiKeyPermissions,
} from '@podverse/helpers';
import type { ORMContext } from '@podverse/orm';

import type { AuthenticatedRequestOptions } from '../lib/auth/index.js';
import { getBaseApiUrl, startTestApp, stopTestApp } from './helpers/index.js';

vi.mock('@podverse/orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@podverse/orm')>();

  class MockCategoryService {
    async setCategoryCache(): Promise<void> {}
  }

  return {
    ...actual,
    CategoryService: MockCategoryService,
  };
});

const TEST_PASSWORD = 'IntegrationTest1!';
const UNKNOWN_WELL_FORMED_KEY = `pvk_${'A'.repeat(43)}`;
const INVALID_KEY_BODY = { message: 'Invalid API key', code: 'api_key_invalid' };
const NOT_ALLOWED_BODY = {
  message: 'API keys cannot be used for this endpoint.',
  code: 'api_key_not_allowed',
};

type TestAccount = { id: number; idText: string; email: string };
type TestKey = { id: string; token: string };

function setCookies(res: request.Response): string[] {
  const header: unknown = res.headers['set-cookie'];
  if (Array.isArray(header)) {
    return header.filter((value): value is string => typeof value === 'string');
  }
  return typeof header === 'string' ? [header] : [];
}

function jwtCookieValue(res: request.Response): string | null {
  const cookie = setCookies(res).find((value) => value.startsWith('jwt='));
  if (cookie === undefined) {
    return null;
  }
  return cookie.slice('jwt='.length).split(';')[0] ?? '';
}

function permissionsWith(resource: keyof ApiKeyPermissions, mask: number): ApiKeyPermissions {
  return { ...emptyApiKeyPermissions(), [resource]: mask };
}

describe('API key authentication (real stores)', () => {
  let server: Server | undefined;
  let ormContext: ORMContext | undefined;
  let manager: EntityManager;
  let app: import('express').Express;
  let probeApp: import('express').Express;
  let authBase: string;
  let termsVersion: string;
  let accountCounter = 0;

  beforeAll(async () => {
    const started = await startTestApp({ accountSessions: 'real' });
    app = started.app;
    server = started.server;
    ormContext = started.ormContext;
    if (!ormContext) {
      throw new Error('ORM context required for API key auth integration test');
    }
    manager = ormContext.dataSourceReadWrite.manager;
    const apiBase = await getBaseApiUrl();
    authBase = `${apiBase}/auth`;

    const { config } = await import('../config/index.js');
    termsVersion = config.terms.version;
    if (termsVersion === '') {
      throw new Error(
        'TERMS_OF_SERVICE_VERSION is empty in the test env; the terms probe would prove nothing'
      );
    }

    // Imported after the app starts so the probe routes share the app's auth module instance.
    const { ensureAuthenticated } = await import('../lib/auth/index.js');
    probeApp = express();
    probeApp.use(cookieParser());
    const probeRoute = (path: string, options: AuthenticatedRequestOptions): void => {
      probeApp.get(path, (req, res) => {
        ensureAuthenticated(
          req,
          res,
          () => {
            res.json({ ok: true });
          },
          options
        );
      });
    };
    probeRoute('/probe/terms', {
      skipMembershipStatus: false,
      apiKeyAccess: { resource: 'account', action: 'read' },
    });
    probeRoute('/probe/capability', {
      skipMembershipStatus: false,
      skipTermsAcceptance: true,
      requiredCapability: ACCOUNT_ENTITLEMENT_CAPABILITY.allowNotifications,
      apiKeyAccess: { resource: 'notifications', action: 'read' },
    });
    probeRoute('/probe/membership', {
      skipMembershipStatus: false,
      skipTermsAcceptance: true,
      apiKeyAccess: { resource: 'account', action: 'read' },
    });
    probeRoute('/probe/closed', { skipMembershipStatus: false, skipTermsAcceptance: true });
  }, 30000);

  afterAll(async () => {
    await stopTestApp(server, ormContext);
  });

  async function createVerifiedAccount(): Promise<TestAccount> {
    const { AccountService } = await import('@podverse/orm');
    accountCounter += 1;
    const email = `api-key-auth-${Date.now()}-${accountCounter}@example.com`;
    const accountService = new AccountService();
    await accountService.create({
      email,
      password: TEST_PASSWORD,
      locale: 'en-US',
      terms_version: termsVersion,
    });
    const account = await accountService.getByEmail(email);
    if (!account) {
      throw new Error('Failed to load account after create');
    }
    await accountService.verifyEmail(account.id);
    return { id: account.id, idText: account.id_text, email };
  }

  async function webLoginCookie(account: TestAccount): Promise<string> {
    const res = await request(app)
      .post(`${authBase}/login`)
      .send({ email: account.email, password: TEST_PASSWORD });
    expect(res.status).toBe(200);
    const token = jwtCookieValue(res);
    if (token === null || token === '') {
      throw new Error('Login set no jwt cookie');
    }
    return `jwt=${token}`;
  }

  async function createKey(account: TestAccount, permissions: ApiKeyPermissions): Promise<TestKey> {
    const { createAccountApiKey } = await import('@podverse/orm');
    const { apiKey, token } = await createAccountApiKey({
      accountId: account.id,
      name: 'Integration key',
      permissions,
      expiresAt: null,
    });
    return { id: apiKey.id, token };
  }

  async function readLastUsedAtMs(key: TestKey): Promise<number | null> {
    const rows: unknown = await manager.query(
      `SELECT last_used_at FROM account_api_key WHERE id = $1::bigint`,
      [key.id]
    );
    const row: unknown = Array.isArray(rows) ? rows[0] : undefined;
    if (typeof row !== 'object' || row === null) {
      throw new Error('API key row is missing');
    }
    const value: unknown = Reflect.get(row, 'last_used_at');
    if (value === null) {
      return null;
    }
    if (value instanceof Date) {
      return value.getTime();
    }
    throw new Error('API key last_used_at is not a timestamp');
  }

  async function lapseMembership(account: TestAccount): Promise<void> {
    await manager.query(
      `UPDATE billing_membership_grant
       SET revoked_at = now()
       WHERE account_id = $1 AND revoked_at IS NULL`,
      [account.id]
    );
    await manager.query(
      `UPDATE account_membership_status
       SET membership_expires_at = now() - interval '1 day'
       WHERE account_id = $1`,
      [account.id]
    );
  }

  function bearer(key: TestKey | string): string {
    return `Bearer ${typeof key === 'string' ? key : key.token}`;
  }

  it('a key with account read gets GET /auth/me and records last use at most once per interval', async () => {
    const account = await createVerifiedAccount();
    const key = await createKey(account, permissionsWith('account', CRUD_BITS.read));
    expect(await readLastUsedAtMs(key)).toBeNull();

    const first = await request(app).get(`${authBase}/me`).set('Authorization', bearer(key));
    expect(first.status).toBe(200);
    expect(first.body.id_text).toBe(account.idText);
    const recordedAt = await readLastUsedAtMs(key);
    expect(recordedAt).not.toBeNull();

    const second = await request(app).get(`${authBase}/me`).set('Authorization', bearer(key));
    expect(second.status).toBe(200);
    expect(await readLastUsedAtMs(key)).toBe(recordedAt);
  });

  it('an unknown well-formed key and a malformed key each get 401 api_key_invalid', async () => {
    const unknown = await request(app)
      .get(`${authBase}/me`)
      .set('Authorization', bearer(UNKNOWN_WELL_FORMED_KEY));
    expect(unknown.status).toBe(401);
    expect(unknown.body).toEqual(INVALID_KEY_BODY);

    const malformed = await request(app)
      .get(`${authBase}/me`)
      .set('Authorization', bearer('pvk_x'));
    expect(malformed.status).toBe(401);
    expect(malformed.body).toEqual(INVALID_KEY_BODY);
  });

  it('a key whose row was deleted gets 401 api_key_invalid', async () => {
    const account = await createVerifiedAccount();
    const key = await createKey(account, apiKeyPermissionsForPreset('full_access'));
    await manager.query(`DELETE FROM account_api_key WHERE id = $1::bigint`, [key.id]);

    const res = await request(app).get(`${authBase}/me`).set('Authorization', bearer(key));
    expect(res.status).toBe(401);
    expect(res.body).toEqual(INVALID_KEY_BODY);
  });

  it('a key past its expiry gets 401 api_key_expired', async () => {
    const account = await createVerifiedAccount();
    const key = await createKey(account, apiKeyPermissionsForPreset('full_access'));
    await manager.query(
      `UPDATE account_api_key SET expires_at = now() - interval '1 minute' WHERE id = $1::bigint`,
      [key.id]
    );

    const res = await request(app).get(`${authBase}/me`).set('Authorization', bearer(key));
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'API key expired', code: 'api_key_expired' });
  });

  it('a key without account read gets 403 api_key_permission_denied naming the permission', async () => {
    const account = await createVerifiedAccount();
    const key = await createKey(account, permissionsWith('playlists', CRUD_BITS.read));

    const res = await request(app).get(`${authBase}/me`).set('Authorization', bearer(key));
    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      message: 'This API key needs the read permission on account.',
      code: 'api_key_permission_denied',
      required_permission: { resource: 'account', action: 'read' },
    });
  });

  it('a full-access key gets 403 api_key_not_allowed on a route that does not accept keys', async () => {
    const account = await createVerifiedAccount();
    const key = await createKey(account, apiKeyPermissionsForPreset('full_access'));

    const res = await request(app).get(`${authBase}/sessions`).set('Authorization', bearer(key));
    expect(res.status).toBe(403);
    expect(res.body).toEqual(NOT_ALLOWED_BODY);
  });

  it('after membership expires the key gets 403 membership_expired while the session still gets GET /auth/me', async () => {
    const account = await createVerifiedAccount();
    const key = await createKey(account, apiKeyPermissionsForPreset('full_access'));
    const cookie = await webLoginCookie(account);
    await lapseMembership(account);

    const keyRes = await request(app).get(`${authBase}/me`).set('Authorization', bearer(key));
    expect(keyRes.status).toBe(403);
    expect(keyRes.body).toEqual({
      message: 'Your membership has expired. Renew to use this feature.',
      code: 'membership_expired',
      i18nKey: 'membership.membership_expired',
      renewPath: APP_ROUTES.MEMBERSHIP_RENEW,
    });

    const sessionRes = await request(app).get(`${authBase}/me`).set('Cookie', cookie);
    expect(sessionRes.status).toBe(200);
  });

  it('a request carrying a session cookie and a key is authenticated by the cookie', async () => {
    const account = await createVerifiedAccount();
    const key = await createKey(account, permissionsWith('playlists', CRUD_BITS.read));
    const cookie = await webLoginCookie(account);

    const res = await request(app)
      .get(`${authBase}/me`)
      .set('Cookie', cookie)
      .set('Authorization', bearer(key));
    expect(res.status).toBe(200);
    expect(res.body.id_text).toBe(account.idText);
  });

  it('a key 401 sets no jwt cookie', async () => {
    const res = await request(app)
      .get(`${authBase}/me`)
      .set('Authorization', bearer(UNKNOWN_WELL_FORMED_KEY));
    expect(res.status).toBe(401);
    expect(jwtCookieValue(res)).toBeNull();
  });

  describe('a key cannot do more than its owner', () => {
    async function probeBoth(
      path: string,
      key: TestKey,
      cookie: string
    ): Promise<{ key: request.Response; session: request.Response }> {
      const keyRes = await request(probeApp).get(path).set('Authorization', bearer(key));
      const sessionRes = await request(probeApp).get(path).set('Cookie', cookie);
      return { key: keyRes, session: sessionRes };
    }

    async function ownerWithKey(): Promise<{ account: TestAccount; key: TestKey; cookie: string }> {
      const account = await createVerifiedAccount();
      const key = await createKey(account, apiKeyPermissionsForPreset('full_access'));
      const cookie = await webLoginCookie(account);
      return { account, key, cookie };
    }

    it('terms: the key and the session both pass with current terms and both get 403 with stale terms', async () => {
      const { account, key, cookie } = await ownerWithKey();

      const before = await probeBoth('/probe/terms', key, cookie);
      expect(before.key.status).toBe(200);
      expect(before.session.status).toBe(200);

      await manager.query(
        `UPDATE account_terms_acceptance SET terms_version = '2000-01-01' WHERE account_id = $1`,
        [account.id]
      );

      const after = await probeBoth('/probe/terms', key, cookie);
      expect(after.key.status).toBe(403);
      expect(after.key.body.code).toBe('terms_acceptance_required');
      expect(after.session.status).toBe(403);
      expect(after.key.body).toEqual(after.session.body);
    });

    it('capability: the key and the session both pass with notifications allowed and both get 403 without', async () => {
      const { account, key, cookie } = await ownerWithKey();
      await manager.query(
        `UPDATE account_membership_status SET allow_notifications = true WHERE account_id = $1`,
        [account.id]
      );

      const before = await probeBoth('/probe/capability', key, cookie);
      expect(before.key.status).toBe(200);
      expect(before.session.status).toBe(200);

      await manager.query(
        `UPDATE account_membership_status SET allow_notifications = false WHERE account_id = $1`,
        [account.id]
      );

      const after = await probeBoth('/probe/capability', key, cookie);
      expect(after.key.status).toBe(403);
      expect(after.key.body.code).toBe('feature_not_available_for_account_type');
      expect(after.session.status).toBe(403);
      expect(after.key.body).toEqual(after.session.body);
    });

    it('membership: the key and the session both get 403 membership_expired after it expires', async () => {
      const { account, key, cookie } = await ownerWithKey();

      const before = await probeBoth('/probe/membership', key, cookie);
      expect(before.key.status).toBe(200);
      expect(before.session.status).toBe(200);

      await lapseMembership(account);

      const after = await probeBoth('/probe/membership', key, cookie);
      expect(after.key.status).toBe(403);
      expect(after.key.body.code).toBe('membership_expired');
      expect(after.session.status).toBe(403);
      expect(after.key.body).toEqual(after.session.body);
    });

    it('a full-access key gets 403 api_key_not_allowed on a route without apiKeyAccess while the session passes', async () => {
      const { key, cookie } = await ownerWithKey();

      const res = await probeBoth('/probe/closed', key, cookie);
      expect(res.key.status).toBe(403);
      expect(res.key.body).toEqual(NOT_ALLOWED_BODY);
      expect(res.session.status).toBe(200);
    });
  });
});
