import { getMediumEnumValue } from '@podverse/helpers';

/**
 * Minimum feed shape for duck-typing a publisher into podcast/video/music.
 * Full `FeedObject` satisfies this; seed collectors may pass a partial.
 */
export type PublisherMediumDetectInput = {
  medium?: string | null;
  podcastRemoteItems?: Array<{ medium?: string | null } | null> | null;
};

// The sub-type comes from the remote items that name a medium. When none do, the spec's
// default (podcast) applies, so the feed is a podcast publisher.
export const detectDuckTypedPublisherMediumId = (parsedFeed: PublisherMediumDetectInput) => {
  const mediumRaw = parsedFeed.medium;
  const isPublisher = typeof mediumRaw === 'string' && mediumRaw.toLowerCase() === 'publisher';

  if (!isPublisher) {
    return null;
  }

  let countPodcast = 0;
  let countVideo = 0;
  let countMusic = 0;

  if (Array.isArray(parsedFeed.podcastRemoteItems)) {
    for (const ri of parsedFeed.podcastRemoteItems) {
      const m = (ri?.medium || '').toString().toLowerCase();
      if (!m) {
        continue;
      }
      if (m.includes('music')) {
        countMusic++;
      } else if (m.includes('video')) {
        countVideo++;
      } else if (m.includes('podcast')) {
        countPodcast++;
      }
    }
  }

  const maxCount = Math.max(countPodcast, countVideo, countMusic);
  if (maxCount === 0) {
    return getMediumEnumValue('publisherpodcast');
  } else if (maxCount === countVideo) {
    return getMediumEnumValue('publishervideo');
  } else if (maxCount === countMusic) {
    return getMediumEnumValue('publishermusic');
  }
  return getMediumEnumValue('publisherpodcast');
};
