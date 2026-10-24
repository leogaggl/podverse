import type { DTOChannel, DTOItem } from '@podverse/helpers';
import { buildArtistPath, isAlbumMediumId, isArtistMediumId } from '@podverse/helpers';

import { getApiRequestService } from '../../factories/apiRequestService';
import type { ArtistLineLink } from '../../lib/artistPublishers';
import { artistPublishersForAlbum } from '../../lib/artistPublishers';
import {
  resolveAddByRSSAlbumArtists,
  resolveDirectoryAlbumAddByRSSArtists,
} from './publisherLinks';
import {
  getAddByRSSAlbumSourceByIdText,
  getAddByRSSAlbumSourceByUrl,
  getAllAddByRSSPublisherLinks,
} from './storage';
import type { AddByRSSAlbumSource } from './types';

export type DeviceArtistLinksInput = {
  /** Canonical feed URL or idText of the Add by RSS album playing, when Add by RSS is playing. */
  addByRSS: { feedUrl: string | null; channelIdText: string | null } | null;
  channel: DTOChannel | null | undefined;
  item: DTOItem | null | undefined;
};

type DirectoryArtistRef = { feedGuid: string; feedUrl: string | null };

/** Session cache of directory artist lookups, including misses, keyed by feed guid. */
const directoryArtistLookups = new Map<string, Promise<ArtistLineLink | null>>();

const albumSourceFor = async (addByRSS: {
  feedUrl: string | null;
  channelIdText: string | null;
}): Promise<AddByRSSAlbumSource | null> => {
  if (addByRSS.feedUrl !== null) {
    return getAddByRSSAlbumSourceByUrl(addByRSS.feedUrl);
  }
  if (addByRSS.channelIdText !== null) {
    return getAddByRSSAlbumSourceByIdText(addByRSS.channelIdText);
  }
  return null;
};

const lookupDirectoryArtist = (ref: DirectoryArtistRef): Promise<ArtistLineLink | null> => {
  const cached = directoryArtistLookups.get(ref.feedGuid);
  if (cached !== undefined) {
    return cached;
  }

  const pending = getApiRequestService()
    .reqChannelGetDirectoryMatch({ feed_guid: ref.feedGuid, feed_url: ref.feedUrl })
    .then((match): ArtistLineLink | null => {
      const title = match?.title?.trim() ?? '';
      if (match === null || !isArtistMediumId(match.medium_id) || title.length === 0) {
        return null;
      }
      return {
        idText: match.id_text,
        title,
        href: buildArtistPath(match.id_text),
      };
    })
    .catch((error: unknown) => {
      console.error('Directory artist lookup failed', error);
      if (directoryArtistLookups.get(ref.feedGuid) === pending) {
        directoryArtistLookups.delete(ref.feedGuid);
      }
      return null;
    });

  directoryArtistLookups.set(ref.feedGuid, pending);
  return pending;
};

const lookupDirectoryArtists = async (
  refs: readonly DirectoryArtistRef[]
): Promise<ArtistLineLink[]> => {
  const resolved: ArtistLineLink[] = [];
  const seen = new Set<string>();
  for (const ref of refs) {
    const link = await lookupDirectoryArtist(ref);
    if (link === null || seen.has(link.idText)) {
      continue;
    }
    seen.add(link.idText);
    resolved.push(link);
  }
  return resolved;
};

/** Artist links from this browser's Add by RSS data, for when no verified artist exists. */
export const resolveDeviceArtistLinks = async (
  input: DeviceArtistLinksInput
): Promise<ArtistLineLink[]> => {
  const links = await getAllAddByRSSPublisherLinks();

  if (input.addByRSS !== null) {
    const source = await albumSourceFor(input.addByRSS);
    if (source === null) {
      return [];
    }
    const resolution = resolveAddByRSSAlbumArtists({ album: source.feed, links });
    if (resolution.kind === 'add_by_rss') {
      return resolution.links;
    }
    if (resolution.kind === 'none') {
      return [];
    }
    return lookupDirectoryArtists(resolution.refs);
  }

  const channel = input.channel;
  if (
    channel === null ||
    channel === undefined ||
    !isAlbumMediumId(channel.medium_id) ||
    channel.id_text.length === 0 ||
    artistPublishersForAlbum(channel, input.item).length > 0
  ) {
    return [];
  }

  return resolveDirectoryAlbumAddByRSSArtists({
    channelIdText: channel.id_text,
    podcastGuid: channel.podcast_guid,
    links,
  });
};
