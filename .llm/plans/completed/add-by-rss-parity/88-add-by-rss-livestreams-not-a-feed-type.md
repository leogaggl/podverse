# 88 — Livestreams are not an Add by RSS feed type

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

## Rows

- **R62**: livestreams are a flag, never a medium or a feed type. Remove `'livestreams'` from
  `AddByRSSResourceType` and every branch that reads it. A stored `'livestreams'` value reads as
  `'podcasts'`.

Runs after plan 82 and before plan 83. It edits files that plans 22, 37, 41, 66, 67, 82, and 92
edit first: the `add-by-rss-parity-sync` skill, `addByRssRepository.ts`, `addByRssItemRows.ts`,
`AddByRSSListClient.tsx`, `storage.ts`, and parser-mapping's `index.ts`. Plan 84 reads this
plan's `ADD_BY_RSS_RESOURCE_TYPES`.

## The rule (operator, final)

"Feeds of type livestreams do not always and not exclusively have livestreams. The livestream
designation is a flag in addition to their designation as a podcast, video, music, etc."

- An Add by RSS feed's `resourceType` comes from its medium only: `'podcasts'`, `'artists'`, or
  `'albums'` (`getAddByRSSResourceTypeFromMappedFeed`). `'episodes'` and `'tracks'` stay in the
  union as list kinds that older records and route params use.
- A feed with live items stays on its medium's chips. Its regular items show on Episodes or
  Tracks. Its live items show on Livestreams, found through `mayHaveLivestreams` (plan 82) and
  the bundle's `liveItems`, never through a resource type.

## What exists today

- No feed is stored as `'livestreams'`. The web add page saves `'podcasts'`; plan 37 makes
  mobile store the parsed medium's type; `getAddByRSSResourceTypeFromMappedFeed` never returns
  `'livestreams'`.
- Web has feed-level livestream components that only the `'livestreams'` list used:
  `AddByRSSLivestreamFeedNodes`, `AddByRSSLivestreamFeedRow`, `AddByRSSLivestreamFeedGridNode`,
  and the detail header `AddByRSSLivestreamHeader`. The row and header link a **feed** id into
  `/add-by-rss/<medium>/livestream/[id]`, whose page (`AddByRSSLivestreamItemPageClient`) expects
  an **item** id, so those links never worked. The item-level `AddByRSSLivestreamRow`,
  `AddByRSSLivestreamNodes`, `AddByRSSLivestreamGridNode`, and `AddByRSSLivestreamDetailHeader`
  stay; plan 84 uses them.
- Plan 67 already deleted `app/add-by-rss/[resource]/page.tsx` and the two
  `add-by-rss/{podcast,music}/livestream/page.tsx` list pages. If any of the three still exists,
  delete it here.

## Locked decisions

1. **One normalizer, both devices.** `@podverse/parser-mapping` owns the list of resource types
   and the read rule, because mobile may import values from it and not from the
   `@podverse/helpers` barrel.
2. **Read rule.** Any stored value that is not one of the five types reads as `'podcasts'`.
   Mobile applies it in `rowToRecord`. Web applies it on every feed read in `storage.ts`. No
   IndexedDB version bump and no SQLite migration: nothing is stored with the old value, and the
   next parse or follow write stores a valid one.
3. **Deletions.** The four feed-level web components above are deleted, not kept unused.
4. **Route.** `/add-by-rss/livestreams/<id>` returns not found, like any other unknown segment.

## Files

| Path                                                                       | Change                     |
| -------------------------------------------------------------------------- | -------------------------- |
| `packages/helpers/src/lib/addByRSS/types.ts`                               | Drop `'livestreams'`       |
| `packages/parser-mapping/src/addByRSS/resourceType.ts`                     | List, guard, read rule     |
| `packages/parser-mapping/src/addByRSS/resourceType.test.ts`                | New, Vitest                |
| `apps/web/src/components/AddByRSS/Detail/AddByRSSDetailClient.tsx`         | Drop livestream branches   |
| `apps/web/src/components/AddByRSS/List/AddByRSSListClient.tsx`             | Drop livestream branches   |
| `apps/web/src/components/AddByRSS/Livestream/AddByRSSLivestreamFeed*.tsx`  | Delete three files         |
| `apps/web/src/components/AddByRSS/Livestream/AddByRSSLivestreamHeader.tsx` | Delete                     |
| `apps/web/src/app/add-by-rss/[resource]/[id_text]/page.tsx`                | Shared guard               |
| `apps/web/src/utils/addByRSS/storage.ts`                                   | Read rule on feed reads    |
| `apps/mobile/src/data/repositories/addByRssRepository.ts`                  | Read rule in `rowToRecord` |
| `.cursor/skills/add-by-rss-parity-sync/SKILL.md`                           | Routes and the flag rule   |
| `.cursor/rules/add-by-rss-data-contracts.mdc`                              | One bullet                 |

