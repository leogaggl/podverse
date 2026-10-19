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
