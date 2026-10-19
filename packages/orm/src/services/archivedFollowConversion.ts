import { AppDataSourceReadWrite } from '@orm/db/index.js';
import type { FollowConversionStatus } from '@orm/entities/channel/channel.js';

import { deriveMembershipState, evaluateFeatureAccess } from '@podverse/helpers';
import { resolveAddByRSSFeedUrlCredentials } from '@podverse/helpers-validation';

export const FOLLOW_CONVERSION_MAX_CHANNELS_PER_RUN = 100;
export const FOLLOW_CONVERSION_MAX_ATTEMPTS = 3;
export const FOLLOW_CONVERSION_RETRY_HOURS = 24;

export type FeedProbe = (url: string) => Promise<boolean>;

export type FollowConversionResult = {
  converted: number;
  followsMoved: number;
  unreachable: number;
  skipped: number;
};

const ARCHIVED_CHANNELS_SQL = `
SELECT c.id, c.title, f.url AS feed_url
FROM channel c
INNER JOIN feed f ON f.id = c.feed_id
INNER JOIN feed_lifecycle_state fls ON fls.feed_id = f.id
INNER JOIN feed_lifecycle_state_type flst ON flst.id = fls.feed_lifecycle_state_type_id
WHERE flst.state_key = 'archived'
  AND c.follow_conversion_status IS NULL
  AND (
    c.follow_conversion_last_attempt_at IS NULL
    OR c.follow_conversion_last_attempt_at < now() - ($1::int * interval '1 hour')
  )
ORDER BY c.id
LIMIT $2
`;

type ChannelCandidate = {
  id: number;
  title: string | null;
  feedUrl: string;
};

type Follower = {
  accountId: number;
  membershipId: number | null;
  membershipExpiresAt: Date | string | null;
};

function integerFrom(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === 'string' && value !== '') {
    const parsed = Number(value);
    if (Number.isInteger(parsed)) {
      return parsed;
    }
  }
  return null;
}

async function queryRows(sql: string, params: unknown[]): Promise<unknown[]> {
  const result: unknown = await AppDataSourceReadWrite.query(sql, params);
  return Array.isArray(result) ? result : [];
}

function readChannelCandidate(value: unknown): ChannelCandidate | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const id = integerFrom(Reflect.get(value, 'id'));
  const feedUrl = Reflect.get(value, 'feed_url');
  const title = Reflect.get(value, 'title');
  if (id === null || typeof feedUrl !== 'string') {
    return null;
  }
  return { id, feedUrl, title: typeof title === 'string' ? title : null };
}

function readFollower(value: unknown): Follower | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const accountId = integerFrom(Reflect.get(value, 'account_id'));
  if (accountId === null) {
    return null;
  }
  const expires = Reflect.get(value, 'membership_expires_at');
  return {
    accountId,
    membershipId: integerFrom(Reflect.get(value, 'account_membership_id')),
    membershipExpiresAt: expires instanceof Date || typeof expires === 'string' ? expires : null,
  };
}

async function setStatus(channelId: number, status: FollowConversionStatus): Promise<void> {
  await AppDataSourceReadWrite.query(
    `UPDATE channel SET follow_conversion_status = $2 WHERE id = $1`,
    [channelId, status]
  );
}

async function isMergeSource(channelId: number): Promise<boolean> {
  const rows = await queryRows(
    `SELECT 1 AS found FROM channel_merge WHERE from_channel_id = $1 LIMIT 1`,
    [channelId]
  );
  return rows.length > 0;
}

async function loadFollowers(channelId: number): Promise<Follower[]> {
  const rows = await queryRows(
    `SELECT afc.account_id, ams.account_membership_id, ams.membership_expires_at
     FROM account_following_channel afc
     LEFT JOIN account_membership_status ams ON ams.account_id = afc.account_id
     WHERE afc.channel_id = $1
     ORDER BY afc.account_id`,
    [channelId]
  );
  const followers: Follower[] = [];
  for (const row of rows) {
    const follower = readFollower(row);
    if (follower) {
      followers.push(follower);
    }
  }
  return followers;
}

async function firstImageUrl(channelId: number): Promise<string | null> {
  const rows = await queryRows(
    `SELECT url FROM channel_image WHERE channel_id = $1 ORDER BY id ASC LIMIT 1`,
    [channelId]
  );
  const row = rows[0];
  if (typeof row !== 'object' || row === null) {
    return null;
  }
  const url = Reflect.get(row, 'url');
  return typeof url === 'string' && url !== '' ? url : null;
}

