/**
 * Show fields a Taste Profile row needs to render and link. `channel_images` feeds
 * `primaryChannelListArtworkUrl`.
 */
export type DTOAccountTasteProfileChannel = {
  id_text: string;
  slug: string | null;
  title: string | null;
  medium_id: number;
  channel_images: Array<{ url: string; image_width_size: number | null; is_resized: boolean }>;
};

/**
 * One show in the signed-in listener's Taste Profile. Listen times are null while `listen_count`
 * is 0 (a show added back).
 */
export type DTOAccountTasteProfileRow = {
  channel: DTOAccountTasteProfileChannel;
  listen_count: number;
  completion_count: number;
  first_listened_at: string | null;
  last_listened_at: string | null;
};

/** One show on the signed-in listener's Hidden From Taste Profile list. */
export type DTOAccountTasteProfileHiddenRow = {
  channel: DTOAccountTasteProfileChannel;
  hidden_at: string;
};

export type DTOAccountTasteProfilePagination = {
  page: number;
  total_count: number;
  total_pages: number;
};

export type DTOAccountTasteProfileList = {
  items: DTOAccountTasteProfileRow[];
  pagination: DTOAccountTasteProfilePagination;
};

export type DTOAccountTasteProfileHiddenList = {
  items: DTOAccountTasteProfileHiddenRow[];
  pagination: DTOAccountTasteProfilePagination;
};

/** A show's state after hide or unhide. */
export type DTOAccountTasteProfileShowState = {
  channel_id_text: string;
  hidden: boolean;
  in_taste_profile: boolean;
};
