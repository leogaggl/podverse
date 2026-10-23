import { config } from '@api/config/index.js';
import { handleGenericErrorResponse } from '@api/controllers/helpers/error.js';
import { ensureAuthenticated, getAuthenticatedUser } from '@api/lib/auth/index.js';
import { loadTasteProfileAgreementMarkdown } from '@api/lib/legal/tasteProfileAgreementContent.js';
import type { Request, Response } from 'express';

import { AccountSettingsLocaleService, getDefaultLocale } from '@podverse/orm';

export class TasteProfileAgreementLegalController {
  static async get(req: Request, res: Response): Promise<void> {
    ensureAuthenticated(
      req,
      res,
      async () => {
        try {
          const jwtUser = getAuthenticatedUser(req);
          const localeService = new AccountSettingsLocaleService();
          const localeSettings = await localeService.getByAccountId(jwtUser.id);
          const locale = localeSettings?.locale ?? getDefaultLocale();
          const markdown = loadTasteProfileAgreementMarkdown(locale);

          res.json({
            version: config.tasteProfileAgreement.version,
            markdown,
          });
        } catch (error) {
          handleGenericErrorResponse(res, error);
        }
      },
      { skipMembershipStatus: true }
    );
  }
}
