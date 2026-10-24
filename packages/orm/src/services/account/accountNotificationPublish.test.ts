import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationCategoryEnum } from '@podverse/helpers';

const { callOrder, createMock, findOneMock, loggerMock, ormConfig, saveMock } = vi.hoisted(() => {
  const order: string[] = [];
  return {
    callOrder: order,
    createMock: vi.fn(),
    findOneMock: vi.fn(),
    loggerMock: {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    },
    ormConfig: { nodeEnv: 'test' },
    saveMock: vi.fn(),
  };
});

vi.mock('@orm/db/index.js', () => {
  const repository = {
    create: createMock,
    findOne: findOneMock,
    save: saveMock,
  };
  return {
    AppDataSourceRead: { getRepository: () => repository },
    AppDataSourceReadWrite: { getRepository: () => repository },
  };
});

vi.mock('@orm/context.js', () => ({
  getLoggerService: () => loggerMock,
  getORMConfig: () => ormConfig,
}));

import {
  parseAccountEventMessage,
  registerAccountEventPublisher,
  unregisterAccountEventPublisher,
} from '@orm/lib/accountEventPublisher.js';

import { AccountService } from './account.js';
import { AccountNotificationService } from './accountNotification.js';

const notificationDto = {
  account_id: 41,
  category: NotificationCategoryEnum.General,
  title: 'Scheduled maintenance',
};

const registerRecordingClient = () => {
  const publish = vi.fn(async (_channel: string, message: string) => {
    callOrder.push('publish');
    return message.length;
  });
  registerAccountEventPublisher({ publish });
  return publish;
};

const publishedEvents = (publish: ReturnType<typeof registerRecordingClient>) =>
  publish.mock.calls.flatMap(([, message]) => parseAccountEventMessage(message) ?? []);

describe('notification writes publish account events', () => {
  beforeEach(() => {
    callOrder.length = 0;
    createMock.mockReset();
    findOneMock.mockReset();
    saveMock.mockReset();
    loggerMock.warn.mockReset();
    ormConfig.nodeEnv = 'test';

    createMock.mockImplementation((row: Record<string, unknown>) => ({ ...row }));
    saveMock.mockImplementation(async (value: unknown) => {
      callOrder.push('save');
      if (Array.isArray(value)) {
        return value.map((row: Record<string, unknown>, index) => ({ ...row, id: 900 + index }));
      }
      return value;
    });
  });

  afterEach(() => {
    unregisterAccountEventPublisher();
  });

  it('in a test env, createMany with no publisher registered rejects', async () => {
    const service = new AccountNotificationService();

    await expect(service.createMany([notificationDto])).rejects.toThrow(
      'Account events were written with no account event publisher registered'
    );
  });

  it('createMany publishes one notification.created event after the rows are saved', async () => {
    const publish = registerRecordingClient();
    const service = new AccountNotificationService();

    const saved = await service.createMany([notificationDto]);

    expect(saved).toEqual([expect.objectContaining({ account_id: 41, id: 900 })]);
    expect(callOrder).toEqual(['save', 'publish']);
    expect(publishedEvents(publish)).toEqual([
      { account_id: 41, type: 'notification.created', data: { notification_ids: [900] } },
    ]);
  });

  it('updateNotificationsLastReadAt publishes one notification.read_all event after the save', async () => {
    const publish = registerRecordingClient();
    findOneMock.mockResolvedValue({ id: 41, notifications_last_read_at: null });
    const readAt = new Date('2026-10-01T12:00:00.000Z');

    await new AccountService().updateNotificationsLastReadAt(41, readAt);

    expect(callOrder).toEqual(['save', 'publish']);
    expect(publishedEvents(publish)).toEqual([
      {
        account_id: 41,
        type: 'notification.read_all',
        data: { last_read_at: '2026-10-01T12:00:00.000Z' },
      },
    ]);
  });

  it('outside a test env, createMany with no publisher still resolves with the saved rows', async () => {
    ormConfig.nodeEnv = 'production';
    const service = new AccountNotificationService();

    const saved = await service.createMany([notificationDto]);

    expect(saved).toEqual([expect.objectContaining({ account_id: 41, id: 900 })]);
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'Account events dropped: no account event publisher is registered',
      { count: 1 }
    );
  });
});
