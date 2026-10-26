type ExistingLiveItemRef = {
  guid: string | null;
  itemId: number;
};

/**
 * Existing live-item ids to archive after a parse.
 *
 * A guid skipped for an invalid status stays. An id updated in this parse stays. Everything
 * else left the feed.
 */
export const liveItemIdsToArchive = (
  existing: readonly ExistingLiveItemRef[],
  updatedItemIds: readonly number[],
  skippedGuids: ReadonlySet<string>
): number[] => {
  return existing
    .filter((row) => {
      if (row.guid !== null && skippedGuids.has(row.guid)) {
        return false;
      }
      return !updatedItemIds.includes(row.itemId);
    })
    .map((row) => row.itemId);
};
