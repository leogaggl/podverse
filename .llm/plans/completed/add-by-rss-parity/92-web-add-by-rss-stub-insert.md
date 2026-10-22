# 92 — Web follow syncs never collide on the feed URL index

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

Row: R58. Web only. Paths are under `apps/web/`.

Run after plan 70, which wraps the body of `syncAddByRSSFollowStubs` in
`trackBackgroundActivity('add_by_rss_refresh', { counted: false }, …)`. This plan edits one line
inside that wrapped body and leaves the wrapper alone.

## Answer: how the collision happens

The `feeds` object store in `src/utils/addByRSS/storage.ts` is keyed by `idText` and has a
**unique** `feedUrl` index (`openAddByRSSDb`). `syncAddByRSSFollowStubs`
(`src/utils/addByRSS/sync.ts`) reads every stored feed, mints a fresh `idText` stub for each
follow whose URL it did not see, then writes the stubs with `bulkUpsertAddByRSSFeeds`.

Five callers run that sync, and on a page load several start together:

- the background refresh (`src/utils/addByRSS/backgroundRefresh.ts`, from
  `providers/AddByRSSBackgroundRefresh.tsx`)
- the library list (`components/AddByRSS/List/AddByRSSListClient.tsx`)
- the feed detail (`components/AddByRSS/Detail/AddByRSSDetailClient.tsx`)
- the player metadata upgrade (`hooks/useAddByRSSMetadataUpgrade.ts`)
- area F's Home work, after it lands

Two runs that both read before either writes both see the follow as missing. Each mints its own
`idText`. The second `put` breaks the unique `feedUrl` index and throws `ConstraintError`, which
aborts that run's whole transaction, so its other new stubs are lost too. The list page then
skips `refreshFeeds()` (same `try`) and logs the error. The background refresh logs "follow sync
failed". A second tab running the background refresh has the same race.

`syncAddByRSSCacheWithServer` only removes rows, and `patchAddByRSSFollowMetadata` only updates
rows found by URL. Neither inserts, so neither collides.

## Locked decisions

1. **Fix it at the write.** The stub write becomes check-and-insert: for each stub, look up
   `feedUrl` on the index and `put` only when no row has it. Both steps happen inside one
   `readwrite` transaction on `feeds`. IndexedDB never runs two `readwrite` transactions on the
   same store at once, even from different tabs. A second run's transaction starts after the
   first commits, finds that row, and skips it.
2. **Replace `bulkUpsertAddByRSSFeeds`; do not add a second writer.** Its only caller is this sync.
   Rename it `insertMissingAddByRSSFeeds` and give it the check-and-insert body. No unused export
   remains.
3. **No in-tab single-flight.** Sharing one in-flight run between callers would hand a later caller
   (for example the metadata upgrade, checking a feed it was just told about) a server read that
   started before that follow. Duplicate runs are now harmless: removals and patches are
   idempotent, and inserts skip existing URLs.
4. **The follow write on the add page stays as it is.** `followAddByRSSChannelAndQueue`
   (`actions.ts`) writes its own record with `upsertAddByRSSFeed`. The add page already recovers
   from a `ConstraintError` by loading the stored row for that URL
   (`AddByRSSAddFeedPageClient.tsx`, the `isConstraintError` branch). R58 covers the follow
   syncs only.
5. **No new dependency.** The web unit tests run in jsdom without IndexedDB and mock `./storage`
   (`actions.test.ts`, `firstParse.test.ts`). The transaction behavior is covered by the
   Playwright guard below, not by adding a fake IndexedDB package, which would mean a lockfile
   change.

## Files

| File                                    | Change                                          |
| --------------------------------------- | ----------------------------------------------- |
| `src/utils/addByRSS/storage.ts`         | `bulkUpsertAddByRSSFeeds` → `insertMissingAddByRSSFeeds` |
| `src/utils/addByRSS/sync.ts`            | Call the renamed write                          |
| `src/utils/addByRSS/sync.test.ts`       | New, Vitest                                     |
| `e2e/add-by-rss-auto-parse.spec.ts`     | Fail on a feed URL index collision in the console |

Tier B: extensionless relative imports. `vitest.config.ts` already includes `src/**/*.test.ts`.

## Implementation

### `storage.ts`

Replace `bulkUpsertAddByRSSFeeds` (same position in the file) with:

