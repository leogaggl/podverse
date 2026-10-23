/** Labels in one group scroll one at a time and hand off after each pass. */
export const MEDIA_PLAYER_MARQUEE_TURN_GROUP = {
  /**
   * Bottom player bar and the segment strip above it. Desktop and mobile web share it; the hidden
   * variant measures 0 and never takes a turn.
   */
  playerBar: 'player-bar',
  /** Full-size player modal. */
  fullPlayer: 'full-player',
  /**
   * Embed player. Each embed is its own document, so two embeds on one page never share a
   * rotation.
   */
  embedPlayer: 'embed-player',
} as const;

type MediaPlayerMarqueeTurnGroupKey = keyof typeof MEDIA_PLAYER_MARQUEE_TURN_GROUP;

/** Position of each line within its group's rotation. Lower goes first. */
export const MEDIA_PLAYER_MARQUEE_TURN_ORDER = {
  playerBar: { title: 0, segment: 1, channel: 2 },
  fullPlayer: { title: 0, channel: 1, subsection: 2 },
  embedPlayer: { title: 0, segment: 1, channel: 2 },
} as const satisfies Record<MediaPlayerMarqueeTurnGroupKey, Record<string, number>>;
