# 82 — Add by RSS "may have livestreams" flag (web and mobile devices)

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

## Rows

- **R53** (device half): an Add by RSS feed remembers, on the device, that it has carried a live
  item. The server half is plan 80.
- **R62** (device half): the flag sits beside the feed's `resourceType` and never changes it.
  Plan 88, which runs right after this one, removes `'livestreams'` from
  `AddByRSSResourceType`.

Runs after plan 80. Plans 84 and 86 read the flag to decide which feeds the Livestreams chips
read.

## The flag is not a feed type (R62)

A feed's `resourceType` comes from its medium (`getAddByRSSResourceTypeFromMappedFeed`:
podcasts, artists, or albums). `mayHaveLivestreams` is a separate fact about the same feed. A
feed with live items stays on its medium's chips, its regular items stay on Episodes or Tracks,
and its live items are listed on Livestreams by reading this flag and the bundle's `liveItems`
(plans 84 and 86). No reader picks Livestreams by resource type.

## Parity source

The server rule in plan 80: set when a parse carries any `podcast:liveItem`, never cleared. On
mobile, `latest_item_pub_date_ms` and `channelLiveStatusRepository.setFromAddByRssBundle` show
where a parse-derived value is written (`addByRssRepository.upsertFeed`, `mappedFeed` branch).

## Locked decisions

1. **One helper, both devices.** `@podverse/parser-mapping` owns the rule, so web and mobile
   cannot drift.
2. **Names.** The field is `mayHaveLivestreams` on both records (camelCase, as the records'
   other fields); the mobile column is `may_have_livestreams`.
3. **When it is written.** Only when a parse result is stored: web `applyAddByRSSParseStatus`
   with a `parsedFeed`; mobile `upsertFeed` with `mappedFeed !== undefined`. A follow merge or
   stub write leaves it alone.
4. **Sticky.** Next value = stored value OR "this bundle has live items". A `null` bundle or a
   parse without live items keeps a stored `true`.
5. **Reads.** Readers call the same helper with the stored flag and the stored bundle, so a web
   record saved before this plan (no field) still counts while its bundle has live items.
6. **Mobile backfill.** Migration 24 sets the column from each row's stored
   `mapped_feed_json`. Web records need no migration: IndexedDB stores whole objects, and
   decision 5 covers records without the field.
7. **No server sync.** The flag stays on the device. The follow row and its API do not change.
8. **Type untouched.** Writing the flag never writes `resourceType`; the mobile `parsedValues`
   keeps plan 37's medium-derived `resourceType` key beside the new one. Leave `isResourceType`
   for plan 88.

## Files

| Path                                                      | Change                |
| --------------------------------------------------------- | --------------------- |
| `packages/parser-mapping/src/addByRSS/liveItems.ts`       | New                   |
| `packages/parser-mapping/src/addByRSS/liveItems.test.ts`  | New, Vitest           |
| `packages/parser-mapping/src/index.ts`                    | Export                |
| `apps/web/src/utils/addByRSS/types.ts`                    | Record field          |
| `apps/web/src/utils/addByRSS/actions.ts`                  | Write on parse        |
| `apps/web/src/utils/addByRSS/actions.test.ts`             | Cases                 |
| `apps/mobile/src/data/db/migrations.ts`                   | Version 24            |
| `apps/mobile/src/data/db/migrations.test.ts`              | Version 24 case       |
| `apps/mobile/src/data/db/schema.ts`                       | Column                |
| `apps/mobile/src/prefs/addByRSSFeeds.ts`                  | Record field          |
| `apps/mobile/src/data/repositories/addByRssRepository.ts` | Read and sticky write |

## Implementation

### parser-mapping `addByRSS/liveItems.ts` (new)

```typescript
import type { AddByRSSMappedFeed } from './types.js';

/** True when a parsed Add by RSS feed carries at least one live item, of any status. */
export const addByRSSMappedFeedHasLiveItems = (
  mappedFeed: AddByRSSMappedFeed | null | undefined
): boolean => (mappedFeed?.liveItems ?? []).length > 0;

/**
 * Whether a feed may have livestreams: once a parse has carried a live item the answer stays
 * yes, even after the item leaves the feed. Used both to write the stored flag and to read it.
 */
export const addByRSSFeedMayHaveLivestreams = (
  storedFlag: boolean | null | undefined,
  mappedFeed: AddByRSSMappedFeed | null | undefined
): boolean => storedFlag === true || addByRSSMappedFeedHasLiveItems(mappedFeed);
```

Match how `apps/web/src/utils/addByRSS/itemIndex.ts` reads `feed.mappedFeed?.liveItems ?? []`;
if `liveItems` is not optional on the type and lint flags the `??`, keep only the outer `?.`.
Add `export * from './addByRSS/liveItems.js';` after the `itemIndex.js` line in `src/index.ts`.

### Web record and parse

- `types.ts` `AddByRSSFeedRecord` (line 28), after `lastFailureReason`:

