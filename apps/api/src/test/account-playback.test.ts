import { randomBytes, randomUUID } from 'node:crypto';
import type { Server } from 'node:http';

import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DTOPlaybackResourceSummary, PlaybackStatePublishBody } from '@podverse/helpers';
import {
  AccountMembershipEnum,
  isDTOPlaybackCommandEnvelope,
  isDTOPlaybackDevices,
  isDTOPlaybackStartFailed,
  isDTOPlaybackState,
  MediumEnum,
  PLAYBACK_COMMAND_TTL_MS,
} from '@podverse/helpers';
import type { AccountEvent, ORMContext } from '@podverse/orm';

import type { TestAppResult } from './helpers/index.js';
import {
  getBaseApiUrl,
  startTestApp,
  stopTestApp,
  withMutedExpectedErrorLogs,
} from './helpers/index.js';

const { ACCOUNT_ID, getAccountMock } = vi.hoisted(() => ({
  ACCOUNT_ID: 991_000_000 + Math.floor(Math.random() * 8_000_000),
  getAccountMock: vi.fn(),
}));

vi.mock('@podverse/orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@podverse/orm')>();

  class MockCategoryService {
    async setCategoryCache(): Promise<void> {}
  }

  class MockAccountService {
    get = getAccountMock;
  }

  return {
    ...actual,
    CategoryService: MockCategoryService,
    AccountService: MockAccountService,
  };
});

type PlaybackRedisModule = typeof import('../lib/accountPlayback/playbackRedis.js');
type AccountPlaybackRouterModule = typeof import('../routes/accountPlayback.js');
type OrmModule = typeof import('@podverse/orm');

const JWT_SECRET = process.env.AUTH_JWT_SECRET ?? '';
const ACCOUNT_ID_TEXT = 'pvplayrt01';
const SESSION_SUFFIX = randomBytes(3).toString('hex');
const SESSION_A = `pbrta${SESSION_SUFFIX}`;
const SESSION_B = `pbrtb${SESSION_SUFFIX}`;
const SESSION_ABSENT = `pbrtx${SESSION_SUFFIX}`;

const PLAYBACK_ACCOUNT_KEY_NAMES = [
  'presence',
  'devices',
  'devices_rev',
  'state',
  'state_rev',
  'active',
] as const;

const accountWithMembershipExpiringAt = (membershipExpiresAt: Date) => ({
  id: ACCOUNT_ID,
  id_text: ACCOUNT_ID_TEXT,
  account_credentials: { email: 'playback-routes-test@example.com' },
  account_membership_status: {
    membership_expires_at: membershipExpiresAt,
    account_membership: { id: AccountMembershipEnum.Premium },
  },
  account_terms_acceptance: {
    terms_version: '2026-10-15',
    accepted_at: new Date('2026-01-01T00:00:00.000Z'),
  },
});

const activeMemberGet = async (id: number) =>
  id === ACCOUNT_ID ? accountWithMembershipExpiringAt(new Date(Date.now() + 86_400_000)) : null;

const expiredMemberGet = async (id: number) =>
  id === ACCOUNT_ID ? accountWithMembershipExpiringAt(new Date(Date.now() - 86_400_000)) : null;

const authFor = (sessionIdText: string): { Authorization: string } => ({
  Authorization: `Bearer ${jwt.sign(
    { id: ACCOUNT_ID, id_text: ACCOUNT_ID_TEXT, sid: sessionIdText, token_use: 'access' },
    JWT_SECRET,
    { expiresIn: '1h' }
  )}`,
});

const musicResource: DTOPlaybackResourceSummary = {
  ref: { kind: 'item', item_id_text: 'pbrtitem01' },
  medium: MediumEnum.Music,
  title: 'Track One',
  channel_title: 'The Album',
  image_url: null,
};

const stateBody = (
  overrides: Partial<PlaybackStatePublishBody> = {}
): PlaybackStatePublishBody => ({
  claim: false,
  resource: musicResource,
  status: 'playing',
  is_live: false,
  position_seconds: 100,
  duration_seconds: 3600,
  rate: 1,
  ...overrides,
});

const liveStateBody = (
  overrides: Partial<PlaybackStatePublishBody> = {}
): PlaybackStatePublishBody =>
  stateBody({
    is_live: true,
    position_seconds: null,
    duration_seconds: null,
    rate: 1,
    ...overrides,
  });

