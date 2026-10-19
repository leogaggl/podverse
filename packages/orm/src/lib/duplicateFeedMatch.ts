/**
 * One-to-one episode matching for a Podcast Index duplicate pair.
 * GUID, then enclosure, then title + publish date + duration. No network and no database.
 */

export type MatchItem = {
  id: number;
  guid: string | null;
  enclosureUrl: string | null;
  title: string | null;
  pubDateMs: number | null;
  durationSeconds: number | null;
};

export type MatchFeed = {
  podcastGuid: string | null;
  itunesId: string | null;
  selfUrl: string | null;
  items: MatchItem[];
};

export type DuplicateMatchTier = 'guid' | 'enclosure' | 'fuzzy';

export type DuplicateItemPair = {
  fromId: number;
  toId: number;
  tier: DuplicateMatchTier;
};

export type PairAssessment = {
  status: 'verified' | 'needs_review';
  confidence: number;
  pairs: DuplicateItemPair[];
  stats: {
    oldCount: number;
    survivorCount: number;
    matched: number;
    byTier: { guid: number; enclosure: number; fuzzy: number };
    sharedPodcastGuid: boolean;
    sharedItunesId: boolean;
    selfLinkAgrees: boolean;
  };
};

const FUZZY_PUB_DATE_WINDOW_MS = 36 * 60 * 60 * 1000;
const FUZZY_DURATION_FLOOR_SECONDS = 30;
const FUZZY_DURATION_RATIO = 0.03;
const VERIFIED_MIN_MATCHES = 3;

const TRACKING_HOSTS = new Set([
  'dts.podtrac.com',
  'www.podtrac.com',
  'op3.dev',
  'chrt.fm',
  'pdst.fm',
  'pfx.vpixl.com',
  'claritaspod.com',
  'mgln.ai',
]);

const MEDIA_FILE_EXTENSION = /\.(?:mp3|m4a|mp4|m4v|aac|ogg|oga|wav|mpeg|mpg)$/i;

const HOSTNAME =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export function guidMatchKey(guid: string | null | undefined): string | null {
  if (guid === null || guid === undefined) {
    return null;
  }
  const trimmed = guid.trim();
  if (trimmed === '') {
    return null;
  }
  return trimmed;
}

export function normalizeEnclosureUrl(url: string): string | null {
  const trimmed = url.trim();
  if (trimmed === '') {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }

  for (let depth = 0; depth < 4; depth += 1) {
    const unwrapped = unwrapTrackingUrl(parsed);
    if (unwrapped === null) {
      break;
    }
    parsed = unwrapped;
  }

  return canonicalMediaUrl(parsed);
}

export function matchDuplicateItems(
  oldItems: readonly MatchItem[],
  survivorItems: readonly MatchItem[]
): DuplicateItemPair[] {
  const pairs: DuplicateItemPair[] = [];
  const usedOld = new Set<number>();
  const usedSurvivor = new Set<number>();

  pairUniqueKeys(oldItems, survivorItems, usedOld, usedSurvivor, pairs, 'guid', (item) =>
    guidMatchKey(item.guid)
  );
  pairUniqueKeys(oldItems, survivorItems, usedOld, usedSurvivor, pairs, 'enclosure', (item) =>
    item.enclosureUrl === null ? null : normalizeEnclosureUrl(item.enclosureUrl)
  );
  pairFuzzy(oldItems, survivorItems, usedOld, usedSurvivor, pairs);

  return pairs;
}

export function assessDuplicatePair(oldFeed: MatchFeed, survivorFeed: MatchFeed): PairAssessment {
  const oldCount = oldFeed.items.length;
  const survivorCount = survivorFeed.items.length;
  const sharedPodcastGuid = podcastGuidsMatch(oldFeed.podcastGuid, survivorFeed.podcastGuid);
  const sharedItunesId = itunesIdsMatch(oldFeed.itunesId, survivorFeed.itunesId);
  const selfLinkAgrees = selfLinksAgree(oldFeed.selfUrl, survivorFeed.selfUrl);
  const smaller = Math.min(oldCount, survivorCount);

  if (smaller === 0) {
    return {
      status: 'needs_review',
      confidence: 0,
      pairs: [],
      stats: {
        oldCount,
        survivorCount,
        matched: 0,
        byTier: { guid: 0, enclosure: 0, fuzzy: 0 },
        sharedPodcastGuid,
        sharedItunesId,
        selfLinkAgrees,
      },
    };
  }

  const pairs = matchDuplicateItems(oldFeed.items, survivorFeed.items);
  const matched = pairs.length;
  const byTier = { guid: 0, enclosure: 0, fuzzy: 0 };
  for (const pair of pairs) {
    byTier[pair.tier] += 1;
  }

  const ratioVerified = matched >= VERIFIED_MIN_MATCHES && matched * 5 >= smaller * 4;
  const identifierVerified =
    matched >= 1 && (sharedPodcastGuid || sharedItunesId || selfLinkAgrees);
  const status = ratioVerified || identifierVerified ? 'verified' : 'needs_review';

  return {
    status,
    confidence: matched / smaller,
    pairs,
    stats: {
      oldCount,
      survivorCount,
      matched,
      byTier,
      sharedPodcastGuid,
      sharedItunesId,
      selfLinkAgrees,
    },
  };
}

