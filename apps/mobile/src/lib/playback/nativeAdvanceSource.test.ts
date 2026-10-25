import { describe, expect, it, vi } from 'vitest';

import type {
  AddByRSSResourceData,
  DTOChannel,
  DTOItem,
  DTOQueueResource,
} from '@podverse/helpers/dto';
import type { PlaybackTarget } from '@podverse/playback-core';
import type {
  AutoQueueConfig,
  AutoQueueResourcesMap,
  AutoQueueResourcesMapRow,
} from '@podverse/playback-core/autoQueue';

import { safeJsonParse } from '../../data/db/serialization';
import { addByRssPlaybackMediaId } from '../addByRss/resourceData';
import type { NativeAdvanceSourceV1 } from './nativeAdvanceSource';
import {
  buildNativeAdvanceSource,
  decideAdoptedContinuation,
  findManualQueueResource,
  manualQueueResourceIdentityKeys,
  nativeAdvanceSourceWriteKey,
  parseNativeAdvanceSource,
} from './nativeAdvanceSource';

vi.mock('../e2e/resolveE2eMediaUrl', () => ({
  resolveE2eMediaUrl: (url: string) => url,
}));

const fixture = <T>(value: unknown): T => {
  const parsed = safeJsonParse<T>(JSON.stringify(value));
  if (parsed === null) {
    throw new Error('Failed to build fixture');
  }
  return parsed;
};

const channel = fixture<DTOChannel>({
  channel_images: [],
  id: 1,
  id_text: 'channel-1',
  title: 'Show',
});

const itemFor = (idText: string): DTOItem =>
  fixture<DTOItem>({
    channel,
    channel_id: 1,
    id: 1,
    id_text: idText,
    item_about: { duration: '60', id: 1, item_id: 1 },
    item_enclosures: [],
    item_images: [],
    title: `Episode ${idText}`,
  });

const itemRow = (idText: string): AutoQueueResourcesMapRow => ({
  channel,
  clip: null,
  item: itemFor(idText),
  item_soundbite: null,
});

const clipRow = (clipIdText: string, itemIdText: string): AutoQueueResourcesMapRow =>
  fixture<AutoQueueResourcesMapRow>({
    channel,
    clip: { end_time: '30', id_text: clipIdText, item: itemFor(itemIdText), start_time: '12' },
    item: itemFor(itemIdText),
    item_soundbite: null,
  });

const config: AutoQueueConfig = {
  disabled: false,
  nextPage: 2,
  playlist_id_text: 'playlist-1',
  random: true,
  repeat: false,
  shuffleHash: 'hash-1',
};

const podcastTarget = (idText = 'anchor'): PlaybackTarget => ({
  channel,
  item: itemFor(idText),
  kind: 'item-podcast',
});

const rssResourceData = (guid: string): AddByRSSResourceData => ({
  channel_title: 'Feed',
  enclosure_url: `https://e.x/${guid}.mp3`,
  feed_url: 'https://e.x/feed.xml',
  guid,
  title: `RSS ${guid}`,
});

const FEED_URL = 'https://e.x/feed.xml';

const resources = (rows: AutoQueueResourcesMapRow[]): AutoQueueResourcesMap => {
  const map: AutoQueueResourcesMap = {};
  rows.forEach((row, index) => {
    map[index] = row;
  });
  return map;
};

const build = (input: {
  target?: PlaybackTarget | null;
  rows?: AutoQueueResourcesMapRow[];
  resourcesMap?: AutoQueueResourcesMap;
  activeRow?: number;
  config?: AutoQueueConfig;
  addByRssFeedUrls?: ReadonlyMap<string, string>;
}): NativeAdvanceSourceV1 | null =>
  buildNativeAdvanceSource({
    activeRow: input.activeRow ?? 0,
    addByRssFeedUrls: input.addByRssFeedUrls ?? new Map<string, string>(),
    config: input.config ?? config,
    nowMs: 1000,
    resources: input.resourcesMap ?? resources(input.rows ?? []),
    target: input.target === undefined ? podcastTarget() : input.target,
  });

/** A saved buffer of the anchor, a clip of ep-1, and ep-2, plus an Add by RSS episode. */
const savedSource = (): NativeAdvanceSourceV1 => {
  const source = build({
    addByRssFeedUrls: new Map([['rss-1', FEED_URL]]),
    rows: [itemRow('anchor'), clipRow('clip-1', 'ep-1'), itemRow('ep-2')],
  });
  if (source === null) {
    throw new Error('fixture source is null');
  }
  return source;
};

