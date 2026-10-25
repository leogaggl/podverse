import { describe, expect, it, vi } from 'vitest';

import type {
  AddByRSSResourceData,
  DTOChannel,
  DTOItem,
  DTOQueueResource,
} from '@podverse/helpers/dto';
import { MediumEnum } from '@podverse/helpers/medium';
import type { PlaybackTarget } from '@podverse/playback-core';
import type {
  AutoQueueResourcesMap,
  AutoQueueResourcesMapRow,
} from '@podverse/playback-core/autoQueue';

import { addByRssPlaybackMediaId } from '../../lib/addByRss/resourceData';
import { safeJsonParse } from '../db/serialization';
import type {
  AdvanceWindowAddByRssMedia,
  AdvanceWindowAutoQueueState,
  AdvanceWindowManualRow,
} from './advanceWindow';
import { buildAdvanceWindow, NATIVE_ADVANCE_WINDOW_AUTO_ROWS } from './advanceWindow';

// The composer's store readers are mocked so the pure builder loads without SQLite or React Native.
vi.mock('../../lib/e2e/resolveE2eMediaUrl', () => ({
  resolveE2eMediaUrl: (url: string) => url,
}));
vi.mock('./carCacheReproject', () => ({
  completeDownloadMap: async () => new Map(),
  readAccountIdText: async () => null,
  readProgressLookup: async () => () => null,
}));
vi.mock('../repositories/queueProjectionHelpers', () => ({
  readAddByRssProgressForProjection: async () => () => null,
  readCachedQueueIds: async () => ({ avQueueIdText: null, musicQueueIdText: null }),
  readQueueCachesForProjection: async () => ({ nowPlaying: null, upcoming: [] }),
}));
vi.mock('../repositories/addByRssRepository', () => ({
  addByRssRepository: {
    getFeedByUrl: async () => null,
    getMappedFeedByUrl: async () => null,
  },
}));
vi.mock('../../playback/addByRssMediaAuth', () => ({
  addByRssFeedUrlForTarget: async () => null,
  createAddByRssPlainUrlCheck: async () => () => true,
}));

const fixture = <T>(value: unknown): T => {
  const parsed = safeJsonParse<T>(JSON.stringify(value));
  if (parsed === null) {
    throw new Error('Failed to build fixture');
  }
  return parsed;
};

const channelFor = (mediumId: MediumEnum): DTOChannel =>
  fixture<DTOChannel>({
    channel_images: [],
    id: 1,
    id_text: 'channel-1',
    medium_id: mediumId,
    title: 'Show',
  });

const podcastChannel = channelFor(MediumEnum.Podcast);

const itemFor = (idText: string, extra: Record<string, unknown> = {}): DTOItem =>
  fixture<DTOItem>({
    channel: podcastChannel,
    channel_id: 1,
    id: 1,
    id_text: idText,
    item_about: { duration: '60', id: 1, item_id: 1 },
    item_enclosures: [
      {
        id: 1,
        item_enclosure_default: true,
        item_enclosure_sources: [
          {
            content_type: 'audio/mpeg',
            id: 1,
            item_enclosure_id: 1,
            uri: `https://e.x/${idText}.mp3`,
          },
        ],
        item_id: 1,
        type: 'audio/mpeg',
      },
    ],
    item_images: [],
    title: `Episode ${idText}`,
    ...extra,
  });

const itemRow = (idText: string): AutoQueueResourcesMapRow => ({
  channel: podcastChannel,
  clip: null,
  item: itemFor(idText),
  item_soundbite: null,
});

const clipRow = (clipIdText: string, itemIdText: string): AutoQueueResourcesMapRow =>
  fixture<AutoQueueResourcesMapRow>({
    channel: podcastChannel,
    clip: {
      end_time: '30',
      id_text: clipIdText,
      item: itemFor(itemIdText),
      start_time: '12',
      title: 'A clip',
    },
    item: itemFor(itemIdText),
    item_soundbite: null,
  });

const soundbiteRow = (soundbiteIdText: string, itemIdText: string): AutoQueueResourcesMapRow =>
  fixture<AutoQueueResourcesMapRow>({
    channel: podcastChannel,
    clip: null,
    item: itemFor(itemIdText),
    item_soundbite: {
      duration: '8',
      id_text: soundbiteIdText,
      item: itemFor(itemIdText),
      start_time: '4',
      title: 'A soundbite',
    },
  });

