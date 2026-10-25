import type { Server } from 'http';
import jwt from 'jsonwebtoken';
import { type Mock, vi } from 'vitest';

import type { ORMContext } from '@podverse/orm';

import { accountSessionStoreStub } from './accountSessionStoreStub.js';
import {
  TEST_ACCOUNT_SESSION_ID_TEXT,
  TEST_ADMIN_E2E_ID_TEXT,
  TEST_USER_ACCOUNT_ID_TEXT,
} from './testAccountIds.js';

const JWT_SECRET = process.env.AUTH_JWT_SECRET ?? '';

export type TestAppResult = {
  app: import('express').Express;
  server: Server | undefined;
  ormContext: ORMContext | undefined;
};

const TEST_KEYVAL_READY_MAX_WAIT_MS = 10_000;
const TEST_KEYVAL_READY_POLL_MS = 50;

async function waitForTestKeyvaldbReady(): Promise<void> {
  const { testKeyvaldbConnection } = await import('../../lib/keyvaldb/keyvaldb.js');
  const deadline = Date.now() + TEST_KEYVAL_READY_MAX_WAIT_MS;
  while (Date.now() < deadline) {
    if (await testKeyvaldbConnection(false)) {
      return;
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, TEST_KEYVAL_READY_POLL_MS);
    });
  }
  throw new Error('KeyValDB not reachable during test app startup');
}

async function waitForTestPlaybackRedisReady(): Promise<void> {
  const { getPlaybackRedis, PlaybackStoreUnavailableError } =
    await import('../../lib/accountPlayback/playbackRedis.js');
  const deadline = Date.now() + TEST_KEYVAL_READY_MAX_WAIT_MS;
  while (Date.now() < deadline) {
    try {
      getPlaybackRedis();
      return;
    } catch (error) {
      if (!(error instanceof PlaybackStoreUnavailableError)) {
        throw error;
      }
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, TEST_KEYVAL_READY_POLL_MS);
    });
  }
  throw new Error('Playback Redis connection not ready during test app startup');
}

async function closeTestPlaybackRedis(): Promise<void> {
  try {
    const { closePlaybackRedis } = await import('../../lib/accountPlayback/playbackRedis.js');
    await closePlaybackRedis();
  } catch {
    // The playback Redis module may not have been loaded in this test file
  }
}

async function closeTestKeyvaldb(): Promise<void> {
  try {
    const { keyvaldb } = await import('../../lib/keyvaldb/keyvaldb.js');
    if (keyvaldb.status === 'ready' || keyvaldb.status === 'connecting') {
      await keyvaldb.quit();
    }
  } catch {
    // keyvaldb module may not have been loaded in this test file
  }
}

async function closeTestAccountEventStreamHub(): Promise<void> {
  try {
    const { closeAccountEventStreamHub } =
      await import('../../lib/accountEventStream/accountEventStreamHub.js');
    await closeAccountEventStreamHub();
  } catch {
    // The hub module may not have been loaded in this test file
  }
}

async function unregisterTestAccountEventPublisher(): Promise<void> {
  try {
    const { unregisterAccountEventPublisher } = await import('@podverse/orm');
    unregisterAccountEventPublisher();
  } catch {
    // @podverse/orm may be mocked without account event publisher helpers in a unit-only test file.
  }
}

export type StartTestAppOptions = {
  /**
   * `'stub'` (default) replaces the session store with {@link accountSessionStoreStub}, for files
   * whose accounts exist only in mocks. `'real'` uses the real store and real password checks, for
   * files that create their accounts in the test database.
   */
  accountSessions?: 'stub' | 'real';
};

const ACCOUNT_SESSION_STORE_MODULE = '../../lib/auth/accountSessionStore.js';
const PASSWORD_MODULE = '../../lib/auth/password.js';

