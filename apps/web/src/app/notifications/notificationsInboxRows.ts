import type { DTOAccountNotification } from '@podverse/helpers';

/**
 * Adds a row received live, keeping newest first (created_at descending, then id descending).
 * Returns the same array when a row with that id is already present.
 */
export function insertLiveNotificationRow(
  items: DTOAccountNotification[],
  row: DTOAccountNotification
): DTOAccountNotification[] {
  if (items.some((item) => item.id === row.id)) {
    return items;
  }

  const insertAt = items.findIndex((item) => liveRowComesBefore(row, item));
  if (insertAt === -1) {
    return [...items, row];
  }

  return [...items.slice(0, insertAt), row, ...items.slice(insertAt)];
}

/** True when `row` belongs earlier than `item` in a newest-first list. */
function liveRowComesBefore(row: DTOAccountNotification, item: DTOAccountNotification): boolean {
  const rowTime = Date.parse(row.created_at);
  const itemTime = Date.parse(item.created_at);
  if (Number.isNaN(rowTime) || Number.isNaN(itemTime)) {
    return row.id > item.id;
  }
  if (rowTime === itemTime) {
    return row.id > item.id;
  }
  return rowTime > itemTime;
}
