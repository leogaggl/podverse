import { isObjectLike, toNonEmptyTrimmedString } from '@podverse/helpers/guards';

type TitledItem = { title?: string | null } | null | undefined;

/** The parts of a `DTOQueueResource` that can name it. An Add by RSS row has no linked item. */
export type QueueResourceTitleSource = {
  add_by_rss_resource_data?: unknown;
  clip?: { item?: TitledItem } | null;
  item?: TitledItem;
  item_soundbite?: { item?: TitledItem } | null;
};

/** The episode title stored in Add by RSS resource data, or null when it has none. */
export const addByRssResourceDataTitle = (resourceData: unknown): string | null => {
  if (!isObjectLike(resourceData)) {
    return null;
  }
  return toNonEmptyTrimmedString(resourceData.title);
};

/** The title a queue row shows in the handoff prompt, or null when the row carries none. */
export const queueResourceTitle = (resource: QueueResourceTitleSource): string | null => {
  const titleFromItem = resource.item?.title;
  if (typeof titleFromItem === 'string' && titleFromItem.length > 0) {
    return titleFromItem;
  }
  const titleFromClipItem = resource.clip?.item?.title;
  if (typeof titleFromClipItem === 'string' && titleFromClipItem.length > 0) {
    return titleFromClipItem;
  }
  const titleFromSoundbiteItem = resource.item_soundbite?.item?.title;
  if (typeof titleFromSoundbiteItem === 'string' && titleFromSoundbiteItem.length > 0) {
    return titleFromSoundbiteItem;
  }
  return addByRssResourceDataTitle(resource.add_by_rss_resource_data);
};
