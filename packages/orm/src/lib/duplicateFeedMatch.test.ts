import { describe, expect, it } from 'vitest';

import type { MatchFeed, MatchItem, PairAssessment } from './duplicateFeedMatch.js';
import { assessDuplicatePair, normalizeEnclosureUrl } from './duplicateFeedMatch.js';

const HOUR_MS = 60 * 60 * 1000;

function item(partial: Partial<MatchItem> & Pick<MatchItem, 'id'>): MatchItem {
  return {
    id: partial.id,
    guid: partial.guid === undefined ? null : partial.guid,
    enclosureUrl: partial.enclosureUrl === undefined ? null : partial.enclosureUrl,
    title: partial.title === undefined ? null : partial.title,
    pubDateMs: partial.pubDateMs === undefined ? null : partial.pubDateMs,
    durationSeconds: partial.durationSeconds === undefined ? null : partial.durationSeconds,
  };
}

function feed(items: MatchItem[], partial?: Partial<Omit<MatchFeed, 'items'>>): MatchFeed {
  return {
    podcastGuid: partial?.podcastGuid === undefined ? null : partial.podcastGuid,
    itunesId: partial?.itunesId === undefined ? null : partial.itunesId,
    selfUrl: partial?.selfUrl === undefined ? null : partial.selfUrl,
    items,
  };
}

function tiers(assessment: PairAssessment): string[] {
  return assessment.pairs.map((pair) => pair.tier);
}

describe('normalizeEnclosureUrl', () => {
  it('unwraps a podtrac prefix and drops the query', () => {
    expect(
      normalizeEnclosureUrl('https://dts.podtrac.com/redirect.mp3/example.com/ep.mp3?aid=1')
    ).toBe('https://example.com/ep.mp3');
    expect(normalizeEnclosureUrl('https://example.com/ep.mp3')).toBe('https://example.com/ep.mp3');
  });

  it('returns null when the value is not an http(s) URL', () => {
    expect(normalizeEnclosureUrl('not a url')).toBe(null);
    expect(normalizeEnclosureUrl('')).toBe(null);
  });
});

