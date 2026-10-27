import { describe, expect, it } from 'vitest';

import { NotificationCategoryEnum } from '@podverse/helpers';

import type { LocalSeedNotificationCatalog } from './localUserContentSeedLib.js';
import {
  buildLocalSeedNotificationDrafts,
  dummyClipTitle,
  dummyClipWindow,
  LOCAL_SEED_NOTIFICATION_KEYS,
  LOCAL_USER_CONTENT_SEED_EMAILS,
  pickRotated,
  readLocalSeedKey,
} from './localUserContentSeedLib.js';

describe('localUserContentSeedLib', () => {
  it('keeps dummy catalog emails off example.com and e2e prefixes', () => {
    const dummyEmails = LOCAL_USER_CONTENT_SEED_EMAILS.filter((email) => email.startsWith('dummy'));
    expect(dummyEmails).toHaveLength(6);
    for (const email of dummyEmails) {
      expect(email.endsWith('@podverse.local')).toBe(true);
      expect(email.startsWith('e2e-')).toBe(false);
      expect(email.startsWith('local-')).toBe(false);
    }
  });

  it('picks a rotated slice without wrapping past the requested count', () => {
    expect(pickRotated(['a', 'b', 'c', 'd'], 1, 3)).toEqual(['b', 'c', 'd']);
    expect(pickRotated(['a', 'b', 'c'], 2, 3)).toEqual(['c', 'a', 'b']);
    expect(pickRotated(['a'], 9, 4)).toEqual(['a']);
    expect(pickRotated([], 1, 3)).toEqual([]);
  });

  it('builds clip titles from item id_text', () => {
    expect(dummyClipTitle('abc123xyz')).toBe('Dummy clip abc123xyz');
  });

  it('keeps clip windows 15–30s, start ≤ 60, end ≤ 90', () => {
    for (let accountId = 1; accountId <= 20; accountId += 1) {
      for (let itemId = 1; itemId <= 40; itemId += 1) {
        const window = dummyClipWindow(accountId, itemId);
        const duration = window.end - window.start;
        expect(window.start).toBeGreaterThanOrEqual(0);
        expect(window.start).toBeLessThanOrEqual(60);
        expect(window.end).toBeGreaterThan(window.start);
        expect(window.end).toBeLessThanOrEqual(90);
        expect(duration).toBeGreaterThanOrEqual(15);
        expect(duration).toBeLessThanOrEqual(30);
      }
    }
  });

  it('returns the same window for the same account and item', () => {
    expect(dummyClipWindow(4, 11)).toEqual(dummyClipWindow(4, 11));
  });
});

const publisherNotice = (
  announcedIdText: string,
  announcedTitle: string,
  mediumId: number,
  publisherIdText: string,
  publisherTitle: string
): LocalSeedNotificationCatalog['publisherAlbum'] => ({
  announcedIdText,
  announcedTitle,
  imageUrl: null,
  mediumId,
  publisherIdText,
  publisherTitle,
});

const fullCatalog = (): LocalSeedNotificationCatalog => ({
  episode: {
    channelIdText: 'show1',
    channelTitle: 'Podcasting 2.0',
    imageUrl: 'https://example.com/ep.jpg',
    itemIdText: 'ep1',
    itemTitle: 'Latest episode',
    mediumId: 2,
  },
  livestreamScheduled: {
    channelIdText: 'show1',
    channelTitle: 'Podcasting 2.0',
    imageUrl: null,
    itemIdText: 'live-soon',
    itemTitle: 'Upcoming live',
    mediumId: 2,
  },
  livestreamStarted: {
    channelIdText: 'show1',
    channelTitle: 'Podcasting 2.0',
    imageUrl: null,
    itemIdText: 'live-now',
    itemTitle: 'On air',
    mediumId: 2,
  },
  newContent: {
    channelIdText: 'show2',
    channelTitle: 'Boostagram Ball',
    imageUrl: null,
    itemIdText: 'ep2',
    itemTitle: 'Another episode',
    mediumId: 2,
  },
  podcastIndexPreview: {
    announcedIdText: '6651863',
    announcedTitle: "Let Go (What's holding you back)",
    imageUrl: null,
    mediumId: 22,
    publisherIdText: 'pubmusic',
    publisherTitle: 'Middle Season',
  },
  publisherAlbum: {
    announcedIdText: 'album1',
    announcedTitle: 'No Longer Afraid - Single',
    imageUrl: 'https://example.com/album.jpg',
    mediumId: 22,
    publisherIdText: 'pubmusic',
    publisherTitle: 'Middle Season',
  },
  publisherPodcast: publisherNotice(
    'show-from-publisher',
    'Announced Show',
    21,
    'pubpod',
    'Example Publisher'
  ),
  publisherVideo: publisherNotice(
    'vid-from-publisher',
    'Announced Channel',
    23,
    'pubvid',
    'Example Video Publisher'
  ),
  track: {
    channelIdText: 'album1',
    channelTitle: 'Doerfel-Verse',
    imageUrl: null,
    itemIdText: 'track1',
    itemTitle: 'Opening track',
    mediumId: 3,
  },
  video: {
    channelIdText: 'vidshow',
    channelTitle: 'Video show',
    imageUrl: null,
    itemIdText: 'vid1',
    itemTitle: 'Latest video',
    mediumId: 4,
  },
});