## Implementation

### helpers `types.ts`

```typescript
export type AddByRSSResourceType = 'podcasts' | 'episodes' | 'artists' | 'albums' | 'tracks';
```

### parser-mapping `resourceType.ts`

Add above `getAddByRSSResourceTypeFromMappedFeed`:

```typescript
/** Every Add by RSS resource type. Livestreams are a per-feed flag, not a type. */
export const ADD_BY_RSS_RESOURCE_TYPES: readonly AddByRSSResourceType[] = [
  'podcasts',
  'episodes',
  'artists',
  'albums',
  'tracks',
];

export const isAddByRSSResourceType = (value: string): value is AddByRSSResourceType =>
  ADD_BY_RSS_RESOURCE_TYPES.some((resourceType) => resourceType === value);

/** A stored resource type; any value outside the list reads as podcasts. */
export const toAddByRSSResourceType = (value: string): AddByRSSResourceType =>
  isAddByRSSResourceType(value) ? value : 'podcasts';
```

`some` with `===` keeps the guard free of `as`. In `getAddByRSSDetailRouteSegment`, delete the
`case 'livestreams':` branch; leave the other cases and the `default`. `index.ts` already exports
the whole module.

### Web detail and list clients

- `AddByRSSDetailClient.tsx`: delete the `AddByRSSLivestreamHeader` import, the
  `case 'livestreams':` in `itemsLabel`, and the `resourceType === 'livestreams' ? (…) :` arm of
  `headerNode`, so `headerNode` is the artists, tracks, or `null` chain.
- `AddByRSSListClient.tsx`: delete the `AddByRSSLivestreamFeedNodes` import and the
  `case 'livestreams':` in `renderFeeds`. If `getResourceLabel` still exists (plan 67 removes it
  when unused), delete its `livestreams` case too.

### Web deletions

Delete `AddByRSSLivestreamFeedNodes.tsx`, `AddByRSSLivestreamFeedRow.tsx`,
`AddByRSSLivestreamFeedGridNode.tsx`, and `AddByRSSLivestreamHeader.tsx` under
`apps/web/src/components/AddByRSS/Livestream/`. They import only shared stylesheets
(`ListLiveItemRow`, `ListGridNode`, `ListNodes`, `EpisodeHeader`), which other components keep
using, so no stylesheet is deleted. Then
`rg -n "AddByRSSLivestreamFeed|AddByRSSLivestreamHeader\b" apps/web` must print nothing.

### `[resource]/[id_text]/page.tsx`

Replace the local `RESOURCE_TYPES` array and the local `isAddByRSSResourceType` (which casts with
`as`) with `import { isAddByRSSResourceType } from '@podverse/parser-mapping';`. Keep the
`notFound()` call and the `AddByRSSResourceType` type import only if still used.

### Web `storage.ts`

Add one private mapper and apply it wherever a feed record leaves the store:

```typescript
const withKnownResourceType = (record: AddByRSSFeedRecord): AddByRSSFeedRecord => {
  const resourceType = toAddByRSSResourceType(record.resourceType);
  return resourceType === record.resourceType ? record : { ...record, resourceType };
};
```

- `getAllAddByRSSFeeds`: map the `getAll()` result.
- `getAddByRSSFeedByIdText` and `getAddByRSSFeedByUrl`: map a found record; keep `null` and
  `undefined` handling as written.
- `getAddByRSSFeedsByResourceType`: return
  `(await getAllAddByRSSFeeds()).filter((feed) => feed.resourceType === resourceType)` so a
  record read as `'podcasts'` is found by the Podcasts list. The `resourceType` index stays in the
  store definition; leave `DB_VERSION` alone.
- Any read helper plan 92 added that returns feed records (for example inside
  `insertMissingAddByRSSFeeds`) only compares feed URLs; leave it.

Import `toAddByRSSResourceType` as a value from `@podverse/parser-mapping`, on its own line apart
from the type imports (**type-imports-separate-line**).

