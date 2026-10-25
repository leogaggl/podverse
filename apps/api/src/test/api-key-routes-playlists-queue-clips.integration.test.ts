import type { Express } from 'express';
import type { Server } from 'http';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { ApiKeyPermissionRequirement } from '@podverse/helpers';
import { SharableStatusEnum } from '@podverse/helpers';
import type { ORMContext } from '@podverse/orm';

import {
  apiKeyHeaders,
  createApiKeyTestAccount,
  createTestApiKey,
  permissionsWithOnly,
  permissionsWithout,
} from './helpers/apiKeyTestAccounts.js';
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

const PLAYLIST_ID = 'pvtestid01';
const RESOURCE_ID = 'pvtestid02';
const QUEUE_ID = 'pvtestid01';

const EMPTY_BODY: Record<string, unknown> = {};
const ADD_BY_RSS_BODY: Record<string, unknown> = { add_by_rss_resource_data: {} };
const REPLAY_BODY: Record<string, unknown> = {
  events: [{ item_id_text: RESOURCE_ID, playback_event_kind: 'play' }],
};

const CREATED_TITLE = 'API key playlist';
const UPDATED_TITLE = 'API key playlist renamed';
const OTHER_PUBLIC_TITLE = 'Other public playlist';
const OTHER_UNLISTED_TITLE = 'Other unlisted playlist';
const OTHER_PRIVATE_TITLE = 'Other private playlist';
const CREATE_PLAYLIST_BODY = {
  title: CREATED_TITLE,
  description: 'Created with an API key',
  medium: 'av',
  sharable_status_id: SharableStatusEnum.Private,
};
const UPDATE_PLAYLIST_BODY = {
  title: UPDATED_TITLE,
  description: 'Created with an API key',
  sharable_status_id: SharableStatusEnum.Private,
};
const LIST_QUERY = { medium: 'av', page: '1' };

const playlistsRead: ApiKeyPermissionRequirement = { resource: 'playlists', action: 'read' };
const playlistsCreate: ApiKeyPermissionRequirement = { resource: 'playlists', action: 'create' };
const playlistsUpdate: ApiKeyPermissionRequirement = { resource: 'playlists', action: 'update' };
const playlistsDelete: ApiKeyPermissionRequirement = { resource: 'playlists', action: 'delete' };
const queueRead: ApiKeyPermissionRequirement = { resource: 'queue', action: 'read' };
const queueCreate: ApiKeyPermissionRequirement = { resource: 'queue', action: 'create' };
const queueUpdate: ApiKeyPermissionRequirement = { resource: 'queue', action: 'update' };
const queueDelete: ApiKeyPermissionRequirement = { resource: 'queue', action: 'delete' };
const clipsRead: ApiKeyPermissionRequirement = { resource: 'clips', action: 'read' };
const clipsCreate: ApiKeyPermissionRequirement = { resource: 'clips', action: 'create' };
const clipsUpdate: ApiKeyPermissionRequirement = { resource: 'clips', action: 'update' };
const clipsDelete: ApiKeyPermissionRequirement = { resource: 'clips', action: 'delete' };
const subscriptionsRead: ApiKeyPermissionRequirement = {
  resource: 'subscriptions',
  action: 'read',
};

type RouteMethod = 'get' | 'post' | 'patch' | 'delete';

type RouteCase = {
  method: RouteMethod;
  path: string;
  requirement: ApiKeyPermissionRequirement;
  query?: Record<string, string>;
  body?: Record<string, unknown>;
};

const QUEUE_ZONES = ['now-playing', 'next', 'last', 'between', 'history'] as const;

function playlistResourceMutations(createBase: string, deletePath: string): RouteCase[] {
  return [
    { method: 'post', path: `${createBase}/first`, requirement: playlistsCreate },
    { method: 'post', path: `${createBase}/between`, requirement: playlistsCreate },
    { method: 'post', path: `${createBase}/last`, requirement: playlistsCreate },
    { method: 'delete', path: deletePath, requirement: playlistsDelete },
  ];
}