const resourceRow = (item: DTOItem | null): AdvanceWindowManualRow => ({
  kind: 'resource',
  resource: fixture<DTOQueueResource>({
    add_by_rss_resource_data: null,
    clip: null,
    item,
    item_soundbite: null,
    media_file_duration: '60',
    playback_position: '0',
  }),
});

const autoQueue = (
  rows: AutoQueueResourcesMapRow[],
  options: { disabled?: boolean } = {}
): AdvanceWindowAutoQueueState => {
  const resources: AutoQueueResourcesMap = { 0: itemRow('anchor') };
  rows.forEach((row, index) => {
    resources[index + 1] = row;
  });
  return { activeRow: 0, disabled: options.disabled ?? false, resources };
};

const podcastTarget = (idText = 'anchor'): PlaybackTarget => ({
  channel: podcastChannel,
  item: itemFor(idText),
  kind: 'item-podcast',
});

const build = (input: {
  target: PlaybackTarget | null;
  manual?: AdvanceWindowManualRow[];
  autoQueue?: AdvanceWindowAutoQueueState;
  addByRssAhead?: AdvanceWindowAddByRssMedia[];
  downloadFileNameFor?: (itemIdText: string) => string | null;
}) =>
  buildAdvanceWindow({
    addByRssAhead: input.addByRssAhead ?? [],
    autoQueue: input.autoQueue ?? autoQueue([]),
    downloadFileNameFor: input.downloadFileNameFor ?? (() => null),
    manual: input.manual ?? [],
    progressFor: () => null,
    target: input.target,
  });

const ids = (window: ReturnType<typeof build>): string[] =>
  window.entries.map((entry) => `${entry.kind ?? 'item'}:${entry.idText}`);

const rssResource = (guid: string, extra: Record<string, unknown> = {}): AddByRSSResourceData => ({
  channel_title: 'Feed',
  enclosure_url: `https://e.x/${guid}.mp3`,
  feed_url: 'https://e.x/feed.xml',
  guid,
  title: `RSS ${guid}`,
  ...extra,
});

const rssMedia = (
  resourceData: AddByRSSResourceData,
  mediaUrl: string | null = 'https://e.x/a.mp3'
): AdvanceWindowAddByRssMedia => ({
  downloadFileName: null,
  mediaUrl,
  resourceData,
  startPositionSeconds: null,
});

