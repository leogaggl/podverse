/**
 * Add-by-RSS hash: compute add_by_rss_hash_id from a minimal, stable set of fields.
 *
 * Feed form (the episode has the same id on every device): `feed_url` + `guid`, or
 * `feed_url` + `enclosure_url` when the guid is missing or device-local.
 *
 * Per-device form (payloads without `feed_url`): `channel_id_text` + `guid`, or
 * `channel_id_text` + `enclosure_url` when the guid is missing. `channel_id_text` is a random id
 * each device creates for its copy of the feed, so this form differs per device.
 *
 * `getMd5Hash` hashes `JSON.stringify`, so key insertion order is part of the contract.
 * `public.add_by_rss_hash_id_from_feed` in
 * `infra/k8s/base/ops/source/database/linear-migrations/app/0001_app_schema.sql`
 * reproduces the feed form. The two must stay byte for byte identical.
 */

import { getMd5Hash } from './hash.js';

function toHashString(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const s = String(value).trim();
  return s === '' ? null : s;
}

const DIGITS_ONLY = /^[0-9]+$/;

/**
 * True when `guid` was made up on this device for an item without an RSS guid: the device's
 * channel id, a hyphen, then the item's position. Such a guid differs per device, so the feed
 * form ignores it and falls back to `enclosure_url`.
 */
export function isDeviceLocalAddByRSSGuid(
  guid: string,
  channelIdText: string | null | undefined
): boolean {
  const channel = toHashString(channelIdText);
  if (channel === null) {
    return false;
  }
  const prefix = `${channel}-`;
  return guid.startsWith(prefix) && DIGITS_ONLY.test(guid.slice(prefix.length));
}

/**
 * Extract minimal hash input from add_by_rss_resource_data (full payload).
 *
 * `feed_url` must already be canonical (`canonicalAddByRSSFeedUrl` in `@podverse/helpers-validation`,
 * userinfo removed). This package cannot canonicalize it; the code that builds resource data and
 * the API boundary do.
 */
export function extractAddByRSSHashInput(data: unknown): Record<string, string> {
  if (!data || typeof data !== 'object') {
    return {};
  }
  const record = data as Record<string, unknown>;
  const result: Record<string, string> = {};

  const feedUrl = toHashString(record['feed_url']);
  const channelIdText = toHashString(record['channel_id_text']);
  const guid = toHashString(record['guid']);
  const enclosureUrl = toHashString(record['enclosure_url']);

  if (feedUrl) {
    result['feed_url'] = feedUrl;
    if (guid && !isDeviceLocalAddByRSSGuid(guid, channelIdText)) {
      result['guid'] = guid;
    } else if (enclosureUrl) {
      result['enclosure_url'] = enclosureUrl;
    }
    return result;
  }

  if (channelIdText) {
    result['channel_id_text'] = channelIdText;
  }
  if (guid) {
    result['guid'] = guid;
  } else if (enclosureUrl) {
    result['enclosure_url'] = enclosureUrl;
  }

  return result;
}

/** Compute add_by_rss_hash_id from a full add_by_rss_resource_data payload. */
export function getAddByRSSHashId(addByRSSResourceData: unknown): string {
  const minimal = extractAddByRSSHashInput(addByRSSResourceData);
  return getMd5Hash(minimal);
}

/**
 * The hash of this payload with `feed_url` left out. When the payload has no `feed_url`, this
 * is the same id as `getAddByRSSHashId`. When it has `feed_url`, a stored row may still carry
 * this id.
 */
export function getLegacyAddByRSSHashId(addByRSSResourceData: unknown): string {
  if (!addByRSSResourceData || typeof addByRSSResourceData !== 'object') {
    return getMd5Hash({});
  }
  const { feed_url: _feedUrl, ...legacy } = addByRSSResourceData as Record<string, unknown>;
  return getAddByRSSHashId(legacy);
}

/**
 * Every add_by_rss_hash_id a stored row for this payload may carry: the hash of the payload,
 * then the hash with `feed_url` left out when that id differs.
 */
export function getAddByRSSHashIdsForResourceData(addByRSSResourceData: unknown): string[] {
  const current = getAddByRSSHashId(addByRSSResourceData);
  const legacy = getLegacyAddByRSSHashId(addByRSSResourceData);
  return legacy === current ? [current] : [current, legacy];
}