const itemResource = (idText: string): DTOQueueResource =>
  fixture<DTOQueueResource>({
    add_by_rss_resource_data: null,
    clip: null,
    item: itemFor(idText),
    item_soundbite: null,
  });

const clipResource = (
  clipIdText: string,
  itemIdText: string,
  options: { withItem: boolean } = { withItem: true }
): DTOQueueResource =>
  fixture<DTOQueueResource>({
    add_by_rss_resource_data: null,
    clip: { end_time: '30', id_text: clipIdText, item: itemFor(itemIdText), start_time: '12' },
    item: options.withItem ? itemFor(itemIdText) : null,
    item_soundbite: null,
  });

const rssResource = (guid: string): DTOQueueResource =>
  fixture<DTOQueueResource>({
    add_by_rss_resource_data: rssResourceData(guid),
    clip: null,
    item: null,
    item_soundbite: null,
  });

const rowIdTexts = (map: AutoQueueResourcesMap | undefined): Array<[number, string]> =>
  Object.entries(map ?? {}).map(([key, row]) => [
    Number(key),
    row.clip ? `clip:${row.clip.id_text}` : row.item.id_text,
  ]);

describe('buildNativeAdvanceSource', () => {
  it('keeps the buffer from the active row through the highest key, in key order', () => {
    const resourcesMap: AutoQueueResourcesMap = {};
    resourcesMap[3] = itemRow('ep-3');
    resourcesMap[0] = itemRow('ep-0');
    resourcesMap[2] = clipRow('clip-2', 'ep-2');
    resourcesMap[1] = itemRow('ep-1');

    const source = build({ activeRow: 1, resourcesMap });

    expect(source?.anchor).toEqual({ idText: 'anchor', kind: 'item' });
    expect(source?.autoQueue?.config).toEqual(config);
    expect(source?.autoQueue?.rows.map(({ idText, kind }) => ({ idText, kind }))).toEqual([
      { idText: 'ep-1', kind: 'item' },
      { idText: 'clip-2', kind: 'clip' },
      { idText: 'ep-3', kind: 'item' },
    ]);
  });

  it('saves no buffer when the auto-queue is disabled or the target is an Add by RSS episode', () => {
    const addByRssFeedUrls = new Map([['rss-1', FEED_URL]]);
    const disabled = build({
      addByRssFeedUrls,
      config: { ...config, disabled: true },
      rows: [itemRow('anchor')],
    });
    const rssTarget = build({
      addByRssFeedUrls,
      rows: [itemRow('anchor')],
      target: { kind: 'add-by-rss', resourceData: rssResourceData('g-1') },
    });

    expect(disabled?.autoQueue).toBeNull();
    expect(rssTarget?.autoQueue).toBeNull();
    expect(rssTarget?.anchor).toEqual({
      idText: addByRssPlaybackMediaId(rssResourceData('g-1')),
      kind: 'add_by_rss',
    });
  });

  it('keeps Add by RSS feed URLs and drops one that carries userinfo', () => {
    const source = build({
      addByRssFeedUrls: new Map([
        ['rss-1', FEED_URL],
        ['rss-2', 'https://user:pass@e.x/private.xml'],
      ]),
    });

    expect(source?.addByRss).toEqual([{ feedUrl: FEED_URL, idText: 'rss-1' }]);
  });

  it('returns null when nothing could continue', () => {
    expect(build({ config: { ...config, disabled: true }, rows: [itemRow('anchor')] })).toBeNull();
    expect(build({ rows: [] })).toBeNull();
    expect(build({ rows: [itemRow('anchor')], target: null })).toBeNull();
  });
});

