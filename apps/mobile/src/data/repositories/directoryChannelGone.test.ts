import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountMembershipEnum } from '@podverse/helpers';

const getByIdText = vi.fn();
const unsubscribe = vi.fn();
const remapChannel = vi.fn();
const append = vi.fn();
const syncChannel = vi.fn();
const extendWindow = vi.fn();
const removeChannel = vi.fn();
const notify = vi.fn();
const getSnapshot = vi.fn();
const requestAddByRssRefresh = vi.fn();

vi.mock('./subscriptionsRepository', () => ({
  subscriptionsRepository: {
    getByIdText: (...args: unknown[]) => getByIdText(...args),
    unsubscribe: (...args: unknown[]) => unsubscribe(...args),
  },
}));

vi.mock('./identityRemapRepository', () => ({
  identityRemapRepository: {
    remapChannel: (...args: unknown[]) => remapChannel(...args),
  },
}));

vi.mock('./syncEventLogRepository', () => ({
  syncEventLogRepository: {
    append: (...args: unknown[]) => append(...args),
  },
}));

vi.mock('./channelItemsRepository', () => ({
  channelItemsRepository: {
    extendWindow: (...args: unknown[]) => extendWindow(...args),
    removeChannel: (...args: unknown[]) => removeChannel(...args),
    syncChannel: (...args: unknown[]) => syncChannel(...args),
  },
}));

vi.mock('../../lib/home/homeFeedRefresh', () => ({
  homeFeedRefresh: {
    notify: (...args: unknown[]) => notify(...args),
  },
}));

vi.mock('./accountRepository', () => ({
  accountRepository: {
    getSnapshot: (...args: unknown[]) => getSnapshot(...args),
  },
}));

vi.mock('../../sync/requestAddByRssRefresh', () => ({
  requestAddByRssRefresh: (...args: unknown[]) => requestAddByRssRefresh(...args),
}));

import {
  DIRECTORY_CHANNEL_CONVERTED_CODE,
  DIRECTORY_CHANNEL_GONE_CODE,
  dropGoneDirectoryChannel,
  formatDirectoryChannelGoneDetail,
  isDirectoryChannelGoneError,
  syncDirectoryChannelOrDropGone,
} from './directoryChannelGone';

const httpError = (
  status: number,
  data?: Record<string, unknown>
): { response: { data?: Record<string, unknown>; status: number } } => {
  return { response: { data, status } };
};

const context = {
  accessToken: 'token',
  clearSession: async () => undefined,
  refreshToken: 'refresh',
  setTokens: async () => undefined,
};

const memberAccount = {
  account_membership_status: {
    account_membership_id: AccountMembershipEnum.Premium,
    membership_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  },
  id: 1,
  id_text: 'acct',
  verified: true,
};

const archivedBody = (feedUrl: string | null): Record<string, unknown> => {
  return {
    gone: {
      add_by_rss_feed_url: feedUrl,
      reason: 'archived',
    },
  };
};

describe('isDirectoryChannelGoneError', () => {
  it('treats an item-list 404 as a directory channel the device should drop', () => {
    expect(isDirectoryChannelGoneError(httpError(404))).toBe(true);
  });

  it('leaves other answers and transport failures to the retry path', () => {
    expect(isDirectoryChannelGoneError(httpError(403))).toBe(false);
    expect(isDirectoryChannelGoneError(httpError(500))).toBe(false);
    expect(isDirectoryChannelGoneError(new Error('network request failed'))).toBe(false);
  });
});

describe('formatDirectoryChannelGoneDetail', () => {
  it('names the channel so the error log can quote which follow was removed', () => {
    expect(formatDirectoryChannelGoneDetail('abc123', 'Podcasting 2.0')).toBe(
      'Podcasting 2.0 (abc123)'
    );
  });

  it('falls back to the id when the local row has no title', () => {
    expect(formatDirectoryChannelGoneDetail('abc123', '  ')).toBe('abc123');
    expect(formatDirectoryChannelGoneDetail('abc123', null)).toBe('abc123');
  });
});

describe('syncDirectoryChannelOrDropGone', () => {
  beforeEach(() => {
    getByIdText.mockReset();
    unsubscribe.mockReset();
    remapChannel.mockReset();
    append.mockReset();
    syncChannel.mockReset();
    extendWindow.mockReset();
    removeChannel.mockReset();
    notify.mockReset();
    getSnapshot.mockReset();
    requestAddByRssRefresh.mockReset();

    getByIdText.mockResolvedValue({ title: 'Archived Show' });
    unsubscribe.mockResolvedValue(undefined);
    append.mockResolvedValue(undefined);
    removeChannel.mockResolvedValue(undefined);
    notify.mockReturnValue(undefined);
    remapChannel.mockResolvedValue(null);
    getSnapshot.mockResolvedValue(memberAccount);
  });

  it('drops an archived follow, logs the move, and enqueues one refresh for a member', async () => {
    syncChannel.mockRejectedValue(httpError(410, archivedBody('https://example.com/feed.xml')));

    const outcome = await syncDirectoryChannelOrDropGone(context, 'show-1');

    expect(outcome).toEqual({ kind: 'gone' });
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(append).toHaveBeenCalledTimes(1);
    expect(append.mock.calls[0]?.[0]).toMatchObject({
      errorCode: DIRECTORY_CHANNEL_CONVERTED_CODE,
      outcome: 'reconciled',
    });
    expect(requestAddByRssRefresh).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes a gone follow and skips the local line when the account is signed in', async () => {
    syncChannel.mockRejectedValue(httpError(410, archivedBody(null)));

    await syncDirectoryChannelOrDropGone(context, 'show-1');

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(append).not.toHaveBeenCalled();
    expect(requestAddByRssRefresh).not.toHaveBeenCalled();
  });

  it('does not enqueue a refresh for a signed-in account without a membership', async () => {
    getSnapshot.mockResolvedValue({ id: 1, id_text: 'acct', verified: true });
    syncChannel.mockRejectedValue(httpError(410, archivedBody('https://example.com/feed.xml')));

    await syncDirectoryChannelOrDropGone(context, 'show-1');

    expect(append.mock.calls[0]?.[0]).toMatchObject({
      errorCode: DIRECTORY_CHANNEL_CONVERTED_CODE,
    });
    expect(requestAddByRssRefresh).not.toHaveBeenCalled();
  });

  it('remaps a merge response and leaves the follow in place', async () => {
    remapChannel.mockResolvedValue('dest-show');
    syncChannel.mockRejectedValue(
      httpError(410, { merged_into: { id_text: 'dest-show', kind: 'channel' } })
    );

    const outcome = await syncDirectoryChannelOrDropGone(context, 'show-1');

    expect(outcome).toEqual({ kind: 'remapped', toIdText: 'dest-show' });
    expect(unsubscribe).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
    expect(requestAddByRssRefresh).not.toHaveBeenCalled();
  });

  it('skips the local gone line when accessToken is set', async () => {
    await dropGoneDirectoryChannel({ channelIdText: 'show-1', context });

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(append).not.toHaveBeenCalled();
  });

  it('records the local gone line when accessToken is null', async () => {
    await dropGoneDirectoryChannel({
      channelIdText: 'show-1',
      context: { ...context, accessToken: null },
    });

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(append).toHaveBeenCalledTimes(1);
    expect(append.mock.calls[0]?.[0]).toMatchObject({
      errorCode: DIRECTORY_CHANNEL_GONE_CODE,
      outcome: 'reconciled',
    });
  });
});
