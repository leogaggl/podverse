import type { Server } from 'http';
import request from 'supertest';
import type { EntityManager } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  AccountMembershipEnum,
  CHANNEL_GONE_ARCHIVED_MESSAGE,
  MediumEnum,
} from '@podverse/helpers';
import type { FeedProbe, ORMContext } from '@podverse/orm';
import {
  Channel,
  convertArchivedShowFollows,
  deleteEmptyRemovedShows,
  Feed,
  FeedLifecycleStateKeyEnum,
  FeedLifecycleUpdateSourceEnum,
  FeedService,
  Item,
  ItemFlagStatusStatusEnum,
} from '@podverse/orm';

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rowsOf(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord);
}

function asId(value: unknown): number {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === 'string' && value !== '') {
    const parsed = Number(value);
    if (Number.isInteger(parsed)) {
      return parsed;
    }
  }
  throw new Error('expected an integer id');
}

async function queryRows(
  manager: EntityManager,
  sql: string,
  params: unknown[]
): Promise<Record<string, unknown>[]> {
  const result: unknown = await manager.query(sql, params);
  return rowsOf(result);
}

type AccountFixture = { id: number; idText: string };

type Show = {
  feedId: number;
  channelId: number;
  idText: string;
  url: string;
  title: string;
  podcastIndexId: number;
};

const runId = Date.now();
let nextPodcastIndexId = 830_000_000 + (runId % 1_000_000);

function nextPodcastIndexIdValue(): number {
  nextPodcastIndexId += 1;
  return nextPodcastIndexId;
}

async function createAccount(email: string): Promise<AccountFixture> {
  const { AccountService } = await import('@podverse/orm');
  const accountService = new AccountService();
  await accountService.create({
    email,
    password: 'IntegrationTest1!',
    locale: 'en-US',
    terms_version: '2026-10-15',
  });
  const account = await accountService.getByEmail(email);
  if (!account) {
    throw new Error('expected the seeded account');
  }
  return { id: account.id, idText: account.id_text };
}

async function grantPremium(manager: EntityManager, accountId: number): Promise<void> {
  await manager.query(
    `UPDATE account_membership_status
     SET account_membership_id = $2,
         membership_expires_at = now() + interval '30 days'
     WHERE account_id = $1`,
    [accountId, AccountMembershipEnum.Premium]
  );
  await manager.query(
    `INSERT INTO billing_membership_grant (account_id, source, starts_at, ends_at)
     VALUES ($1, 'admin', now(), now() + interval '30 days')`,
    [accountId]
  );
}

async function lapseMembership(manager: EntityManager, accountId: number): Promise<void> {
  await manager.query(
    `UPDATE billing_membership_grant
     SET revoked_at = now()
     WHERE account_id = $1 AND revoked_at IS NULL`,
    [accountId]
  );
  await manager.query(
    `UPDATE account_membership_status
     SET membership_expires_at = now() - interval '1 day'
     WHERE account_id = $1`,
    [accountId]
  );
}

async function createShow(
  manager: EntityManager,
  input: { url: string; title: string }
): Promise<Show> {
  const podcastIndexId = nextPodcastIndexIdValue();
  const feedRepo = manager.getRepository(Feed);
  const feed = await feedRepo.save(
    feedRepo.create({ url: input.url, podcast_index_id: podcastIndexId })
  );
  const channelRepo = manager.getRepository(Channel);
  const channel = await channelRepo.save(
    channelRepo.create({
      feed_id: feed.id,
      medium_id: MediumEnum.AV,
      title: input.title,
    })
  );
  return {
    feedId: feed.id,
    channelId: channel.id,
    idText: channel.id_text,
    url: input.url,
    title: input.title,
    podcastIndexId,
  };
}

