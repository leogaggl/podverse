export type AlbumListItem = {
  id: string;
  title: string;
  /** Ordered URLs for Image fallback (shrunken then originals). */
  imageCandidates?: string[];
  href: string;
  subtitle?: string | null;
  /** Shows the Add by RSS marker after the title. */
  showAddByRssMarker?: boolean;
};
