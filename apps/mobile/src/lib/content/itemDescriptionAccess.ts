import { getDescriptionPreviewText } from '@podverse/helpers';

import { downloadsRepository } from '../../data/repositories/downloadsRepository';
import { itemDescriptionCacheRepository } from '../../data/repositories/itemDescriptionCacheRepository';
import { playableItemRepository } from '../../data/repositories/playableItemRepository';
import { isEffectivelyOffline } from '../../net/connectivity';
import type {
  ItemDescriptionPayload,
  ItemDescriptionSubject,
  ResolvedItemDescription,
  ResolveItemDescriptionDeps,
} from './resolveItemDescription';
import { initialItemDescription, resolveItemDescription } from './resolveItemDescription';

/** The parts of an item DTO the description path reads. */
export type ItemDescriptionSourceItem = {
  id_text: string;
  item_description?: ItemDescriptionPayload | null;
  item_about?: { website_link_url?: string | null } | null;
};

const reportError = (error: unknown): void => {
  if (__DEV__) {
    console.warn('[show-notes] could not load full show notes', error);
  }
};

const isDownloaded = async (itemIdText: string): Promise<boolean> => {
  const record = await downloadsRepository.getByItemIdText(itemIdText);
  return record?.status === 'complete';
};

const deps: ResolveItemDescriptionDeps = {
  canRequest: () => !isEffectivelyOffline(),
  fetchDetail: itemDescriptionCacheRepository.fetchFromServer,
  isDownloaded,
  readCache: itemDescriptionCacheRepository.get,
  reportError,
  writeCache: itemDescriptionCacheRepository.put,
};

const hasPayloadValue = (item: ItemDescriptionSourceItem): boolean => {
  const value = item.item_description?.value;
  return typeof value === 'string' && value.trim() !== '';
};

export const itemDescriptionSubject = (
  item: ItemDescriptionSourceItem,
  addByRss = false
): ItemDescriptionSubject => ({
  addByRss,
  description: item.item_description ?? null,
  itemIdText: item.id_text,
  linkUrl: item.item_about?.website_link_url ?? null,
});

const inFlight = new Map<string, Promise<ResolvedItemDescription>>();

/**
 * Full notes for an item. Callers asking about the same item at the same time share one read.
 * Never rejects: a failed read resolves to the preview and is logged.
 */
export const loadItemDescription = (
  subject: ItemDescriptionSubject
): Promise<ResolvedItemDescription> => {
  const key = subject.itemIdText;
  if (subject.addByRss || key === null || initialItemDescription(subject).source === 'payload') {
    return resolveItemDescription(subject, deps);
  }
  const existing = inFlight.get(key);
  if (existing !== undefined) {
    return existing;
  }
  const promise = resolveItemDescription(subject, deps).finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
};

const warmedItemIds = new Set<string>();

/**
 * Read the now-playing item's notes in the background, once per item per session, so the full
 * player opens with them. A read that found nothing may try again on a later play.
 */
export const warmItemDescription = (item: ItemDescriptionSourceItem): void => {
  if (hasPayloadValue(item) || warmedItemIds.has(item.id_text)) {
    return;
  }
  warmedItemIds.add(item.id_text);
  void loadItemDescription(itemDescriptionSubject(item)).then((resolved) => {
    if (resolved.source === 'none') {
      warmedItemIds.delete(item.id_text);
    }
  });
};

/**
 * Store the notes a single-item read returned. An item with no notes is stored as such. A payload
 * that names a description without its value is a list copy, not an answer, and is skipped.
 */
export const cacheItemDescriptionFromDetail = async (
  item: ItemDescriptionSourceItem
): Promise<void> => {
  const description = item.item_description;
  if (description === undefined) {
    return;
  }
  if (description !== null && typeof description.value !== 'string') {
    return;
  }
  try {
    const rawValue = description === null ? null : description.value;
    const value = typeof rawValue === 'string' && rawValue.trim() !== '' ? rawValue : null;
    await itemDescriptionCacheRepository.put({
      isTruncated: description?.is_truncated === true,
      itemIdText: item.id_text,
      linkUrl: item.item_about?.website_link_url ?? null,
      pinned: await isDownloaded(item.id_text),
      preview: getDescriptionPreviewText(description) || null,
      value,
    });
  } catch (error) {
    reportError(error);
  }
};

/**
 * Keep a downloaded item's notes on the device. They stay pinned until the download is removed,
 * so the Summary of a downloaded episode reads the same with no connection.
 */
export const pinDownloadedItemDescription = async (itemIdText: string): Promise<void> => {
  try {
    const item = await playableItemRepository.getByIdText(itemIdText);
    if (item !== null && hasPayloadValue(item)) {
      await cacheItemDescriptionFromDetail(item);
      await itemDescriptionCacheRepository.pin(itemIdText);
      return;
    }
    if (await itemDescriptionCacheRepository.pin(itemIdText)) {
      return;
    }
    await loadItemDescription(
      item !== null
        ? itemDescriptionSubject(item)
        : { addByRss: false, description: null, itemIdText, linkUrl: null }
    );
    await itemDescriptionCacheRepository.pin(itemIdText);
  } catch (error) {
    reportError(error);
  }
};
