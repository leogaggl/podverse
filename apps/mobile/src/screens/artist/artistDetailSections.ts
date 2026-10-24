export type ArtistDetailSectionRow<T> =
  | { kind: 'verified-heading'; key: 'verified-heading' }
  | { kind: 'verified'; key: string; sectionIndex: number; row: T }
  | { kind: 'add-by-rss-slot'; key: 'add-by-rss-albums' }
  | { kind: 'not-yet-added-heading'; key: 'not-yet-added-heading' }
  | { kind: 'not-yet-added-note'; key: 'not-yet-added-note' }
  | { kind: 'not-yet-added'; key: string; sectionIndex: number; row: T }
  | { kind: 'track'; key: string; sectionIndex: number; row: T }
  | { kind: 'add-by-rss-tracks-slot'; key: 'add-by-rss-tracks' };

/** Album rows keep each list's element type so a verified album and an unparsed feed stay distinct. */
export type ArtistAlbumSectionRow<Verified, NotYetAdded> =
  | Extract<
      ArtistDetailSectionRow<Verified>,
      {
        kind:
          | 'verified-heading'
          | 'verified'
          | 'add-by-rss-slot'
          | 'not-yet-added-heading'
          | 'not-yet-added-note';
      }
    >
  | Extract<ArtistDetailSectionRow<NotYetAdded>, { kind: 'not-yet-added' }>;

export function buildArtistAlbumSectionRows<Verified, NotYetAdded>(args: {
  verified: readonly Verified[];
  notYetAdded: readonly NotYetAdded[];
  includeAddByRssSlot: boolean;
  verifiedKey: (row: Verified, sectionIndex: number) => string;
  notYetAddedKey: (row: NotYetAdded, sectionIndex: number) => string;
}): ArtistAlbumSectionRow<Verified, NotYetAdded>[] {
  const rows: ArtistAlbumSectionRow<Verified, NotYetAdded>[] = [];

  if (args.verified.length > 0) {
    rows.push({ kind: 'verified-heading', key: 'verified-heading' });
    let sectionIndex = 0;
    for (const row of args.verified) {
      rows.push({
        kind: 'verified',
        key: args.verifiedKey(row, sectionIndex),
        sectionIndex,
        row,
      });
      sectionIndex += 1;
    }
  }

  if (args.includeAddByRssSlot) {
    rows.push({ kind: 'add-by-rss-slot', key: 'add-by-rss-albums' });
  }

  if (args.notYetAdded.length > 0) {
    rows.push({ kind: 'not-yet-added-heading', key: 'not-yet-added-heading' });
    rows.push({ kind: 'not-yet-added-note', key: 'not-yet-added-note' });
    let sectionIndex = 0;
    for (const row of args.notYetAdded) {
      rows.push({
        kind: 'not-yet-added',
        key: args.notYetAddedKey(row, sectionIndex),
        sectionIndex,
        row,
      });
      sectionIndex += 1;
    }
  }

  return rows;
}

export function buildArtistTrackSectionRows<T>(args: {
  tracks: readonly T[];
  includeAddByRssSlot: boolean;
  trackKey: (row: T, sectionIndex: number) => string;
}): ArtistDetailSectionRow<T>[] {
  const rows: ArtistDetailSectionRow<T>[] = [];
  let sectionIndex = 0;
  for (const row of args.tracks) {
    rows.push({
      kind: 'track',
      key: args.trackKey(row, sectionIndex),
      sectionIndex,
      row,
    });
    sectionIndex += 1;
  }
  if (args.includeAddByRssSlot) {
    rows.push({ kind: 'add-by-rss-tracks-slot', key: 'add-by-rss-tracks' });
  }
  return rows;
}
