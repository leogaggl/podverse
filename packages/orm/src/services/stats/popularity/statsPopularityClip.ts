import { AppDataSourceRead } from '@orm/db/index.js';
import { StatsPopularityClip } from '@orm/entities/stats/statsPopularityClip.js';
import { getActiveFeedWhere } from '@orm/lib/feedFlagHelpers.js';
import type { FindManyOptions } from 'typeorm';

import type { QueryParamsMedium } from '@podverse/helpers';
import { SharableStatusEnum } from '@podverse/helpers';

/**
 * Reads the range totals behind public Top lists. Rows are rebuilt from the daily totals by the
 * popularity refresh job; see `docs/features/POPULARITY-TRACKING.md`.
 */
export class StatsPopularityClipService {
  private repositoryRead = AppDataSourceRead.getRepository(StatsPopularityClip);

  async getManyPublic(
    config: FindManyOptions<StatsPopularityClip>,
    mediumType: QueryParamsMedium | null,
    category_id: number | null
  ): Promise<StatsPopularityClip[]> {
    return this.repositoryRead.find({
      where: {
        clip: {
          sharable_status_id: SharableStatusEnum.Public,
          item: {
            ...getActiveFeedWhere({
              channel_ids: null,
              mediumType,
              category_id,
            }),
          },
        },
      },
      ...config,
    });
  }

  async getManyAndCountPublic(
    config: FindManyOptions<StatsPopularityClip>,
    mediumType: QueryParamsMedium | null,
    category_id: number | null
  ): Promise<[StatsPopularityClip[], number]> {
    return this.repositoryRead.findAndCount({
      where: {
        clip: {
          sharable_status_id: SharableStatusEnum.Public,
          item: {
            ...getActiveFeedWhere({
              channel_ids: null,
              mediumType,
              category_id,
            }),
          },
        },
      },
      ...config,
    });
  }

  async getManyByChannelsAndCountPublic(
    channel_ids: number[],
    config: FindManyOptions<StatsPopularityClip>
  ): Promise<[StatsPopularityClip[], number]> {
    return this.repositoryRead.findAndCount({
      where: {
        clip: {
          sharable_status_id: SharableStatusEnum.Public,
          item: {
            ...getActiveFeedWhere({
              channel_ids,
              mediumType: null,
              category_id: null,
            }),
          },
        },
      },
      ...config,
    });
  }

  async getManyByItemAndCountPublic(
    item_id: number,
    config: FindManyOptions<StatsPopularityClip>
  ): Promise<[StatsPopularityClip[], number]> {
    return this.repositoryRead.findAndCount({
      where: {
        clip: {
          sharable_status_id: SharableStatusEnum.Public,
          item: {
            id: item_id,
            ...getActiveFeedWhere({
              channel_ids: null,
              mediumType: null,
              category_id: null,
            }),
          },
        },
      },
      ...config,
    });
  }
}
