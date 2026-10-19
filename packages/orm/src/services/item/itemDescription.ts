import type { Item } from '@orm/entities/item/item.js';
import { ItemDescription } from '@orm/entities/item/itemDescription.js';
import { BaseOneService } from '@orm/services/base/baseOneService.js';
import type { EntityManager } from 'typeorm';

type ItemDescriptionDto = {
  value: string;
  preview: string;
  is_truncated: boolean;
  source_length: number | null;
};

export class ItemDescriptionService extends BaseOneService<ItemDescription, 'item'> {
  constructor(transactionalEntityManager?: EntityManager) {
    super(ItemDescription, 'item', transactionalEntityManager);
  }

  async update(item: Item, dto: ItemDescriptionDto): Promise<ItemDescription> {
    return super._update(item, dto, {
      select: {
        id: true,
        value: true,
        preview: true,
        is_truncated: true,
        source_length: true,
      },
    });
  }

  async getValueByParentId(itemId: number): Promise<string | null> {
    const row = await this.repositoryRead
      .createQueryBuilder('item_description')
      .select('item_description.value', 'value')
      .where('item_description.item_id = :itemId', { itemId })
      .getRawOne<{ value: string }>();

    return row?.value ?? null;
  }
}
