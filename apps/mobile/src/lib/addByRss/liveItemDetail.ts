import { LiveItemStatusEnum, pickItemDescriptionSource } from '@podverse/helpers';
import type { AddByRSSResourceData } from '@podverse/helpers/dto';
import { toNonEmptyTrimmedString } from '@podverse/helpers/guards';
import { isValidHttpUrl } from '@podverse/helpers-validation/client';
import type { AddByRSSMappedFeed } from '@podverse/parser-mapping';

import { isAddByRssLivestreamResourceData } from './resourceData';

type AddByRssLiveBundle = AddByRSSMappedFeed['liveItems'][number];

export type AddByRssLivePerson = {
  href: string | null;
  img: string | null;
  name: string;
  role: string | null;
};

export type AddByRssLiveItemDetail = {
  descriptionHtml: string | null;
  imageUrl: string | null;
  liveBundle: AddByRssLiveBundle;
  liveIndex: number;
  liveItemKey: string;
  people: AddByRssLivePerson[];
  startTime: Date | string | null;
  statusId: LiveItemStatusEnum;
  title: string | null;
};

const httpUrlOrNull = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined || isValidHttpUrl(value) !== true) {
    return null;
  }
  return value;
};

const livePeople = (liveBundle: AddByRssLiveBundle): AddByRssLivePerson[] => {
  const people: AddByRssLivePerson[] = [];
  for (const person of liveBundle.item.podcastPeople ?? []) {
    const name = toNonEmptyTrimmedString(person.name);
    if (name === null) {
      continue;
    }
    const role = toNonEmptyTrimmedString(person.role);
    people.push({
      href: httpUrlOrNull(person.href),
      img: httpUrlOrNull(person.img),
      name,
      role: role === null ? null : role.toLowerCase(),
    });
  }
  return people;
};

const toAddByRssLiveItemDetail = (
  liveBundle: AddByRssLiveBundle,
  liveIndex: number
): AddByRssLiveItemDetail => {
  const descriptionHtml = toNonEmptyTrimmedString(
    pickItemDescriptionSource({
      content: liveBundle.item.content ?? undefined,
      description: liveBundle.item.description ?? undefined,
      descriptionRaw: liveBundle.item.descriptionRaw ?? undefined,
      summary: liveBundle.item.summary ?? undefined,
    })
  );

  return {
    descriptionHtml,
    imageUrl:
      toNonEmptyTrimmedString(liveBundle.item.image) ??
      toNonEmptyTrimmedString(liveBundle.item.itunesImage),
    liveBundle,
    liveIndex,
    liveItemKey: addByRssLiveItemKey(liveBundle, liveIndex),
    people: livePeople(liveBundle),
    startTime: liveBundle.liveItem.start_time ?? null,
    statusId: liveBundle.liveItem.live_item_status,
    title: toNonEmptyTrimmedString(liveBundle.item.title),
  };
};

/** The trimmed live-item guid, or the bundle index when the guid is blank. */
export const addByRssLiveItemKey = (liveBundle: AddByRssLiveBundle, liveIndex: number): string =>
  toNonEmptyTrimmedString(liveBundle.item.guid) ?? String(liveIndex);

/**
 * The live item key for a playing Add by RSS livestream on this device's stored feed: by guid
 * (a guidless live item carries `${feedIdText}-${liveIndex}`), then by stream URL. Null when the
 * resource is not a livestream or the feed no longer lists it.
 */
export const resolveAddByRssLiveItemKey = (
  mappedFeed: AddByRSSMappedFeed,
  resourceData: AddByRSSResourceData,
  feedIdText: string
): string | null => {
  if (!isAddByRssLivestreamResourceData(resourceData)) {
    return null;
  }
  const guid = toNonEmptyTrimmedString(resourceData.guid);
  if (guid !== null) {
    const byGuid = mappedFeed.liveItems.findIndex((liveBundle, liveIndex) => {
      const bundleGuid = toNonEmptyTrimmedString(liveBundle.item.guid);
      return bundleGuid === null ? guid === `${feedIdText}-${liveIndex}` : bundleGuid === guid;
    });
    const liveBundle = mappedFeed.liveItems[byGuid];
    if (liveBundle !== undefined) {
      return addByRssLiveItemKey(liveBundle, byGuid);
    }
  }
  const enclosureUrl = toNonEmptyTrimmedString(resourceData.enclosure_url);
  if (enclosureUrl === null) {
    return null;
  }
  const byEnclosure = mappedFeed.liveItems.findIndex(
    (liveBundle) => toNonEmptyTrimmedString(liveBundle.item.enclosure.url) === enclosureUrl
  );
  const liveBundle = mappedFeed.liveItems[byEnclosure];
  return liveBundle === undefined ? null : addByRssLiveItemKey(liveBundle, byEnclosure);
};

/** The live item whose key matches, or null when this feed has none. */
export const findAddByRssLiveItemDetail = (
  mappedFeed: AddByRSSMappedFeed,
  liveItemKey: string
): AddByRssLiveItemDetail | null => {
  for (let liveIndex = 0; liveIndex < mappedFeed.liveItems.length; liveIndex += 1) {
    const liveBundle = mappedFeed.liveItems[liveIndex];
    if (liveBundle === undefined) {
      continue;
    }
    if (addByRssLiveItemKey(liveBundle, liveIndex) !== liveItemKey) {
      continue;
    }
    return toAddByRssLiveItemDetail(liveBundle, liveIndex);
  }
  return null;
};

/** Catalog key for the status word on a livestream's date line. */
export const addByRssLiveStatusLabelKey = (
  statusId: LiveItemStatusEnum
): 'media.livestream.ended' | 'media.livestream.live' | 'media.livestream.pending' => {
  switch (statusId) {
    case LiveItemStatusEnum.Live:
      return 'media.livestream.live';
    case LiveItemStatusEnum.Pending:
      return 'media.livestream.pending';
    case LiveItemStatusEnum.Ended:
      return 'media.livestream.ended';
    default:
      throw new Error(`Unexpected livestream status ${String(statusId)}`);
  }
};
