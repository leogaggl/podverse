import { describe, expect, it } from 'vitest';

import { MIGRATIONS } from './migrations';
import type { MigrationDatabase } from './runMigrations';
import { runMigrations } from './runMigrations';
import { safeJsonParse } from './serialization';

const createRecordingDatabase = (userVersion: number) => {
  const executed: string[] = [];
  const database: MigrationDatabase = {
    execAsync: async (source) => {
      executed.push(source);
    },
    getFirstAsync: async () => ({ user_version: userVersion }),
    withTransactionAsync: async (task) => {
      await task();
    },
  };
  return { database, executed };
};

describe('migration 23 item description cache', () => {
  it('creates the cache table on a database at version 22 and records version 23', async () => {
    const { database, executed } = createRecordingDatabase(22);

    await runMigrations(database);

    const sql = executed.join('\n').toLowerCase();
    expect(sql).toContain('create table if not exists item_description_cache');
    for (const column of [
      'item_id_text text primary key not null',
      'value text',
      'preview text',
      'is_truncated integer not null default 0',
      'link_url text',
      'pinned integer not null default 0',
      'fetched_at integer not null',
    ]) {
      expect(sql).toContain(column);
    }
    expect(sql).not.toContain('identity_remap_applied');
    expect(executed).toContain('PRAGMA user_version = 23;');
    expect(executed).not.toContain('PRAGMA user_version = 22;');
  });

  it('leaves stored payload tables alone', () => {
    const migration23 = MIGRATIONS.find((migration) => migration.version === 23);
    const sql = (migration23?.statements ?? []).join('\n').toLowerCase();

    for (const table of ['channel_item', 'playable_item', 'add_by_rss_feed', 'queue_cache']) {
      expect(sql.includes(table)).toBe(false);
    }
  });
});

describe('migration 24 add-by-RSS livestreams flag', () => {
  it('adds may_have_livestreams on version 23 and seeds it from stored bundles', async () => {
    const { database, executed } = createRecordingDatabase(23);

    await runMigrations(database);

    const sql = executed.join('\n').toLowerCase();
    expect(sql).toContain('alter table add_by_rss_feed add column may_have_livestreams');
    expect(sql).toContain('update add_by_rss_feed set may_have_livestreams = 1');
    expect(executed).toContain('PRAGMA user_version = 24;');
    expect(executed).not.toContain('PRAGMA user_version = 23;');
  });
});

describe('migration 25 add-by-RSS listed feeds', () => {
  it('adds the followed and guid columns and the listed-feed table on version 24', async () => {
    const { database, executed } = createRecordingDatabase(24);

    await runMigrations(database);

    const sql = executed.join('\n').toLowerCase();
    for (const statement of [
      'alter table add_by_rss_feed add column followed integer not null default 1',
      'alter table add_by_rss_feed add column podcast_guid text',
      'alter table add_by_rss_feed add column publisher_guids_json text',
      'alter table add_by_rss_feed add column publisher_directory_json text',
      'create table if not exists add_by_rss_listed_feed',
      'primary key (publisher_feed_url, feed_guid)',
    ]) {
      expect(sql).toContain(statement);
    }
    expect(sql).not.toContain('may_have_livestreams');
    expect(executed).toContain('PRAGMA user_version = 25;');
    expect(executed).not.toContain('PRAGMA user_version = 24;');
  });

  it('leaves existing add-by-RSS rows in place', () => {
    const migration25 = MIGRATIONS.find((migration) => migration.version === 25);
    const sql = (migration25?.statements ?? []).join('\n').toLowerCase();

    expect(sql.includes('delete from add_by_rss_feed')).toBe(false);
    expect(sql.includes('drop table')).toBe(false);
  });
});

describe('migration 26 stats listen outbox', () => {
  it('creates the outbox table and its index on a database at version 25', async () => {
    const { database, executed } = createRecordingDatabase(25);

    await runMigrations(database);

    const sql = executed.join('\n').toLowerCase();
    expect(sql).toContain('create table if not exists stats_listen_outbox');
    for (const column of [
      'client_listen_id text primary key not null',
      'account_id_text text not null',
      'target_kind text not null',
      'target_id_text text not null',
      'seconds_heard integer not null',
      'completed integer not null default 0',
      'first_report integer not null default 1',
      'counted_at integer not null',
      'updated_at integer not null',
    ]) {
      expect(sql).toContain(column);
    }
    expect(sql).toContain('create index if not exists idx_stats_listen_outbox_account');
    expect(sql).not.toContain('add_by_rss_listed_feed');
    expect(executed).toContain('PRAGMA user_version = 26;');
    expect(executed).not.toContain('PRAGMA user_version = 25;');
  });
});

describe('migration 20 add-by-RSS credentials', () => {
  it('adds the credential flag and index without a column for secrets', () => {
    const migration20 = MIGRATIONS.find((migration) => migration.version === 20);
    const sql = (migration20?.statements ?? []).join('\n').toLowerCase();

    expect(sql).toContain('requires_credentials integer not null default 0');
    expect(sql).toContain('last_auth_failure text');
    expect(sql).toContain('create table if not exists add_by_rss_credential_index');
    expect(sql.includes('password')).toBe(false);
    expect(sql.includes('username')).toBe(false);
  });
});

describe('migration 16 playback tables', () => {
  it('adds playback_outbox and playback_local_state without editing prior migrations', () => {
    const migration16 = MIGRATIONS.find((migration) => migration.version === 16);
    expect(migration16).toBeDefined();
    expect(migration16?.statements.join('\n')).toContain(
      'CREATE TABLE IF NOT EXISTS playback_outbox'
    );
    expect(migration16?.statements.join('\n')).toContain(
      'CREATE TABLE IF NOT EXISTS playback_local_state'
    );
  });

  it('does not clear or rewrite queue_cache rows during the upgrade', () => {
    const migration16 = MIGRATIONS.find((migration) => migration.version === 16);
    const sql = (migration16?.statements ?? []).join('\n').toLowerCase();

    expect(sql.includes('queue_cache')).toBe(false);
    expect(sql.includes('delete from queue_cache')).toBe(false);
    expect(sql.includes('drop table queue_cache')).toBe(false);
    expect(sql.includes('truncate table queue_cache')).toBe(false);
  });

  it('continues to parse pre-upgrade queue_cache payload JSON', () => {
    const cachedPayloadBeforeUpgrade = JSON.stringify({
      data: [
        {
          id: 101,
          playback_position: '37',
        },
      ],
      meta: {
        count: 1,
      },
    });

    expect(
      safeJsonParse<{ data: unknown[]; meta: { count: number } }>(cachedPayloadBeforeUpgrade)
    ).toEqual({
      data: [
        {
          id: 101,
          playback_position: '37',
        },
      ],
      meta: {
        count: 1,
      },
    });
  });
});
