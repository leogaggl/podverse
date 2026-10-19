import { deriveMembershipState, evaluateFeatureAccess } from '@podverse/helpers';
import { getErrorResponseBody, getErrorResponseStatus } from '@podverse/helpers/error';

import { homeFeedRefresh } from '../../lib/home/homeFeedRefresh';
import { requestAddByRssRefresh } from '../../sync/requestAddByRssRefresh';
import { accountRepository } from './accountRepository';
import type { ChannelWindowSyncResult } from './channelItemsRepository';
import { channelItemsRepository } from './channelItemsRepository';
import { identityRemapRepository } from './identityRemapRepository';
import { subscriptionsRepository } from './subscriptionsRepository';
import { syncEventLogRepository } from './syncEventLogRepository';
import type { MobileAuthRequestContext } from './types';

/**
 * Directory episode list 404, or 410 that names a merge target or an archived show.
 * Add-by-RSS never uses this path. A merge target rewrites local keys. An archived show
 * with an Add-by-RSS URL drops the directory follow and records that the follow moved.
 * Anything else drops the follow so the next launch does not ask again.
 */
export const DIRECTORY_CHANNEL_GONE_CODE = 'directory_channel_gone';
export const DIRECTORY_CHANNEL_CONVERTED_CODE = 'directory_channel_converted';

export const isDirectoryChannelGoneError = (error: unknown): boolean => {
  return getErrorResponseStatus(error) === 404;
};

export const formatDirectoryChannelGoneDetail = (
  channelIdText: string,
  channelTitle: string | null | undefined
): string => {
  const trimmed = channelTitle?.trim();
  return trimmed !== undefined && trimmed.length > 0
    ? `${trimmed} (${channelIdText})`
    : channelIdText;
};

export type DirectoryChannelSyncOutcome =
  | { kind: 'gone' }
  | { kind: 'remapped'; toIdText: string }
  | { kind: 'synced'; result: ChannelWindowSyncResult };

const mergedChannelIdText = (error: unknown): string | null => {
  const body = getErrorResponseBody(error);
  if (body === undefined) {
    return null;
  }
  const merged = body.merged_into;
  if (merged === null || typeof merged !== 'object' || Array.isArray(merged)) {
    return null;
  }
  if (!('kind' in merged) || !('id_text' in merged)) {
    return null;
  }
  if (merged.kind !== 'channel' || typeof merged.id_text !== 'string' || merged.id_text.length === 0) {
    return null;
  }
  return merged.id_text;
};

/**
 * Non-empty Add-by-RSS URL on an archived 410. `''` is an archived 410 with no URL.
 * `null` is any other response.
 */
const archivedAddByRssFeedUrl = (error: unknown): string | null => {
  if (getErrorResponseStatus(error) !== 410) {
    return null;
  }
  const body = getErrorResponseBody(error);
  if (body === undefined) {
    return null;
  }
  const gone = body.gone;
  if (gone === null || typeof gone !== 'object' || Array.isArray(gone)) {
    return null;
  }
  if (!('reason' in gone) || gone.reason !== 'archived') {
    return null;
  }
  if (!('add_by_rss_feed_url' in gone) || typeof gone.add_by_rss_feed_url !== 'string') {
    return '';
  }
  const url = gone.add_by_rss_feed_url.trim();
  return url.length > 0 ? url : '';
};

const shouldResolveBeforeDrop = (error: unknown): boolean => {
  const status = getErrorResponseStatus(error);
  if (status === 404) {
    return true;
  }
  if (status === 410 && mergedChannelIdText(error) !== null) {
    return true;
  }
  return archivedAddByRssFeedUrl(error) !== null;
};

const enqueueAddByRssRefreshForMember = async (): Promise<void> => {
  const account = await accountRepository.getSnapshot();
  if (account === null) {
    return;
  }
  const access = evaluateFeatureAccess('add_by_rss_refresh', deriveMembershipState(account));
  if (!access.allowed) {
    return;
  }
  requestAddByRssRefresh();
};

const dropDirectoryFollow = async (
  params: {
    channelIdText: string;
    channelTitle?: string | null;
    context: MobileAuthRequestContext;
  },
  errorCode: string
): Promise<void> => {
  const local = await subscriptionsRepository.getByIdText(params.channelIdText);
  const title = params.channelTitle ?? local?.title ?? null;

  if (local === null) {
    await channelItemsRepository.removeChannel(params.channelIdText);
    return;
  }

  await subscriptionsRepository.unsubscribe({
    accountSync: params.context.accessToken === null ? undefined : params.context,
    idText: params.channelIdText,
    source: 'directory',
  });

  await syncEventLogRepository.append({
    errorCode,
    jobKind: 'channel-items',
    message: formatDirectoryChannelGoneDetail(params.channelIdText, title),
    occurredAt: Date.now(),
    outcome: 'reconciled',
  });

  homeFeedRefresh.notify();
};

export const dropGoneDirectoryChannel = async (params: {
  channelIdText: string;
  channelTitle?: string | null;
  context: MobileAuthRequestContext;
}): Promise<void> => {
  await dropDirectoryFollow(params, DIRECTORY_CHANNEL_GONE_CODE);
};

const runOrDropGone = async (
  work: () => Promise<ChannelWindowSyncResult>,
  params: {
    channelIdText: string;
    channelTitle?: string | null;
    context: MobileAuthRequestContext;
  }
): Promise<DirectoryChannelSyncOutcome> => {
  try {
    return { kind: 'synced', result: await work() };
  } catch (error) {
    if (!shouldResolveBeforeDrop(error)) {
      throw error;
    }
    const toIdText = await identityRemapRepository.remapChannel(params.channelIdText);
    if (toIdText !== null) {
      return { kind: 'remapped', toIdText };
    }
    const feedUrl = archivedAddByRssFeedUrl(error);
    if (feedUrl !== null && feedUrl.length > 0) {
      await dropDirectoryFollow(params, DIRECTORY_CHANNEL_CONVERTED_CODE);
      await enqueueAddByRssRefreshForMember();
      return { kind: 'gone' };
    }
    await dropDirectoryFollow(params, DIRECTORY_CHANNEL_GONE_CODE);
    return { kind: 'gone' };
  }
};

export const syncDirectoryChannelOrDropGone = async (
  context: MobileAuthRequestContext,
  channelIdText: string,
  options: { channelTitle?: string | null } = {}
): Promise<DirectoryChannelSyncOutcome> => {
  return runOrDropGone(() => channelItemsRepository.syncChannel(context, channelIdText, options), {
    channelIdText,
    channelTitle: options.channelTitle,
    context,
  });
};

export const extendDirectoryChannelOrDropGone = async (
  context: MobileAuthRequestContext,
  channelIdText: string,
  options: { channelTitle?: string | null } = {}
): Promise<DirectoryChannelSyncOutcome> => {
  return runOrDropGone(() => channelItemsRepository.extendWindow(context, channelIdText, options), {
    channelIdText,
    channelTitle: options.channelTitle,
    context,
  });
};
