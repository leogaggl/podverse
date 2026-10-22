import { describe, expect, it } from 'vitest';

import type { AddByRSSResourceData } from '@podverse/helpers/dto';
import {
  convertParsedRSSFeedToCompat,
  mapAddByRSSChaptersToDTOItemChapters,
} from '@podverse/parser-mapping';

import type { AddByRssItemSections } from '../lib/addByRss/itemSections';
import type { AddByRssNowPlayingItemSource } from '../lib/addByRss/localResourceData';
import type { AddByRssNowPlayingSectionsSnapshot } from './addByRssNowPlayingSectionsStore';
import {
  addByRssNowPlayingSectionsKey,
  createAddByRssNowPlayingSectionsStore,
  IDLE_ADD_BY_RSS_NOW_PLAYING_SECTIONS,
  shouldAutoLoadAddByRssNowPlayingChapters,
} from './addByRssNowPlayingSectionsStore';

const FEED_URL = 'https://example.com/feed.xml';

const mappedFeed = convertParsedRSSFeedToCompat({
  explicit: false,
  items: [
    {
      duration: 60,
      enclosure: { length: 100, type: 'audio/mpeg', url: 'https://cdn.example.com/episode.mp3' },
      explicit: false,
      guid: 'episode-guid-2',
      pubDate: new Date('2026-01-02T00:00:00.000Z'),
      title: 'Episode Two',
    },
  ],
  link: FEED_URL,
  title: 'Show Name',
});

const itemBundle = mappedFeed.items[0];
if (itemBundle === undefined) {
  throw new Error('mapped feed has no items');
}

const sections: AddByRssItemSections = {
  chapters: mapAddByRSSChaptersToDTOItemChapters([
    {
      data_hash: 'intro',
      end_time: null,
      id_text: 'intro',
      img: null,
      start_time: '0',
      table_of_contents: true,
      title: 'Intro',
      web_url: null,
    },
  ]),
  transcriptText: '',
};

type Context = { token: string };

const context: Context = { token: 'token' };

const resource = (guid: string): AddByRSSResourceData => ({
  feed_url: FEED_URL,
  guid,
});

const playingSource = (
  itemIdText: string,
  sectionUrls: AddByRssNowPlayingItemSource['sectionUrls'] = {
    chaptersFeedUrl: 'https://example.com/chapters.json',
    transcriptUrl: undefined,
  }
): AddByRssNowPlayingItemSource => ({
  feedUrl: FEED_URL,
  itemBundle,
  itemIdText,
  sectionUrls,
});

type Deferred<T> = {
  promise: Promise<T>;
  reject: (reason: unknown) => void;
  resolve: (value: T) => void;
};

const deferred = <T>(): Deferred<T> => {
  let resolvePromise: ((value: T) => void) | null = null;
  let rejectPromise: ((reason: unknown) => void) | null = null;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  if (resolvePromise === null || rejectPromise === null) {
    throw new Error('deferred promise was not initialized');
  }
  return { promise, reject: rejectPromise, resolve: resolvePromise };
};

const at = <T>(values: readonly T[], index: number): T => {
  const value = values[index];
  if (value === undefined) {
    throw new Error(`missing entry ${index}`);
  }
  return value;
};

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const readySnapshot = (
  overrides: Partial<AddByRssNowPlayingSectionsSnapshot> = {}
): AddByRssNowPlayingSectionsSnapshot => ({
  key: 'item',
  sections: null,
  sectionsStatus: 'idle',
  source: playingSource('episode-guid-2'),
  sourceStatus: 'resolved',
  ...overrides,
});