```typescript
/** Set once a stored parse has carried a live item; never cleared. Absent on older records. */
mayHaveLivestreams?: boolean;
```

- `actions.ts` `applyAddByRSSParseStatus`, the `parsedFeed` branch: `updated` gains
  `mayHaveLivestreams: addByRSSFeedMayHaveLivestreams(nextBase.mayHaveLivestreams, mappedFeed)`.
  The `!parsedFeed` branch keeps `...base` and so keeps the stored value.
- `rg -n "upsertAddByRSSFeed\(" apps/web/src` and check each writer builds from an existing
  record with a spread. A writer that builds a record from scratch for a feed that already
  exists (for example a follow stub refresh in `sync.ts`) must carry `existing.mayHaveLivestreams`
  over. List any you change in the final message.

### Mobile migration 24

Append after version 23 in `migrations.ts`:

```typescript
{
  version: 24,
  statements: [
    // Whether an Add by RSS feed has carried a live item in any stored parse. Never cleared, so it
    // outlasts a live item that has left the feed. Seeded from the bundles already on the device.
    `ALTER TABLE add_by_rss_feed ADD COLUMN may_have_livestreams INTEGER NOT NULL DEFAULT 0;`,
    `UPDATE add_by_rss_feed SET may_have_livestreams = 1
      WHERE mapped_feed_json IS NOT NULL
        AND json_valid(mapped_feed_json)
        AND json_array_length(mapped_feed_json, '$.liveItems') > 0;`,
  ],
},
```

`json_array_length` returns NULL for a missing path, which the comparison treats as false. Match
the statement formatting of the version 23 entry.

### Mobile schema, record, and repository

- `schema.ts` `addByRssFeed` (line 107), after `lastAuthFailure`:
  `mayHaveLivestreams: integer('may_have_livestreams').notNull().default(0),`
- `MobileAddByRSSFeedRecord` (`prefs/addByRSSFeeds.ts` line 13): `mayHaveLivestreams?: boolean;`
  with the same doc comment as web. Writers never need to set it.
- `addByRssRepository.ts`:
  - `rowToRecord` (line 52): `mayHaveLivestreams: row.mayHaveLivestreams === 1,`
  - `upsertFeed` (line 236): the existing select also reads `mayHaveLivestreams`. In the
    `mappedFeed !== undefined` branch, `parsedValues` gains
    `mayHaveLivestreams: addByRSSFeedMayHaveLivestreams(existingRows[0]?.mayHaveLivestreams ===
1, mappedFeed) ? 1 : 0`. `baseValues` does not include the column, so the follow-merge
    branch leaves it as stored. Extend the method's doc comment with one sentence: the
    livestreams flag is derived at the same moment and is never cleared.

## Reuse

`AddByRSSMappedFeed.liveItems`, the existing parse-derived write in `upsertFeed`, and the web
parse branch in `applyAddByRSSParseStatus`.

## Tests

**Unit** — `liveItems.test.ts` (parser-mapping):

- `addByRSSMappedFeedHasLiveItems`: null and undefined → false; a feed with `liveItems: []` →
  false; a feed with one live item → true.
- `addByRSSFeedMayHaveLivestreams`: stored true with no live items → true; stored undefined
  with one live item → true; stored false with a null bundle → false.

Build the minimal `AddByRSSMappedFeed` the way `channelMetadata.test.ts` does.

**Unit** — `actions.test.ts`, in `describe('applyAddByRSSParseStatus')`, following the file's
existing mocks:

- A parsed feed whose compat result has a live item stores `mayHaveLivestreams: true`.
- A record stored with `mayHaveLivestreams: true` and a parse with no live items stays `true`.
- The parse with a live item keeps the record's `resourceType` (`'podcasts'` in the fixture).

If the file mocks `convertParsedRSSFeedToCompat`, return a mapped feed with `liveItems` set;
otherwise give the parsed feed one `podcastLiveItems` entry.

**Unit** — `migrations.test.ts`: a case like the version 23 one. `createRecordingDatabase(23)`,
`runMigrations`, expect the `ALTER TABLE add_by_rss_feed ADD COLUMN may_have_livestreams`
statement, the `UPDATE add_by_rss_feed SET may_have_livestreams = 1` statement, and
`PRAGMA user_version = 24;`. Update any case that asserts the latest version is 23.

## Release scratchpad

Append to `release-notes/scratchpad.md`:

```markdown
## Add by RSS feeds remember that they may have livestreams

- Surfaces: web, mobile
- Change: each Add by RSS feed stored on the device records, from its parses, that it has
  carried a live item, and keeps that after the item leaves the feed. The flag sits beside the
  feed's podcast or music type and never changes it. Mobile SQLite migration 24 adds
  `add_by_rss_feed.may_have_livestreams` and seeds it from stored feeds.
- Who notices: nobody directly; the Livestreams chips use it to pick feeds
- Operator steps: none
```
