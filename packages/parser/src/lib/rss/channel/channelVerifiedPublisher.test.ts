import { beforeEach, describe, expect, it, vi } from 'vitest';

const { logErrorMock, recomputeForChannelMock } = vi.hoisted(() => ({
  logErrorMock: vi.fn(),
  recomputeForChannelMock: vi.fn(),
}));

vi.mock('@parser/factories/loggerService.js', () => ({
  loggerService: {
    logError: logErrorMock,
  },
}));

vi.mock('@podverse/orm', () => ({
  Channel: class Channel {
    id = 0;
  },
  ChannelVerifiedPublisherService: class {
    recomputeForChannel = recomputeForChannelMock;
  },
}));

import { Channel } from '@podverse/orm';

import { handleParsedChannelVerifiedPublisher } from './channelVerifiedPublisher.js';

function channelWithId(id: number): Channel {
  const channel = new Channel();
  channel.id = id;
  return channel;
}

describe('handleParsedChannelVerifiedPublisher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recomputeForChannelMock.mockResolvedValue({ links: 0, contentChannelsRechecked: 0 });
  });

  it('recomputes verified publisher links for the channel id', async () => {
    await handleParsedChannelVerifiedPublisher(channelWithId(42));

    expect(recomputeForChannelMock).toHaveBeenCalledTimes(1);
    expect(recomputeForChannelMock).toHaveBeenCalledWith(42);
    expect(logErrorMock).not.toHaveBeenCalled();
  });

  it('resolves and logs once when recompute fails', async () => {
    const failure = new Error('recompute failed');
    recomputeForChannelMock.mockRejectedValue(failure);

    await expect(handleParsedChannelVerifiedPublisher(channelWithId(42))).resolves.toBeUndefined();

    expect(recomputeForChannelMock).toHaveBeenCalledWith(42);
    expect(logErrorMock).toHaveBeenCalledTimes(1);
    expect(logErrorMock).toHaveBeenCalledWith(
      'handleParsedChannelVerifiedPublisher channel_id=42',
      failure
    );
  });
});
