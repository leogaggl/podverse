import { describe, expect, it } from 'vitest';

import { MediumEnum } from '@podverse/helpers/medium';
import type { FeedObject } from '@podverse/parser-mapping';
import { convertParsedRSSFeedToCompat, Phase4Medium } from '@podverse/parser-mapping';

import { resourceTypeUpdatesFromStoredRows } from './storedResourceType';

const FEED_URL = 'https://example.com/feed.xml';

const mappedBundle = (medium?: Phase4Medium, remoteMedium?: Phase4Medium) => {
  const items: FeedObject['items'] = [];
  const parsed = {
    explicit: false,
    items,
    link: FEED_URL,
    title: 'Feed',
    ...(medium !== undefined ? { medium } : {}),
    ...(remoteMedium !== undefined
      ? { podcastRemoteItems: [{ feedGuid: 'g', medium: remoteMedium }] }
      : {}),
  } satisfies FeedObject;
  return convertParsedRSSFeedToCompat(parsed);
};

const storedRow = (mappedFeedJson: string | null, resourceType: string, feedUrl = FEED_URL) => ({
  feedUrl,
  mappedFeedJson,
  resourceType,
});

describe('resourceTypeUpdatesFromStoredRows', () => {
  it('retypes a music bundle stored as a podcast to an album', () => {
    const mapped = mappedBundle(Phase4Medium.Music);
    expect(mapped.channel.channel.medium_id).toBe(MediumEnum.Music);

    expect(
      resourceTypeUpdatesFromStoredRows([storedRow(JSON.stringify(mapped), 'podcasts')])
    ).toEqual([{ feedUrl: FEED_URL, resourceType: 'albums' }]);
  });

  it('retypes a publisher whose remote items are music to an artist', () => {
    const mapped = mappedBundle(Phase4Medium.Publisher, Phase4Medium.Music);

    expect(
      resourceTypeUpdatesFromStoredRows([
        storedRow(JSON.stringify(mapped), 'podcasts', 'https://example.com/artist.xml'),
      ])
    ).toEqual([{ feedUrl: 'https://example.com/artist.xml', resourceType: 'artists' }]);
  });

  it('leaves a podcast bundle stored as podcasts unchanged', () => {
    const mapped = mappedBundle();
    expect(mapped.channel.channel.medium_id).toBe(MediumEnum.Podcast);

    expect(
      resourceTypeUpdatesFromStoredRows([storedRow(JSON.stringify(mapped), 'podcasts')])
    ).toEqual([]);
  });

  it('leaves a music bundle already stored as an album unchanged', () => {
    const mapped = mappedBundle(Phase4Medium.Music);

    expect(
      resourceTypeUpdatesFromStoredRows([storedRow(JSON.stringify(mapped), 'albums')])
    ).toEqual([]);
  });

  it('skips a missing or unreadable bundle', () => {
    expect(
      resourceTypeUpdatesFromStoredRows([
        storedRow(null, 'podcasts', 'https://example.com/empty.xml'),
        storedRow('{', 'albums', 'https://example.com/broken.xml'),
      ])
    ).toEqual([]);
  });

  it('replaces an unrecognized stored type with the medium on the bundle', () => {
    const mapped = mappedBundle(Phase4Medium.Music);

    expect(
      resourceTypeUpdatesFromStoredRows([
        storedRow(JSON.stringify(mapped), 'unrecognized', 'https://example.com/was-live.xml'),
      ])
    ).toEqual([{ feedUrl: 'https://example.com/was-live.xml', resourceType: 'albums' }]);
  });
});