```typescript
/**
 * Stores each record whose feed URL has no row yet and skips the rest. The lookup and the write
 * share one readwrite transaction, and the browser runs those one at a time per store across
 * tabs, so two syncs that both saw a feed as missing cannot both insert it.
 */
export const insertMissingAddByRSSFeeds = async (
  records: readonly AddByRSSFeedRecord[]
): Promise<void> => {
  if (!isIndexedDbAvailable() || records.length === 0) {
    return;
  }

  await withStore(FEEDS_STORE, 'readwrite', async (store) => {
    const index = store.index('feedUrl');
    for (const record of records) {
      const existingKey = await requestToPromise(index.getKey(record.feedUrl));
      if (existingKey !== undefined) {
        continue;
      }
      await requestToPromise(store.put(record));
    }
  });
};
```

Awaiting `requestToPromise` inside the handler keeps the transaction open, the same way
`patchAddByRSSFollowMetadata` and the old bulk write did. Do not add any other `await` (a timer,
fetch, or another store) inside the loop. The transaction would commit early and the check would
no longer guard the write.

### `sync.ts`

In the import from `./storage`, replace `bulkUpsertAddByRSSFeeds` with
`insertMissingAddByRSSFeeds` (keep the list alphabetical). In `syncAddByRSSFollowStubs`, replace

```typescript
if (inserts.length > 0) {
  await bulkUpsertAddByRSSFeeds(inserts);
}
```

with `await insertMissingAddByRSSFeeds(inserts);` (the function returns early on an empty list).
Add one sentence to the function's doc comment: a stub is stored only when no row has its URL,
so syncs that overlap, in this tab or another, never collide on the feed URL index.

## Tests

**`sync.test.ts`** (new, Vitest). Use `vi.hoisted` mocks:

- `vi.mock('./api', …)` with `getFollowedAddByRSSChannels`.
- `vi.mock('./storage', …)` with `getAllAddByRSSFeeds`, `bulkRemoveAddByRSSFeeds`,
  `clearAddByRSSItemsIndex`, `patchAddByRSSFollowMetadata` (resolves `[]`), and
  `insertMissingAddByRSSFeeds`.
- `vi.mock('./feedChangedEvent', …)` with `emitAddByRSSFeedChanged`.

`firstParse.test.ts` uses the same pattern. Leave plan 70's
`../backgroundActivity/backgroundActivityStore` unmocked; it has no side effects beyond its own
snapshot. Cases for `syncAddByRSSFollowStubs('account-1')`:

- One follow `{ feed_url: 'https://a.example/feed.xml', title: 'A', image_url: null,
  requires_credentials: false }` and no stored feeds: `insertMissingAddByRSSFeeds` is called once
  with one record whose `feedUrl` is that URL, `title` is `'A'`, `resourceType` is `'podcasts'`,
  and `requiresCredentials` is `false`. `patchAddByRSSFollowMetadata` receives `[]`.
- The same follow with a stored feed for that URL: `insertMissingAddByRSSFeeds` receives `[]`, and
  `patchAddByRSSFollowMetadata` receives one patch for that URL.
- A stored feed the account no longer follows: `bulkRemoveAddByRSSFeeds` receives its `idText` and
  `clearAddByRSSItemsIndex` is called.

**Playwright `e2e/add-by-rss-auto-parse.spec.ts`** (existing). Its first step opens the Add by RSS
list in a fresh browser for an account that follows a feed this browser never stored. That load
is when the background refresh and the list page sync at the same moment. After
`await loginSeedUser(page);`, add:

```typescript
const feedUrlIndexErrors: string[] = [];
page.on('console', (message) => {
  const text = message.text();
  if (
    message.type() === 'error' &&
    (text.includes('ConstraintError') || text.includes('uniqueness'))
  ) {
    feedUrlIndexErrors.push(text);
  }
});
```

As the test's last statement, add a step:

```typescript
await test.step('No follow sync collided on the stored feed URL index', async () => {
  expect(feedUrlIndexErrors).toEqual([]);
});
```

The race is timing-dependent, so this guard fails when it happens rather than forcing it. If
area F has moved this spec's list URL, keep the listener and the step; they do not depend on the
URL.

## Release scratchpad

```markdown
## Web Add by RSS follow sync no longer fails when two syncs overlap

- Surfaces: web
- Change: When the background refresh and an Add by RSS page synced follows at the same moment
  (common on the first visit in a browser, or with two tabs open), one of them could fail on the
  browser's feed store and drop the feeds it was adding. The list then stayed empty until a
  reload. Each feed is now added only if no stored feed has its URL, so overlapping syncs both
  finish and every followed feed appears.
- Who notices: web users who follow feeds by RSS from another device or use several tabs
- Operator steps: none
```
