import { AppDataSourceRead } from '@orm/db/index.js';
import { StatsPopularityPlaylist } from '@orm/entities/stats/statsPopularityPlaylist.js';
import type { FindManyOptions } from 'typeorm';
import { Equal, In } from 'typeorm';

import type { QueryParamsQueueMedium } from '@podverse/helpers';
import { getQueueMediumIdFromType, SharableStatusEnum } from '@podverse/helpers';

const STATS_POPULARITY_SELECT_ALL = {
  playlist_id: true,
  day_count: true,
  week_count: true,
  month_count: true,
  all_time_count: true,
};

/**
 * Reads the range totals behind public Top lists. Rows are rebuilt from counted events and daily
 * totals by the popularity refresh job; see `docs/features/POPULARITY-AND-TASTE-PROFILE.md`.
 */
export class StatsPopularityPlaylistService {
  private repositoryRead = AppDataSourceRead.getRepository(StatsPopularityPlaylist);

  async getManyPublic(
    config: FindManyOptions<StatsPopularityPlaylist>,
    queueMediumType: QueryParamsQueueMedium | null
  ): Promise<StatsPopularityPlaylist[]> {
    const medium_id = getQueueMediumIdFromType(queueMediumType);

    return this.repositoryRead.find({
      ...config,
      select: {
        ...STATS_POPULARITY_SELECT_ALL,
        playlist: {
          id_text: true,
          title: true,
          description: true,
          is_default_likes: true,
          item_count: true,
          account: {
            id_text: true,
            account_profile: {
              display_name: true,
            },
          },
        },
      },
      where: {
        playlist: {
          sharable_status_id: SharableStatusEnum.Public,
          ...(medium_id ? { medium_id: Equal(medium_id) } : {}),
        },
      },
      relations: {
        playlist: {
          account: {
            account_profile: true,
          },

          sharable_status: true,
          medium: true,
        },
      },
    });
  }

  async getManyPrivate(
    config: FindManyOptions<StatsPopularityPlaylist>,
    account_id: number,
    queueMediumType: QueryParamsQueueMedium | null
  ): Promise<[StatsPopularityPlaylist[], number]> {
    const medium_id = getQueueMediumIdFromType(queueMediumType);

    return this.repositoryRead.findAndCount({
      ...config,
      select: {
        ...STATS_POPULARITY_SELECT_ALL,
        playlist: {
          id_text: true,
          title: true,
          description: true,
          is_default_likes: true,
          item_count: true,
          account: {
            id_text: true,
            account_profile: {
              display_name: true,
            },
          },
        },
      },
      where: {
        playlist: {
          ...(medium_id ? { medium_id: Equal(medium_id) } : {}),
          ...(account_id ? { account: { id: Equal(account_id) } } : {}),
        },
      },
      relations: {
        playlist: {
          account: {
            account_profile: true,
          },

          sharable_status: true,
          medium: true,
        },
      },
    });
  }

  async getManyPrivateByPlaylists(
    playlist_ids: number[],
    config: FindManyOptions<StatsPopularityPlaylist>
  ): Promise<[StatsPopularityPlaylist[], number]> {
    return this.repositoryRead.findAndCount({
      ...config,
      where: {
        ...config.where,
        playlist: {
          id: In(playlist_ids),
        },
      },
    });
  }
}