function followerMayAddByRss(follower: Follower): boolean {
  const state = deriveMembershipState(
    follower.membershipId === null
      ? { account_membership_status: null }
      : {
          account_membership_status: {
            account_membership_id: follower.membershipId,
            membership_expires_at: follower.membershipExpiresAt,
          },
        }
  );
  return evaluateFeatureAccess('add_by_rss_add', state).allowed;
}

async function moveFollower(input: {
  accountId: number;
  channelId: number;
  feedUrl: string;
  title: string | null;
  imageUrl: string | null;
}): Promise<void> {
  await AppDataSourceReadWrite.transaction(async (manager) => {
    await manager.query(
      `INSERT INTO account_following_add_by_rss_channel
         (account_id, feed_url, title, image_url, requires_credentials)
       VALUES ($1, $2, $3, $4, false)
       ON CONFLICT (account_id, feed_url) DO NOTHING`,
      [input.accountId, input.feedUrl, input.title, input.imageUrl]
    );
    await manager.query(
      `DELETE FROM account_following_channel WHERE account_id = $1 AND channel_id = $2`,
      [input.accountId, input.channelId]
    );
  });
}

async function recordProbeFailure(channelId: number): Promise<boolean> {
  const rows = await queryRows(
    `UPDATE channel
     SET follow_conversion_attempts = follow_conversion_attempts + 1,
         follow_conversion_last_attempt_at = now(),
         follow_conversion_status = CASE
           WHEN follow_conversion_attempts + 1 >= $2 THEN 'unreachable'
           ELSE follow_conversion_status
         END
     WHERE id = $1
     RETURNING follow_conversion_status`,
    [channelId, FOLLOW_CONVERSION_MAX_ATTEMPTS]
  );
  const row = rows[0];
  if (typeof row !== 'object' || row === null) {
    return false;
  }
  return Reflect.get(row, 'follow_conversion_status') === 'unreachable';
}

/**
 * The feed URL stored on an Add-by-RSS follow, when this account already has that row.
 * Anyone else receives null, including a signed-out caller.
 */
export async function archivedShowFeedUrlForFollower(
  accountId: number,
  rawFeedUrl: string
): Promise<string | null> {
  const resolved = resolveAddByRSSFeedUrlCredentials(rawFeedUrl);
  if (resolved === null) {
    return null;
  }
  const rows = await queryRows(
    `SELECT feed_url
     FROM account_following_add_by_rss_channel
     WHERE account_id = $1 AND feed_url = $2
     LIMIT 1`,
    [accountId, resolved.feedUrl]
  );
  const row = rows[0];
  if (typeof row !== 'object' || row === null) {
    return null;
  }
  const feedUrl = Reflect.get(row, 'feed_url');
  return typeof feedUrl === 'string' && feedUrl !== '' ? feedUrl : null;
}

export async function convertArchivedShowFollows(
  probe: FeedProbe
): Promise<FollowConversionResult> {
  const counts: FollowConversionResult = {
    converted: 0,
    followsMoved: 0,
    unreachable: 0,
    skipped: 0,
  };
  const selected = await queryRows(ARCHIVED_CHANNELS_SQL, [
    FOLLOW_CONVERSION_RETRY_HOURS,
    FOLLOW_CONVERSION_MAX_CHANNELS_PER_RUN,
  ]);

  for (const raw of selected) {
    const channel = readChannelCandidate(raw);
    if (!channel) {
      continue;
    }

    const canonical = resolveAddByRSSFeedUrlCredentials(channel.feedUrl.trim());
    if ((await isMergeSource(channel.id)) || channel.feedUrl.trim() === '' || canonical === null) {
      await setStatus(channel.id, 'skipped');
      counts.skipped += 1;
      continue;
    }

    const followers = await loadFollowers(channel.id);
    if (followers.length === 0) {
      await setStatus(channel.id, 'no_followers');
      continue;
    }

    const reachable = await probe(canonical.feedUrl);
    if (!reachable) {
      const unreachable = await recordProbeFailure(channel.id);
      if (unreachable) {
        counts.unreachable += 1;
      }
      continue;
    }

    const imageUrl = await firstImageUrl(channel.id);
    for (const follower of followers) {
      if (!followerMayAddByRss(follower)) {
        continue;
      }
      await moveFollower({
        accountId: follower.accountId,
        channelId: channel.id,
        feedUrl: canonical.feedUrl,
        title: channel.title,
        imageUrl,
      });
      counts.followsMoved += 1;
    }

    await setStatus(channel.id, 'converted');
    counts.converted += 1;
  }

  return counts;
}