function pairUniqueKeys(
  oldItems: readonly MatchItem[],
  survivorItems: readonly MatchItem[],
  usedOld: Set<number>,
  usedSurvivor: Set<number>,
  pairs: DuplicateItemPair[],
  tier: DuplicateMatchTier,
  keyOf: (item: MatchItem) => string | null
): void {
  const oldUnique = uniqueByKey(oldItems, usedOld, keyOf);
  const survivorUnique = uniqueByKey(survivorItems, usedSurvivor, keyOf);

  for (const [key, oldItem] of oldUnique) {
    const survivorItem = survivorUnique.get(key);
    if (survivorItem === undefined) {
      continue;
    }
    pairs.push({ fromId: oldItem.id, toId: survivorItem.id, tier });
    usedOld.add(oldItem.id);
    usedSurvivor.add(survivorItem.id);
  }
}

function uniqueByKey(
  items: readonly MatchItem[],
  used: Set<number>,
  keyOf: (item: MatchItem) => string | null
): Map<string, MatchItem> {
  const groups = new Map<string, MatchItem[]>();
  for (const item of items) {
    if (used.has(item.id)) {
      continue;
    }
    const key = keyOf(item);
    if (key === null) {
      continue;
    }
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, [item]);
    } else {
      group.push(item);
    }
  }

  const unique = new Map<string, MatchItem>();
  for (const [key, group] of groups) {
    const only = group[0];
    if (group.length === 1 && only !== undefined) {
      unique.set(key, only);
    }
  }
  return unique;
}

function pairFuzzy(
  oldItems: readonly MatchItem[],
  survivorItems: readonly MatchItem[],
  usedOld: Set<number>,
  usedSurvivor: Set<number>,
  pairs: DuplicateItemPair[]
): void {
  const oldMatches = new Map<number, number[]>();
  const survivorMatches = new Map<number, number[]>();

  for (const oldItem of oldItems) {
    if (usedOld.has(oldItem.id)) {
      continue;
    }
    for (const survivorItem of survivorItems) {
      if (usedSurvivor.has(survivorItem.id)) {
        continue;
      }
      if (!fuzzyCompatible(oldItem, survivorItem)) {
        continue;
      }
      pushId(oldMatches, oldItem.id, survivorItem.id);
      pushId(survivorMatches, survivorItem.id, oldItem.id);
    }
  }

  for (const [oldId, survivorIds] of oldMatches) {
    const survivorId = survivorIds[0];
    if (survivorIds.length !== 1 || survivorId === undefined) {
      continue;
    }
    const oldIds = survivorMatches.get(survivorId);
    const onlyOldId = oldIds?.[0];
    if (oldIds === undefined || oldIds.length !== 1 || onlyOldId !== oldId) {
      continue;
    }
    pairs.push({ fromId: oldId, toId: survivorId, tier: 'fuzzy' });
    usedOld.add(oldId);
    usedSurvivor.add(survivorId);
  }
}

function pushId(map: Map<number, number[]>, key: number, value: number): void {
  const list = map.get(key);
  if (list === undefined) {
    map.set(key, [value]);
  } else {
    list.push(value);
  }
}

function fuzzyCompatible(oldItem: MatchItem, survivorItem: MatchItem): boolean {
  return (
    titlesMatch(oldItem.title, survivorItem.title) &&
    pubDatesWithinWindow(oldItem.pubDateMs, survivorItem.pubDateMs) &&
    durationsWithinWindow(oldItem.durationSeconds, survivorItem.durationSeconds)
  );
}

function titlesMatch(left: string | null, right: string | null): boolean {
  const a = normalizeTitle(left);
  const b = normalizeTitle(right);
  if (a === null || b === null) {
    return false;
  }
  return a === b;
}

