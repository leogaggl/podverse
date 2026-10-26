import { describe, expect, it } from 'vitest';

import { splitUpcomingLiveItemsPage } from './upcomingLiveItemsPage.js';

describe('splitUpcomingLiveItemsPage', () => {
  it('reads only live items when the page sits inside the live group', () => {
    expect(splitUpcomingLiveItemsPage({ skip: 10, take: 20, liveCount: 100 })).toEqual({
      live: { skip: 10, take: 20 },
      pending: null,
    });
  });

  it('reads the rest of the live group, then fills the page from the scheduled group', () => {
    expect(splitUpcomingLiveItemsPage({ skip: 0, take: 60, liveCount: 5 })).toEqual({
      live: { skip: 0, take: 5 },
      pending: { skip: 0, take: 55 },
    });
  });

  it('reads only scheduled items when the page starts past the live group', () => {
    expect(splitUpcomingLiveItemsPage({ skip: 60, take: 60, liveCount: 5 })).toEqual({
      live: null,
      pending: { skip: 55, take: 60 },
    });
  });

  it('reads only scheduled items when there are no live items', () => {
    expect(splitUpcomingLiveItemsPage({ skip: 0, take: 60, liveCount: 0 })).toEqual({
      live: null,
      pending: { skip: 0, take: 60 },
    });
  });

  it('skips the scheduled group when the live group exactly fills the page', () => {
    expect(splitUpcomingLiveItemsPage({ skip: 0, take: 60, liveCount: 60 })).toEqual({
      live: { skip: 0, take: 60 },
      pending: null,
    });
  });
});