function standardQueueBody(
  zone: (typeof QUEUE_ZONES)[number]
): Record<string, unknown> | undefined {
  if (zone === 'between') {
    return undefined;
  }
  return EMPTY_BODY;
}

function addByRssQueueBody(
  zone: (typeof QUEUE_ZONES)[number]
): Record<string, unknown> | undefined {
  if (zone === 'now-playing' || zone === 'history') {
    return ADD_BY_RSS_BODY;
  }
  return undefined;
}

function queueResourceMutations(
  createBase: string,
  deletePath: string,
  bodyForZone: (zone: (typeof QUEUE_ZONES)[number]) => Record<string, unknown> | undefined,
  deleteBody: Record<string, unknown> | undefined
): RouteCase[] {
  const creates = QUEUE_ZONES.map((zone) => {
    const body = bodyForZone(zone);
    const route: RouteCase = {
      method: 'post',
      path: `${createBase}/${zone}`,
      requirement: queueCreate,
    };
    if (body !== undefined) {
      route.body = body;
    }
    return route;
  });
  const remove: RouteCase = {
    method: 'delete',
    path: deletePath,
    requirement: queueDelete,
  };
  if (deleteBody !== undefined) {
    remove.body = deleteBody;
  }
  return [...creates, remove];
}

const playlistRoutes: RouteCase[] = [
  { method: 'get', path: '/playlist/private/likes', requirement: playlistsRead },
  { method: 'post', path: '/playlist/private/likes/membership', requirement: playlistsRead },
  { method: 'post', path: '/playlist/private/likes/toggle', requirement: playlistsUpdate },
  { method: 'get', path: '/playlist/private/top', requirement: playlistsRead },
  { method: 'get', path: '/playlist/private/recent', requirement: playlistsRead },
  { method: 'get', path: '/playlist/private/oldest', requirement: playlistsRead },
  { method: 'get', path: '/playlist/private/az', requirement: playlistsRead },
  { method: 'get', path: '/playlist/private/followed/top', requirement: subscriptionsRead },
  { method: 'get', path: '/playlist/private/followed/recent', requirement: subscriptionsRead },
  { method: 'get', path: '/playlist/private/followed/oldest', requirement: subscriptionsRead },
  { method: 'get', path: '/playlist/private/followed/az', requirement: subscriptionsRead },
  { method: 'post', path: '/playlist', requirement: playlistsCreate },
  { method: 'get', path: `/playlist/${PLAYLIST_ID}`, requirement: playlistsRead },
  { method: 'patch', path: `/playlist/${PLAYLIST_ID}`, requirement: playlistsUpdate },
  { method: 'delete', path: `/playlist/${PLAYLIST_ID}`, requirement: playlistsDelete },
];

const playlistResourceRoutes: RouteCase[] = [
  {
    method: 'get',
    path: `/playlist/${PLAYLIST_ID}/resources/private-all`,
    requirement: playlistsRead,
  },
  {
    method: 'get',
    path: `/playlist/${PLAYLIST_ID}/resources/queue-by-list-position`,
    requirement: playlistsRead,
    query: { direction: 'forward' },
  },
  {
    method: 'get',
    path: `/playlist/${PLAYLIST_ID}/resources/shuffle`,
    requirement: playlistsRead,
    query: { shuffleHash: 'shufflehash1' },
  },
  {
    method: 'get',
    path: `/playlist/${PLAYLIST_ID}/resources`,
    requirement: playlistsRead,
  },
];

