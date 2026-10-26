import { beforeEach, describe, expect, it, vi } from 'vitest';

import { readBrowseListPrefs } from '../screens/browse/browseListPrefs';
import {
  DEFAULT_HOME_RANGE,
  DEFAULT_HOME_SORT,
  DEFAULT_HOME_VIEW_MODE,
  homeClipSortToApiSort,
  homeClipsPrefsChangeRefetches,
  homeClipsQueryFromPrefs,
  homeSortOptionsFor,
  homeSortToApiRange,
  isHomeFilterMediaType,
  isHomeSortableMediaType,
  isHomeViewModeMediaType,
  readHomeListPrefs,
  resolveHomeSort,
  subscribeHomeListPrefs,
  writeHomeRange,
  writeHomeSort,
  writeHomeViewMode,
} from './homeListPrefs';

const inMemoryStore = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => {
  return {
    default: {
      getItem: vi.fn(async (key: string) => {
        return inMemoryStore.has(key) ? (inMemoryStore.get(key) ?? null) : null;
      }),
      removeItem: vi.fn(async (key: string) => {
        inMemoryStore.delete(key);
      }),
      setItem: vi.fn(async (key: string, value: string) => {
        inMemoryStore.set(key, value);
      }),
    },
  };
});

describe('homeListPrefs', () => {
  beforeEach(() => {
    inMemoryStore.clear();
  });

  it('opens with the documented defaults when nothing has been chosen', async () => {
    await expect(readHomeListPrefs('podcasts')).resolves.toEqual({
      range: DEFAULT_HOME_RANGE,
      sort: DEFAULT_HOME_SORT,
      viewMode: DEFAULT_HOME_VIEW_MODE,
    });
  });

  it('opens Clips on Recent when nothing is stored', async () => {
    await expect(readHomeListPrefs('clips')).resolves.toEqual({
      range: DEFAULT_HOME_RANGE,
      sort: 'recent',
      viewMode: DEFAULT_HOME_VIEW_MODE,
    });
  });

  it('defaults the view mode to list', () => {
    expect(DEFAULT_HOME_VIEW_MODE).toBe('list');
  });

  it('remembers grid on artists without changing podcasts', async () => {
    await writeHomeViewMode('artists', 'grid');

    await expect(readHomeListPrefs('artists')).resolves.toMatchObject({ viewMode: 'grid' });
    await expect(readHomeListPrefs('podcasts')).resolves.toMatchObject({
      viewMode: DEFAULT_HOME_VIEW_MODE,
    });
    await expect(readHomeListPrefs('albums')).resolves.toMatchObject({
      viewMode: DEFAULT_HOME_VIEW_MODE,
    });
  });

  it('leaves Browse podcasts on list when Home podcasts is grid', async () => {
    await writeHomeViewMode('podcasts', 'grid');

    await expect(readHomeListPrefs('podcasts')).resolves.toMatchObject({ viewMode: 'grid' });
    await expect(readBrowseListPrefs()).resolves.toMatchObject({
      viewMode: DEFAULT_HOME_VIEW_MODE,
    });
  });

  it('leaves the sort alone when the view changes, and the view alone when the sort does', async () => {
    await writeHomeSort('podcasts', 'recent');
    await writeHomeViewMode('podcasts', 'grid');

    await expect(readHomeListPrefs('podcasts')).resolves.toMatchObject({
      sort: 'recent',
      viewMode: 'grid',
    });
  });

  it('ignores a stored view mode it does not recognise', async () => {
    inMemoryStore.set('sort.podcasts', JSON.stringify({ viewMode: 'carousel' }));

    await expect(readHomeListPrefs('podcasts')).resolves.toMatchObject({
      viewMode: DEFAULT_HOME_VIEW_MODE,
    });
  });

  it('uses the podcasts view mode for a channel type that has none of its own', async () => {
    inMemoryStore.set('sort.podcasts', JSON.stringify({ viewMode: 'grid' }));

    await expect(readHomeListPrefs('albums')).resolves.toMatchObject({ viewMode: 'grid' });
  });

  it('keeps a sort per media type, so one list says nothing about another', async () => {
    await writeHomeSort('podcasts', 'recent');

    await expect(readHomeListPrefs('podcasts')).resolves.toMatchObject({ sort: 'recent' });
    await expect(readHomeListPrefs('episodes')).resolves.toMatchObject({
      sort: DEFAULT_HOME_SORT,
    });
  });

  it('ignores a stored sort it does not recognise', async () => {
    inMemoryStore.set('sort.podcasts', JSON.stringify({ sort: 'oldest' }));

    await expect(readHomeListPrefs('podcasts')).resolves.toMatchObject({
      sort: DEFAULT_HOME_SORT,
    });
  });

  it('reads a stored A-Z on Clips as Recent', async () => {
    inMemoryStore.set('sort.clips', JSON.stringify({ sort: 'alphabetical' }));

    await expect(readHomeListPrefs('clips')).resolves.toMatchObject({ sort: 'recent' });
  });

  it('does not store an A-Z choice on Clips', async () => {
    await writeHomeSort('clips', 'popularity');
    await writeHomeSort('clips', 'alphabetical');

    await expect(readHomeListPrefs('clips')).resolves.toMatchObject({ sort: 'popularity' });
  });

  it('remembers popularity per media type', async () => {
    await writeHomeSort('podcasts', 'popularity');

    await expect(readHomeListPrefs('podcasts')).resolves.toMatchObject({ sort: 'popularity' });
    await expect(readHomeListPrefs('episodes')).resolves.toMatchObject({
      sort: DEFAULT_HOME_SORT,
    });
  });

  it('remembers the popularity window per media type and opens on week when none is stored', async () => {
    await writeHomeRange('podcasts', 'month');

    await expect(readHomeListPrefs('podcasts')).resolves.toMatchObject({
      range: 'month',
      sort: 'popularity',
    });
    await expect(readHomeListPrefs('episodes')).resolves.toMatchObject({
      range: DEFAULT_HOME_RANGE,
    });
  });

  it('remembers Popularity and its window on Clips', async () => {
    await writeHomeRange('clips', 'month');

    await expect(readHomeListPrefs('clips')).resolves.toMatchObject({
      range: 'month',
      sort: 'popularity',
    });
  });

  it('ignores a stored range it does not recognise', async () => {
    inMemoryStore.set('sort.podcasts', JSON.stringify({ range: 'fortnight', sort: 'popularity' }));

    await expect(readHomeListPrefs('podcasts')).resolves.toMatchObject({
      range: DEFAULT_HOME_RANGE,
      sort: 'popularity',
    });
  });

  it('sends the chosen window only while the order is popularity', () => {
    expect(homeSortToApiRange('alphabetical', 'month')).toBeNull();
    expect(homeSortToApiRange('recent', 'day')).toBeNull();
    expect(homeSortToApiRange('popularity', 'all-time')).toBe('all-time');
    expect(homeSortToApiRange('popularity')).toBe(DEFAULT_HOME_RANGE);
  });

  it('offers Recent and Popularity on Clips, and A-Z on the other sortable lists', () => {
    expect(homeSortOptionsFor('clips')).toEqual(['recent', 'popularity']);
    expect(homeSortOptionsFor('podcasts')).toEqual(['alphabetical', 'recent', 'popularity']);
    expect(homeSortOptionsFor('episodes')).toEqual(['alphabetical', 'recent', 'popularity']);
    expect(homeSortOptionsFor('artists')).toEqual(['alphabetical', 'recent', 'popularity']);
    expect(homeSortOptionsFor('albums')).toEqual(['alphabetical', 'recent', 'popularity']);
    expect(homeSortOptionsFor('tracks')).toEqual(['alphabetical', 'recent', 'popularity']);
  });

  it('reads a Clips A-Z token as Recent and keeps A-Z on the other lists', () => {
    expect(resolveHomeSort('clips', 'alphabetical')).toBe('recent');
    expect(resolveHomeSort('podcasts', 'alphabetical')).toBe('alphabetical');
    expect(resolveHomeSort('episodes', undefined)).toBe(DEFAULT_HOME_SORT);
  });

  it('maps a Home clips order onto the clip endpoint sort', () => {
    expect(homeClipSortToApiSort('recent')).toBe('recent');
    expect(homeClipSortToApiSort('popularity')).toBe('top');
    expect(homeClipSortToApiSort('alphabetical')).toBe('recent');
  });

  it('builds the Home clips request from the order and window', () => {
    expect(homeClipsQueryFromPrefs({ range: 'week', sort: 'recent' })).toEqual({
      range: null,
      sort: 'recent',
    });
    expect(homeClipsQueryFromPrefs({ range: 'month', sort: 'popularity' })).toEqual({
      range: 'month',
      sort: 'top',
    });
    expect(homeClipsQueryFromPrefs({ range: 'week', sort: 'alphabetical' })).toEqual({
      range: null,
      sort: 'recent',
    });
  });

  describe('homeClipsPrefsChangeRefetches', () => {
    const signedInClips = {
      isAuthenticated: true,
      mediaType: 'clips' as const,
      offlineModeEnabled: false,
    };
    const recentToPopularity = {
      next: { range: 'week' as const, sort: 'popularity' as const },
      previous: { range: 'week' as const, sort: 'recent' as const },
    };

    it('refetches when Clips moves from Recent to Popularity', () => {
      expect(homeClipsPrefsChangeRefetches({ ...signedInClips, ...recentToPopularity })).toBe(true);
    });

    it('refetches when the Popularity window changes', () => {
      expect(
        homeClipsPrefsChangeRefetches({
          ...signedInClips,
          next: { range: 'month', sort: 'popularity' },
          previous: { range: 'week', sort: 'popularity' },
        })
      ).toBe(true);
    });

    it('does not refetch when only a window Recent never sends changes', () => {
      expect(
        homeClipsPrefsChangeRefetches({
          ...signedInClips,
          next: { range: 'month', sort: 'recent' },
          previous: { range: 'week', sort: 'recent' },
        })
      ).toBe(false);
    });

    it('does not refetch off the Clips chip, signed out, or with Offline Mode on', () => {
      expect(
        homeClipsPrefsChangeRefetches({
          ...signedInClips,
          ...recentToPopularity,
          mediaType: 'podcasts',
        })
      ).toBe(false);
      expect(
        homeClipsPrefsChangeRefetches({
          ...signedInClips,
          ...recentToPopularity,
          isAuthenticated: false,
        })
      ).toBe(false);
      expect(
        homeClipsPrefsChangeRefetches({
          ...signedInClips,
          ...recentToPopularity,
          offlineModeEnabled: true,
        })
      ).toBe(false);
    });
  });

  it('does not notify a podcasts watcher when artists view mode changes', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeHomeListPrefs('podcasts', listener);

    await writeHomeViewMode('artists', 'grid');
    expect(listener).not.toHaveBeenCalled();

    unsubscribe();
  });

  it('notifies a watcher when the list it is watching changes', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeHomeListPrefs('podcasts', listener);

    await writeHomeSort('podcasts', 'recent');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    await writeHomeSort('podcasts', 'alphabetical');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('offers the same three orders on every Home list except Livestreams', () => {
    expect(isHomeSortableMediaType('podcasts')).toBe(true);
    expect(isHomeSortableMediaType('episodes')).toBe(true);
    expect(isHomeSortableMediaType('clips')).toBe(true);
    expect(isHomeSortableMediaType('artists')).toBe(true);
    expect(isHomeSortableMediaType('albums')).toBe(true);
    expect(isHomeSortableMediaType('tracks')).toBe(true);
    expect(isHomeSortableMediaType('livestreams')).toBe(false);
  });

  it('offers the grid on channel and album lists, where artwork identifies the row', () => {
    expect(isHomeViewModeMediaType('podcasts')).toBe(true);
    expect(isHomeViewModeMediaType('artists')).toBe(true);
    expect(isHomeViewModeMediaType('albums')).toBe(true);
    expect(isHomeViewModeMediaType('episodes')).toBe(false);
    expect(isHomeViewModeMediaType('tracks')).toBe(false);
    expect(isHomeViewModeMediaType('clips')).toBe(false);
    expect(isHomeViewModeMediaType('livestreams')).toBe(false);
  });

  it('offers Filter only on complete local channel lists', () => {
    expect(isHomeFilterMediaType('podcasts')).toBe(true);
    expect(isHomeFilterMediaType('artists')).toBe(true);
    expect(isHomeFilterMediaType('albums')).toBe(true);
    expect(isHomeFilterMediaType('episodes')).toBe(false);
    expect(isHomeFilterMediaType('tracks')).toBe(false);
    expect(isHomeFilterMediaType('clips')).toBe(false);
    expect(isHomeFilterMediaType('livestreams')).toBe(false);
  });
});
