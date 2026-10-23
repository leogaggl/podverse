import { describe, expect, it, vi } from 'vitest';

import { MQ_QUEUES } from '@podverse/helpers';

import { mqAddByRSSAdd } from './addByRSS.js';

const createService = () => {
  const fake = {
    initialize: vi.fn(async () => {}),
    sendMessage: vi.fn<(params: Record<string, unknown>) => Promise<void>>(async () => {}),
    close: vi.fn(async () => {}),
  };
  // The service class has private connection state; the function only calls these three methods.
  return { fake, service: fake as never };
};

const baseOptions = {
  ...MQ_QUEUES['add-by-rss-background'],
  accountId: 7,
  feedUrl: 'https://album.example/feed.xml',
  requestId: 'req-album',
  closeAfterSend: false,
};

describe('mqAddByRSSAdd', () => {
  it('copies the publisher request id and withheld decision onto the message', async () => {
    const { fake, service } = createService();

    await mqAddByRSSAdd(service, {
      ...baseOptions,
      dedupeCacheTimeMS: null,
      publisherRequestId: 'req-artist',
      credentialsWithheld: 'withheld_other_domain',
    });

    expect(fake.sendMessage).toHaveBeenCalledTimes(1);
    const params = fake.sendMessage.mock.calls[0]?.[0];
    expect(params?.dedupeCacheTimeMS).toBeNull();
    expect(params?.message).toMatchObject({
      accountId: 7,
      feedUrl: 'https://album.example/feed.xml',
      requestId: 'req-album',
      publisherRequestId: 'req-artist',
      credentialsWithheld: 'withheld_other_domain',
    });
    expect(fake.close).not.toHaveBeenCalled();
  });

  it('leaves both fields off a message that does not set them', async () => {
    const { fake, service } = createService();

    await mqAddByRSSAdd(service, baseOptions);

    const message = fake.sendMessage.mock.calls[0]?.[0]?.message;
    expect(message).toBeDefined();
    expect(message).not.toHaveProperty('publisherRequestId');
    expect(message).not.toHaveProperty('credentialsWithheld');
    expect(message).not.toHaveProperty('credentialsEnvelope');
  });
});