const playlistClipRoutes = playlistResourceMutations(
  `/playlist/${PLAYLIST_ID}/clip/${RESOURCE_ID}`,
  `/playlist/${PLAYLIST_ID}/clip/${RESOURCE_ID}`
);
const playlistItemRoutes = playlistResourceMutations(
  `/playlist/${PLAYLIST_ID}/item/${RESOURCE_ID}`,
  `/playlist/${PLAYLIST_ID}/item/${RESOURCE_ID}`
);
const playlistAddByRssRoutes = playlistResourceMutations(
  `/playlist/${PLAYLIST_ID}/item-add-by-rss`,
  `/playlist/${PLAYLIST_ID}/item-add-by-rss/${RESOURCE_ID}`
);
const playlistSoundbiteRoutes = playlistResourceMutations(
  `/playlist/${PLAYLIST_ID}/item-soundbite/${RESOURCE_ID}`,
  `/playlist/${PLAYLIST_ID}/item-soundbite/${RESOURCE_ID}`
);

const queueRoutes: RouteCase[] = [
  { method: 'get', path: '/queue/all-for-account/private', requirement: queueRead },
  {
    method: 'post',
    path: `/queue/${QUEUE_ID}/update-is-active`,
    requirement: queueUpdate,
  },
];

const queueResourceRoutes: RouteCase[] = [
  { method: 'get', path: '/queue/resources/all-by-account-abridged', requirement: queueRead },
  {
    method: 'get',
    path: `/queue/${QUEUE_ID}/resources/now-playing`,
    requirement: queueRead,
  },
  {
    method: 'get',
    path: `/queue/${QUEUE_ID}/resources/upcoming-all`,
    requirement: queueRead,
  },
  {
    method: 'get',
    path: `/queue/${QUEUE_ID}/resources/history-paginated`,
    requirement: queueRead,
  },
  {
    method: 'post',
    path: `/queue/${QUEUE_ID}/resources/promote-upcoming`,
    requirement: queueUpdate,
  },
  {
    method: 'post',
    path: `/queue/${QUEUE_ID}/playback-events/replay`,
    requirement: queueUpdate,
    body: REPLAY_BODY,
  },
];

const queueClipRoutes = queueResourceMutations(
  `/queue/${QUEUE_ID}/clip/${RESOURCE_ID}`,
  `/queue/${QUEUE_ID}/clip/${RESOURCE_ID}`,
  standardQueueBody,
  EMPTY_BODY
);
const queueItemRoutes = queueResourceMutations(
  `/queue/${QUEUE_ID}/item/${RESOURCE_ID}`,
  `/queue/${QUEUE_ID}/item/${RESOURCE_ID}`,
  standardQueueBody,
  EMPTY_BODY
);
const queueAddByRssRoutes = queueResourceMutations(
  `/queue/${QUEUE_ID}/item-add-by-rss`,
  `/queue/${QUEUE_ID}/item-add-by-rss/${RESOURCE_ID}`,
  addByRssQueueBody,
  EMPTY_BODY
);
const queueSoundbiteRoutes = queueResourceMutations(
  `/queue/${QUEUE_ID}/item-soundbite/${RESOURCE_ID}`,
  `/queue/${QUEUE_ID}/item-soundbite/${RESOURCE_ID}`,
  standardQueueBody,
  EMPTY_BODY
);

const clipRoutes: RouteCase[] = [
  { method: 'get', path: '/clip/private', requirement: clipsRead },
  { method: 'post', path: '/clip', requirement: clipsCreate },
  { method: 'get', path: `/clip/${RESOURCE_ID}`, requirement: clipsRead },
  { method: 'patch', path: `/clip/${RESOURCE_ID}`, requirement: clipsUpdate },
  { method: 'delete', path: `/clip/${RESOURCE_ID}`, requirement: clipsDelete },
  {
    method: 'get',
    path: '/clip/public/subscribed/recent',
    requirement: subscriptionsRead,
    query: { medium: 'podcasts', page: '1' },
  },
  {
    method: 'get',
    path: '/clip/public/subscribed/top',
    requirement: subscriptionsRead,
    query: { medium: 'podcasts', page: '1', range: 'week' },
  },
];

