import { getActiveMQArtemisService } from '@workers/factories/activeMQArtemisService.js';
import { getPodcastIndexService } from '@workers/factories/podcastIndexService.js';

import { MQ_QUEUES, resolveParserMaxFeedBodyBytes } from '@podverse/helpers';
import { mqRSSAdd } from '@podverse/mq';
import type {
  MatchFeed,
  MatchItem,
  RepointParseRequest,
  SurvivorFeedSnapshot,
} from '@podverse/orm';
import { getAndParseRSSFeed } from '@podverse/parser';

type ParsedFeed = Awaited<ReturnType<typeof getAndParseRSSFeed>>;

function itunesId(parsed: ParsedFeed): string | null {
  const ids = parsed.podcastId;
  if (ids === undefined) {
    return null;
  }
  for (const entry of ids) {
    if (entry.platform !== 'apple' && entry.platform !== 'itunes') {
      continue;
    }
    if (typeof entry.id === 'string' && entry.id !== '') {
      return entry.id;
    }
  }
  return null;
}

function selfUrl(parsed: ParsedFeed, fetchedUrl: string): string {
  const self = parsed.pubsub?.self;
  if (typeof self === 'string' && self.trim() !== '') {
    return self;
  }
  return fetchedUrl;
}

function matchItems(parsed: ParsedFeed): MatchItem[] {
  return parsed.items.map((item, index) => {
    const published = item.pubDate instanceof Date ? item.pubDate.getTime() : null;
    return {
      id: index + 1,
      guid: item.guid.trim() === '' ? null : item.guid,
      enclosureUrl: item.enclosure.url.trim() === '' ? null : item.enclosure.url,
      title: item.title === undefined || item.title.trim() === '' ? null : item.title,
      pubDateMs: published !== null && Number.isFinite(published) ? published : null,
      durationSeconds: Number.isFinite(item.duration) ? item.duration : null,
    };
  });
}

function matchFeedFromParsed(parsed: ParsedFeed, fetchedUrl: string): MatchFeed {
  const podcastGuid =
    typeof parsed.guid === 'string' && parsed.guid.trim() !== '' ? parsed.guid : null;
  return {
    podcastGuid,
    itunesId: itunesId(parsed),
    selfUrl: selfUrl(parsed, fetchedUrl),
    items: matchItems(parsed),
  };
}

export async function fetchSurvivorFeed(
  podcastIndexId: number
): Promise<SurvivorFeedSnapshot | null> {
  try {
    const data = await getPodcastIndexService().podcastGetById(podcastIndexId);
    const url = data?.feed?.url;
    if (typeof url !== 'string' || url.trim() === '') {
      return null;
    }
    const parsed = await getAndParseRSSFeed(
      url,
      resolveParserMaxFeedBodyBytes(process.env.PARSER_MAX_FEED_BODY_BYTES)
    );
    return { url, match: matchFeedFromParsed(parsed, url) };
  } catch {
    console.warn(`Survivor feed fetch failed for podcast index id ${podcastIndexId}.`);
    return null;
  }
}

export async function enqueueRepointParse(request: RepointParseRequest): Promise<void> {
  await mqRSSAdd(
    getActiveMQArtemisService(),
    {
      ...MQ_QUEUES['rss-on-demand'],
      closeAfterSend: true,
      feedUrl: request.feedUrl,
      podcast_index_id: request.podcastIndexId,
    },
    request.options
  );
}
