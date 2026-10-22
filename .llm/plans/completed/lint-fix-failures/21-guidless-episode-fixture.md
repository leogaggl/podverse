**Cursor model:** Cursor Grok 4.7 · **Reasoning:** low

# 21 — Give the guidless episode fixture an empty guid

`guidlessFeed` in `describe('addByRssEpisodeItemKey')` builds its second item, titled `No Guid`, without a `guid`. `convertParsedRSSFeedToCompat` takes a `FeedObject`, whose `items` are `Episode` (`packages/parser-mapping/src/types/partytime.ts`). `Episode.guid` is `string`, so omitting it is TS2741 at `localResourceData.test.ts` line 126. The item must stay guidless: the next test matches it by enclosure and expects the index `'1'`.

## Rows

R12

## Runs after

none

## Files

apps/mobile/src/lib/addByRss/localResourceData.test.ts

Read only, do not edit:

- `apps/mobile/src/lib/addByRss/localResourceData.ts` (`addByRssEpisodeItemKey`, `findLocalItemIndex`, `findAddByRssLocalItem`)
- `packages/parser-mapping/src/types/partytime.ts` (`Episode.guid: string`, `FeedObject.items`)
- `packages/parser-mapping/src/compat/partytime/item.ts` (`compatItemDto`)
- `apps/mobile/src/screens/home/addByRssHomeDetailData.test.ts` (the existing empty-guid fixture, around the test `hashes a guidless item by its enclosure url`)

## The fixture

On the second item of `guidlessFeed` (title `No Guid`, enclosure `LOCAL_ENCLOSURE`), add `guid: ''` between `explicit: false` and `pubDate`. Leave the first item's `guid: 'kept-guid'` as it is. Do not change any `expect`, test name, or other fixture field.

`guid: ''` is the value other tests already use for an item with no RSS guid (`addByRssHomeDetailData.test.ts`, and `episode({ guid: '' })` in `packages/parser-mapping/src/addByRSS/queuePlaylistHelpers.test.ts`). Do not use `null` (`Episode.guid` is `string`). Do not make `guid` optional on `Episode`.

Why the existing assertion still holds:

- `compatItemDto` stores `parsedItem.guid?.slice(...) || null`, so `''` becomes `null` on the mapped item.
- `findAddByRssLocalItem` looks up with `toNonEmptyTrimmedString` (`packages/helpers/src/lib/guards.ts`), which turns `''` and whitespace into `null`.
- The test passes guid `` `${feedIdText}-1` `` (`phone-channel-7-1`). That does not equal the stored guid, so `findLocalItemIndex` falls through to the enclosure. `LOCAL_ENCLOSURE` is item index 1.
- `itemKey` is `toNonEmptyTrimmedString(item.guid) ?? String(itemIndex)`, so a null guid yields `'1'`.

## Tests

Update the fixture in the existing test file only. Do not add a test. `returns the index when a guidless item is matched by enclosure` already asserts `.toBe('1')`. No Maestro flow.

## Release scratchpad

none
