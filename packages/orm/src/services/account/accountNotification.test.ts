import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationCategoryEnum } from '@podverse/helpers';

const { countMock, createMock, deleteMock, existsByMock, findMock, queryMock, saveMock } =
  vi.hoisted(() => ({
    countMock: vi.fn(),
    createMock: vi.fn(),
    deleteMock: vi.fn(),
    existsByMock: vi.fn(),
    findMock: vi.fn(),
    queryMock: vi.fn(),
    saveMock: vi.fn(),
  }));

const { AccountNotificationEntity } = vi.hoisted(() => ({
  AccountNotificationEntity: class AccountNotification {},
}));

vi.mock('@orm/db/index.js', () => ({
  AppDataSourceRead: {
    getRepository: () => ({
      count: countMock,
      find: findMock,
    }),
  },
  AppDataSourceReadWrite: {
    getRepository: () => ({
      create: createMock,
      delete: deleteMock,
      existsBy: existsByMock,
      query: queryMock,
      save: saveMock,
    }),
  },
}));

vi.mock('@orm/entities/account/accountNotification.js', () => ({
  AccountNotification: AccountNotificationEntity,
}));

const { publishAccountNotificationCreatedMock, publishAccountNotificationSignalsMock } = vi.hoisted(
  () => ({
    publishAccountNotificationCreatedMock: vi.fn(
      async (_rows: Array<{ id: number; account_id: number }>) => undefined
    ),
    publishAccountNotificationSignalsMock: vi.fn(
      async (_signals: Array<{ kind: string; account_id: number; notification_id: number }>) =>
        undefined
    ),
  })
);

vi.mock('./accountNotificationSignal.js', () => ({
  publishAccountNotificationCreated: publishAccountNotificationCreatedMock,
  publishAccountNotificationSignals: publishAccountNotificationSignalsMock,
}));

import { AccountNotificationService } from './accountNotification.js';

describe('AccountNotificationService', () => {
  beforeEach(() => {
    countMock.mockReset();
    createMock.mockReset();
    deleteMock.mockReset();
    existsByMock.mockReset();
    findMock.mockReset();
    queryMock.mockReset();
    saveMock.mockReset();
    publishAccountNotificationCreatedMock.mockClear();
    publishAccountNotificationSignalsMock.mockClear();
  });

  it('createMany publishes the saved rows and still returns them', async () => {
    const savedRows = [
      { id: 501, account_id: 41, title: 'First' },
      { id: 502, account_id: 42, title: 'Second' },
    ];
    createMock.mockImplementation((row: Record<string, unknown>) => row);
    saveMock.mockResolvedValue(savedRows);

    const service = new AccountNotificationService();
    const result = await service.createMany([
      { account_id: 41, category: NotificationCategoryEnum.General, title: 'First' },
      { account_id: 42, category: NotificationCategoryEnum.General, title: 'Second' },
    ]);

    expect(result).toBe(savedRows);
    expect(publishAccountNotificationCreatedMock).toHaveBeenCalledTimes(1);
    expect(publishAccountNotificationCreatedMock).toHaveBeenCalledWith(savedRows);
  });

  it('getManyByIdsForAccount with no ids returns nothing without a query', async () => {
    const service = new AccountNotificationService();

    expect(await service.getManyByIdsForAccount(41, [])).toEqual([]);
    expect(findMock).not.toHaveBeenCalled();
  });

  it('countForAccount counts every row for the account', async () => {
    countMock.mockResolvedValue(25);

    const service = new AccountNotificationService();
    const count = await service.countForAccount(41);

    expect(count).toBe(25);
    expect(countMock).toHaveBeenCalledWith({
      where: { account_id: 41 },
    });
  });

  it('countUnread with no cutoff counts rows not read on their own', async () => {
    countMock.mockResolvedValue(12);

    const service = new AccountNotificationService();
    const count = await service.countUnread(41, null);

    expect(count).toBe(12);
    expect(countMock).toHaveBeenCalledWith({
      where: {
        account_id: 41,
        read_at: expect.any(Object),
      },
    });
  });

  it('countUnread applies created_at filter when last_read_at is set', async () => {
    countMock.mockResolvedValue(4);

    const service = new AccountNotificationService();
    const count = await service.countUnread(41, new Date('2026-04-01T00:00:00.000Z'));

    expect(count).toBe(4);
    expect(countMock).toHaveBeenCalledWith({
      where: expect.objectContaining({
        account_id: 41,
        created_at: expect.any(Object),
        read_at: expect.any(Object),
      }),
    });
  });

  it('markReadById marks one unread row and publishes read_one', async () => {
    queryMock.mockResolvedValue([[{ id: 101 }], 1]);

    const service = new AccountNotificationService();
    const result = await service.markReadById(41, 101);

    expect(result).toEqual({ found: true, marked_ids: [101] });
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('read_at IS NULL'), [41, 101]);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('notifications_last_read_at'),
      [41, 101]
    );
    expect(publishAccountNotificationSignalsMock).toHaveBeenCalledWith([
      { kind: 'read_one', account_id: 41, notification_id: 101 },
    ]);
    expect(existsByMock).not.toHaveBeenCalled();
  });

  it('markReadById on an already read row reports found true with no ids', async () => {
    queryMock.mockResolvedValue([[], 0]);
    existsByMock.mockResolvedValue(true);

    const service = new AccountNotificationService();
    const result = await service.markReadById(41, 101);

    expect(result).toEqual({ found: true, marked_ids: [] });
    expect(existsByMock).toHaveBeenCalledWith({ id: 101, account_id: 41 });
    expect(publishAccountNotificationSignalsMock).toHaveBeenCalledWith([]);
  });

  it('markReadById on a missing row reports found false with no ids', async () => {
    queryMock.mockResolvedValue([[], 0]);
    existsByMock.mockResolvedValue(false);

    const service = new AccountNotificationService();
    const result = await service.markReadById(41, 101);

    expect(result).toEqual({ found: false, marked_ids: [] });
  });

  it('markReadByItem marks matching unread rows and publishes sorted ids', async () => {
    queryMock.mockResolvedValue([[{ id: '8' }, { id: 7 }], 2]);

    const service = new AccountNotificationService();
    const result = await service.markReadByItem(41, 'item123456', 'livestream-started');

    expect(result).toEqual([7, 8]);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("n.payload->>'itemIdText' = $2 AND n.payload->>'type' = $3"),
      [41, 'item123456', 'livestream-started']
    );
    expect(publishAccountNotificationSignalsMock).toHaveBeenCalledWith([
      { kind: 'read_one', account_id: 41, notification_id: 7 },
      { kind: 'read_one', account_id: 41, notification_id: 8 },
    ]);
  });

  it('deleteCreatedBefore reports how many rows the retention window removed', async () => {
    deleteMock.mockResolvedValue({ affected: 7 });

    const service = new AccountNotificationService();
    const deleted = await service.deleteCreatedBefore(new Date('2026-04-01T00:00:00.000Z'));

    expect(deleted).toBe(7);
    expect(deleteMock).toHaveBeenCalledWith({
      created_at: expect.any(Object),
    });
  });

  it('a second purge over the same window finds nothing left to delete', async () => {
    deleteMock.mockResolvedValueOnce({ affected: 7 }).mockResolvedValueOnce({ affected: 0 });

    const service = new AccountNotificationService();
    const cutoff = new Date('2026-04-01T00:00:00.000Z');

    expect(await service.deleteCreatedBefore(cutoff)).toBe(7);
    expect(await service.deleteCreatedBefore(cutoff)).toBe(0);
  });
});
