import type { Server } from 'http';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { ORMContext } from '@podverse/orm';

import { authHeaders, getBaseApiUrl, startTestApp, stopTestApp } from './helpers/index.js';

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

type ContentLogAccount = {
  id: number;
  idText: string;
};

describe('GET /account/content-log', () => {
  let app: import('express').Express;
  let server: Server | undefined;
  let ormContext: ORMContext | undefined;
  let accountBase = '';
  let owner: ContentLogAccount;
  let other: ContentLogAccount;
  let olderChannelIdText = '';
  let newerChannelIdText = '';
  let otherChannelIdText = '';

  beforeAll(async () => {
    const started = await startTestApp();
    app = started.app;
    server = started.server;
    ormContext = started.ormContext;
    if (!ormContext) {
      throw new Error('ORM context required for content log test');
    }

    const stamp = String(Date.now()).slice(-10);
    olderChannelIdText = `older${stamp}`;
    newerChannelIdText = `newer${stamp}`;
    otherChannelIdText = `other${stamp}`;

    owner = await createContentLogAccount(ormContext, `content-log-${stamp}@example.com`);
    other = await createContentLogAccount(ormContext, `content-log-other-${stamp}@example.com`);

    await ormContext.dataSourceReadWrite.query(
      `INSERT INTO account_content_log (
         account_id,
         log_type,
         channel_id_text,
         channel_title,
         reason,
         follow_outcome,
         clip_count,
         playlist_entry_count,
         updated_at
       ) VALUES
         ($1, 'removed_content', $3, 'Older Show', 'left_directory', 'ended', 1, 0, $6),
         ($1, 'removed_content', $4, 'Newer Show', 'taken_down', NULL, 2, 4, $7),
         ($2, 'removed_content', $5, 'Other Show', 'left_directory', 'moved_to_add_by_rss', 9, 8, $8)
       `,
      [
        owner.id,
        other.id,
        olderChannelIdText,
        newerChannelIdText,
        otherChannelIdText,
        new Date('2026-01-01T00:00:00.000Z'),
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-07-01T00:00:00.000Z'),
      ]
    );

    accountBase = `${await getBaseApiUrl()}/account`;
  }, 60000);

  afterAll(async () => {
    if (ormContext && olderChannelIdText !== '') {
      await ormContext.dataSourceReadWrite.query(
        `DELETE FROM account_content_log WHERE channel_id_text = ANY($1::varchar[])`,
        [[olderChannelIdText, newerChannelIdText, otherChannelIdText]]
      );
    }
    await stopTestApp(server, ormContext);
  });

  it('returns 401 without a token', async () => {
    const response = await request(app).get(`${accountBase}/content-log?type=removed_content`);
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Unauthorized' });
  });

  it('returns 400 when type is omitted', async () => {
    const response = await request(app)
      .get(`${accountBase}/content-log`)
      .set(authHeaders(owner.id, owner.idText));

    expect(response.status).toBe(400);
    expect(typeof response.body.message).toBe('string');
    expect(response.body.message.length).toBeGreaterThan(0);
  });

  it('returns 400 when type is unknown', async () => {
    const response = await request(app)
      .get(`${accountBase}/content-log?type=future_type`)
      .set(authHeaders(owner.id, owner.idText));

    expect(response.status).toBe(400);
    expect(typeof response.body.message).toBe('string');
    expect(response.body.message.length).toBeGreaterThan(0);
  });

  it('returns the signed-in account rows newest first', async () => {
    const response = await request(app)
      .get(`${accountBase}/content-log?type=removed_content`)
      .set(authHeaders(owner.id, owner.idText));

    expect(response.status).toBe(200);
    expect(response.body.rows).toEqual([
      {
        id: expect.any(String),
        log_type: 'removed_content',
        channel_id_text: newerChannelIdText,
        channel_title: 'Newer Show',
        reason: 'taken_down',
        follow_outcome: null,
        clip_count: 2,
        playlist_entry_count: 4,
        updated_at: '2026-06-01T00:00:00.000Z',
      },
      {
        id: expect.any(String),
        log_type: 'removed_content',
        channel_id_text: olderChannelIdText,
        channel_title: 'Older Show',
        reason: 'left_directory',
        follow_outcome: 'ended',
        clip_count: 1,
        playlist_entry_count: 0,
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ]);
    expect(response.body.rows[0].id).not.toBe(response.body.rows[1].id);
    expect(Object.keys(response.body.rows[0])).not.toContain('account_id');
    expect(Object.keys(response.body.rows[0])).not.toContain('created_at');
    expect(JSON.stringify(response.body)).not.toContain(otherChannelIdText);
  });
});

async function createContentLogAccount(
  ormContext: ORMContext,
  email: string
): Promise<ContentLogAccount> {
  const { AccountService } = await import('@podverse/orm');
  const accountService = new AccountService();
  await accountService.create({
    email,
    password: 'IntegrationTest1!',
    locale: 'en-US',
    terms_version: '2026-10-15',
  });
  const account = await accountService.getByEmail(email);
  if (!account || typeof account.id_text !== 'string' || account.id_text === '') {
    throw new Error(`Failed to load account ${email}`);
  }
  return { id: account.id, idText: account.id_text };
}