describe('decideAdoptedContinuation without a manual queue item', () => {
  it('finds a clip row by its clip id, not its item id, and restores the buffer from it', () => {
    const source = savedSource();

    const byClip = decideAdoptedContinuation(source, { idText: 'clip-1', kind: 'clip' }, null);
    const byItem = decideAdoptedContinuation(source, { idText: 'ep-1', kind: 'item' }, null);

    expect(rowIdTexts(byClip?.autoQueue?.resources)).toEqual([
      [0, 'clip:clip-1'],
      [1, 'ep-2'],
    ]);
    expect(byClip?.autoQueue?.config).toEqual(config);
    expect(byClip?.row?.clip?.id_text).toBe('clip-1');
    expect(byClip?.addByRssFeedUrl).toBeNull();
    expect(byItem).toBeNull();
  });

  it('returns the feed URL for a saved Add by RSS episode', () => {
    const continuation = decideAdoptedContinuation(
      savedSource(),
      { idText: 'rss-1', kind: 'add_by_rss' },
      null
    );

    expect(continuation).toEqual({ addByRssFeedUrl: FEED_URL, autoQueue: null, row: null });
  });

  it('returns null for an episode of the same podcast outside the saved rows', () => {
    expect(
      decideAdoptedContinuation(savedSource(), { idText: 'ep-9', kind: 'item' }, null)
    ).toBeNull();
  });

  it('returns null without a saved source', () => {
    expect(
      decideAdoptedContinuation(null, { idText: 'ep-9', kind: 'item' }, itemResource('ep-9'))
    ).toBeNull();
  });
});

describe('decideAdoptedContinuation with a manual queue item', () => {
  it('restores every saved row from key 0 when the item is not a saved row', () => {
    const continuation = decideAdoptedContinuation(
      savedSource(),
      { idText: 'queued', kind: 'item' },
      itemResource('queued')
    );

    expect(rowIdTexts(continuation?.autoQueue?.resources)).toEqual([
      [0, 'anchor'],
      [1, 'clip:clip-1'],
      [2, 'ep-2'],
    ]);
    expect(continuation?.autoQueue?.config).toEqual(config);
    expect(continuation?.row?.item.id_text).toBe('queued');
  });

  it('restores every saved row when the item is a saved row past the first', () => {
    const continuation = decideAdoptedContinuation(
      savedSource(),
      { idText: 'ep-2', kind: 'item' },
      itemResource('ep-2')
    );

    expect(rowIdTexts(continuation?.autoQueue?.resources)).toEqual([
      [0, 'anchor'],
      [1, 'clip:clip-1'],
      [2, 'ep-2'],
    ]);
  });

  it('takes the row only when the window key names the item', () => {
    const asWholeItem = decideAdoptedContinuation(
      savedSource(),
      { idText: 'ep-7', kind: 'item' },
      clipResource('clip-7', 'ep-7')
    );
    const asClip = decideAdoptedContinuation(
      savedSource(),
      { idText: 'clip-7', kind: 'clip' },
      clipResource('clip-7', 'ep-7')
    );

    expect(asWholeItem?.row).toBeNull();
    expect(rowIdTexts(asWholeItem?.autoQueue?.resources)).toHaveLength(3);
    expect(asClip?.row?.clip?.id_text).toBe('clip-7');
  });

  it('gives no buffer when the saved source has none, and null when nothing else applies', () => {
    const rssOnly = build({
      addByRssFeedUrls: new Map([['rss-1', FEED_URL]]),
      target: { kind: 'add-by-rss', resourceData: rssResourceData('g-1') },
    });

    const queuedItem = decideAdoptedContinuation(
      rssOnly,
      { idText: 'queued', kind: 'item' },
      itemResource('queued')
    );
    const clipAsItem = decideAdoptedContinuation(
      rssOnly,
      { idText: 'ep-7', kind: 'item' },
      clipResource('clip-7', 'ep-7')
    );

    expect(queuedItem?.autoQueue).toBeNull();
    expect(queuedItem?.row?.item.id_text).toBe('queued');
    expect(clipAsItem).toBeNull();
  });

  it('returns the buffer and the feed URL for a queued Add by RSS episode the source lists', () => {
    const mediaId = addByRssPlaybackMediaId(rssResourceData('g-5'));
    const source = build({
      addByRssFeedUrls: new Map([[mediaId, FEED_URL]]),
      rows: [itemRow('anchor'), itemRow('ep-2')],
    });

    const continuation = decideAdoptedContinuation(
      source,
      { idText: mediaId, kind: 'add_by_rss' },
      rssResource('g-5')
    );

    expect(continuation?.addByRssFeedUrl).toBe(FEED_URL);
    expect(continuation?.row).toBeNull();
    expect(rowIdTexts(continuation?.autoQueue?.resources)).toEqual([
      [0, 'anchor'],
      [1, 'ep-2'],
    ]);
  });
});

