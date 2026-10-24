import { getErrorResponseBody, getErrorResponseStatus } from '@podverse/helpers/error';
import { getOwnPropertyValue, isPlainObject } from '@podverse/helpers/guards';
import { getChannelRouteKind, isMusicMediumId } from '@podverse/helpers/medium';

/** Where an absorbed id now lives. A re-point keeps the same id and is not a move. */
export type MergedInto = {
  kind: 'channel' | 'item';
  idText: string;
};

export type MergedDetailScreen =
  'AlbumDetail' | 'ArtistDetail' | 'EpisodeDetail' | 'PodcastDetail' | 'TrackDetail';

/** Detail screen that should replace the one opened with an absorbed id. */
export type MergedDetailTarget = {
  imageUrl: string | null;
  idText: string;
  screen: MergedDetailScreen;
  title: string | null;
};

const mergedKind = (value: unknown): MergedInto['kind'] | null => {
  if (value === 'channel' || value === 'item') {
    return value;
  }
  return null;
};

/** `merged_into` on an error body. Ignores an archived or taken-down 410. */
export const readMergedInto = (error: unknown): MergedInto | null => {
  const body = getErrorResponseBody(error);
  if (body === undefined) {
    return null;
  }
  const merged = getOwnPropertyValue(body, 'merged_into');
  if (!isPlainObject(merged)) {
    return null;
  }
  const kind = mergedKind(getOwnPropertyValue(merged, 'kind'));
  const idText = getOwnPropertyValue(merged, 'id_text');
  if (kind === null || typeof idText !== 'string' || idText.length === 0) {
    return null;
  }
  return { kind, idText };
};

/** A 410 that names the surviving channel or item. */
export const readMergedIntoRedirect = (error: unknown): MergedInto | null => {
  if (getErrorResponseStatus(error) !== 410) {
    return null;
  }
  return readMergedInto(error);
};

export const mergedChannelDetailTarget = (input: {
  idText: string;
  imageUrl: string | null;
  mediumId: number;
  title: string | null;
}): MergedDetailTarget => {
  const kind = getChannelRouteKind(input.mediumId);
  if (kind === 'artist') {
    return {
      imageUrl: input.imageUrl,
      idText: input.idText,
      screen: 'ArtistDetail',
      title: input.title,
    };
  }
  if (kind === 'album') {
    return {
      imageUrl: input.imageUrl,
      idText: input.idText,
      screen: 'AlbumDetail',
      title: input.title,
    };
  }
  return {
    imageUrl: input.imageUrl,
    idText: input.idText,
    screen: 'PodcastDetail',
    title: input.title,
  };
};

/** Music mediums open a track. Every other medium, including a missing one, opens an episode. */
export const mergedItemDetailTarget = (input: {
  idText: string;
  imageUrl: string | null;
  mediumId: number | null;
  title: string | null;
}): MergedDetailTarget => {
  return {
    imageUrl: input.imageUrl,
    idText: input.idText,
    screen: isMusicMediumId(input.mediumId) ? 'TrackDetail' : 'EpisodeDetail',
    title: input.title,
  };
};
