import { AppDataSourceReadWrite } from '@orm/db/index.js';

export const EMPTY_SHOW_DELETE_MAX_PER_RUN = 200;

const EMPTY_REMOVED_CHANNEL_IDS_SQL = `
SELECT c.id
FROM channel c
INNER JOIN feed f ON f.id = c.feed_id
INNER JOIN feed_lifecycle_state fls ON fls.feed_id = f.id
INNER JOIN feed_lifecycle_state_type flst ON flst.id = fls.feed_lifecycle_state_type_id
WHERE (
    flst.state_key = 'takedown'
    OR (flst.state_key = 'archived' AND c.follow_conversion_status IS NOT NULL)
  )
  AND NOT EXISTS (SELECT 1 FROM item i WHERE i.channel_id = c.id)
  AND NOT EXISTS (
    SELECT 1 FROM channel_merge m
    WHERE m.from_channel_id = c.id OR m.to_channel_id = c.id
  )
ORDER BY c.id
LIMIT $1
`;

function integerFrom(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === 'string' && value !== '') {
    const parsed = Number(value);
    if (Number.isInteger(parsed)) {
      return parsed;
    }
  }
  return null;
}

function readId(value: unknown): number | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  return integerFrom(Reflect.get(value, 'id'));
}

/**
 * Deletes channels whose feed is taken down, or archived after follow conversion finished,
 * and that have no episodes and no merge row. The feed row stays.
 */
export async function deleteEmptyRemovedShows(): Promise<{ deleted: number }> {
  const selected: unknown = await AppDataSourceReadWrite.manager.query(
    EMPTY_REMOVED_CHANNEL_IDS_SQL,
    [EMPTY_SHOW_DELETE_MAX_PER_RUN]
  );
  const ids: number[] = [];
  if (Array.isArray(selected)) {
    for (const row of selected) {
      const id = readId(row);
      if (id !== null) {
        ids.push(id);
      }
    }
  }
  if (ids.length === 0) {
    return { deleted: 0 };
  }

  const deleted: unknown = await AppDataSourceReadWrite.manager.query(
    `DELETE FROM channel
     WHERE id = ANY($1::int[])
       AND NOT EXISTS (SELECT 1 FROM item i WHERE i.channel_id = channel.id)
       AND NOT EXISTS (
         SELECT 1 FROM channel_merge m
         WHERE m.from_channel_id = channel.id OR m.to_channel_id = channel.id
       )
     RETURNING id`,
    [ids]
  );
  return { deleted: Array.isArray(deleted) ? deleted.length : 0 };
}