describe('buildLocalSeedNotificationDrafts', () => {
  const now = new Date('2026-10-26T12:00:00.000Z');

  it('builds one row for every notification key from real targets', () => {
    const drafts = buildLocalSeedNotificationDrafts(fullCatalog(), now);
    expect(drafts.map((draft) => draft.localSeedKey)).toEqual([...LOCAL_SEED_NOTIFICATION_KEYS]);
    for (const draft of drafts) {
      expect(readLocalSeedKey(draft.payload)).toBe(draft.localSeedKey);
    }
  });

  it('links each content type to the parsed feed target', () => {
    const drafts = buildLocalSeedNotificationDrafts(fullCatalog(), now);
    const link = (key: string) => drafts.find((draft) => draft.localSeedKey === key)?.linkPath;
    expect(link('new')).toBeNull();
    expect(link('new-episode')).toBe('/episode/ep1');
    expect(link('new-podcast')).toBe('/podcast/show-from-publisher');
    expect(link('new-video')).toBe('/video/vid1');
    expect(link('new-video-channel')).toBe('/channel/vid-from-publisher');
    expect(link('new-track')).toBe('/track/track1');
    expect(link('new-album')).toBe('/album/album1');
    expect(link('podcast-index-feed')).toBe('/podcast-index/feed/6651863');
    expect(link('livestream-started')).toBe('/podcast/livestream/live-now');
    expect(link('livestream-scheduled')).toBe('/podcast/livestream/live-soon');
  });

  it('keeps system rows when no feeds are parsed, and marks general read', () => {
    const empty: LocalSeedNotificationCatalog = {
      episode: null,
      livestreamScheduled: null,
      livestreamStarted: null,
      newContent: null,
      podcastIndexPreview: null,
      publisherAlbum: null,
      publisherPodcast: null,
      publisherVideo: null,
      track: null,
      video: null,
    };
    const drafts = buildLocalSeedNotificationDrafts(empty, now);
    expect(drafts.map((draft) => draft.localSeedKey)).toEqual([
      'product-update',
      'maintenance',
      'terms-of-service',
      'general',
    ]);
    expect(drafts.find((draft) => draft.localSeedKey === 'general')?.markRead).toBe(true);
    expect(drafts.find((draft) => draft.localSeedKey === 'product-update')?.markRead).toBe(false);
    expect(drafts.find((draft) => draft.localSeedKey === 'product-update')?.category).toBe(
      NotificationCategoryEnum.ProductUpdate
    );
    expect(drafts.find((draft) => draft.localSeedKey === 'maintenance')?.category).toBe(
      NotificationCategoryEnum.Maintenance
    );
    expect(drafts.find((draft) => draft.localSeedKey === 'terms-of-service')?.category).toBe(
      NotificationCategoryEnum.TermsOfService
    );
  });

  it('omits a publisher medium when that notice is missing', () => {
    const catalog = fullCatalog();
    catalog.publisherPodcast = null;
    catalog.publisherVideo = null;
    catalog.newContent = null;
    const drafts = buildLocalSeedNotificationDrafts(catalog, now);
    const keys = drafts.map((draft) => draft.localSeedKey);
    expect(keys).not.toContain('new-podcast');
    expect(keys).not.toContain('new-video-channel');
    expect(keys).not.toContain('new');
    expect(keys).toContain('new-episode');
    expect(keys).toContain('new-album');

    const album = drafts.find((draft) => draft.localSeedKey === 'new-album');
    expect(album?.payload.channelTitle).toBe('Middle Season');
    expect(album?.payload.itemTitle).toBe('No Longer Afraid - Single');
    expect(album?.body).toBe('Middle Season');
    expect(album?.title).toBe('No Longer Afraid - Single');
  });

  it('uses a different episode for New content than for New episode', () => {
    const drafts = buildLocalSeedNotificationDrafts(fullCatalog(), now);
    const newContent = drafts.find((draft) => draft.localSeedKey === 'new');
    const episode = drafts.find((draft) => draft.localSeedKey === 'new-episode');
    expect(newContent?.payload.itemIdText).toBe('ep2');
    expect(episode?.payload.itemIdText).toBe('ep1');
    expect(newContent?.payload.itemIdText).not.toBe(episode?.payload.itemIdText);
  });
});
