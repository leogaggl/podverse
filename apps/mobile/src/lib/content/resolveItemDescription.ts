import { getDescriptionPreviewText, isDescriptionTruncated } from '@podverse/helpers';
import type { DTOItemDescriptionDetail } from '@podverse/helpers/dto';

import type {
  ItemDescriptionCacheEntry,
  ItemDescriptionCacheWrite,
} from '../../data/repositories/itemDescriptionCacheRepository';

/**
 * The description fields a payload may carry. Every field is optional because rows already on the
 * phone were stored before `preview` and `is_truncated` existed, and slim list payloads may omit
 * `value`.
 */
export type ItemDescriptionPayload = {
  value?: string | null;
  preview?: string | null;
  is_truncated?: boolean;
};

export type ItemDescriptionSubject = {
  itemIdText: string | null;
  /** Add-by-RSS items have no server row, so only the payload can answer for them. */
  addByRss: boolean;
  description: ItemDescriptionPayload | null | undefined;
  /** The item's own link, shown when the notes were shortened. */
  linkUrl: string | null | undefined;
};

export type ItemDescriptionSource = 'payload' | 'cache' | 'network' | 'none';

export type ResolvedItemDescription = {
  /** Full notes. Null when they are not known on this device, or the item has none. */
  html: string | null;
  /** Plain text for a collapsed view; empty when nothing is known. */
  preview: string;
  isTruncated: boolean;
  linkUrl: string | null;
  source: ItemDescriptionSource;
};

export type ResolveItemDescriptionDeps = {
  readCache: (itemIdText: string) => Promise<ItemDescriptionCacheEntry | null>;
  writeCache: (write: ItemDescriptionCacheWrite) => Promise<void>;
  fetchDetail: (itemIdText: string) => Promise<DTOItemDescriptionDetail>;
  /** False while Offline Mode is on or the device has no connection. */
  canRequest: () => boolean;
  isDownloaded: (itemIdText: string) => Promise<boolean>;
  reportError?: (error: unknown) => void;
};

const nonEmpty = (value: string | null | undefined): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

const fromPayload = (
  subject: ItemDescriptionSubject,
  html: string | null,
  source: ItemDescriptionSource
): ResolvedItemDescription => ({
  html,
  isTruncated: isDescriptionTruncated(subject.description),
  linkUrl: nonEmpty(subject.linkUrl),
  preview: getDescriptionPreviewText(subject.description),
  source,
});

/** The text a screen can show before any read finishes: the payload's notes or its preview. */
export const initialItemDescription = (
  subject: ItemDescriptionSubject
): ResolvedItemDescription => {
  const value = nonEmpty(subject.description?.value);
  return fromPayload(subject, value, value !== null ? 'payload' : 'none');
};

/**
 * Full notes for an item, from the first place that has them: the payload, the device cache, then
 * the server when a request is allowed. A server answer is cached, pinned when the item is
 * downloaded. When none of them answers, the preview stands in so a Summary is never empty.
 */
export const resolveItemDescription = async (
  subject: ItemDescriptionSubject,
  deps: ResolveItemDescriptionDeps
): Promise<ResolvedItemDescription> => {
  const initial = initialItemDescription(subject);
  if (initial.source === 'payload') {
    return initial;
  }
  const itemIdText = nonEmpty(subject.itemIdText);
  if (subject.addByRss || itemIdText === null) {
    return initial;
  }

  try {
    const cached = await deps.readCache(itemIdText);
    if (cached !== null) {
      return {
        html: nonEmpty(cached.value),
        isTruncated: cached.isTruncated,
        linkUrl: nonEmpty(cached.linkUrl) ?? initial.linkUrl,
        preview: nonEmpty(cached.preview) ?? initial.preview,
        source: 'cache',
      };
    }
  } catch (error) {
    deps.reportError?.(error);
  }

  if (!deps.canRequest()) {
    return initial;
  }

  try {
    const detail = await deps.fetchDetail(itemIdText);
    const pinned = await deps.isDownloaded(itemIdText).catch(() => false);
    await deps
      .writeCache({
        isTruncated: detail.is_truncated,
        itemIdText,
        linkUrl: detail.link_url,
        pinned,
        preview: detail.preview,
        value: detail.value,
      })
      .catch((error: unknown) => {
        deps.reportError?.(error);
      });
    return {
      html: nonEmpty(detail.value),
      isTruncated: detail.is_truncated,
      linkUrl: nonEmpty(detail.link_url) ?? initial.linkUrl,
      preview: nonEmpty(detail.preview) ?? initial.preview,
      source: 'network',
    };
  } catch (error) {
    deps.reportError?.(error);
    return initial;
  }
};
