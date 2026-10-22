import { describe, expect, it, vi } from 'vitest';

import { markChannelMayHaveLiveItems } from './channelLiveItemFlag.js';

const channel = {
  id: 41,
  may_have_live_items: false,
  medium_id: 12,
};

describe('markChannelMayHaveLiveItems', () => {
  it('does not update when the parse carries no live items', async () => {
    const update = vi.fn();

    const wrote = await markChannelMayHaveLiveItems(channel, 0, { update });

    expect(wrote).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('sets the flag once and writes the channel medium back unchanged', async () => {
    const update = vi.fn();

    const wrote = await markChannelMayHaveLiveItems(channel, 2, { update });

    expect(wrote).toBe(true);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(channel.id, {
      may_have_live_items: true,
      medium_id: channel.medium_id,
    });
  });

  it('does not rewrite a flag that is already true', async () => {
    const update = vi.fn();

    const wrote = await markChannelMayHaveLiveItems({ ...channel, may_have_live_items: true }, 2, {
      update,
    });

    expect(wrote).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});
