import { describe, expect, it } from 'vitest';

import { MediumEnum } from '@podverse/helpers';

import { detectDuckTypedPublisherMediumId } from './publisher.js';

describe('detectDuckTypedPublisherMediumId', () => {
  it('returns null when the feed medium is not publisher', () => {
    expect(
      detectDuckTypedPublisherMediumId({
        medium: 'podcast',
        podcastRemoteItems: [{ medium: 'music' }],
      })
    ).toBeNull();
  });

  it('returns PublisherPodcast when a publisher feed has no remote items', () => {
    expect(
      detectDuckTypedPublisherMediumId({
        medium: 'publisher',
        podcastRemoteItems: [],
      })
    ).toBe(MediumEnum.PublisherPodcast);
  });

  it('returns PublisherPodcast when every remote item omits medium', () => {
    expect(
      detectDuckTypedPublisherMediumId({
        medium: 'publisher',
        podcastRemoteItems: [{}, { medium: null }, { medium: '' }],
      })
    ).toBe(MediumEnum.PublisherPodcast);
  });

  it('returns PublisherMusic when named music items outnumber blank mediums', () => {
    expect(
      detectDuckTypedPublisherMediumId({
        medium: 'publisher',
        podcastRemoteItems: [
          { medium: 'music' },
          { medium: 'music' },
          {},
          { medium: null },
          { medium: '' },
        ],
      })
    ).toBe(MediumEnum.PublisherMusic);
  });

  it('returns PublisherVideo when remote items are mostly video', () => {
    expect(
      detectDuckTypedPublisherMediumId({
        medium: 'publisher',
        podcastRemoteItems: [{ medium: 'video' }, { medium: 'video' }, { medium: 'podcast' }],
      })
    ).toBe(MediumEnum.PublisherVideo);
  });
});
