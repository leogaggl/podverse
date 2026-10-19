import { Clip } from '@orm/entities/clip.js';
import { getChannelCategoryWhere } from '@orm/lib/categoryFilterWhere.js';
import { AccountService } from '@orm/services/account/account.js';
import { BaseManyService } from '@orm/services/base/baseManyService.js';
import type { EntityManager, FindManyOptions, FindOneOptions } from 'typeorm';
import { In, IsNull } from 'typeorm';

import type { QueryParamsMedium } from '@podverse/helpers';
import { getMediumIdArrayFromType, SharableStatusEnum } from '@podverse/helpers';

import { ItemService } from './item/item.js';

export type ClipDto = {
  start_time: string;
  end_time?: string | null;
  title?: string | null;
  description?: string | null;
  item_id_text: string;
  sharable_status_id: number;
};

export type ClipUpdateDto = Omit<ClipDto, 'item_id_text'> & {
  item_id_text?: string | null;
};

export const CLIP_SOURCE_REMOVED_MESSAGE = 'Clip source was removed';

/** A clip whose episode is gone: captured at removal, or nulled by the foreign key. */
export function isClipSourceRemoved(clip: Pick<Clip, 'item_id' | 'source_removed_at'>): boolean {
  return clip.source_removed_at !== null || clip.item_id === null;
}

/** An update the clip cannot accept; the API answers 400. */
export class ClipUpdateRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClipUpdateRejectedError';
  }
}

/** Request bodies carry numbers; stored media times come back as strings. */
function toTimeOrNull(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return Number(value);
}

export class ClipService extends BaseManyService<Clip, 'account'> {
  private accountService: AccountService;
  private itemService: ItemService;

  constructor(transactionalEntityManager?: EntityManager) {
    super(Clip, 'account', transactionalEntityManager);
    this.accountService = new AccountService();
    this.itemService = new ItemService();
  }

  async create(account_id: number, dto: ClipDto): Promise<Clip> {
    const account = await this.accountService.get(account_id);
    if (!account) {
      throw new Error('Account not found.');
    }

    const item = await this.itemService.getByIdOrIdText(dto.item_id_text);
    if (!item) {
      throw new Error('Item not found.');
    }

    if (dto.end_time && parseFloat(dto.end_time) <= parseFloat(dto.start_time)) {
      throw new Error('End time must be greater than start time.');
    }

    const finalDto = {
      start_time: dto.start_time,
      end_time: dto.end_time || null,
      title: dto.title || null,
      description: dto.description || null,
      account,
      item,
      sharable_status_id: dto.sharable_status_id,
    };

    const whereKeys = [] as (keyof Clip)[];
    return this._update(account, whereKeys, finalDto);
  }

  async update(account_id: number, clip_id_text: string, dto: ClipUpdateDto): Promise<Clip> {
    const account = await this.accountService.get(account_id);
    if (!account) {
      throw new Error('Account not found.');
    }

    const clip = await this._get(account, { id_text: clip_id_text });
    if (!clip) {
      throw new Error('Clip not found.');
    }

    const whereKeys = ['id_text'] as (keyof Clip)[];

    if (isClipSourceRemoved(clip)) {
      const timesChanged =
        toTimeOrNull(dto.start_time) !== toTimeOrNull(clip.start_time) ||
        toTimeOrNull(dto.end_time) !== toTimeOrNull(clip.end_time);
      const sharingChanged = dto.sharable_status_id !== clip.sharable_status_id;
      if (timesChanged || sharingChanged) {
        throw new ClipUpdateRejectedError(
          'Clip source was removed. Only the title and description can change.'
        );
      }

      return this._update(
        account,
        whereKeys,
        { title: dto.title || null, description: dto.description || null },
        undefined,
        clip
      );
    }

    if (!dto.item_id_text) {
      throw new ClipUpdateRejectedError('item_id_text is required.');
    }

    const item = await this.itemService.getByIdOrIdText(dto.item_id_text);
    if (!item) {
      throw new Error('Item not found.');
    }

    if (dto.end_time && parseFloat(dto.end_time) <= parseFloat(dto.start_time)) {
      throw new Error('End time must be greater than start time.');
    }

    const finalDto = {
      start_time: dto.start_time,
      end_time: dto.end_time || null,
      title: dto.title || null,
      description: dto.description || null,
      item,
      sharable_status_id: dto.sharable_status_id,
    };

    return this._update(account, whereKeys, finalDto, undefined, clip);
  }

