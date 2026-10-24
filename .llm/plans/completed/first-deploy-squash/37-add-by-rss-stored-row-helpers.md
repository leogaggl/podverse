**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 37 — Delete the Add by RSS stored-row helpers the open passes used

Plan 21 removes the two one-time passes that ran when the database opened
(`applyAddByRssResourceTypes`, `applyAddByRssPublisherRefs`). The pure helpers they called live in
`apps/mobile/src/lib/addByRss/` and have no other caller. This plan deletes them and their tests.
No behavior changes.

## Rows

R19, R26

## Runs after

21, 34

Plan 21 deletes the only callers. Plan 34 edits `apps/mobile/vitest.config.ts` first.

## Files

apps/mobile/src/lib/addByRss/storedResourceType.ts
apps/mobile/src/lib/addByRss/storedResourceType.test.ts
apps/mobile/src/lib/addByRss/publisherRefs.ts
apps/mobile/src/lib/addByRss/publisherRefs.test.ts
apps/mobile/vitest.config.ts

## Before editing

Confirm the callers are gone:

- `rg -n "applyAddByRss" apps/mobile` prints nothing.
- `rg -n "storedResourceType|resourceTypeUpdatesFromStoredRows|ADD_BY_RSS_RESOURCE_TYPE_PASS_KEY" apps/mobile --glob '!node_modules/**'`
  prints only the two `storedResourceType` files and the `vitest.config.ts` include line.
- `rg -n "publisherRefUpdatesFromStoredRows|ADD_BY_RSS_PUBLISHER_REFS_PASS_KEY|StoredAddByRssPublisherRefsRow|AddByRssPublisherRefsUpdate" apps/mobile --glob '!node_modules/**'`
  prints only `publisherRefs.ts` and `publisherRefs.test.ts`.

If any other file prints, stop and report it as a blocker. Do not delete a helper that still has a
caller.

## Edits

1. Delete `apps/mobile/src/lib/addByRss/storedResourceType.ts` and
   `apps/mobile/src/lib/addByRss/storedResourceType.test.ts` (`rm`, not `git rm`).
2. `apps/mobile/vitest.config.ts`: delete the line `'src/lib/addByRss/storedResourceType.test.ts',`
   from `test.include`. Keep plan 34's `publicWebBaseUrl.test.ts` line and every other line.
3. `apps/mobile/src/lib/addByRss/publisherRefs.ts`:
   - Delete the doc comment and the export `ADD_BY_RSS_PUBLISHER_REFS_PASS_KEY` at the top of the
     file.
   - Delete `StoredAddByRssPublisherRefsRow`, `AddByRssPublisherRefsUpdate`, and
     `publisherRefUpdatesFromStoredRows` with its doc comment, at the end of the file.
   - In the doc comment above `addByRssPublisherRefsFromMappedFeed`, replace
     "Reads stored bundles defensively: a bundle written before publisher pointers were mapped has
     no list and yields none." with "A bundle with no publisher list yields none."
   - Keep `addByRssPublisherRefsFromMappedFeed`, `parseStoredPublisherGuids`,
     `parseStoredPublisherDirectoryMatches`, `publisherRefColumnsFromMappedFeed`, the
     `AddByRssPublisherPointer`, `AddByRssPublisherRefs`, and `AddByRssDirectoryPublisherMatch`
     types, and the `safeJsonParse` import (`parseStoredArray` still uses it).
4. `apps/mobile/src/lib/addByRss/publisherRefs.test.ts`: remove
   `publisherRefUpdatesFromStoredRows` from the import list and delete the whole
   `describe('publisherRefUpdatesFromStoredRows', …)` block. Keep the other describes and the
   `mappedBundle` helper. If `ARTIST_URL` or `FEED_URL` is unused afterward, delete that constant.

## Self-check

- The three `rg` commands in § Before editing print nothing.
- `npx eslint` on `apps/mobile/src/lib/addByRss/publisherRefs.ts` and
  `apps/mobile/src/lib/addByRss/publisherRefs.test.ts` reports no unused import or variable. Scope
  any formatter to the files this plan lists.

## Tests

The deleted `storedResourceType.test.ts` and the removed `publisherRefUpdatesFromStoredRows`
block are the only test changes. The remaining `publisherRefs.test.ts` cases cover the helpers a
parse still calls. No Maestro flow.

## Release scratchpad

none. Dead-code removal; plan 21's entry covers the behavior.