describe('assessDuplicatePair', () => {
  it('verifies a PowerPress-shaped pair with the same GUIDs and enclosures', () => {
    const oldItems = [1, 2, 3].map((id) =>
      item({
        id,
        guid: `guid-${id}`,
        enclosureUrl: `https://cdn.example.com/${id}.mp3`,
        title: `Episode ${id}`,
      })
    );
    const survivorItems = [1, 2, 3].map((id) =>
      item({
        id: id + 10,
        guid: `guid-${id}`,
        enclosureUrl: `https://cdn.example.com/${id}.mp3`,
        title: `Episode ${id}`,
      })
    );

    const assessment = assessDuplicatePair(feed(oldItems), feed(survivorItems));

    expect(assessment.status).toBe('verified');
    expect(assessment.confidence).toBe(1);
    expect(assessment.stats.matched).toBe(3);
    expect(assessment.stats.byTier).toEqual({ guid: 3, enclosure: 0, fuzzy: 0 });
    expect(tiers(assessment)).toEqual(['guid', 'guid', 'guid']);
  });

  it('verifies a host move on GUIDs when enclosure hosts differ', () => {
    const oldItems = [1, 2, 3].map((id) =>
      item({
        id,
        guid: `guid-${id}`,
        enclosureUrl: `https://old.example.com/${id}.mp3`,
      })
    );
    const survivorItems = [1, 2, 3].map((id) =>
      item({
        id: id + 10,
        guid: `guid-${id}`,
        enclosureUrl: `https://new.example.com/${id}.mp3`,
      })
    );

    const assessment = assessDuplicatePair(feed(oldItems), feed(survivorItems));

    expect(assessment.status).toBe('verified');
    expect(assessment.stats.byTier).toEqual({ guid: 3, enclosure: 0, fuzzy: 0 });
  });

  it('does not pair a junk GUID repeated on every item', () => {
    const oldItems = [1, 2, 3].map((id) =>
      item({
        id,
        guid: '1',
        enclosureUrl: `https://old.example.com/${id}.mp3`,
        title: `Old ${id}`,
        pubDateMs: id * 10 * 24 * HOUR_MS,
        durationSeconds: 1000 + id,
      })
    );
    const survivorItems = [1, 2, 3].map((id) =>
      item({
        id: id + 10,
        guid: '1',
        enclosureUrl: `https://new.example.com/${id}.mp3`,
        title: `New ${id}`,
        pubDateMs: id * 10 * 24 * HOUR_MS + 10 * 24 * HOUR_MS,
        durationSeconds: 5000 + id,
      })
    );

    const assessment = assessDuplicatePair(feed(oldItems), feed(survivorItems));

    expect(assessment.pairs).toEqual([]);
    expect(assessment.status).toBe('needs_review');
    expect(assessment.confidence).toBe(0);
  });

  it('pairs enclosures after a repeated GUID is skipped', () => {
    const assessment = assessDuplicatePair(
      feed([
        item({
          id: 1,
          guid: '1',
          enclosureUrl: 'https://dts.podtrac.com/redirect.mp3/example.com/ep.mp3?aid=1',
        }),
        item({
          id: 2,
          guid: '1',
          enclosureUrl: 'https://cdn.example.com/other.mp3',
        }),
      ]),
      feed([
        item({ id: 11, guid: '1', enclosureUrl: 'https://example.com/ep.mp3' }),
        item({ id: 12, guid: 'other', enclosureUrl: 'https://cdn.example.com/other.mp3' }),
      ])
    );

    expect(assessment.pairs).toEqual([
      { fromId: 1, toId: 11, tier: 'enclosure' },
      { fromId: 2, toId: 12, tier: 'enclosure' },
    ]);
    expect(assessment.status).toBe('needs_review');
  });

  it('verifies one fuzzy episode when the feeds share a podcast GUID', () => {
    const published = Date.UTC(2024, 0, 1);
    const assessment = assessDuplicatePair(
      feed(
        [
          item({
            id: 1,
            guid: 'old-guid',
            enclosureUrl: 'https://old.example.com/ep.mp3',
            title: '  The Show   Episode ',
            pubDateMs: published,
            durationSeconds: 1800,
          }),
        ],
        { podcastGuid: 'EAD4C236-BF58-58C6-A2C6-A6B28D128CB6' }
      ),
      feed(
        [
          item({
            id: 9,
            guid: 'new-guid',
            enclosureUrl: 'https://new.example.com/ep.mp3',
            title: 'the show episode',
            pubDateMs: published + 20 * HOUR_MS,
            durationSeconds: 1810,
          }),
        ],
        { podcastGuid: 'ead4c236-bf58-58c6-a2c6-a6b28d128cb6' }
      )
    );

    expect(assessment.pairs).toEqual([{ fromId: 1, toId: 9, tier: 'fuzzy' }]);
    expect(assessment.stats.sharedPodcastGuid).toBe(true);
    expect(assessment.status).toBe('verified');
    expect(assessment.confidence).toBe(1);
  });

  it('sends a single fuzzy episode to review when no identifier is shared', () => {
    const published = Date.UTC(2024, 0, 1);
    const assessment = assessDuplicatePair(
      feed([
        item({
          id: 1,
          guid: 'old-guid',
          enclosureUrl: 'https://old.example.com/ep.mp3',
          title: 'Episode',
          pubDateMs: published,
          durationSeconds: 1800,
        }),
      ]),
      feed([
        item({
          id: 9,
          guid: 'new-guid',
          enclosureUrl: 'https://new.example.com/ep.mp3',
          title: 'Episode',
          pubDateMs: published + 20 * HOUR_MS,
          durationSeconds: 1810,
        }),
      ])
    );

    expect(assessment.pairs).toEqual([{ fromId: 1, toId: 9, tier: 'fuzzy' }]);
    expect(assessment.status).toBe('needs_review');
  });

  it('does not fuzzy-pair two old items with one survivor item', () => {
    const published = Date.UTC(2024, 0, 1);
    const shared = {
      guid: null,
      title: 'Same title',
      pubDateMs: published,
      durationSeconds: 900,
    };
    const assessment = assessDuplicatePair(
      feed([
        item({ id: 1, enclosureUrl: 'https://old.example.com/a.mp3', ...shared }),
        item({ id: 2, enclosureUrl: 'https://old.example.com/b.mp3', ...shared }),
      ]),
      feed([item({ id: 9, enclosureUrl: 'https://new.example.com/a.mp3', ...shared })])
    );

    expect(assessment.pairs).toEqual([]);
    expect(assessment.status).toBe('needs_review');
  });

  it('does not fuzzy-pair one old item with two survivor items', () => {
    const published = Date.UTC(2024, 0, 1);
    const shared = {
      guid: null,
      title: 'Same title',
      pubDateMs: published,
      durationSeconds: 900,
    };
    const assessment = assessDuplicatePair(
      feed([item({ id: 1, enclosureUrl: 'https://old.example.com/a.mp3', ...shared })]),
      feed([
        item({ id: 8, enclosureUrl: 'https://new.example.com/a.mp3', ...shared }),
        item({ id: 9, enclosureUrl: 'https://new.example.com/b.mp3', ...shared }),
      ])
    );

    expect(assessment.pairs).toEqual([]);
    expect(assessment.status).toBe('needs_review');
  });

  it('verifies one episode match when iTunes ids are equal after trim', () => {
    const assessment = assessDuplicatePair(
      feed([item({ id: 1, guid: 'same', enclosureUrl: 'https://old.example.com/ep.mp3' })], {
        itunesId: ' 12345 ',
      }),
      feed([item({ id: 2, guid: 'same', enclosureUrl: 'https://new.example.com/ep.mp3' })], {
        itunesId: '12345',
      })
    );

    expect(assessment.stats.sharedItunesId).toBe(true);
    expect(assessment.stats.matched).toBe(1);
    expect(assessment.status).toBe('verified');
  });

  it('verifies on a self link when one episode matches', () => {
    const assessment = assessDuplicatePair(
      feed(
        [
          item({
            id: 1,
            guid: 'same',
            enclosureUrl: 'https://old.example.com/ep.mp3',
          }),
        ],
        { selfUrl: 'https://survivor.example/feed/' }
      ),
      feed(
        [
          item({
            id: 2,
            guid: 'same',
            enclosureUrl: 'https://new.example.com/ep.mp3',
          }),
        ],
        { selfUrl: 'https://survivor.example/feed?src=pi' }
      )
    );

    expect(assessment.stats.selfLinkAgrees).toBe(true);
    expect(assessment.stats.matched).toBe(1);
    expect(assessment.status).toBe('verified');
  });

  it('returns needs_review with confidence 0 when the survivor has no episodes', () => {
    const assessment = assessDuplicatePair(
      feed([item({ id: 1, guid: 'guid-1', enclosureUrl: 'https://cdn.example.com/1.mp3' })]),
      feed([])
    );

    expect(assessment).toEqual({
      status: 'needs_review',
      confidence: 0,
      pairs: [],
      stats: {
        oldCount: 1,
        survivorCount: 0,
        matched: 0,
        byTier: { guid: 0, enclosure: 0, fuzzy: 0 },
        sharedPodcastGuid: false,
        sharedItunesId: false,
        selfLinkAgrees: false,
      },
    });
  });

  it('verifies at 80 percent with at least 3 matches and reviews a smaller ratio', () => {
    const fourOfFive = assessDuplicatePair(
      feed(
        [1, 2, 3, 4, 5].map((id) =>
          item({ id, guid: `g-${id}`, enclosureUrl: `https://old.example.com/${id}.mp3` })
        )
      ),
      feed(
        [1, 2, 3, 4, 9].map((id) =>
          item({
            id: id + 10,
            guid: `g-${id}`,
            enclosureUrl: `https://new.example.com/${id}.mp3`,
          })
        )
      )
    );
    expect(fourOfFive.stats.matched).toBe(4);
    expect(fourOfFive.confidence).toBe(0.8);
    expect(fourOfFive.status).toBe('verified');

    const threeOfFour = assessDuplicatePair(
      feed(
        [1, 2, 3, 4].map((id) =>
          item({ id, guid: `g-${id}`, enclosureUrl: `https://old.example.com/${id}.mp3` })
        )
      ),
      feed(
        [1, 2, 3, 9].map((id) =>
          item({
            id: id + 10,
            guid: `g-${id}`,
            enclosureUrl: `https://new.example.com/${id}.mp3`,
          })
        )
      )
    );
    expect(threeOfFour.stats.matched).toBe(3);
    expect(threeOfFour.confidence).toBe(0.75);
    expect(threeOfFour.status).toBe('needs_review');
  });
});