  async delete(account_id: number, clip_id_text: string): Promise<void> {
    const account = await this.accountService.get(account_id);
    if (!account) {
      throw new Error('Account not found.');
    }

    return this._delete(account, { id_text: clip_id_text });
  }

  async getByIdText(clip_id_text: string, config?: FindOneOptions<Clip>): Promise<Clip | null> {
    const options: FindOneOptions<Clip> = {
      where: { id_text: clip_id_text },
      ...config,
    };

    return this.repositoryRead.findOne(options);
  }

  async getManyPublic(
    mediumType: QueryParamsMedium | null,
    category_id: number | null,
    config: FindManyOptions<Clip>
  ): Promise<Clip[]> {
    const medium_ids = mediumType ? getMediumIdArrayFromType(mediumType) : null;
    return this.repositoryRead.find({
      where: {
        sharable_status_id: SharableStatusEnum.Public,
        item: {
          channel: {
            feed: {
              feed_policy: {
                public_visible: true,
              },
            },
            ...(medium_ids ? { medium_id: In(medium_ids) } : {}),
            ...getChannelCategoryWhere(category_id),
          },
        },
      },
      ...config,
    });
  }

  async getManyByChannels(
    channel_ids: number[],
    config: FindManyOptions<Clip>
  ): Promise<[Clip[], number]> {
    return this.repositoryRead.findAndCount({
      where: {
        sharable_status_id: SharableStatusEnum.Public,
        item: {
          channel: {
            id: In(channel_ids),
            feed: {
              feed_policy: {
                public_visible: true,
              },
            },
          },
        },
      },
      ...config,
    });
  }

  async getManyByChannelAndCountPublic(
    channel_id_text: string,
    config: FindManyOptions<Clip>
  ): Promise<[Clip[], number]> {
    return this.repositoryRead.findAndCount({
      where: {
        sharable_status_id: SharableStatusEnum.Public,
        item: {
          channel: {
            feed: {
              feed_policy: {
                public_visible: true,
              },
            },
            id_text: channel_id_text,
          },
        },
      },
      ...config,
    });
  }

  async getManyByItemAndCountPublic(
    item_id_text: string,
    config: FindManyOptions<Clip>
  ): Promise<[Clip[], number]> {
    return this.repositoryRead.findAndCount({
      where: {
        sharable_status_id: SharableStatusEnum.Public,
        item: {
          id_text: item_id_text,
          channel: {
            feed: {
              feed_policy: {
                public_visible: true,
              },
            },
          },
        },
      },
      ...config,
    });
  }

  async getManyByAccount(account_id: number): Promise<Clip[]> {
    const account = await this.accountService.get(account_id);
    if (!account) {
      throw new Error('Account not found.');
    }

    return this._getAll(account);
  }

  /** The account's own clips, including clips whose episode was removed. */
  async getManyByAccountIdTextAndCount(
    account_id_text: string,
    config: FindManyOptions<Clip>
  ): Promise<[Clip[], number]> {
    return this.repositoryRead.findAndCount({
      where: [
        {
          account: {
            id_text: account_id_text,
          },
          item: {
            channel: {
              feed: {
                feed_policy: {
                  public_visible: true,
                },
              },
            },
          },
        },
        {
          account: {
            id_text: account_id_text,
          },
          item_id: IsNull(),
        },
      ],
      ...config,
    });
  }

  async getManyByAccountIdTextPublicAndCount(
    account_id_text: string,
    config: FindManyOptions<Clip>
  ): Promise<[Clip[], number]> {
    return this.repositoryRead.findAndCount({
      where: {
        account: {
          id_text: account_id_text,
        },
        sharable_status_id: SharableStatusEnum.Public,
        item: {
          channel: {
            feed: {
              feed_policy: {
                public_visible: true,
              },
            },
          },
        },
      },
      ...config,
    });
  }

  async getRandomClip(medium_id: number): Promise<Clip | null> {
    const query = this.repositoryRead
      .createQueryBuilder('clip')
      .innerJoin('clip.item', 'item')
      .innerJoin('item.channel', 'channel');

    const clips = await query
      .where('channel.medium_id = :medium_id', { medium_id })
      .orderBy('RANDOM()')
      .limit(1)
      .getMany();

    return clips[0] || null;
  }
}
