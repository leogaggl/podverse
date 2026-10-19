import { getErrorResponseBody, getErrorResponseStatus } from '@podverse/helpers/error';

import { homeFeedRefresh } from '../../lib/home/homeFeedRefresh';
import type { ChannelWindowSyncResult } from './channelItemsRepository';
import { channelItemsRepository } from './channelItemsRepository';
import { identityRemapRepository } from './identityRemapRepository';
import { subscriptionsRepository } from './subscriptionsRepository';
import { syncEventLogRepository } from './syncEventLogRepository';
import type { MobileAuthRequestContext } from './types';

/**
 * Directory episode list 404, or 410 that names the show this one was merged into. Add-by-RSS
 * never uses this path. A merge target rewrites local keys. Anything else drops the follow so
 * the next launch does not ask again.
 */
export const DIRECTORY_CHANNEL_GONE_CODE = 'directory_channel_gone';

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

const shouldResolveBeforeDrop = (error: unknown): boolean => {
  const status = getErrorResponseStatus(error);
  if (status === 404) {
    return true;
  }
  return status === 410 && mergedChannelIdText(error) !== null;
};

export const dropGoneDirectoryChannel = async (params: {
  channelIdText: string;
  channelTitle?: string | null;
  context: MobileAuthRequestContext;
}): Promise<void> => {
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
    errorCode: DIRECTORY_CHANNEL_GONE_CODE,
    jobKind: 'channel-items',
    message: formatDirectoryChannelGoneDetail(params.channelIdText, title),
    occurredAt: Date.now(),
    outcome: 'reconciled',
  });

  homeFeedRefresh.notify();
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
    await dropGoneDirectoryChannel(params);
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