const LABELED_ROUTES: RouteCase[] = [
  ...playlistRoutes,
  ...playlistResourceRoutes,
  ...playlistClipRoutes,
  ...playlistItemRoutes,
  ...playlistAddByRssRoutes,
  ...playlistSoundbiteRoutes,
  ...queueRoutes,
  ...queueResourceRoutes,
  ...queueClipRoutes,
  ...queueItemRoutes,
  ...queueAddByRssRoutes,
  ...queueSoundbiteRoutes,
  ...clipRoutes,
];

function requirementKey(requirement: ApiKeyPermissionRequirement): string {
  return `${requirement.resource}:${requirement.action}`;
}

function permissionDeniedBody(requirement: ApiKeyPermissionRequirement) {
  return {
    message: `This API key needs the ${requirement.action} permission on ${requirement.resource}.`,
    code: 'api_key_permission_denied',
    required_permission: requirement,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function playlistIdText(body: unknown): string {
  if (!isRecord(body) || typeof body.id_text !== 'string' || body.id_text === '') {
    throw new Error('Playlist response is missing id_text');
  }
  return body.id_text;
}

function playlistTitle(body: unknown): string {
  if (!isRecord(body) || typeof body.title !== 'string') {
    throw new Error('Playlist response is missing title');
  }
  return body.title;
}

function listIncludesPlaylist(body: unknown, idText: string): boolean {
  if (!isRecord(body) || !Array.isArray(body.data)) {
    return false;
  }
  return body.data.some((row) => isRecord(row) && row.id_text === idText);
}

describe('API key access on playlist, queue, and clip routes', () => {
  let server: Server | undefined;
  let ormContext: ORMContext | undefined;
  let app: Express;
  let apiBase: string;
  let deniedTokens = new Map<string, string>();
  let playlistsToken = '';
  let playlistsReadToken = '';
  let queueReadToken = '';
  let clipsReadToken = '';
  let subscriptionsReadToken = '';

  beforeAll(async () => {
    const started = await startTestApp({ accountSessions: 'real' });
    app = started.app;
    server = started.server;
    ormContext = started.ormContext;
    if (!ormContext) {
      throw new Error('ORM context required for playlist, queue, and clip API key route test');
    }
    apiBase = await getBaseApiUrl();
    const account = await createApiKeyTestAccount('api-key-routes-pqc-');

    deniedTokens = new Map();
    for (const route of LABELED_ROUTES) {
      const key = requirementKey(route.requirement);
      if (deniedTokens.has(key)) {
        continue;
      }
      deniedTokens.set(
        key,
        await createTestApiKey(account.id, permissionsWithout(route.requirement))
      );
    }
    playlistsToken = await createTestApiKey(
      account.id,
      permissionsWithOnly([playlistsCreate, playlistsRead, playlistsUpdate, playlistsDelete])
    );
    playlistsReadToken = await createTestApiKey(account.id, permissionsWithOnly([playlistsRead]));
    queueReadToken = await createTestApiKey(account.id, permissionsWithOnly([queueRead]));
    clipsReadToken = await createTestApiKey(account.id, permissionsWithOnly([clipsRead]));
    subscriptionsReadToken = await createTestApiKey(
      account.id,
      permissionsWithOnly([subscriptionsRead])
    );
  }, 60000);

  afterAll(async () => {
    await stopTestApp(server, ormContext);
  });

  function deniedToken(requirement: ApiKeyPermissionRequirement): string {
    const token = deniedTokens.get(requirementKey(requirement));
    if (token === undefined) {
      throw new Error(`No key for ${requirementKey(requirement)}`);
    }
    return token;
  }

  function callRoute(route: RouteCase, token: string) {
    const url = `${apiBase}${route.path}`;
    const headers = apiKeyHeaders(token);
    let pending = request(app).get(url);
    if (route.method === 'post') {
      pending = request(app).post(url);
    } else if (route.method === 'patch') {
      pending = request(app).patch(url);
    } else if (route.method === 'delete') {
      pending = request(app).delete(url);
    }
    pending = pending.set(headers);
    if (route.query !== undefined) {
      pending = pending.query(route.query);
    }
    if (route.body !== undefined) {
      pending = pending.send(route.body);
    }
    return pending;
  }

  it('labels every playlist, queue, and clip route', () => {
    expect(playlistRoutes).toHaveLength(15);
    expect(playlistResourceRoutes).toHaveLength(4);
    expect(playlistClipRoutes).toHaveLength(4);
    expect(playlistItemRoutes).toHaveLength(4);
    expect(playlistAddByRssRoutes).toHaveLength(4);
    expect(playlistSoundbiteRoutes).toHaveLength(4);
    expect(queueRoutes).toHaveLength(2);
    expect(queueResourceRoutes).toHaveLength(6);
    expect(queueClipRoutes).toHaveLength(6);
    expect(queueItemRoutes).toHaveLength(6);
    expect(queueAddByRssRoutes).toHaveLength(6);
    expect(queueSoundbiteRoutes).toHaveLength(6);
    expect(clipRoutes).toHaveLength(7);
    expect(LABELED_ROUTES).toHaveLength(74);
    expect(deniedTokens.size).toBe(13);
    const identities = LABELED_ROUTES.map((route) => `${route.method} ${route.path}`);
    expect(new Set(identities).size).toBe(LABELED_ROUTES.length);
  });

  it.each(LABELED_ROUTES)('$method $path denies a key missing that permission', async (route) => {
    const res = await callRoute(route, deniedToken(route.requirement));
    expect(res.status).toBe(403);
    expect(res.body).toEqual(permissionDeniedBody(route.requirement));
  });

  it('a playlists key can create, update, list, and delete a playlist', async () => {
    const created = await request(app)
      .post(`${apiBase}/playlist`)
      .set(apiKeyHeaders(playlistsToken))
      .send(CREATE_PLAYLIST_BODY);
    expect(created.status).toBe(201);
    const idText = playlistIdText(created.body);
    expect(playlistTitle(created.body)).toBe(CREATED_TITLE);

    const fetched = await request(app)
      .get(`${apiBase}/playlist/${idText}`)
      .set(apiKeyHeaders(playlistsToken));
    expect(fetched.status).toBe(200);
    expect(playlistTitle(fetched.body)).toBe(CREATED_TITLE);

    const updated = await request(app)
      .patch(`${apiBase}/playlist/${idText}`)
      .set(apiKeyHeaders(playlistsToken))
      .send(UPDATE_PLAYLIST_BODY);
    expect(updated.status).toBe(200);
    expect(playlistTitle(updated.body)).toBe(UPDATED_TITLE);

    const reread = await request(app)
      .get(`${apiBase}/playlist/${idText}`)
      .set(apiKeyHeaders(playlistsToken));
    expect(reread.status).toBe(200);
    expect(playlistTitle(reread.body)).toBe(UPDATED_TITLE);

    const listed = await request(app)
      .get(`${apiBase}/playlist/private/az`)
      .query(LIST_QUERY)
      .set(apiKeyHeaders(playlistsToken));
    expect(listed.status).toBe(200);
    expect(listIncludesPlaylist(listed.body, idText)).toBe(true);

    const deleted = await request(app)
      .delete(`${apiBase}/playlist/${idText}`)
      .set(apiKeyHeaders(playlistsToken));
    expect(deleted.status).toBe(204);

    const missing = await request(app)
      .get(`${apiBase}/playlist/${idText}`)
      .set(apiKeyHeaders(playlistsToken));
    expect(missing.status).toBe(404);
  });

  it("a playlists read key can read another account's public and unlisted playlists but not a private one", async () => {
    const otherAccount = await createApiKeyTestAccount('api-key-routes-pqc-other-');
    const otherToken = await createTestApiKey(
      otherAccount.id,
      permissionsWithOnly([playlistsCreate, playlistsRead, playlistsDelete])
    );

    const createdPublic = await request(app)
      .post(`${apiBase}/playlist`)
      .set(apiKeyHeaders(otherToken))
      .send({
        ...CREATE_PLAYLIST_BODY,
        title: OTHER_PUBLIC_TITLE,
        sharable_status_id: SharableStatusEnum.Public,
      });
    expect(createdPublic.status).toBe(201);
    const publicIdText = playlistIdText(createdPublic.body);

    const createdUnlisted = await request(app)
      .post(`${apiBase}/playlist`)
      .set(apiKeyHeaders(otherToken))
      .send({
        ...CREATE_PLAYLIST_BODY,
        title: OTHER_UNLISTED_TITLE,
        sharable_status_id: SharableStatusEnum.Unlisted,
      });
    expect(createdUnlisted.status).toBe(201);
    const unlistedIdText = playlistIdText(createdUnlisted.body);

    const createdPrivate = await request(app)
      .post(`${apiBase}/playlist`)
      .set(apiKeyHeaders(otherToken))
      .send({
        ...CREATE_PLAYLIST_BODY,
        title: OTHER_PRIVATE_TITLE,
        sharable_status_id: SharableStatusEnum.Private,
      });
    expect(createdPrivate.status).toBe(201);
    const privateIdText = playlistIdText(createdPrivate.body);

    const readPublic = await request(app)
      .get(`${apiBase}/playlist/${publicIdText}`)
      .set(apiKeyHeaders(playlistsReadToken));
    expect(readPublic.status).toBe(200);
    expect(playlistTitle(readPublic.body)).toBe(OTHER_PUBLIC_TITLE);

    const readUnlisted = await request(app)
      .get(`${apiBase}/playlist/${unlistedIdText}`)
      .set(apiKeyHeaders(playlistsReadToken));
    expect(readUnlisted.status).toBe(200);
    expect(playlistTitle(readUnlisted.body)).toBe(OTHER_UNLISTED_TITLE);

    const readPrivate = await request(app)
      .get(`${apiBase}/playlist/${privateIdText}`)
      .set(apiKeyHeaders(playlistsReadToken));
    expect(readPrivate.status).toBe(404);

    const ownerReadPrivate = await request(app)
      .get(`${apiBase}/playlist/${privateIdText}`)
      .set(apiKeyHeaders(otherToken));
    expect(ownerReadPrivate.status).toBe(200);
    expect(playlistTitle(ownerReadPrivate.body)).toBe(OTHER_PRIVATE_TITLE);

    for (const idText of [publicIdText, unlistedIdText, privateIdText]) {
      const deleted = await request(app)
        .delete(`${apiBase}/playlist/${idText}`)
        .set(apiKeyHeaders(otherToken));
      expect(deleted.status).toBe(204);
    }
  });

  it('a playlists read key cannot create a playlist', async () => {
    const res = await request(app)
      .post(`${apiBase}/playlist`)
      .set(apiKeyHeaders(playlistsReadToken))
      .send(CREATE_PLAYLIST_BODY);
    expect(res.status).toBe(403);
    expect(res.body).toEqual(permissionDeniedBody(playlistsCreate));
  });

  it('a queue read key can list the account queues', async () => {
    const res = await request(app)
      .get(`${apiBase}/queue/all-for-account/private`)
      .set(apiKeyHeaders(queueReadToken));
    expect(res.status).toBe(200);
  });

  it('a clips read key can list the account clips', async () => {
    const res = await request(app)
      .get(`${apiBase}/clip/private`)
      .set(apiKeyHeaders(clipsReadToken));
    expect(res.status).toBe(200);
  });

  it('a subscriptions read key can list followed playlists', async () => {
    const res = await request(app)
      .get(`${apiBase}/playlist/private/followed/az`)
      .query(LIST_QUERY)
      .set(apiKeyHeaders(subscriptionsReadToken));
    expect(res.status).toBe(200);
  });
});
