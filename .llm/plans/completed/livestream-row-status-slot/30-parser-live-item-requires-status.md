**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 30 — A liveItem without a status is not saved

## Rows

R21

## Runs after

none

## Files

packages/parser-mapping/src/compat/partytime/liveItem.ts
packages/parser-mapping/src/compat/partytime/liveItem.test.ts
packages/parser/src/lib/rss/liveItem/liveItem.ts
packages/parser/src/lib/rss/liveItem/liveItemArchive.ts
packages/parser/src/lib/rss/liveItem/liveItemArchive.test.ts

## Goal

A `podcast:liveItem` is a livestream only when its status is pending, live, or ended. A missing
or unrecognized status makes that item invalid. The parser does not save it and does not return
it. A live item already in the database stays: a later parse does not archive it only because
this parse skipped it.

The operator settled this in `00-REQUEST.md` § Review of the second-pass choices, E3.

## What the code does today

`compatLiveItemsDtos` in `packages/parser-mapping/src/compat/partytime/liveItem.ts` maps a missing
or unrecognized status to `LiveItemStatusEnum.Pending`:

```typescript
getLiveItemStatusEnumValue(parsedLiveItem.status ?? null) ?? LiveItemStatusEnum.Pending
```

`getLiveItemStatusEnumValue` (`packages/helpers/src/lib/liveItemStatus.ts`) returns null unless
the sanitized status is `pending`, `live`, or `ended`.

`handleParsedLiveItems` (`packages/parser/src/lib/rss/liveItem/liveItem.ts`) saves every DTO from
that mapper. After the save, it archives existing live items on the channel whose ids were not
updated in this parse (`ItemFlagStatusStatusEnum.PendingArchive`). Add by RSS mapped feeds use
the same mapper through `convertParsedRSSFeedToCompat`.

## Decisions (settled — transcribe, do not revisit)

1. **Recognized statuses are pending, live, and ended.** Anything else, including a missing
   status, is invalid. Do not default it to pending.
2. **Invalid live items are omitted** from `compatLiveItemsDtos`. They are not saved and they are
   not in the mapped feed Add by RSS returns. A feed whose only live items are invalid maps to an
   empty live-item list.
3. **Already-saved rows stay.** When this parse skips a live item for an invalid status, that
   item's guid is not a reason to archive the existing row. A live item that is absent from the
   feed entirely still archives, as it does today.
4. **No API, database, or mobile change.** This plan does not delete rows and does not hide a
   row the database already has.

## Step 1 — omit invalid live items

In `compatLiveItemsDtos`, skip a parsed live item when
`getLiveItemStatusEnumValue(parsedLiveItem.status ?? null)` is null. Set `live_item_status` from
that value directly. Remove the `?? LiveItemStatusEnum.Pending` fallback and the
`LiveItemStatusEnum` import if nothing else in the file uses it.

`markChannelMayHaveLiveItems` is called with `parsedLiveItems.length` today. Change that call in
`handleParsedLiveItems` to `liveItemObjDtos.length` (the list after this filter and the existing
dedupe), so a feed of only invalid live items does not mark the channel as having live items.

## Step 2 — do not archive a skipped row

Add `packages/parser/src/lib/rss/liveItem/liveItemArchive.ts`:

```typescript
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
```

In `handleParsedLiveItems`, build `skippedGuids` from `parsedLiveItems` whose
`getLiveItemStatusEnumValue(item.status ?? null)` is null, using each item's `guid` when it is a
non-empty string. Replace the `itemIdsToDelete` filter with `liveItemIdsToArchive`. Keep the
`updateManyFlagStatus(..., PendingArchive)` call.

Use `.js` import specifiers. This package is Tier A.

## Tests

- `packages/parser-mapping/src/compat/partytime/liveItem.test.ts` (vitest, `.js` specifiers, same
  style as `src/addByRSS/liveItems.test.ts`). Build a minimal `Phase4PodcastLiveItem` the way
  that file's `podcastLiveItems` entry does (`guid`, `enclosure`, `start`, `contentLinks`).
  Cases, as `it` sentences:
  - "keeps a live item whose status is live, pending, or ended", and the mapped
    `live_item_status` is that enum.
  - "omits a live item with no status".
  - "omits a live item whose status is not pending, live, or ended". The `Phase4PodcastLiveItem`
    type lists `status` as required and only those three values. Build the invalid fixtures in the
    test and pass them through a parameter typed as the parsed array the function already accepts.
    Do not widen `compatLiveItemsDtos`'s public parameter.
- `packages/parser/src/lib/rss/liveItem/liveItemArchive.test.ts`. Cases:
  - "archives a live item that this parse did not update and did not skip".
  - "keeps a live item whose guid was skipped for an invalid status".
  - "keeps a live item this parse updated".
  - "archives a skipped row that has no guid".
- Do not change `addByRSS/liveItems.test.ts`. Its fixture has status `Live`.

## Release scratchpad

```markdown
## A livestream without a status is not saved

- Surfaces: parser, workers
- Change: A podcast:liveItem whose status is missing or not pending, live, or ended is not saved
  and is not returned in a mapped feed. The parser used to store that item as Scheduled. A live
  item already in the database is left in place when a later parse skips it for this reason.
- Who notices: feeds that publish a liveItem tag without a status; those items no longer appear
  as Scheduled
- Operator steps: none
```
