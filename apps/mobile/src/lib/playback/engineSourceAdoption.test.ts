import { describe, expect, it } from 'vitest';

import { MediumEnum } from '@podverse/helpers/medium';

import type { MediaEngineSourceMeta } from '../../../modules/podverse-media-engine';
import {
  adoptedItemNeedsEnrichment,
  buildAdoptedPlaybackTarget,
  buildChannelFromEngineMeta,
  buildItemFromEngineMeta,
} from './engineSourceAdoption';

const baseMeta: MediaEngineSourceMeta = {
  artworkUrl: 'https://example.com/art.jpg',
  idText: 'item1',
  isLive: false,
  kind: 'item',
  origin: 'car',
  queueMedium: 'av',
  subtitle: 'Show Title',
  title: 'Episode Title',
};

describe('engine source adoption', () => {
  it('builds a podcast item target from metadata alone', () => {
    const item = buildItemFromEngineMeta(baseMeta, 'https://example.com/ep.mp3', 1800);
    const channel = buildChannelFromEngineMeta(baseMeta);
    const target = buildAdoptedPlaybackTarget(item, channel, baseMeta);

    expect(target.kind).toBe('item-podcast');
    expect(item.title).toBe('Episode Title');
    expect(item.item_about.duration).toBe('1800');
    expect(item.item_images[0]?.url).toBe('https://example.com/art.jpg');
    expect(item.item_enclosures[0]?.item_enclosure_sources[0]?.uri).toBe(
      'https://example.com/ep.mp3'
    );
    expect(channel.title).toBe('Show Title');
    expect(adoptedItemNeedsEnrichment({ builtFromMeta: true, channel, item })).toBe(true);
  });

  it('never offers a local file as an enclosure', () => {
    const item = buildItemFromEngineMeta(baseMeta, 'file:///downloads/ep.mp3', 0);
    expect(item.item_enclosures).toEqual([]);
    expect(item.item_about.duration).toBeNull();
  });

  it('adopts a live car source as a livestream target', () => {
    const meta: MediaEngineSourceMeta = { ...baseMeta, isLive: true };
    const item = buildItemFromEngineMeta(meta, 'https://example.com/live.m3u8', 0);
    const target = buildAdoptedPlaybackTarget(item, buildChannelFromEngineMeta(meta), meta);

    expect(target.kind).toBe('livestream');
    expect(item.item_enclosures[0]?.type).toBe('application/x-mpegURL');
  });

  it('adopts a Music source with a session-restore intent', () => {
    const meta: MediaEngineSourceMeta = { ...baseMeta, queueMedium: 'music' };
    const channel = buildChannelFromEngineMeta(meta);
    const target = buildAdoptedPlaybackTarget(
      buildItemFromEngineMeta(meta, 'https://example.com/track.mp3', 200),
      channel,
      meta
    );

    expect(channel.medium_id).toBe(MediumEnum.Music);
    expect(target).toMatchObject({ intent: 'session_restore', kind: 'item-music' });
  });

  it('skips enrichment for a whole stored item', () => {
    const meta = baseMeta;
    const item = buildItemFromEngineMeta(meta, 'https://example.com/ep.mp3', 1800);
    const channel = { ...buildChannelFromEngineMeta(meta), id_text: 'channel1' };

    expect(adoptedItemNeedsEnrichment({ builtFromMeta: false, channel, item })).toBe(false);
  });
});
