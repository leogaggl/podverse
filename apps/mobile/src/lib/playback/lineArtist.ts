import type { DTOVerifiedPublisher } from '@podverse/helpers/dto';

/**
 * An artist on a now-playing or track byline: a directory artist or one of the member's Add by RSS
 * feeds. The kind is explicit because an Add by RSS idText is random and shares no id space with
 * directory ids.
 */
export type LineArtist =
  | { kind: 'directory'; publisher: DTOVerifiedPublisher }
  | { kind: 'add-by-rss'; feedIdText: string; feedUrl: string; title: string };

export const directoryLineArtist = (publisher: DTOVerifiedPublisher): LineArtist => ({
  kind: 'directory',
  publisher,
});

/** Stable React key: `directory:<id_text>` or `add-by-rss:<feedIdText>`. */
export const lineArtistKey = (artist: LineArtist): string =>
  artist.kind === 'directory'
    ? `directory:${artist.publisher.id_text}`
    : `add-by-rss:${artist.feedIdText}`;

/** Trimmed display title; '' when the directory artist has none. */
export const lineArtistTitle = (artist: LineArtist): string =>
  artist.kind === 'directory' ? (artist.publisher.title?.trim() ?? '') : artist.title.trim();

/** Non-empty titles joined with ', ' (the separator `joinVerifiedPublisherTitles` uses). */
export const joinLineArtistTitles = (artists: readonly LineArtist[]): string =>
  artists
    .map(lineArtistTitle)
    .filter((title) => title.length > 0)
    .join(', ');
