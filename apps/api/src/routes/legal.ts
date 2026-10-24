import { config } from '@api/config/index.js';
import { TasteProfileAgreementLegalController } from '@api/controllers/legal/tasteProfileAgreement.js';
import { TermsLegalController } from '@api/controllers/legal/terms.js';
import { asyncHandler } from '@api/middleware/asyncHandler.js';
import { Router } from 'express';

const router = Router();

router.use(`${config.api.prefix}${config.api.version}/legal`, router);

router.get('/taste-profile-agreement', asyncHandler(TasteProfileAgreementLegalController.get));
router.get('/terms', asyncHandler(TermsLegalController.get));

export const legalRouter = router;
