import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PublishableAccountEvent } from './accountEventPublisher.js';

const { loggerMock, ormConfig } = vi.hoisted(() => ({
  loggerMock: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  ormConfig: { nodeEnv: 'production' },
}));

vi.mock('@orm/context.js', () => ({
  getLoggerService: () => loggerMock,
  getORMConfig: () => ormConfig,
}));

const loadPublisher = async () => {
  vi.resetModules();
  return import('./accountEventPublisher.js');
};

const createdEvent = (account_id: number, notification_id: number): PublishableAccountEvent => ({
  account_id,
  type: 'notification.created',
  data: { notification_ids: [notification_id] },
});

describe('accountEventPublisher', () => {
  beforeEach(() => {
    loggerMock.debug.mockReset();
    loggerMock.error.mockReset();
    loggerMock.info.mockReset();
    loggerMock.warn.mockReset();
    ormConfig.nodeEnv = 'production';
  });

  it('splits 1,100 events into messages of 500, 500, and 100 on the account events channel', async () => {
    const publisher = await loadPublisher();
    const publish = vi.fn(async (_channel: string, _message: string) => 1);
    publisher.registerAccountEventPublisher({ publish });
    const events = Array.from({ length: 1_100 }, (_, index) => createdEvent(index + 1, index + 1));

    await publisher.publishAccountEvents(events);

    expect(publish).toHaveBeenCalledTimes(3);
    const sentBatches = publish.mock.calls.map(([channel, message]) => {
      expect(channel).toBe('podverse:account-events');
      return publisher.parseAccountEventMessage(message);
    });
    expect(sentBatches.map((batch) => batch?.length)).toEqual([500, 500, 100]);
    expect(sentBatches.flatMap((batch) => batch ?? [])).toEqual(events);
  });

  it('does not touch Redis for an empty list', async () => {
    const publisher = await loadPublisher();
    const publish = vi.fn(async () => 1);
    publisher.registerAccountEventPublisher({ publish });

    await publisher.publishAccountEvents([]);

    expect(publish).not.toHaveBeenCalled();
  });

  it('a failing publish resolves, warns once through an outage, and logs the recovery', async () => {
    const publisher = await loadPublisher();
    const publish = vi
      .fn(async () => 1)
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockRejectedValueOnce(new Error('connection refused'));
    publisher.registerAccountEventPublisher({ publish });

    await expect(publisher.publishAccountEvents([createdEvent(1, 10)])).resolves.toBeUndefined();
    expect(loggerMock.warn).toHaveBeenCalledTimes(1);
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'Account event publish failed; open streams catch up on their next connection',
      { error: 'connection refused' }
    );

    await expect(publisher.publishAccountEvents([createdEvent(1, 11)])).resolves.toBeUndefined();
    expect(loggerMock.warn).toHaveBeenCalledTimes(1);
    expect(loggerMock.info).not.toHaveBeenCalled();

    await publisher.publishAccountEvents([createdEvent(1, 12)]);
    expect(loggerMock.info).toHaveBeenCalledTimes(1);
    expect(loggerMock.info).toHaveBeenCalledWith('Account event publishing recovered');
  });

  it('outside a test env, a write with no publisher resolves and warns with the count', async () => {
    const publisher = await loadPublisher();

    await expect(
      publisher.publishAccountEvents([createdEvent(1, 10), createdEvent(2, 11)])
    ).resolves.toBeUndefined();

    expect(loggerMock.warn).toHaveBeenCalledWith(
      'Account events dropped: no account event publisher is registered',
      { count: 2 }
    );
  });

  it('in a test env, a write with no publisher rejects', async () => {
    ormConfig.nodeEnv = 'test';
    const publisher = await loadPublisher();

    await expect(publisher.publishAccountEvents([createdEvent(1, 10)])).rejects.toThrow(
      'Account events were written with no account event publisher registered'
    );
  });

  it('warnIfNoAccountEventPublisher warns only while nothing is registered', async () => {
    const publisher = await loadPublisher();

    publisher.warnIfNoAccountEventPublisher('api');
    expect(loggerMock.warn).toHaveBeenCalledTimes(1);
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'No account event publisher is registered; notification changes from this process will not reach open streams',
      { processName: 'api' }
    );

    publisher.registerAccountEventPublisher({ publish: vi.fn(async () => 1) });
    expect(publisher.hasAccountEventPublisher()).toBe(true);
    publisher.warnIfNoAccountEventPublisher('api');
    expect(loggerMock.warn).toHaveBeenCalledTimes(1);

    publisher.unregisterAccountEventPublisher();
    expect(publisher.hasAccountEventPublisher()).toBe(false);
  });

  it('parseAccountEventMessage keeps valid entries and drops one with a non-integer account_id', async () => {
    const publisher = await loadPublisher();
    const message = JSON.stringify({
      events: [
        { account_id: 7, type: 'notification.read_one', data: { notification_id: 3 } },
        { account_id: 7.5, type: 'notification.read_one', data: { notification_id: 4 } },
        { account_id: 8, type: 'playback.progress', data: null },
      ],
    });

    expect(publisher.parseAccountEventMessage(message)).toEqual([
      { account_id: 7, type: 'notification.read_one', data: { notification_id: 3 } },
      { account_id: 8, type: 'playback.progress', data: null },
    ]);
  });

  it('parseAccountEventMessage returns null for malformed JSON or a value without events', async () => {
    const publisher = await loadPublisher();

    expect(publisher.parseAccountEventMessage('{not json')).toBeNull();
    expect(publisher.parseAccountEventMessage(JSON.stringify({ items: [] }))).toBeNull();
    expect(publisher.parseAccountEventMessage(JSON.stringify([1, 2]))).toBeNull();
  });
});
