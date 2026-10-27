import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_HOME_VIEW_MODE } from '../../prefs/homeListPrefs';
import { readBrowseListPrefs } from '../browse/browseListPrefs';
import {
  readRecommendationViewMode,
  writeRecommendationViewMode,
} from './recommendationsListPrefs';

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

describe('recommendationsListPrefs', () => {
  beforeEach(() => {
    inMemoryStore.clear();
  });

  it('opens on the list when nothing has been chosen', async () => {
    await expect(readRecommendationViewMode('podcasts')).resolves.toBe(DEFAULT_HOME_VIEW_MODE);
  });

  it('keeps a Recommendations podcasts grid off albums and off Browse podcasts', async () => {
    await writeRecommendationViewMode('podcasts', 'grid');

    await expect(readRecommendationViewMode('podcasts')).resolves.toBe('grid');
    await expect(readRecommendationViewMode('albums')).resolves.toBe('list');
    await expect(readBrowseListPrefs()).resolves.toMatchObject({ viewMode: 'list' });
  });
});
