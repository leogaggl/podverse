import { describe, expect, it } from 'vitest';

import { selectVisibleBackgroundActivity } from './backgroundActivityDisplay';
import type { BackgroundActivitySnapshot } from './backgroundActivityStore';

const refreshEntry: BackgroundActivitySnapshot = [
  { kind: 'add_by_rss_refresh', completed: 0, total: 1 },
];

describe('selectVisibleBackgroundActivity', () => {
  it('drops add_by_rss_refresh when the account follows no feeds', () => {
    expect(selectVisibleBackgroundActivity(refreshEntry, { addByRSSFollowCount: 0 })).toEqual([]);
  });

  it('keeps add_by_rss_refresh when the account follows a feed', () => {
    expect(selectVisibleBackgroundActivity(refreshEntry, { addByRSSFollowCount: 1 })).toBe(
      refreshEntry
    );
  });

  it('leaves an empty snapshot empty and returns it unchanged', () => {
    const empty: BackgroundActivitySnapshot = [];
    expect(selectVisibleBackgroundActivity(empty, { addByRSSFollowCount: 0 })).toBe(empty);
    expect(selectVisibleBackgroundActivity(empty, { addByRSSFollowCount: 1 })).toBe(empty);
  });
});
