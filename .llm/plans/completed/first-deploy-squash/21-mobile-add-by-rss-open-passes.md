**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 21 — Remove the one-time Add by RSS repair passes from database open

## Rows

R18, R25

## Runs after

none

## Files

apps/mobile/src/data/db/index.ts
apps/mobile/src/data/db/applyAddByRssResourceTypes.ts
apps/mobile/src/data/db/applyAddByRssPublisherRefs.ts
apps/mobile/src/data/repositories/addByRssRepository.ts

## Why these go

`initialize()` in `apps/mobile/src/data/db/index.ts` runs two passes after `runMigrations`:

- `applyAddByRssResourceTypes()` sets `add_by_rss_feed.resource_type` from each stored bundle,
  then writes the `kv_meta` marker `add_by_rss.resource_type_from_bundle`.
- `applyAddByRssPublisherRefs()` sets `podcast_guid` and `publisher_guids_json` from each stored
  bundle, then writes the marker `add_by_rss_publisher_refs_v1`.

Each pass reads only rows that already exist at that open, then writes its marker and never runs
again. On a fresh database (every install after the squash in plan 20) the first open finds no
`add_by_rss_feed` rows, writes the marker, and the pass never acts. `upsertFeed` in
`addByRssRepository.ts` already writes `resource_type` from
`getAddByRSSResourceTypeFromMappedFeed` and the guid columns from
`publisherRefColumnsFromMappedFeed` whenever a bundle lands. The passes exist only to repair rows
written by earlier builds, so they go.

`reloadAddByRssArtistIndex()` (`readAddByRssArtistIndex.ts`) is current behavior and stays.

## Changes

1. `apps/mobile/src/data/db/index.ts`: remove the imports of `applyAddByRssPublisherRefs` and
   `applyAddByRssResourceTypes` and the two `await` calls in `initialize()`. The order after the
   edit is `PRAGMA journal_mode = WAL`, `runMigrations`, `reloadAddByRssArtistIndex`, then the
   chrome and channel-action hydration exactly as today.
2. Delete `apps/mobile/src/data/db/applyAddByRssResourceTypes.ts` and
   `apps/mobile/src/data/db/applyAddByRssPublisherRefs.ts`.
3. `apps/mobile/src/data/repositories/addByRssRepository.ts`, the doc comment above
   `upsertFeed` (around line 799): delete the sentence "Opening the database uses that helper
   once to set `resource_type` from bundles already stored." Keep the rest of the comment.

Do not edit `apps/mobile/src/lib/addByRss/storedResourceType.ts`,
`apps/mobile/src/lib/addByRss/publisherRefs.ts`, their tests, or `apps/mobile/vitest.config.ts`.
Those are area C files; this plan leaves some of their exports unused (see the final message's
notes). `parseStoredPublisherGuids`, `parseStoredPublisherDirectoryMatches`,
`addByRssPublisherRefsFromMappedFeed`, and `publisherRefColumnsFromMappedFeed` stay in use.

Grep `applyAddByRss` across `apps/mobile` after the edit; nothing may reference the deleted files.

## Tests

none. The passes had no unit tests of their own; the pure helpers they called are tested in area
C files (`storedResourceType.test.ts`, `publisherRefs.test.ts`), which area C removes or trims.
Database open is covered by the existing Maestro `hello-world` and `add-by-rss-artist` flows.

## Release scratchpad

```markdown
## Mobile database open no longer repairs stored Add by RSS rows

- Surfaces: mobile
- Change: opening the database no longer runs the one-time passes that rewrote stored Add by RSS
  feed types and podcast/publisher guids from saved bundles. A parse already writes those columns.
- Who notices: nobody on a fresh install
- Operator steps: none beyond the reinstall in "Mobile database starts over at one first migration"
```