describe('findManualQueueResource', () => {
  it('matches the now-playing row and an upcoming one', () => {
    const nowPlaying = itemResource('now');
    const upcoming = itemResource('next');
    const queues = [{ nowPlaying, upcoming: [itemResource('other'), upcoming] }];

    expect(findManualQueueResource(queues, { idText: 'now', kind: 'item' })).toBe(nowPlaying);
    expect(findManualQueueResource(queues, { idText: 'next', kind: 'item' })).toBe(upcoming);
  });

  it('checks the podcast queue before the Music queue', () => {
    const inPodcastQueue = itemResource('shared');
    const inMusicQueue = itemResource('shared');

    expect(
      findManualQueueResource(
        [
          { nowPlaying: null, upcoming: [inPodcastQueue] },
          { nowPlaying: inMusicQueue, upcoming: [] },
        ],
        { idText: 'shared', kind: 'item' }
      )
    ).toBe(inPodcastQueue);
  });

  it('matches a clip row by its clip id and by its item id', () => {
    const clip = clipResource('clip-1', 'ep-1');
    const queues = [{ nowPlaying: null, upcoming: [clip] }];

    expect(findManualQueueResource(queues, { idText: 'clip-1', kind: 'clip' })).toBe(clip);
    expect(findManualQueueResource(queues, { idText: 'ep-1', kind: 'item' })).toBe(clip);
  });

  it('matches a clip row without an item by its clip id only', () => {
    const clip = clipResource('clip-1', 'ep-1', { withItem: false });

    expect(manualQueueResourceIdentityKeys(clip)).toEqual(['clip:clip-1']);
  });

  it('matches an Add by RSS row by its media id', () => {
    const rss = rssResource('g-1');
    const mediaId = addByRssPlaybackMediaId(rssResourceData('g-1'));

    expect(
      findManualQueueResource([{ nowPlaying: null, upcoming: [rss] }], {
        idText: mediaId,
        kind: 'add_by_rss',
      })
    ).toBe(rss);
  });

  it('returns null for an identity in neither queue', () => {
    expect(
      findManualQueueResource(
        [
          { nowPlaying: itemResource('now'), upcoming: [] },
          { nowPlaying: null, upcoming: [itemResource('track')] },
        ],
        { idText: 'elsewhere', kind: 'item' }
      )
    ).toBeNull();
  });
});

describe('parseNativeAdvanceSource', () => {
  it('round-trips a built source', () => {
    const source = savedSource();

    expect(parseNativeAdvanceSource(JSON.stringify(source))).toEqual(source);
  });

  it('returns null for a wrong version, a missing anchor, or a row without its row', () => {
    const source = savedSource();
    const firstRow = source.autoQueue?.rows[0];
    if (source.autoQueue === null || firstRow === undefined) {
      throw new Error('fixture has no saved rows');
    }
    const rowWithoutRow = { idText: firstRow.idText, kind: firstRow.kind };

    expect(parseNativeAdvanceSource(JSON.stringify({ ...source, v: 2 }))).toBeNull();
    expect(parseNativeAdvanceSource(JSON.stringify({ ...source, anchor: undefined }))).toBeNull();
    expect(
      parseNativeAdvanceSource(
        JSON.stringify({
          ...source,
          autoQueue: { ...source.autoQueue, rows: [rowWithoutRow] },
        })
      )
    ).toBeNull();
    expect(parseNativeAdvanceSource(null)).toBeNull();
    expect(parseNativeAdvanceSource('not json')).toBeNull();
  });
});

describe('nativeAdvanceSourceWriteKey', () => {
  it('ignores the timestamp and changes when the config or a row changes', () => {
    const source = savedSource();
    const key = nativeAdvanceSourceWriteKey(source);
    const otherRows = build({
      addByRssFeedUrls: new Map([['rss-1', FEED_URL]]),
      rows: [itemRow('anchor'), clipRow('clip-1', 'ep-1'), itemRow('ep-3')],
    });

    expect(nativeAdvanceSourceWriteKey({ ...source, updatedAtMs: 99 })).toBe(key);
    expect(
      nativeAdvanceSourceWriteKey(
        source.autoQueue === null
          ? source
          : { ...source, autoQueue: { ...source.autoQueue, config: { ...config, nextPage: 3 } } }
      )
    ).not.toBe(key);
    expect(nativeAdvanceSourceWriteKey(otherRows)).not.toBe(key);
    expect(nativeAdvanceSourceWriteKey(null)).toBe('');
  });
});