function normalizeTitle(title: string | null): string | null {
  if (title === null) {
    return null;
  }
  const folded = title.trim().toLowerCase().replace(/\s+/g, ' ');
  if (folded === '') {
    return null;
  }
  return folded;
}

function pubDatesWithinWindow(left: number | null, right: number | null): boolean {
  if (left === null || right === null) {
    return false;
  }
  return Math.abs(left - right) <= FUZZY_PUB_DATE_WINDOW_MS;
}

function durationsWithinWindow(left: number | null, right: number | null): boolean {
  if (left === null || right === null) {
    return false;
  }
  const longer = Math.max(left, right);
  const limit = Math.max(FUZZY_DURATION_FLOOR_SECONDS, FUZZY_DURATION_RATIO * longer);
  return Math.abs(left - right) <= limit;
}

function podcastGuidsMatch(left: string | null, right: string | null): boolean {
  if (left === null || right === null) {
    return false;
  }
  const a = left.trim().toLowerCase();
  const b = right.trim().toLowerCase();
  if (a === '' || b === '') {
    return false;
  }
  return a === b;
}

function itunesIdsMatch(left: string | null, right: string | null): boolean {
  if (left === null || right === null) {
    return false;
  }
  const a = left.trim();
  const b = right.trim();
  if (a === '' || b === '') {
    return false;
  }
  return a === b;
}

function selfLinksAgree(left: string | null, right: string | null): boolean {
  const a = hostAndPath(left);
  const b = hostAndPath(right);
  if (a === null || b === null) {
    return false;
  }
  return a === b;
}

function hostAndPath(url: string | null): string | null {
  if (url === null || url.trim() === '') {
    return null;
  }
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    let path = parsed.pathname;
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    return `${parsed.hostname.toLowerCase()}${path}`;
  } catch {
    return null;
  }
}

function unwrapTrackingUrl(url: URL): URL | null {
  const host = url.hostname.toLowerCase();
  const path = safeDecode(url.pathname);
  const embedded = extractEmbeddedHttpUrl(path);
  if (embedded !== null && (TRACKING_HOSTS.has(host) || pathHasTrackingHost(path))) {
    return embedded;
  }
  if (TRACKING_HOSTS.has(host)) {
    return innerUrlFromTrackerPath(url.protocol, path);
  }
  if (pathHasTrackingHost(path)) {
    return urlFromTrackingPathSegment(url.protocol, path);
  }
  return null;
}

function pathHasTrackingHost(path: string): boolean {
  return path
    .split('/')
    .some((segment) => segment !== '' && TRACKING_HOSTS.has(segment.toLowerCase()));
}

function extractEmbeddedHttpUrl(path: string): URL | null {
  const match = /https?:\/\/\S+/i.exec(path);
  if (match === null) {
    return null;
  }
  const raw = match[0];
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function innerUrlFromTrackerPath(protocol: string, path: string): URL | null {
  const parts = path.split('/').filter((segment) => segment !== '');
  let hostIndex = -1;
  for (let i = 0; i < parts.length; i += 1) {
    const segment = parts[i];
    if (segment !== undefined && looksLikeHostname(segment)) {
      hostIndex = i;
      break;
    }
  }
  if (hostIndex === -1) {
    return null;
  }
  const host = parts[hostIndex];
  if (host === undefined) {
    return null;
  }
  const rest = parts.slice(hostIndex + 1).join('/');
  try {
    return new URL(`${protocol}//${host}/${rest}`);
  } catch {
    return null;
  }
}

function urlFromTrackingPathSegment(protocol: string, path: string): URL | null {
  const parts = path.split('/').filter((segment) => segment !== '');
  const index = parts.findIndex((segment) => TRACKING_HOSTS.has(segment.toLowerCase()));
  if (index === -1) {
    return null;
  }
  const rebuilt = parts.slice(index).join('/');
  try {
    return new URL(`${protocol}//${rebuilt}`);
  } catch {
    return null;
  }
}

function looksLikeHostname(segment: string): boolean {
  if (segment.toLowerCase().startsWith('redirect.')) {
    return false;
  }
  if (MEDIA_FILE_EXTENSION.test(segment)) {
    return false;
  }
  return HOSTNAME.test(segment);
}

function canonicalMediaUrl(url: URL): string {
  const protocol = url.protocol.toLowerCase();
  const hostname = url.hostname.toLowerCase();
  const port = url.port === '' ? '' : `:${url.port}`;
  let path = url.pathname;
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  if (path === '') {
    path = '/';
  }
  return `${protocol}//${hostname}${port}${path}`;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
