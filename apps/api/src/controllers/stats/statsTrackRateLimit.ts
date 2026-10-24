import { config } from '@api/config/index.js';
import { rateLimitAuthEndpoint } from '@api/lib/rateLimiter.js';

/**
 * Per-account ceiling shared by the listen and open routes. Exported so tests can reset the
 * in-memory counter between cases.
 */
export const statsTrackRateLimit = rateLimitAuthEndpoint({
  windowMs: config.rateLimits.statsTrack.windowMs,
  max: config.rateLimits.statsTrack.max,
});