describe('createAddByRssNowPlayingSectionsStore', () => {
  it('resolves the source once when the same item is tracked twice', async () => {
    const gate = deferred<AddByRssNowPlayingItemSource | null>();
    let resolveCount = 0;
    const store = createAddByRssNowPlayingSectionsStore<Context>({
      fetchSections: async () => sections,
      resolveSource: () => {
        resolveCount += 1;
        return gate.promise;
      },
    });
    const episode = resource('episode-guid-2');

    store.track(episode);
    store.track(episode);
    expect(resolveCount).toBe(1);
    expect(store.getSnapshot().sourceStatus).toBe('resolving');
    expect(store.getSnapshot().key).toBe(addByRssNowPlayingSectionsKey(episode));

    gate.resolve(playingSource('phone-channel-7-episode-guid-2'));
    await gate.promise;
    await flush();

    expect(resolveCount).toBe(1);
    expect(store.getSnapshot().sourceStatus).toBe('resolved');
    expect(store.getSnapshot().source).toEqual(playingSource('phone-channel-7-episode-guid-2'));
    store.track(episode);
    expect(resolveCount).toBe(1);
  });

  it('fetches sections once while a load is in flight, then ends loaded', async () => {
    const gate = deferred<AddByRssItemSections>();
    let fetchCount = 0;
    const store = createAddByRssNowPlayingSectionsStore<Context>({
      fetchSections: () => {
        fetchCount += 1;
        return gate.promise;
      },
      resolveSource: async () => playingSource('phone-channel-7-episode-guid-2'),
    });

    store.track(resource('episode-guid-2'));
    await flush();
    const first = store.load(context);
    const second = store.load(context);

    expect(fetchCount).toBe(1);
    expect(second).toBe(first);
    gate.resolve(sections);
    await first;

    expect(store.getSnapshot().sectionsStatus).toBe('loaded');
    expect(store.getSnapshot().sections).toEqual(sections);
  });

  it('leaves a rejected fetch as error and fetches again on the next load', async () => {
    const gates: Array<Deferred<AddByRssItemSections>> = [];
    const store = createAddByRssNowPlayingSectionsStore<Context>({
      fetchSections: () => {
        const gate = deferred<AddByRssItemSections>();
        gates.push(gate);
        return gate.promise;
      },
      resolveSource: async () => playingSource('phone-channel-7-episode-guid-2'),
    });

    store.track(resource('episode-guid-2'));
    await flush();
    const first = store.load(context);
    at(gates, 0).reject(new Error('failed'));
    await first;

    expect(store.getSnapshot().sectionsStatus).toBe('error');
    expect(store.getSnapshot().sections).toBeNull();

    const second = store.load(context);
    expect(gates).toHaveLength(2);
    at(gates, 1).resolve(sections);
    await second;

    expect(store.getSnapshot().sectionsStatus).toBe('loaded');
    expect(store.getSnapshot().sections).toEqual(sections);
  });

  it('drops an answer that arrives after reset', async () => {
    const sourceGates: Array<Deferred<AddByRssNowPlayingItemSource | null>> = [];
    const sectionGates: Array<Deferred<AddByRssItemSections>> = [];
    const store = createAddByRssNowPlayingSectionsStore<Context>({
      fetchSections: () => {
        const gate = deferred<AddByRssItemSections>();
        sectionGates.push(gate);
        return gate.promise;
      },
      resolveSource: () => {
        const gate = deferred<AddByRssNowPlayingItemSource | null>();
        sourceGates.push(gate);
        return gate.promise;
      },
    });
    const episode = resource('episode-guid-2');

    store.track(episode);
    store.reset();
    at(sourceGates, 0).resolve(playingSource('phone-channel-7-episode-guid-2'));
    await at(sourceGates, 0).promise;
    await flush();
    expect(store.getSnapshot()).toEqual(IDLE_ADD_BY_RSS_NOW_PLAYING_SECTIONS);

    store.track(episode);
    at(sourceGates, 1).resolve(playingSource('phone-channel-7-episode-guid-2'));
    await at(sourceGates, 1).promise;
    await flush();
    const pending = store.load(context);
    store.reset();
    at(sectionGates, 0).resolve(sections);
    await pending;
    await flush();

    expect(store.getSnapshot()).toEqual(IDLE_ADD_BY_RSS_NOW_PLAYING_SECTIONS);
  });

  it('drops an answer that arrives after another item is tracked', async () => {
    const sourceGates: Array<Deferred<AddByRssNowPlayingItemSource | null>> = [];
    const sectionGates: Array<Deferred<AddByRssItemSections>> = [];
    const store = createAddByRssNowPlayingSectionsStore<Context>({
      fetchSections: () => {
        const gate = deferred<AddByRssItemSections>();
        sectionGates.push(gate);
        return gate.promise;
      },
      resolveSource: () => {
        const gate = deferred<AddByRssNowPlayingItemSource | null>();
        sourceGates.push(gate);
        return gate.promise;
      },
    });
    const firstEpisode = resource('episode-guid-2');
    const secondEpisode = resource('episode-guid-9');

    store.track(firstEpisode);
    at(sourceGates, 0).resolve(playingSource('phone-channel-7-episode-guid-2'));
    await at(sourceGates, 0).promise;
    await flush();
    const pending = store.load(context);
    store.track(secondEpisode);
    at(sectionGates, 0).resolve(sections);
    at(sourceGates, 1).resolve(playingSource('phone-channel-7-episode-guid-9'));
    await pending;
    await at(sourceGates, 1).promise;
    await flush();

    expect(store.getSnapshot().key).toBe(addByRssNowPlayingSectionsKey(secondEpisode));
    expect(store.getSnapshot().sourceStatus).toBe('resolved');
    expect(store.getSnapshot().source?.itemIdText).toBe('phone-channel-7-episode-guid-9');
    expect(store.getSnapshot().sections).toBeNull();
    expect(store.getSnapshot().sectionsStatus).toBe('idle');
  });
});

describe('shouldAutoLoadAddByRssNowPlayingChapters', () => {
  const load = (
    overrides: {
      isAuthenticated?: boolean;
      offlineModeEnabled?: boolean;
      snapshot?: AddByRssNowPlayingSectionsSnapshot;
    } = {}
  ): boolean =>
    shouldAutoLoadAddByRssNowPlayingChapters({
      isAuthenticated: overrides.isAuthenticated ?? true,
      offlineModeEnabled: overrides.offlineModeEnabled ?? false,
      snapshot: overrides.snapshot ?? readySnapshot(),
    });

  it('is true only for a resolved chapters item while signed in and Offline Mode is off', () => {
    expect(load()).toBe(true);
    expect(
      load({
        snapshot: readySnapshot({
          source: playingSource('episode-guid-2', {
            chaptersFeedUrl: undefined,
            transcriptUrl: 'https://example.com/episode.vtt',
          }),
        }),
      })
    ).toBe(false);
    expect(load({ isAuthenticated: false })).toBe(false);
    expect(load({ offlineModeEnabled: true })).toBe(false);
    expect(load({ snapshot: readySnapshot({ sectionsStatus: 'loading' }) })).toBe(false);
    expect(load({ snapshot: readySnapshot({ sourceStatus: 'resolving' }) })).toBe(false);
    expect(load({ snapshot: readySnapshot({ source: null }) })).toBe(false);
  });
});
