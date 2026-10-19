import { handleGenericErrorResponse } from '@api/controllers/helpers/error.js';
import { getParamRequired } from '@api/lib/params.js';
import { validateParamsObject } from '@api/lib/validation/index.js';
import type { Request, Response } from 'express';
import Joi from 'joi';

import { ChannelMergeRedirectService, ChannelService, FeedService } from '@podverse/orm';

export class FeedController {
  private static feedService = new FeedService();
  private static channelService = new ChannelService();
  private static mergeRedirects = new ChannelMergeRedirectService();

  // Always return 200 on not found. This is to prevent unnecessary 404 error handling
  // in the SSR next.js app.
  static async getByPodcastIndexId(req: Request, res: Response): Promise<void> {
    const paramsSchema = Joi.object({
      podcast_index_id: Joi.number().integer().min(1).required(),
    });

    validateParamsObject(paramsSchema, req, res, async () => {
      try {
        const podcast_index_id = getParamRequired(req, 'podcast_index_id');
        const numericId = parseInt(podcast_index_id, 10);
        const survivorIdText =
          await FeedController.mergeRedirects.survivorIdTextForPodcastIndexId(numericId);
        if (survivorIdText) {
          const survivor = await FeedController.channelService.getByIdText(survivorIdText);
          if (survivor) {
            const survivorFeed = await FeedController.feedService.get(survivor.feed_id);
            res.json(survivorFeed || null);
            return;
          }
        }
        const data = await FeedController.feedService.getByPodcastIndexId(numericId);

        res.json(data || null);
      } catch (error) {
        handleGenericErrorResponse(res, error);
      }
    });
  }
}
