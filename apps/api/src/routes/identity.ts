import { config } from '@api/config/index.js';
import { IdentityController } from '@api/controllers/identity.js';
import { asyncHandler } from '@api/middleware/asyncHandler.js';
import { Router } from 'express';

const router = Router();

router.use(`${config.api.prefix}${config.api.version}/identity`, router);

router.post('/resolve', asyncHandler(IdentityController.resolve));

export const identityRouter = router;
