import type { Server } from 'http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { ORMContext } from '@podverse/orm';

import { startTestApp, stopTestApp } from './helpers/index.js';

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

type OrmApi = {
  ensureStatsEventMonthPartition: typeof import('@podverse/orm').ensureStatsEventMonthPartition;
  dropStatsEventMonthPartitionsBefore: typeof import('@podverse/orm').dropStatsEventMonthPartitionsBefore;
};

const TEST_MONTH_START = '2002-01-01';
const TEST_PARTITION = 'public.stats_open_event_p200201';
const CUTOFF_AFTER_TEST_MONTH = '2002-02-01';

describe('stats event partition wrappers (real database)', () => {
  let server: Server | undefined;
  let ormContext: ORMContext | undefined;
  let orm: OrmApi;

  const partitionExists = async (): Promise<boolean> => {
    if (!ormContext) {
      throw new Error('ORM context required');
    }
    const result: unknown = await ormContext.dataSourceReadWrite.manager.query(
      'SELECT to_regclass($1) IS NOT NULL AS present',
      [TEST_PARTITION]
    );
    if (!Array.isArray(result)) {
      throw new Error('expected rows');
    }
    const row: unknown = result[0];
    return typeof row === 'object' && row !== null && Reflect.get(row, 'present') === true;
  };

  beforeAll(async () => {
    const started = await startTestApp();
    server = started.server;
    ormContext = started.ormContext;
    if (!ormContext) {
      throw new Error('ORM context required for the stats event partitions integration test');
    }
    const loaded = await import('@podverse/orm');
    orm = {
      ensureStatsEventMonthPartition: loaded.ensureStatsEventMonthPartition,
      dropStatsEventMonthPartitionsBefore: loaded.dropStatsEventMonthPartitionsBefore,
    };
    await orm.dropStatsEventMonthPartitionsBefore('stats_open_event', CUTOFF_AFTER_TEST_MONTH);
  }, 60000);

  afterAll(async () => {
    if (ormContext) {
      await orm.dropStatsEventMonthPartitionsBefore('stats_open_event', CUTOFF_AFTER_TEST_MONTH);
    }
    await stopTestApp(server, ormContext);
  });

  it('creates a month partition once and reports false when it already exists', async () => {
    expect(await orm.ensureStatsEventMonthPartition('stats_open_event', TEST_MONTH_START)).toBe(
      true
    );
    expect(await orm.ensureStatsEventMonthPartition('stats_open_event', TEST_MONTH_START)).toBe(
      false
    );
    expect(await partitionExists()).toBe(true);
  });

  it('drops the month partition once the cutoff reaches its upper bound', async () => {
    expect(
      await orm.dropStatsEventMonthPartitionsBefore('stats_open_event', CUTOFF_AFTER_TEST_MONTH)
    ).toBe(1);
    expect(await partitionExists()).toBe(false);
  });
});