async function markArchived(feedId: number): Promise<void> {
  const feedService = new FeedService();
  await feedService.setFeedLifecycleState(feedId, {
    toStateKey: FeedLifecycleStateKeyEnum.PendingArchive,
    source: FeedLifecycleUpdateSourceEnum.Archiver,
  });
  await feedService.setFeedLifecycleState(feedId, {
    toStateKey: FeedLifecycleStateKeyEnum.Archived,
    source: FeedLifecycleUpdateSourceEnum.Archiver,
  });
}

async function followChannel(
  manager: EntityManager,
  accountId: number,
  channelId: number
): Promise<void> {
  await manager.query(
    `INSERT INTO account_following_channel (account_id, channel_id) VALUES ($1, $2)`,
    [accountId, channelId]
  );
}

async function conversionState(
  manager: EntityManager,
  channelId: number
): Promise<{ status: string | null; attempts: number }> {
  const rows = await queryRows(
    manager,
    `SELECT follow_conversion_status, follow_conversion_attempts FROM channel WHERE id = $1`,
    [channelId]
  );
  const status = rows[0]?.follow_conversion_status;
  return {
    status: typeof status === 'string' ? status : null,
    attempts: asId(rows[0]?.follow_conversion_attempts ?? 0),
  };
}

async function directoryFollowCount(
  manager: EntityManager,
  accountId: number,
  channelId: number
): Promise<number> {
  const rows = await queryRows(
    manager,
    `SELECT count(*)::int AS n
     FROM account_following_channel
     WHERE account_id = $1 AND channel_id = $2`,
    [accountId, channelId]
  );
  return asId(rows[0]?.n);
}