describe('buildAdvanceWindow', () => {
  it('gives an empty window with no anchor for a null target', () => {
    expect(build({ target: null })).toEqual({
      anchorIdText: null,
      anchorKind: null,
      entries: [],
      mediumBucket: 'av',
    });
  });

  it('puts manual rows before automatic rows and never includes the anchor', () => {
    const window = build({
      autoQueue: autoQueue([itemRow('auto-1'), itemRow('anchor')]),
      manual: [resourceRow(itemFor('manual-1')), resourceRow(itemFor('anchor'))],
      target: podcastTarget(),
    });

    expect(window.anchorIdText).toBe('anchor');
    expect(window.anchorKind).toBe('item');
    expect(ids(window)).toEqual(['item:manual-1', 'item:auto-1']);
  });

  it('keeps a row in both parts once at its manual position, and a clip apart from its episode', () => {
    const window = build({
      autoQueue: autoQueue([itemRow('auto-1'), itemRow('shared'), clipRow('clip-1', 'shared')]),
      manual: [resourceRow(itemFor('shared'))],
      target: podcastTarget(),
    });

    expect(ids(window)).toEqual(['item:shared', 'item:auto-1', 'clip:clip-1']);
  });

  it('anchors a chapter target on its item and a clip target on the clip', () => {
    const item = itemFor('anchor');
    const chapterWindow = build({
      target: {
        channel: podcastChannel,
        chapter: fixture({ id_text: 'chapter-1', start_time: '5' }),
        item,
        kind: 'chapter',
      },
    });
    const clipWindow = build({
      target: {
        channel: podcastChannel,
        clip: fixture({ end_time: '20', id_text: 'clip-9', start_time: '10' }),
        item,
        kind: 'clip',
      },
    });

    expect([chapterWindow.anchorKind, chapterWindow.anchorIdText]).toEqual(['item', 'anchor']);
    expect([clipWindow.anchorKind, clipWindow.anchorIdText]).toEqual(['clip', 'clip-9']);
  });

  it('carries the range of clip and soundbite rows and caps the automatic part', () => {
    const extra = Array.from({ length: NATIVE_ADVANCE_WINDOW_AUTO_ROWS + 5 }, (_, index) =>
      itemRow(`auto-${index}`)
    );
    const window = build({
      autoQueue: autoQueue([clipRow('clip-1', 'ep-1'), soundbiteRow('sb-1', 'ep-2'), ...extra]),
      target: podcastTarget(),
    });

    expect(window.entries).toHaveLength(NATIVE_ADVANCE_WINDOW_AUTO_ROWS);
    expect(window.entries[0]).toMatchObject({
      clipEndSeconds: 30,
      clipStartSeconds: 12,
      idText: 'clip-1',
      kind: 'clip',
      startPositionSeconds: 12,
    });
    expect(window.entries[1]).toMatchObject({
      clipEndSeconds: 12,
      clipStartSeconds: 4,
      idText: 'sb-1',
      kind: 'item_soundbite',
      startPositionSeconds: 4,
    });
  });

  it('ends the window at a manual row it cannot play, with no automatic rows after it', () => {
    const window = build({
      autoQueue: autoQueue([itemRow('auto-1')]),
      manual: [
        resourceRow(itemFor('manual-1')),
        resourceRow(itemFor('manual-2', { item_enclosures: [] })),
        resourceRow(itemFor('manual-3')),
      ],
      target: podcastTarget(),
    });

    expect(ids(window)).toEqual(['item:manual-1']);
  });

  it('gives only the manual part when the auto-queue is off or a livestream plays', () => {
    const manual = [resourceRow(itemFor('manual-1'))];
    const disabled = build({
      autoQueue: autoQueue([itemRow('auto-1')], { disabled: true }),
      manual,
      target: podcastTarget(),
    });
    const livestream = build({
      addByRssAhead: [rssMedia(rssResource('next'))],
      autoQueue: autoQueue([itemRow('auto-1')]),
      manual,
      target: { channel: podcastChannel, item: itemFor('live-1'), kind: 'livestream' },
    });

    expect(ids(disabled)).toEqual(['item:manual-1']);
    expect(ids(livestream)).toEqual(['item:manual-1']);
    expect(livestream.anchorKind).toBe('livestream');
  });

  it('follows the feed walk for an Add by RSS episode and stops at a row it cannot play', () => {
    const anchor = rssResource('anchor');
    const first = rssResource('first');
    const second = rssResource('second');
    const unplayable = rssResource('unplayable');
    const livestream = rssResource('live', { liveItem: { status: 'live' } });
    const target: PlaybackTarget = { kind: 'add-by-rss', resourceData: anchor };

    const stopsAtUnplayable = build({
      addByRssAhead: [
        rssMedia(first),
        rssMedia(second),
        rssMedia(unplayable, null),
        rssMedia(first),
      ],
      target,
    });
    const stopsAtLivestream = build({
      addByRssAhead: [rssMedia(first), rssMedia(livestream), rssMedia(second)],
      target,
    });

    expect(stopsAtUnplayable.anchorKind).toBe('add_by_rss');
    expect(stopsAtUnplayable.anchorIdText).toBe(addByRssPlaybackMediaId(anchor));
    expect(stopsAtUnplayable.entries.map((entry) => entry.idText)).toEqual([
      addByRssPlaybackMediaId(first),
      addByRssPlaybackMediaId(second),
    ]);
    expect(stopsAtLivestream.entries.map((entry) => entry.idText)).toEqual([
      addByRssPlaybackMediaId(first),
    ]);
  });

  it('uses the music bucket for a music item and the av bucket for a podcast item', () => {
    const musicChannel = channelFor(MediumEnum.Music);
    const music = build({
      target: {
        channel: musicChannel,
        intent: 'explicit_play',
        item: itemFor('track-1'),
        kind: 'item-music',
      },
    });

    expect(music.mediumBucket).toBe('music');
    expect(build({ target: podcastTarget() }).mediumBucket).toBe('av');
  });

  it('carries the download file name of a downloaded row', () => {
    const window = build({
      autoQueue: autoQueue([itemRow('auto-1')]),
      downloadFileNameFor: (itemIdText) => (itemIdText === 'auto-1' ? 'auto-1.mp3' : null),
      target: podcastTarget(),
    });

    expect(window.entries[0]?.downloadFileName).toBe('auto-1.mp3');
  });
});