export async function startTestApp(options?: StartTestAppOptions): Promise<TestAppResult> {
  // Each API integration test file provides its own @podverse/orm mock.
  // Reset modules so dynamic imports below pick up the current file's mocks and a fresh app instance.
  vi.resetModules();

  // Mock registrations outlive the file under `isolate: false`, so every start sets the store
  // module one way or the other rather than inheriting the previous file's choice.
  if ((options?.accountSessions ?? 'stub') === 'stub') {
    vi.doMock(ACCOUNT_SESSION_STORE_MODULE, () => accountSessionStoreStub);
  } else {
    vi.doUnmock(ACCOUNT_SESSION_STORE_MODULE);
    vi.doUnmock(PASSWORD_MODULE);
  }

  process.env.DEFAULT_ACCOUNT_SETTINGS_LOCALE =
    process.env.DEFAULT_ACCOUNT_SETTINGS_LOCALE ?? 'en-US';

  const { assertConfigValid, validateORMConfig } = await import('@podverse/helpers-config');
  const { createORMContext, registerAccountEventPublisher } = await import('@podverse/orm');
  const { config: appConfig } = await import('../../config/index.js');

  const readRequiredTestEnv = (name: string): string => {
    const value = process.env[name];
    if (value === undefined || value === '') {
      throw new Error(`Missing or empty test env: ${name}`);
    }
    return value;
  };

  const ormConfig = {
    nodeEnv: appConfig.nodeEnv,
    database: {
      host: readRequiredTestEnv('DB_HOST'),
      port: parseInt(readRequiredTestEnv('DB_PORT'), 10),
      read_username: readRequiredTestEnv('DB_APP_READ_USER'),
      read_password: readRequiredTestEnv('DB_APP_READ_PASSWORD'),
      read_write_username: readRequiredTestEnv('DB_APP_READ_WRITE_USER'),
      read_write_password: readRequiredTestEnv('DB_APP_READ_WRITE_PASSWORD'),
      database: readRequiredTestEnv('DB_APP_NAME'),
      ssl_connection: process.env.DB_SSL_CONNECTION === 'true',
    },
    log: {
      level: appConfig.log.level,
      dir: process.env.LOG_DIR ?? '',
      timer: process.env.LOG_TIMER === 'true',
    },
    defaults: {
      account: {
        settings: {
          locale: process.env.DEFAULT_ACCOUNT_SETTINGS_LOCALE,
        },
      },
    },
    addByRssCredentialsEncryptionKey:
      process.env.ADD_BY_RSS_CREDENTIALS_ENCRYPTION_KEY ?? undefined,
    addByRssCredentialsEncryptionKeyOld:
      process.env.ADD_BY_RSS_CREDENTIALS_ENCRYPTION_KEY_OLD ?? undefined,
  };
  assertConfigValid(validateORMConfig(ormConfig), 'podverse-orm');
  const ormContext = createORMContext(ormConfig);
  await ormContext.dataSourceRead.initialize();
  await ormContext.dataSourceReadWrite.initialize();
  registerAccountEventPublisher({ publish: async () => 0 });

  const { startPlaybackRedis } = await import('../../lib/accountPlayback/playbackRedis.js');
  startPlaybackRedis();
  await waitForTestPlaybackRedisReady();

  const { initObservability } = await import('@podverse/observability');
  initObservability(appConfig.observability);

  const { app, startApp } = await import('../../app.js');
  const maybeServer = await startApp();
  await waitForTestKeyvaldbReady();

  return { app, server: maybeServer ?? undefined, ormContext };
}

export async function stopTestApp(
  server: Server | undefined,
  ormContext: ORMContext | undefined
): Promise<void> {
  await unregisterTestAccountEventPublisher();
  await closeTestPlaybackRedis();
  await closeTestKeyvaldb();
  await closeTestAccountEventStreamHub();

  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
  if (ormContext) {
    await ormContext.dataSourceRead.destroy();
    await ormContext.dataSourceReadWrite.destroy();
  }
}

export {
  TEST_ACCOUNT_SESSION_ID_TEXT,
  TEST_ADMIN_E2E_ID_TEXT,
  TEST_USER_ACCOUNT_ID_TEXT,
} from './testAccountIds.js';
export { accountSessionStoreStub } from './accountSessionStoreStub.js';

function signTestAccessToken(userId: number, idText: string): string {
  return jwt.sign(
    { id: userId, id_text: idText, sid: TEST_ACCOUNT_SESSION_ID_TEXT, token_use: 'access' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

/** A mobile access token naming {@link TEST_ACCOUNT_SESSION_ID_TEXT}, which the stub store reports active. */
export function authHeaders(
  userId: number = 1,
  idText: string = TEST_USER_ACCOUNT_ID_TEXT
): { Authorization: string } {
  return {
    Authorization: `Bearer ${signTestAccessToken(userId, idText)}`,
  };
}

/** Same as {@link authHeaders} with a distinct default id_text (for admin-scoped API routes in tests). */
export function adminAuthHeaders(
  userId: number = 1,
  idText: string = TEST_ADMIN_E2E_ID_TEXT
): { Authorization: string } {
  return {
    Authorization: `Bearer ${signTestAccessToken(userId, idText)}`,
  };
}

/**
 * `vi.fn(async () => value)` with a consistent name for ORM and service stubs in integration tests.
 */
export function createMockFn<T>(resolved: T | Promise<T>): Mock<() => Promise<T>> {
  return vi.fn(async () => resolved) as unknown as Mock<() => Promise<T>>;
}

export async function getBaseApiUrl(): Promise<string> {
  const { config } = await import('../../config/index.js');
  return `${config.api.prefix}${config.api.version}`;
}

/**
 * Mutes expected error/warn output for a single assertion path.
 * Use for tests that intentionally exercise error responses (401/403/500) and would otherwise
 * print noisy logs that look like suite failures.
 */
export async function withMutedExpectedErrorLogs<T>(run: () => Promise<T> | T): Promise<T> {
  const restoreFns: Array<() => void> = [];

  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  restoreFns.push(() => errorSpy.mockRestore());
  restoreFns.push(() => warnSpy.mockRestore());

  const { loggerService } = await import('@api/factories/loggerService.js');
  const loggerLogErrorSpy = vi.spyOn(loggerService, 'logError').mockImplementation(() => {});
  const loggerErrorSpy = vi.spyOn(loggerService, 'error').mockImplementation(() => {});
  const loggerWarnSpy = vi.spyOn(loggerService, 'warn').mockImplementation(() => {});
  restoreFns.push(() => loggerLogErrorSpy.mockRestore());
  restoreFns.push(() => loggerErrorSpy.mockRestore());
  restoreFns.push(() => loggerWarnSpy.mockRestore());

  try {
    return await run();
  } finally {
    for (const restore of restoreFns) {
      restore();
    }
  }
}

export {
  createDefaultAccountGet,
  defaultAccountGet,
  type AuthIntegrationAccountGetResult,
} from './mockAccount.js';
export { IntegrationTestNoopCategoryService } from './mockOrm.js';