### Mobile `addByRssRepository.ts`

Delete the local `isResourceType`. In `rowToRecord`:
`resourceType: toAddByRSSResourceType(row.resourceType),`. Add `toAddByRSSResourceType` to the
value import from `@podverse/parser-mapping` that plan 37 added for
`getAddByRSSResourceTypeFromMappedFeed`. Leave plan 82's `mayHaveLivestreams` line and plan 37's
`upsertFeed` change as they are.

### Leftover search

After the edits:

```bash
rg -n "'livestreams'" apps/web/src apps/mobile/src packages/helpers/src packages/parser-mapping/src
```

Every remaining hit must be a chip or media-type identifier (`MediaListChip`, `HomeMediaType`,
`AddByRssLibraryMediaType`, `BrowseMediaType`, `membershipFeatureComparison`), never a value
compared with or assigned to a feed's `resourceType`. Fix any hit that is. In particular,
`itemResourceKinds` (in `screens/home/addByRssItemRows.ts` after plan 41) lists `'podcasts'` and
`'episodes'` for Episodes; plans 41 and 66 already dropped `'livestreams'` from their lists.

### Guidance

- `.cursor/skills/add-by-rss-parity-sync/SKILL.md`: keep plan 22's mobile wording. Replace the
  "Keep add-by-RSS routes aligned with" bullet and its six route lines with the routes that exist:
  the `/add-by-rss` chips page (Podcasts, Episodes, Artists, Albums, Tracks, Livestreams chips),
  `/add-by-rss/podcast/:id`, `/add-by-rss/episode/:id`, `/add-by-rss/artist/:id`,
  `/add-by-rss/album/:id`, `/add-by-rss/track/:id`, and the livestream item pages
  `/add-by-rss/podcast/livestream/:itemId` and `/add-by-rss/music/livestream/:itemId`. Add one
  bullet: a feed's resource type comes from its medium; livestreams are the feed's
  `mayHaveLivestreams` flag plus its live items, so a feed with livestreams stays on its medium's
  chips. Lines under 100 characters.
- `.cursor/rules/add-by-rss-data-contracts.mdc`: one bullet after the boundary checklist
  paragraph: resource types are `ADD_BY_RSS_RESOURCE_TYPES` (`@podverse/parser-mapping`); a
  stored value outside it reads as `'podcasts'` through `toAddByRSSResourceType`; whether a feed
  carries livestreams is the `mayHaveLivestreams` flag, never a resource type.

## Reuse

`getAddByRSSResourceTypeFromMappedFeed` and its module; plan 82's flag; the existing
`notFound()` route guard.

## Tests

**Unit**: `packages/parser-mapping/src/addByRSS/resourceType.test.ts` (the package's Vitest
include is `src/**/*.test.ts`):

- `toAddByRSSResourceType`: `'livestreams'` → `'podcasts'`; `''` → `'podcasts'`; `'albums'` →
  `'albums'`; `'tracks'` → `'tracks'`.
- `isAddByRSSResourceType`: true for each of the five; false for `'livestreams'`.
- `getAddByRSSDetailRouteSegment`: `'artists'` → `'artist'`, `'albums'` → `'album'`,
  `'podcasts'` → `'podcast'`.
- `getAddByRSSResourceTypeFromMappedFeed`: a mapped feed whose channel `medium_id` is a podcast
  medium returns `'podcasts'`; `null` returns `'podcasts'`. Build the minimal feed the way
  `channelMetadata.test.ts` does.

Web and mobile type-checks cover the removed branches. Playwright: plan 87's Add by RSS
livestream step already shows a live feed's item on the Livestreams chip; no new spec here.

## Release scratchpad

Append to `release-notes/scratchpad.md`:

```markdown
## Add by RSS feeds have no livestreams type

- Surfaces: web, mobile, shared packages (helpers, parser-mapping)
- Change: an Add by RSS feed's type is its medium only (podcast, artist, or album). Whether it
  carries livestreams is a separate flag, so a feed with livestreams stays on its Podcasts or
  Artists and Albums chips, and its live items show on the Livestreams chips. A stored
  `livestreams` type now reads as podcasts. The web feed-level livestream list rows and header,
  which linked a feed id to the livestream item page, are removed, and
  `/add-by-rss/livestreams/<id>` returns not found.
- Who notices: nobody in normal use; no feed was stored with that type
- Operator steps: none
```
