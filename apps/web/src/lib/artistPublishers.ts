import type { DTOChannel, DTOItem, DTOVerifiedPublisher } from '@podverse/helpers';
import {
  buildArtistPath,
  isAlbumMediumId,
  isArtistMediumId,
  joinVerifiedPublisherTitles,
  resolveVerifiedPublishers,
} from '@podverse/helpers';

/**
 * Verified artists for an album channel: channel-wide credits first, then item credits,
 * each publisher once. Empty when the channel is not an album or no artist has a title.
 */
export const artistPublishersForAlbum = (
  channel: DTOChannel | null | undefined,
  item: DTOItem | null | undefined
): DTOVerifiedPublisher[] => {
  if (!isAlbumMediumId(channel?.medium_id)) {
    return [];
  }
  return resolveVerifiedPublishers({ channel, item }).filter((publisher) =>
    isArtistMediumId(publisher.medium_id)
  );
};

export type ArtistLineLink = {
  idText: string;
  title: string;
  href: string;
};

export type ArtistLinePresentation =
  | { kind: 'hidden' }
  | { kind: 'link'; link: ArtistLineLink }
  | { kind: 'chooser'; label: string; links: ArtistLineLink[] };

export const presentArtistLine = (
  publishers: readonly DTOVerifiedPublisher[]
): ArtistLinePresentation => {
  const links: ArtistLineLink[] = [];
  for (const publisher of publishers) {
    const title = publisher.title?.trim() ?? '';
    if (title.length === 0) {
      continue;
    }
    links.push({
      idText: publisher.id_text,
      title,
      href: buildArtistPath(publisher.id_text),
    });
  }

  if (links.length === 0) {
    return { kind: 'hidden' };
  }

  if (links.length === 1) {
    const link = links[0];
    if (link === undefined) {
      return { kind: 'hidden' };
    }
    return { kind: 'link', link };
  }

  return {
    kind: 'chooser',
    label: joinVerifiedPublisherTitles(publishers),
    links,
  };
};

/** Line for links already resolved: one link, or a chooser labelled with the titles. */
export const presentArtistLineLinks = (
  links: readonly ArtistLineLink[]
): ArtistLinePresentation => {
  if (links.length === 0) {
    return { kind: 'hidden' };
  }

  if (links.length === 1) {
    const link = links[0];
    if (link === undefined) {
      return { kind: 'hidden' };
    }
    return { kind: 'link', link };
  }

  return {
    kind: 'chooser',
    label: links.map((link) => link.title).join(', '),
    links: [...links],
  };
};

/**
 * Second line of the player bar. The middle dot is the separator between the artist label
 * and the album title. An empty artist label leaves the album title unchanged.
 */
export const compactArtistAlbumLine = (
  artistLabel: string,
  albumTitle: string | null
): string | null => {
  if (artistLabel.length === 0) {
    return albumTitle;
  }
  if (albumTitle === null || albumTitle.length === 0) {
    return artistLabel;
  }
  return `${artistLabel} · ${albumTitle}`;
};
