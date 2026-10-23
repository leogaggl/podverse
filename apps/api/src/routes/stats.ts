import { config } from '@api/config/index.js';
import { StatsListenController } from '@api/controllers/stats/statsListen.js';
import { StatsOpenController } from '@api/controllers/stats/statsOpen.js';
import { statsTrackRateLimit } from '@api/controllers/stats/statsTrackRateLimit.js';
import { asyncHandler } from '@api/middleware/asyncHandler.js';
import { Router } from 'express';

const router = Router();

router.use(`${config.api.prefix}${config.api.version}/stats`, router);

router.post('/listen', statsTrackRateLimit, asyncHandler(StatsListenController.create));
router.post('/open', statsTrackRateLimit, asyncHandler(StatsOpenController.create));

export const statsRouter = router;