describe('archived follow conversion and empty show deletion', () => {
  let server: Server | undefined;
  let ormContext: ORMContext | undefined;
  let app: import('express').Express;
  let base: string;
  let manager: EntityManager;
  let member: AccountFixture;
  let other: AccountFixture;

  beforeAll(async () => {
    const started = await startTestApp();
    app = started.app;
    server = started.server;
    ormContext = started.ormContext;
    if (!ormContext) {
      throw new Error('ORM context required for archived follow conversion');
    }
    manager = ormContext.dataSourceReadWrite.manager;
    member = await createAccount(`archived-follow-member-${runId}@example.com`);
    other = await createAccount(`archived-follow-other-${runId}@example.com`);
    await grantPremium(manager, member.id);
    await lapseMembership(manager, other.id);
    base = `${await getBaseApiUrl()}`;
  }, 120000);

  afterAll(async () => {
    await stopTestApp(server, ormContext);
  });

  it('moves a member onto Add by RSS and leaves a non-member on the directory follow', async () => {
    const host = `archived-member-${runId}.example`;
    const show = await createShow(manager, {
      url: `https://${host}/podcast.xml`,
      title: `Archived member show ${runId}`,
    });
    const imageUrl = `https://${host}/cover.jpg`;
    await manager.query(`INSERT INTO channel_about (channel_id) VALUES ($1)`, [show.channelId]);
    await manager.query(
      `INSERT INTO channel_image (channel_id, url, image_width_size) VALUES ($1, $2, 1400)`,
      [show.channelId, imageUrl]
    );
    await followChannel(manager, member.id, show.channelId);
    await followChannel(manager, other.id, show.channelId);
    await markArchived(show.feedId);

    const takedown = await createShow(manager, {
      url: `https://takedown-${runId}.example/podcast.xml`,
      title: `Takedown show ${runId}`,
    });
    await manager.query(`INSERT INTO channel_about (channel_id) VALUES ($1)`, [takedown.channelId]);
    await followChannel(manager, other.id, takedown.channelId);
    await new FeedService().setFeedLifecycleState(takedown.feedId, {
      toStateKey: FeedLifecycleStateKeyEnum.Takedown,
      source: FeedLifecycleUpdateSourceEnum.Admin,
    });

    const probed: string[] = [];
    const probe: FeedProbe = async (url) => {
      probed.push(url);
      return url.includes(host);
    };
    await convertArchivedShowFollows(probe);

    expect(probed.some((url) => url.includes(`takedown-${runId}.example`))).toBe(false);
    expect(await conversionState(manager, takedown.channelId)).toEqual({
      status: null,
      attempts: 0,
    });
    expect(await conversionState(manager, show.channelId)).toEqual({
      status: 'converted',
      attempts: 0,
    });
    expect(await directoryFollowCount(manager, member.id, show.channelId)).toBe(0);
    expect(await directoryFollowCount(manager, other.id, show.channelId)).toBe(1);

    const addByRss = await queryRows(
      manager,
      `SELECT feed_url, title, image_url, requires_credentials
       FROM account_following_add_by_rss_channel
       WHERE account_id = $1 AND feed_url LIKE $2`,
      [member.id, `%${host}%`]
    );
    expect(addByRss).toHaveLength(1);
    const follow = addByRss[0];
    expect(follow?.title).toBe(show.title);
    expect(follow?.image_url).toBe(imageUrl);
    expect(follow?.requires_credentials).toBe(false);
    const feedUrl = follow?.feed_url;
    expect(typeof feedUrl).toBe('string');

    const otherAddByRss = await queryRows(
      manager,
      `SELECT feed_url FROM account_following_add_by_rss_channel WHERE account_id = $1 AND feed_url LIKE $2`,
      [other.id, `%${host}%`]
    );
    expect(otherAddByRss).toEqual([]);

    const memberRes = await request(app)
      .get(`${base}/item/channel/recent/${show.idText}?page=1`)
      .set(authHeaders(member.id, member.idText));
    expect(memberRes.status).toBe(410);
    const memberBody: unknown = memberRes.body;
    expect(isRecord(memberBody) ? memberBody.message : undefined).toBe(
      CHANNEL_GONE_ARCHIVED_MESSAGE
    );
    const memberGone = isRecord(memberBody) ? memberBody.gone : undefined;
    expect(isRecord(memberGone) ? memberGone.reason : undefined).toBe('archived');
    expect(isRecord(memberGone) ? memberGone.add_by_rss_feed_url : undefined).toBe(feedUrl);

    const otherRes = await request(app)
      .get(`${base}/item/channel/recent/${show.idText}?page=1`)
      .set(authHeaders(other.id, other.idText));
    expect(otherRes.status).toBe(410);
    const otherBody: unknown = otherRes.body;
    const otherGone = isRecord(otherBody) ? otherBody.gone : undefined;
    expect(isRecord(otherGone) ? otherGone.add_by_rss_feed_url : undefined).toBeNull();

    const anonymousRes = await request(app).get(
      `${base}/item/channel/recent/${show.idText}?page=1`
    );
    expect(anonymousRes.status).toBe(410);
    const anonymousBody: unknown = anonymousRes.body;
    const anonymousGone = isRecord(anonymousBody) ? anonymousBody.gone : undefined;
    expect(isRecord(anonymousGone) ? anonymousGone.add_by_rss_feed_url : undefined).toBeNull();

    const badTokenRes = await request(app)
      .get(`${base}/item/channel/recent/${show.idText}?page=1`)
      .set({ Authorization: 'Bearer not-a-jwt' });
    expect(badTokenRes.status).toBe(410);
    const badTokenBody: unknown = badTokenRes.body;
    const badTokenGone = isRecord(badTokenBody) ? badTokenBody.gone : undefined;
    expect(isRecord(badTokenGone) ? badTokenGone.add_by_rss_feed_url : undefined).toBeNull();

    const takedownRes = await request(app).get(
      `${base}/item/channel/recent/${takedown.idText}?page=1`
    );
    expect(takedownRes.status).toBe(404);
    const takedownBody: unknown = takedownRes.body;
    expect(isRecord(takedownBody) ? takedownBody.message : undefined).toBe('Channel not found');
  });

  it('marks a feed unreachable on the third probe, and not inside 24 hours', async () => {
    const host = `archived-retry-${runId}.example`;
    const show = await createShow(manager, {
      url: `https://${host}/podcast.xml`,
      title: `Archived retry show ${runId}`,
    });
    await followChannel(manager, other.id, show.channelId);
    await markArchived(show.feedId);

    const attemptIncrease = async (run: () => Promise<void>): Promise<number> => {
      const before = await queryRows(
        manager,
        `SELECT follow_conversion_attempts FROM channel WHERE id = $1`,
        [show.channelId]
      );
      const beforeAttempts = asId(before[0]?.follow_conversion_attempts ?? 0);
      await run();
      const after = await conversionState(manager, show.channelId);
      return after.attempts - beforeAttempts;
    };

    expect(
      await attemptIncrease(async () => {
        await convertArchivedShowFollows(async () => false);
      })
    ).toBe(1);
    expect(await conversionState(manager, show.channelId)).toEqual({ status: null, attempts: 1 });

    expect(
      await attemptIncrease(async () => {
        await convertArchivedShowFollows(async () => false);
      })
    ).toBe(0);
    expect(await conversionState(manager, show.channelId)).toEqual({ status: null, attempts: 1 });

    await manager.query(
      `UPDATE channel SET follow_conversion_last_attempt_at = now() - interval '25 hours' WHERE id = $1`,
      [show.channelId]
    );
    expect(
      await attemptIncrease(async () => {
        await convertArchivedShowFollows(async () => false);
      })
    ).toBe(1);
    expect(await conversionState(manager, show.channelId)).toEqual({ status: null, attempts: 2 });

    await manager.query(
      `UPDATE channel SET follow_conversion_last_attempt_at = now() - interval '25 hours' WHERE id = $1`,
      [show.channelId]
    );
    await convertArchivedShowFollows(async () => false);
    expect(await conversionState(manager, show.channelId)).toEqual({
      status: 'unreachable',
      attempts: 3,
    });
  });

  it('skips a merge source and an uncanonicalizable feed URL without probing them', async () => {
    const mergeHost = `archived-merge-source-${runId}.example`;
    const mergeShow = await createShow(manager, {
      url: `https://${mergeHost}/podcast.xml`,
      title: `Merge source ${runId}`,
    });
    await followChannel(manager, other.id, mergeShow.channelId);
    await markArchived(mergeShow.feedId);
    await manager.query(
      `INSERT INTO channel_merge (from_podcast_index_id, to_podcast_index_id, from_channel_id, status)
       VALUES ($1, $2, $3, 'detected')`,
      [mergeShow.podcastIndexId, nextPodcastIndexIdValue(), mergeShow.channelId]
    );

    const invalidUrl = `http://#archived-invalid-${runId}`;
    const invalid = await createShow(manager, {
      url: `https://invalid-feed-placeholder-${runId}.example/podcast.xml`,
      title: `Invalid feed ${runId}`,
    });
    await markArchived(invalid.feedId);
    await manager.query(`UPDATE feed SET url = $2 WHERE id = $1`, [invalid.feedId, invalidUrl]);

    const probed: string[] = [];
    await convertArchivedShowFollows(async (url) => {
      probed.push(url);
      return false;
    });

    expect(probed.some((url) => url.includes(mergeHost))).toBe(false);
    expect(probed).not.toContain(invalidUrl);
    expect((await conversionState(manager, mergeShow.channelId)).status).toBe('skipped');
    expect((await conversionState(manager, invalid.channelId)).status).toBe('skipped');
  });

  it('returns the merge redirect for an applied absorb', async () => {
    const from = await createShow(manager, {
      url: `https://merged-from-${runId}.example/podcast.xml`,
      title: `Merged from ${runId}`,
    });
    const survivor = await createShow(manager, {
      url: `https://merged-survivor-${runId}.example/podcast.xml`,
      title: `Merged survivor ${runId}`,
    });
    await manager.query(`INSERT INTO channel_about (channel_id) VALUES ($1)`, [from.channelId]);
    await new FeedService().setFeedLifecycleState(from.feedId, {
      toStateKey: FeedLifecycleStateKeyEnum.Merged,
      source: FeedLifecycleUpdateSourceEnum.Admin,
    });
    await manager.query(
      `INSERT INTO channel_merge (
         from_podcast_index_id, to_podcast_index_id, from_channel_id, to_channel_id, mode, status
       ) VALUES ($1, $2, $3, $4, 'absorb', 'applied')`,
      [from.podcastIndexId, survivor.podcastIndexId, from.channelId, survivor.channelId]
    );

    const res = await request(app).get(`${base}/item/channel/recent/${from.idText}?page=1`);
    expect(res.status).toBe(410);
    const body: unknown = res.body;
    const merged = isRecord(body) ? body.merged_into : undefined;
    expect(isRecord(merged) ? merged.kind : undefined).toBe('channel');
    expect(isRecord(merged) ? merged.id_text : undefined).toBe(survivor.idText);
    expect(isRecord(body) ? body.gone : undefined).toBeUndefined();
  });

  it('deletes an empty converted show and keeps the feed row', async () => {
    const empty = await createShow(manager, {
      url: `https://empty-removed-${runId}.example/podcast.xml`,
      title: `Empty removed ${runId}`,
    });
    await followChannel(manager, other.id, empty.channelId);
    await markArchived(empty.feedId);
    await manager.query(`UPDATE channel SET follow_conversion_status = 'converted' WHERE id = $1`, [
      empty.channelId,
    ]);

    const withEpisode = await createShow(manager, {
      url: `https://archived-episode-${runId}.example/podcast.xml`,
      title: `Archived episode show ${runId}`,
    });
    await markArchived(withEpisode.feedId);
    await manager.query(`UPDATE channel SET follow_conversion_status = 'converted' WHERE id = $1`, [
      withEpisode.channelId,
    ]);
    const itemRepo = manager.getRepository(Item);
    await itemRepo.save(
      itemRepo.create({
        channel_id: String(withEpisode.channelId),
        title: 'Archived episode',
        guid: `archived-episode-${runId}@example.com`,
        item_flag_status: { id: ItemFlagStatusStatusEnum.Archived },
      })
    );

    const awaiting = await createShow(manager, {
      url: `https://awaiting-conversion-${runId}.example/podcast.xml`,
      title: `Awaiting conversion ${runId}`,
    });
    await markArchived(awaiting.feedId);

    const merged = await createShow(manager, {
      url: `https://merge-protected-${runId}.example/podcast.xml`,
      title: `Merge protected ${runId}`,
    });
    await markArchived(merged.feedId);
    await manager.query(`UPDATE channel SET follow_conversion_status = 'converted' WHERE id = $1`, [
      merged.channelId,
    ]);
    await manager.query(
      `INSERT INTO channel_merge (from_podcast_index_id, to_podcast_index_id, from_channel_id, status)
       VALUES ($1, $2, $3, 'detected')`,
      [merged.podcastIndexId, nextPodcastIndexIdValue(), merged.channelId]
    );

    const result = await deleteEmptyRemovedShows();
    expect(result.deleted).toBeGreaterThanOrEqual(1);

    expect(
      await queryRows(manager, `SELECT id FROM channel WHERE id = $1`, [empty.channelId])
    ).toEqual([]);
    expect(
      await queryRows(manager, `SELECT id FROM feed WHERE id = $1`, [empty.feedId])
    ).toHaveLength(1);
    expect(await directoryFollowCount(manager, other.id, empty.channelId)).toBe(0);

    expect(
      await queryRows(manager, `SELECT id FROM channel WHERE id = $1`, [withEpisode.channelId])
    ).toHaveLength(1);
    expect(
      await queryRows(manager, `SELECT id FROM channel WHERE id = $1`, [awaiting.channelId])
    ).toHaveLength(1);
    expect(
      await queryRows(manager, `SELECT id FROM channel WHERE id = $1`, [merged.channelId])
    ).toHaveLength(1);
  });
});
