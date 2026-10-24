import { getParamRequired } from '@api/lib/params.js';
import { buildRemoteItemsFinalResult } from '@api/lib/remoteItems.js';
import { idOrIdTextParamSchema, validateParamsObject } from '@api/lib/validation/index.js';
import { attachVerifiedPublishers } from '@api/lib/verifiedPublishers.js';
import type { Request, Response } from 'express';
import Joi from 'joi';

import type { DTOChannel, DTOItem } from '@podverse/helpers';
import { PublisherFeedService } from '@podverse/orm';

export class PublisherFeedController {
  private static publisherFeedService = new PublisherFeedService();

  static async getPublisherFeedRemoteItemsForChannel(req: Request, res: Response): Promise<void> {
    validateParamsObject(Joi.object(idOrIdTextParamSchema), req, res, async () => {
      const idOrIdText = getParamRequired(req, 'idOrIdText');

      const result =
        await PublisherFeedController.publisherFeedService.getPublisherFeedRemoteItemsForChannel(
          idOrIdText
        );
      await attachVerifiedPublishers({
        channels: result.verifiedAlbums,
        items: result.tracks,
      });

      // Channel and Item entities are serialized as the shared channel and item DTOs.
      const finalRemoteItemsResult = await buildRemoteItemsFinalResult(
        result.verifiedAlbums as unknown as DTOChannel[],
        result.notYetAddedAlbumRefs,
        result.tracks as unknown as DTOItem[],
        [],
        { enrichUnaddedChannelsByFeedUrl: true }
      );

      const finalResult = {
        channel: result.channel,
        ...finalRemoteItemsResult,
      };

      res.json(finalResult);
    });
  }
}
