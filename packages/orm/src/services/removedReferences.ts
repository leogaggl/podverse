import type { EntityManager } from 'typeorm';

type QueryRunner = Pick<EntityManager, 'query'>;

const PUB_DATE_SQL = `CASE
  WHEN i.pub_date IS NULL THEN NULL
  ELSE to_char(i.pub_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
END`;

const ITEM_SNAPSHOT_SQL = `UPDATE clip AS c
SET removed_source = jsonb_build_object(
      'kind', 'item',
      'item_title', i.title,
      'channel_title', ch.title,
      'pub_date', ${PUB_DATE_SQL},
      'soundbite_title', NULL
    ),
    source_removed_at = now()
FROM item AS i
INNER JOIN channel AS ch ON ch.id = i.channel_id
WHERE c.item_id = i.id
  AND i.id = ANY($1::int[])
  AND c.source_removed_at IS NULL
RETURNING c.id`;

const PLAYLIST_ITEM_SNAPSHOT_SQL = `UPDATE playlist_resource AS pr
SET removed_source = jsonb_build_object(
      'kind', 'item',
      'item_title', i.title,
      'channel_title', ch.title,
      'pub_date', ${PUB_DATE_SQL},
      'soundbite_title', NULL
    ),
    source_removed_at = now()
FROM item AS i
INNER JOIN channel AS ch ON ch.id = i.channel_id
WHERE pr.item_id = i.id
  AND i.id = ANY($1::int[])
  AND pr.source_removed_at IS NULL
RETURNING pr.id`;

const PLAYLIST_SOUNDBITE_SNAPSHOT_SQL = `UPDATE playlist_resource AS pr
SET removed_source = jsonb_build_object(
      'kind', 'soundbite',
      'item_title', i.title,
      'channel_title', ch.title,
      'pub_date', ${PUB_DATE_SQL},
      'soundbite_title', sb.title
    ),
    source_removed_at = now()
FROM item_soundbite AS sb
INNER JOIN item AS i ON i.id = sb.item_id
INNER JOIN channel AS ch ON ch.id = i.channel_id
WHERE pr.item_soundbite_id = sb.id
  AND sb.item_id = ANY($1::int[])
  AND pr.source_removed_at IS NULL
RETURNING pr.id`;

function returnedRowCount(result: unknown): number {
  return Array.isArray(result) ? result.length : 0;
}

export async function captureRemovedReferences(
  itemIds: number[],
  manager: QueryRunner
): Promise<{ clips: number; playlistEntries: number }> {
  if (itemIds.length === 0) {
    return { clips: 0, playlistEntries: 0 };
  }

  const clipRows: unknown = await manager.query(ITEM_SNAPSHOT_SQL, [itemIds]);
  const playlistItemRows: unknown = await manager.query(PLAYLIST_ITEM_SNAPSHOT_SQL, [itemIds]);
  const playlistSoundbiteRows: unknown = await manager.query(PLAYLIST_SOUNDBITE_SNAPSHOT_SQL, [
    itemIds,
  ]);

  return {
    clips: returnedRowCount(clipRows),
    playlistEntries: returnedRowCount(playlistItemRows) + returnedRowCount(playlistSoundbiteRows),
  };
}
