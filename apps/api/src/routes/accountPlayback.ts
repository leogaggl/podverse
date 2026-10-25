import { config } from '@api/config/index.js';
import { AccountPlaybackController } from '@api/controllers/account/accountPlayback.js';
import { rateLimitAuthEndpoint } from '@api/lib/rateLimiter.js';
import { asyncHandler } from '@api/middleware/asyncHandler.js';
import { Router } from 'express';

/**
 * One budget for every playback route, per account per pod: several devices checking in every
 * 15 s, a playing device publishing every 10 s plus discrete changes, and repeated scrubbing or
 * skipping all fit under it.
 */
export const playbackRateLimit = rateLimitAuthEndpoint({ windowMs: 60_000, max: 240 });

const router = Router();
router.use(`${config.api.prefix}${config.api.version}/account/playback`, router);

router.post('/presence', playbackRateLimit, asyncHandler(AccountPlaybackController.checkIn));
router.post('/state', playbackRateLimit, asyncHandler(AccountPlaybackController.publishState));
router.post('/commands', playbackRateLimit, asyncHandler(AccountPlaybackController.sendCommand));
router.post(
  '/commands/:command_id/start-failed',
  playbackRateLimit,
  asyncHandler(AccountPlaybackController.reportStartFailed)
);

export const accountPlaybackRouter = router;
