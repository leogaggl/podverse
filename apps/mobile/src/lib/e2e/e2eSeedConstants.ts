/**
 * Deterministic E2E seed values the mobile app needs to reference directly under
 * `EXPO_PUBLIC_MOBILE_E2E=1`. Mirror of `apps/web/e2e/helpers/seedConstants.ts` /
 * `tools/web/seed-e2e.mjs` (same seeded Postgres rows); keep both sides in sync.
 *
 * This includes the standalone video-medium item used by the video mini-to-full transition E2E. The
 * app reaches it through an E2E-gated affordance because video browse/search is not exposed.
 */

/** `E2E_VIDEO_ITEM_ID_TEXT` — the seeded video-medium episode (`e2eVideoChnl01`). */
export const E2E_VIDEO_ITEM_ID_TEXT = 'e2eVideoItm001';

/** Seeded non-live VOD HLS playlist episode (`e2eHlsChnl001`). */
export const E2E_HLS_VOD_ITEM_ID_TEXT = 'e2eHlsVodIt01';

/** Seeded account most authenticated Maestro flows sign in as. */
export const E2E_USER_EMAIL = 'e2e-user@example.com';

/** Seeded account that has not answered the Taste Profile consent prompt. */
export const E2E_TASTE_PROFILE_CONSENT_UNDECIDED_EMAIL = 'e2e-taste-consent-undecided@example.com';

/** Seeded account with an outdated terms acceptance (must re-accept current version). */
export const E2E_STALE_TERMS_EMAIL = 'e2e-stale-terms@example.com';

/** Seeded account that owns the perf-volume library. */
export const E2E_PERF_EMAIL = 'e2e-perf@example.com';

/** Shared password for seeded E2E accounts (`tools/web/seed-e2e.mjs`). */
export const E2E_USER_PASSWORD = 'Test!1Aa';

/** Directory channel whose feed was absorbed into the survivor. */
export const E2E_MERGED_OLD_CHANNEL_ID_TEXT = 'e2eMrgOldCh01';

/** Directory channel that remains after the absorb. */
export const E2E_MERGED_SURVIVOR_CHANNEL_ID_TEXT = 'e2eMrgSurCh01';

/** Episode on the absorbed channel that has a match on the survivor. */
export const E2E_MERGED_OLD_ITEM_ID_TEXT = 'e2eMrgOldIt01';

/** Episode on the survivor that the absorbed episode maps to. */
export const E2E_MERGED_SURVIVOR_ITEM_ID_TEXT = 'e2eMrgSurIt01';

/** Finished download path the remap must leave in place. */
export const E2E_IDENTITY_REMAP_FILE_PATH = 'file:///e2e/identity-remap-kept.mp3';

/** Archived episode (`e2ePodArchEp01` = 14). `archived-clip.yaml` opens it by deep link. */
export const E2E_ARCHIVED_CLIP_EPISODE_ID_TEXT = 'e2ePodArchEp01';

/** Public clip on that episode (`e2eArchClip01` = 13). */
export const E2E_ARCHIVED_CLIP_ID_TEXT = 'e2eArchClip01';

/** Clip whose episode was removed (`e2eRemClip01` = 12). Owned by `E2E_USER_EMAIL`. */
export const E2E_REMOVED_CLIP_ID_TEXT = 'e2eRemClip01';
export const E2E_REMOVED_CLIP_TITLE = 'E2E Removed Clip';
export const E2E_REMOVED_EPISODE_TITLE = 'E2E Removed Episode';
export const E2E_REMOVED_SHOW_TITLE = 'E2E Removed Show';

/** Playlist with one live episode and one removed entry (`e2eRemPlay01` = 12). */
export const E2E_REMOVED_PLAYLIST_ID_TEXT = 'e2eRemPlay01';
export const E2E_REMOVED_PLAYLIST_TITLE = 'E2E Removed Playlist';

/** Archived show the seeded E2E user still follows (`e2eArchShow01` = 12). No episodes. */
export const E2E_ARCHIVED_SHOW_ID_TEXT = 'e2eArchShow01';
export const E2E_ARCHIVED_SHOW_TITLE = 'E2E Archived Show';
export const E2E_ARCHIVED_SHOW_FEED_URL = 'https://e2e-seed-archived-show.example/podcast.xml';

/** Removed Content log row for the seeded E2E user. The show is the archived follow. */
export const E2E_CONTENT_LOG_CHANNEL_ID_TEXT = E2E_ARCHIVED_SHOW_ID_TEXT;
export const E2E_CONTENT_LOG_CHANNEL_TITLE = E2E_ARCHIVED_SHOW_TITLE;