/** Replaces every own method on `prototype` with a recorder; returns a function that restores them. */
const recordMethodCalls = (prototype: object, calls: string[]): (() => void) => {
  const restores: Array<() => void> = [];
  for (const name of Object.getOwnPropertyNames(prototype)) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
    if (name === 'constructor' || descriptor === undefined) {
      continue;
    }
    if (typeof descriptor.value !== 'function') {
      continue;
    }
    Object.defineProperty(prototype, name, {
      ...descriptor,
      value: async () => {
        calls.push(name);
        return null;
      },
    });
    restores.push(() => {
      Object.defineProperty(prototype, name, descriptor);
    });
  }
  return () => {
    for (const restore of restores) {
      restore();
    }
  };
};

describe('/account/playback routes', () => {
  let app: TestAppResult['app'];
  let server: Server | undefined;
  let ormContext: ORMContext | undefined;
  let playbackBase: string;
  let playbackRedis: PlaybackRedisModule;
  let playbackRouter: AccountPlaybackRouterModule;
  let orm: OrmModule;
  const published: AccountEvent[] = [];
  const usedCommandIds: string[] = [];

  const eventsOfType = (type: string): unknown[] =>
    published
      .filter((event) => event.type === type && event.account_id === ACCOUNT_ID)
      .map((event) => event.data);

  const checkIn = (sessionIdText: string) =>
    request(app).post(`${playbackBase}/presence`).set(authFor(sessionIdText));

  const publish = (sessionIdText: string, body: object) =>
    request(app).post(`${playbackBase}/state`).set(authFor(sessionIdText)).send(body);

  const sendCommand = async (sessionIdText: string, body: object) => {
    const res = await request(app)
      .post(`${playbackBase}/commands`)
      .set(authFor(sessionIdText))
      .send(body);
    if (res.status === 202 && typeof res.body.command_id === 'string') {
      usedCommandIds.push(res.body.command_id);
    }
    return res;
  };

  const reportStartFailed = (sessionIdText: string, commandId: string) =>
    request(app)
      .post(`${playbackBase}/commands/${commandId}/start-failed`)
      .set(authFor(sessionIdText))
      .send({ reason: 'autoplay_blocked' });

  const waitForPlaybackRedisReady = async (): Promise<void> => {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      try {
        playbackRedis.getPlaybackRedis();
        return;
      } catch (error) {
        if (!(error instanceof playbackRedis.PlaybackStoreUnavailableError)) {
          throw error;
        }
      }
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 50);
      });
    }
    throw new Error('Playback Redis connection not ready');
  };

  beforeAll(async () => {
    getAccountMock.mockImplementation(activeMemberGet);
    const started = await startTestApp();
    app = started.app;
    server = started.server;
    ormContext = started.ormContext;
    playbackBase = `${await getBaseApiUrl()}/account/playback`;
    playbackRedis = await import('../lib/accountPlayback/playbackRedis.js');
    playbackRouter = await import('../routes/accountPlayback.js');
    orm = await import('@podverse/orm');
    orm.registerAccountEventPublisher({
      publish: async (_channel: string, message: string) => {
        published.push(...(orm.parseAccountEventMessage(message) ?? []));
        return 1;
      },
    });
  }, 30000);

  beforeEach(() => {
    getAccountMock.mockImplementation(activeMemberGet);
    playbackRouter.playbackRateLimit.resetForUser(ACCOUNT_ID);
    published.length = 0;
  });

  afterEach(async () => {
    const redis = playbackRedis.getPlaybackRedis();
    await redis.del(
      ...PLAYBACK_ACCOUNT_KEY_NAMES.map((name) => `podverse:playback:${ACCOUNT_ID}:${name}`)
    );
    if (usedCommandIds.length > 0) {
      await redis.del(...usedCommandIds.map((id) => `podverse:playback:command:${id}`));
      usedCommandIds.length = 0;
    }
  });

  afterAll(async () => {
    await stopTestApp(server, ormContext);
  });

  describe('access', () => {
    it('answers 401 without credentials, 403 for an expired membership, and 200 for a member', async () => {
      const anonymous = await request(app).post(`${playbackBase}/presence`);
      expect(anonymous.status).toBe(401);

      getAccountMock.mockImplementation(expiredMemberGet);
      const expired = await withMutedExpectedErrorLogs(async () => checkIn(SESSION_A));
      expect(expired.status).toBe(403);
      expect(expired.body.code).toBe('membership_expired');

      getAccountMock.mockImplementation(activeMemberGet);
      const member = await checkIn(SESSION_A);
      expect(member.status).toBe(200);
    });
  });

  describe('POST /presence', () => {
    it('returns this device, the devices, and the state, and publishes devices only on a join', async () => {
      const first = await checkIn(SESSION_A);
      expect(first.status).toBe(200);
      expect(first.body.session_id_text).toBe(SESSION_A);
      expect(first.body.devices.devices).toHaveLength(1);
      expect(first.body.devices.devices[0]).toMatchObject({
        session_id_text: SESSION_A,
        client_type: 'web',
      });
      expect(first.body.state).toBeNull();
      expect(eventsOfType('playback.devices').filter(isDTOPlaybackDevices)).toHaveLength(1);

      const second = await checkIn(SESSION_B);
      expect(second.status).toBe(200);
      expect(second.body.session_id_text).toBe(SESSION_B);
      expect(
        second.body.devices.devices
          .map((device: { session_id_text: string }) => device.session_id_text)
          .sort()
      ).toEqual([SESSION_A, SESSION_B].sort());
      expect(eventsOfType('playback.devices')).toHaveLength(2);

      published.length = 0;
      const again = await checkIn(SESSION_A);
      expect(again.status).toBe(200);
      expect(published).toHaveLength(0);
    });
  });

  describe('POST /state', () => {
    it('refuses a publish without a claim while nothing is active', async () => {
      const res = await withMutedExpectedErrorLogs(async () => publish(SESSION_A, stateBody()));

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('playback_not_active_device');
      expect(res.body.active_session_id_text).toBeNull();
    });

    it('lets the last claim win and refuses the previous active device', async () => {
      const claimA = await publish(SESSION_A, stateBody({ claim: true }));
      expect(claimA.status).toBe(200);
      expect(claimA.body.active_session_id_text).toBe(SESSION_A);
      expect(Number.isSafeInteger(claimA.body.revision)).toBe(true);
      expect(claimA.body.revision).toBeGreaterThan(0);

      const states = eventsOfType('playback.state').filter(isDTOPlaybackState);
      expect(states).toHaveLength(1);
      expect(states[0]?.active_session_id_text).toBe(SESSION_A);
      expect(states[0]?.revision).toBe(claimA.body.revision);
      expect(states[0]?.resource?.medium).toBe(MediumEnum.Music);

      const claimB = await publish(SESSION_B, stateBody({ claim: true }));
      expect(claimB.status).toBe(200);
      expect(claimB.body.active_session_id_text).toBe(SESSION_B);
      expect(claimB.body.revision).toBeGreaterThan(claimA.body.revision);

      const refused = await withMutedExpectedErrorLogs(async () =>
        publish(SESSION_A, stateBody({ position_seconds: 200 }))
      );
      expect(refused.status).toBe(409);
      expect(refused.body.code).toBe('playback_not_active_device');
      expect(refused.body.active_session_id_text).toBe(SESSION_B);
    });

    it('answers 400 for a resource without a known integer medium and publishes nothing', async () => {
      const withoutMedium = {
        ref: musicResource.ref,
        title: musicResource.title,
        channel_title: musicResource.channel_title,
        image_url: musicResource.image_url,
      };
      const bodies = [
        { ...stateBody({ claim: true }), resource: withoutMedium },
        { ...stateBody({ claim: true }), resource: { ...musicResource, medium: 999 } },
        { ...stateBody({ claim: true }), resource: { ...musicResource, medium: '3' } },
      ];

      for (const body of bodies) {
        const res = await withMutedExpectedErrorLogs(async () => publish(SESSION_A, body));
        expect(res.status).toBe(400);
      }
      expect(published).toHaveLength(0);
    });

    it('stores a periodic publish within the drift tolerance as unchanged and a seek as a new revision', async () => {
      const claim = await publish(SESSION_A, stateBody({ claim: true, position_seconds: 100 }));
      expect(claim.status).toBe(200);
      published.length = 0;

      const periodic = await publish(SESSION_A, stateBody({ position_seconds: 100.5 }));
      expect(periodic.status).toBe(200);
      expect(periodic.body.revision).toBe(claim.body.revision);
      expect(periodic.body.active_session_id_text).toBe(SESSION_A);
      expect(published).toHaveLength(0);

      const seek = await publish(SESSION_A, stateBody({ position_seconds: 900 }));
      expect(seek.status).toBe(200);
      expect(seek.body.revision).toBeGreaterThan(claim.body.revision);
      const states = eventsOfType('playback.state').filter(isDTOPlaybackState);
      expect(states).toHaveLength(1);
      expect(states[0]?.position_seconds).toBe(900);
    });

    it('releases the active device, after which commands find no active device', async () => {
      await publish(SESSION_A, stateBody({ claim: true }));
      await checkIn(SESSION_B);
      published.length = 0;

      const release = await publish(
        SESSION_A,
        stateBody({
          resource: null,
          status: 'paused',
          position_seconds: null,
          duration_seconds: null,
        })
      );
      expect(release.status).toBe(200);
      expect(release.body.active_session_id_text).toBeNull();
      const states = eventsOfType('playback.state').filter(isDTOPlaybackState);
      expect(states).toHaveLength(1);
      expect(states[0]?.active_session_id_text).toBeNull();
      expect(states[0]?.resource).toBeNull();

      const pause = await withMutedExpectedErrorLogs(async () =>
        sendCommand(SESSION_B, { command: { type: 'pause' } })
      );
      expect(pause.status).toBe(409);
      expect(pause.body.code).toBe('playback_no_active_device');
    });
  });

  describe('POST /commands', () => {
    it('relays pause to the active device with a five-second expiry and no state', async () => {
      await publish(SESSION_A, stateBody({ claim: true }));
      await checkIn(SESSION_B);
      published.length = 0;

      const res = await sendCommand(SESSION_B, { command: { type: 'pause' } });

      expect(res.status).toBe(202);
      expect(res.body.target_session_id_text).toBe(SESSION_A);
      const envelopes = eventsOfType('playback.command').filter(isDTOPlaybackCommandEnvelope);
      expect(envelopes).toHaveLength(1);
      const envelope = envelopes[0];
      expect(envelope?.command_id).toBe(res.body.command_id);
      expect(envelope?.sender_session_id_text).toBe(SESSION_B);
      expect(envelope?.target_session_id_text).toBe(SESSION_A);
      expect(envelope?.command).toEqual({ type: 'pause' });
      expect(envelope?.state).toBeNull();
      expect((envelope?.expires_at_ms ?? 0) - (envelope?.issued_at_ms ?? 0)).toBe(
        PLAYBACK_COMMAND_TTL_MS
      );
      expect(res.body.expires_at_ms).toBe(envelope?.expires_at_ms);
    });

    it('answers 400 for a toggle, a negative seek, and a target on pause', async () => {
      await publish(SESSION_A, stateBody({ claim: true }));
      published.length = 0;

      const bodies = [
        { command: { type: 'toggle' } },
        { command: { type: 'seek', position_seconds: -1 } },
        { target_session_id_text: SESSION_A, command: { type: 'pause' } },
      ];
      for (const body of bodies) {
        const res = await withMutedExpectedErrorLogs(async () => sendCommand(SESSION_B, body));
        expect(res.status).toBe(400);
      }
      expect(eventsOfType('playback.command')).toHaveLength(0);
    });

    it('relays next and previous without reading or writing any queue', async () => {
      await publish(SESSION_A, stateBody({ claim: true }));
      await checkIn(SESSION_B);
      published.length = 0;

      const queueCalls: string[] = [];
      const restoreQueue = recordMethodCalls(orm.QueueService.prototype, queueCalls);
      const restoreQueueResource = recordMethodCalls(
        orm.QueueResourceService.prototype,
        queueCalls
      );
      try {
        for (const type of ['next', 'previous'] as const) {
          const res = await sendCommand(SESSION_B, { command: { type } });
          expect(res.status).toBe(202);
          expect(res.body.target_session_id_text).toBe(SESSION_A);
        }
      } finally {
        restoreQueue();
        restoreQueueResource();
      }

      const envelopes = eventsOfType('playback.command').filter(isDTOPlaybackCommandEnvelope);
      expect(envelopes.map((envelope) => envelope.command)).toEqual([
        { type: 'next' },
        { type: 'previous' },
      ]);
      for (const envelope of envelopes) {
        expect(envelope.target_session_id_text).toBe(SESSION_A);
        expect(envelope.state).toBeNull();
      }
      expect(queueCalls).toEqual([]);
    });

    it('answers 400 for next with a target and 409 for next with nothing active', async () => {
      const withTarget = await withMutedExpectedErrorLogs(async () =>
        sendCommand(SESSION_B, { target_session_id_text: SESSION_A, command: { type: 'next' } })
      );
      expect(withTarget.status).toBe(400);

      const nothingActive = await withMutedExpectedErrorLogs(async () =>
        sendCommand(SESSION_B, { command: { type: 'next' } })
      );
      expect(nothingActive.status).toBe(409);
      expect(nothingActive.body.code).toBe('playback_no_active_device');
    });

    it('refuses seek for a live item and relays pause, next, and previous', async () => {
      const claim = await publish(SESSION_A, liveStateBody({ claim: true }));
      expect(claim.status).toBe(200);
      await checkIn(SESSION_B);

      const seek = await withMutedExpectedErrorLogs(async () =>
        sendCommand(SESSION_B, { command: { type: 'seek', position_seconds: 30 } })
      );
      expect(seek.status).toBe(409);
      expect(seek.body.code).toBe('playback_command_not_allowed_for_live');

      for (const type of ['pause', 'next', 'previous'] as const) {
        const res = await sendCommand(SESSION_B, { command: { type } });
        expect(res.status).toBe(202);
      }
    });

    it('answers 409 for play while nothing is active', async () => {
      const res = await withMutedExpectedErrorLogs(async () =>
        sendCommand(SESSION_B, { command: { type: 'play' } })
      );

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('playback_no_active_device');
    });

    it('sends take_over with the stored state and refuses the active, own, and absent targets', async () => {
      await publish(SESSION_A, stateBody({ claim: true }));
      await checkIn(SESSION_B);
      const stored = eventsOfType('playback.state').filter(isDTOPlaybackState).at(-1);
      published.length = 0;

      const toB = await sendCommand(SESSION_A, {
        target_session_id_text: SESSION_B,
        command: { type: 'take_over' },
      });
      expect(toB.status).toBe(202);
      const envelopes = eventsOfType('playback.command').filter(isDTOPlaybackCommandEnvelope);
      expect(envelopes).toHaveLength(1);
      expect(envelopes[0]?.target_session_id_text).toBe(SESSION_B);
      expect(envelopes[0]?.command).toEqual({ type: 'take_over' });
      expect(envelopes[0]?.state).toMatchObject({
        revision: stored?.revision,
        active_session_id_text: SESSION_A,
        resource: musicResource,
        position_seconds: stored?.position_seconds,
      });

      const toActive = await withMutedExpectedErrorLogs(async () =>
        sendCommand(SESSION_B, {
          target_session_id_text: SESSION_A,
          command: { type: 'take_over' },
        })
      );
      expect(toActive.status).toBe(409);
      expect(toActive.body.code).toBe('playback_target_already_active');

      const toSelf = await withMutedExpectedErrorLogs(async () =>
        sendCommand(SESSION_B, {
          target_session_id_text: SESSION_B,
          command: { type: 'take_over' },
        })
      );
      expect(toSelf.status).toBe(400);
      expect(toSelf.body.code).toBe('playback_take_over_self');

      const toAbsent = await withMutedExpectedErrorLogs(async () =>
        sendCommand(SESSION_B, {
          target_session_id_text: SESSION_ABSENT,
          command: { type: 'take_over' },
        })
      );
      expect(toAbsent.status).toBe(409);
      expect(toAbsent.body.code).toBe('playback_device_not_connected');
    });

    it('answers 409 for take_over with nothing loaded', async () => {
      await checkIn(SESSION_A);

      const res = await withMutedExpectedErrorLogs(async () =>
        sendCommand(SESSION_B, {
          target_session_id_text: SESSION_A,
          command: { type: 'take_over' },
        })
      );

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('playback_nothing_to_transfer');
    });
  });

  describe('POST /commands/:command_id/start-failed', () => {
    it('tells the sender when the target reports, and hides the command from anyone else', async () => {
      await publish(SESSION_A, stateBody({ claim: true }));
      await checkIn(SESSION_B);
      const play = await sendCommand(SESSION_B, { command: { type: 'play' } });
      expect(play.status).toBe(202);
      const commandId: string = play.body.command_id;
      published.length = 0;

      const fromTarget = await reportStartFailed(SESSION_A, commandId);
      expect(fromTarget.status).toBe(204);
      const reports = eventsOfType('playback.start_failed').filter(isDTOPlaybackStartFailed);
      expect(reports).toEqual([
        {
          command_id: commandId,
          sender_session_id_text: SESSION_B,
          target_session_id_text: SESSION_A,
          reason: 'autoplay_blocked',
        },
      ]);

      const fromSender = await withMutedExpectedErrorLogs(async () =>
        reportStartFailed(SESSION_B, commandId)
      );
      expect(fromSender.status).toBe(404);

      const unknown = await withMutedExpectedErrorLogs(async () =>
        reportStartFailed(SESSION_A, randomUUID())
      );
      expect(unknown.status).toBe(404);
    });
  });

  describe('playback store outage', () => {
    it('answers 503 playback_unavailable while the playback connection is closed', async () => {
      await playbackRedis.closePlaybackRedis();
      try {
        const res = await withMutedExpectedErrorLogs(async () => checkIn(SESSION_A));
        expect(res.status).toBe(503);
        expect(res.body.code).toBe('playback_unavailable');
      } finally {
        playbackRedis.startPlaybackRedis();
        await waitForPlaybackRedisReady();
      }
    });
  });
});
