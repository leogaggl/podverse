import { describe, expect, it } from 'vitest';

import { homeItemDownloadItem, homeItemShareResource } from './homeItemRowActions';

const directoryEpisode = { title: 'Directory Episode' };
const rssFile = { title: 'RSS File' };

const sources = {
  addByRssItemsById: new Map([
    ['rss-file', { downloadItem: rssFile }],
    ['rss-none', { downloadItem: null }],
  ]),
  directoryItemsById: new Map([['ep-1', directoryEpisode]]),
};

describe('homeItemDownloadItem', () => {
  it('returns the stored directory item, and a share resource from the media type', () => {
    expect(homeItemDownloadItem({ id: 'ep-1' }, sources)).toBe(directoryEpisode);
    expect(homeItemDownloadItem({ id: 'ep-1', source: 'directory' }, sources)).toBe(
      directoryEpisode
    );
    expect(homeItemShareResource({ id: 'ep-1' }, 'episodes')).toBe('episode');
    expect(homeItemShareResource({ id: 'ep-1', source: 'directory' }, 'episodes')).toBe('episode');
    expect(homeItemShareResource({ id: 'ep-1' }, 'tracks')).toBe('track');
    expect(homeItemShareResource({ id: 'ep-1', source: 'directory' }, 'tracks')).toBe('track');
    expect(homeItemShareResource({ id: 'ep-1' }, 'livestreams')).toBe('episode');
    expect(homeItemShareResource({ id: 'ep-1', source: 'directory' }, 'livestreams')).toBe(
      'episode'
    );
  });

  it('returns undefined when the directory id is missing and still has a share resource', () => {
    expect(homeItemDownloadItem({ id: 'missing' }, sources)).toBeUndefined();
    expect(homeItemDownloadItem({ id: 'missing', source: 'directory' }, sources)).toBeUndefined();
    expect(homeItemShareResource({ id: 'missing' }, 'episodes')).toBe('episode');
    expect(homeItemShareResource({ id: 'missing', source: 'directory' }, 'tracks')).toBe('track');
  });

  it('returns the Add by RSS download item and no share resource', () => {
    expect(homeItemDownloadItem({ id: 'rss-file', source: 'addByRss' }, sources)).toBe(rssFile);
    expect(homeItemShareResource({ id: 'rss-file', source: 'addByRss' }, 'episodes')).toBeNull();
    expect(homeItemShareResource({ id: 'rss-file', source: 'addByRss' }, 'tracks')).toBeNull();
    expect(homeItemShareResource({ id: 'rss-file', source: 'addByRss' }, 'livestreams')).toBeNull();
  });

  it('returns undefined and no share resource when Add by RSS has no download item', () => {
    expect(homeItemDownloadItem({ id: 'rss-none', source: 'addByRss' }, sources)).toBeUndefined();
    expect(
      homeItemDownloadItem({ id: 'rss-missing', source: 'addByRss' }, sources)
    ).toBeUndefined();
    expect(homeItemShareResource({ id: 'rss-none', source: 'addByRss' }, 'episodes')).toBeNull();
    expect(homeItemShareResource({ id: 'rss-missing', source: 'addByRss' }, 'tracks')).toBeNull();
  });
});
