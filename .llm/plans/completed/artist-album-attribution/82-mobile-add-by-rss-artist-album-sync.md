**Cursor model:** Opus 5.5 · **Reasoning:** high

# 82 — Mobile stores an Add by RSS artist's albums as their parses finish

When an Add by RSS artist is added or refreshed, its parse status carries `publisherListedFeeds`
(plan 20), and the server has queued one parse per Add by RSS album it lists (plan 22). This plan
makes mobile keep that list (plan 80's table), fetch each album's parse in one background sync
job, and store each album on the device as a listed-only row (R43, R46). It also resolves each
album's `podcast:publisher` pointers to directory channels through plan 70's read and stores the
result for the artist line (R50). Nothing here renders; plans 84–87 read it.

## Rows

R8, R19, R40, R42, R43, R44, R46, R50, R54

## Runs after

20, 22, 70, 80, 81

## Files

apps/mobile/src/lib/addByRss/domain.ts
apps/mobile/src/lib/addByRss/domain.test.ts
apps/mobile/src/data/repositories/addByRssListedFeeds.ts
apps/mobile/src/data/repositories/addByRssListedFeeds.test.ts
apps/mobile/src/data/repositories/addByRssRepository.ts
apps/mobile/src/hooks/useAddByRssAddFlow.ts
apps/mobile/src/sync/syncJobKinds.ts
apps/mobile/src/sync/syncJobKinds.test.ts
apps/mobile/src/sync/syncJobPlan.ts
apps/mobile/src/sync/syncJobs.ts
apps/mobile/src/sync/syncQueue.test.ts
apps/mobile/src/sync/SyncProvider.tsx
apps/mobile/src/sync/requestAddByRssRefresh.ts
apps/mobile/src/screens/more/errorLogPresentation.ts
release-notes/scratchpad.md

## Reuses

- `pollAddByRssParseStatus`, `buildAddByRssFeedRecord`, `resolveAddByRssCredentialStatus`,
  `buildAddByRssParseFailureLog`, `addByRssCredentialStore.get` as they stand.
- `reqChannelGetDirectoryMatch` (plan 70) on the `apiRequestService` that
  `requestWithMobileAuthRefresh` hands out, like every other request in `addByRssRepository.ts`.
- `replaceListedFeeds`, `setListedFeedPending`, `setListedFeedArtwork`,
  `setPublisherDirectoryMatches`, `getPublisherState`, `listAllListedFeeds`, and `upsertFeed` with
  `followed` (plan 80). Plan 81's index reloads after each of those writes.
- `playbackContentRepository.getChannelById(context, idOrIdText)` and
  `primaryChannelListArtworkUrl` for directory album artwork.
- The register/request callback in `sync/requestAddByRssRefresh.ts` (repositories may import it;
  `directoryChannelGone.ts` does).

## Decisions this plan fixes

- **One job polls every pending album per round**, not one job per album. The queue runs one
  job at a time; album parses wait on the server's background queue, so a job per album that
  waits would hold sync for minutes on an artist with many albums. The job makes up to
  `LISTED_FEED_POLL_ROUNDS = 8` rounds, one status read per pending album per round, sleeping
  `LISTED_FEED_POLL_DELAY_MS = 3000` between rounds while any remain, with `timeoutMs: 60000`.
- **A still-pending album keeps its request id.** The next run picks it up. The next artist parse
  replaces it with a fresh id.
- **Album credentials stay on the device.** The server sends the artist's credentials only to
  albums on the artist's domain (plan 22, R54). When this device holds credentials for an album
  URL, the job sends its own parse request for that album with them instead of polling the
  server's fan-out id. A private album with no stored credentials fails `credentials_required`,
  is stored as a row that needs credentials, and shows under the artist in the existing Needs
  username and password state (plan 84).
- **Directory matches are looked up when stored, not when played.** After storing a parsed album
  (followed or listed-only, `resourceType === 'albums'`), the repository asks plan 70's read once
  per publisher pointer, only when the pointer guids differ from what is stored or were never
  looked up. A failed lookup stores nothing and retries on the next parse. The player stays
  synchronous (plan 81).
- **Follows from this device stay follows.** `applyRefreshResult` tickets are server follows, so
  it writes `followed: true`. The add flow passes `followed: true` to `parseNow`. The credentials
  form and feed check pass nothing, so a listed-only album stays listed-only.

## `lib/addByRss/domain.ts`

- `AddByRssPollResult` gains:

  ```typescript
  /** On a `parsed` artist status: everything the artist lists. Absent means keep what is stored. */
  publisherListedFeeds?: AddByRSSPublisherListedFeed[];
  ```

  Set it from `statusResponse.publisherListedFeeds` in the resolved branch of
  `pollAddByRssParseStatus`.
- `pollAddByRssParseStatus(requestId, fetchStatus, options?: { attempts?: number; delayMs?: number })`:
  defaults stay `STATUS_POLL_ATTEMPTS` and `STATUS_POLL_DELAY_MS`. Do not sleep after the last
  attempt.

## Pure decisions (`addByRssListedFeeds.ts`)

```typescript
export type ListedAlbumStoreAction =
  | { kind: 'keep-pending' }
  | { kind: 'update-existing' }
  | { kind: 'skip-duplicate' }
  | { kind: 'insert-parsed' }
  | { kind: 'insert-needs-credentials' }
  | { kind: 'log-failure' };

export const decideListedAlbumStore = (params: {
  result: Pick<AddByRssPollResult, 'failureReason' | 'mappedFeed' | 'status'>;
  /** A stored row with this album's URL (canonical match). */
  hasRowForUrl: boolean;
  /** A stored row whose `podcast_guid` equals the parsed album's guid, under another URL. */
  hasRowForGuid: boolean;
}): ListedAlbumStoreAction => …;

/** True when a pointer lookup is due: never looked up, or the stored guids differ. */
export const directoryLookupDue = (
  stored: { publisherGuids: readonly string[]; directoryMatches: readonly unknown[] | null } | null,
  pointerGuids: readonly string[]
): boolean => …;
```

Order in `decideListedAlbumStore`: `pending` → keep-pending. A non-null `mappedFeed` →
update-existing when `hasRowForUrl`, else skip-duplicate when `hasRowForGuid`, else
insert-parsed. `failed` with `credentials_required` or `credentials_rejected` →
update-existing when `hasRowForUrl`, else insert-needs-credentials. Anything else → log-failure.

## Repository (`addByRssRepository.ts`)

### Shared steps

- Extract the POST in `parseNow` into a private `enqueueParseRequest(context, feedUrl, credentials)`
  returning the request id. `parseNow` calls it; nothing else changes in the request.
- `recordRefreshFailure` gains a `jobKind` parameter (`'add-by-rss-parse'` at its current call;
  `'add-by-rss-listed-feeds'` from the job below).
- Private `storeArtistRelations(context, feedUrl, result)`, called after every `upsertFeed` with a
  bundle in `parseNow`, `applyRefreshResult`, and the job below:
  1. When `result.status === 'parsed'` and `result.publisherListedFeeds !== undefined`:
     `await replaceListedFeeds(feedUrl, result.publisherListedFeeds)`, then
     `requestAddByRssListedFeedsSync()` when any stored row for that artist has a
     `pendingRequestId` or is a `directory` row with `artworkChecked` false.
  2. When the stored feed's `resourceType` is `albums`: `pointers` from
     `addByRssPublisherRefsFromMappedFeed(result.mappedFeed).publisherPointers`. When
     `pointers.length === 0`, `setPublisherDirectoryMatches(feedUrl, [])`. Otherwise, when
     `directoryLookupDue(await getPublisherState(feedUrl), guids)`, call
     `reqChannelGetDirectoryMatch({ feed_guid, feed_url })` per pointer (at most 5, in order),
     keep non-null results as `{ feedGuid, channelIdText: id_text, channelTitle: title, mediumId: medium_id }`,
     and `setPublisherDirectoryMatches`. Any thrown request → `logger.warn` without the URL, store
     nothing.
- `parseNow(context, feedUrl, credentials, options?: { followed?: boolean })`: pass
  `followed: options.followed` into the record when defined; call `storeArtistRelations` after the
  upsert when `result.mappedFeed !== null`.
- `applyRefreshResult`: the record gets `followed: true`; call `storeArtistRelations` after the
  upsert.
- `ensureLocalFeedFromFollow`: when the row exists with `followed === false`, call
  `setFollowed(feedUrl, true)` and return (a follow made elsewhere promotes the album).

### Album work

```typescript
/** True when any listed album waits on a parse or any directory row lacks checked artwork. */
hasListedFeedWork: async (): Promise<boolean> => …,

/** Fetch every pending album parse, store the results, and fill directory artwork. */
runListedFeedWork: async (
  context: MobileAuthRequestContext,
  accountIdText: string,
  sleep: (ms: number) => Promise<void>
): Promise<void> => …,
```

`runListedFeedWork`:

1. `listings = await listAllListedFeeds()`.
2. Album work: `add_by_rss` rows with a `feedUrl` and a `pendingRequestId`, one per canonical
   `feedUrl` (two artists listing one album poll it once; the result is stored once). For each,
   `credentials = await addByRssCredentialStore.get(accountIdText, feedUrl)`; when non-null,
   replace the request id with `await enqueueParseRequest(context, feedUrl, credentials)` and set it
   on every listing row with that URL (`setListedFeedPending`).
3. Rounds: for each album still pending, read its status once
   (`pollAddByRssParseStatus(id, fetch, { attempts: 1, delayMs: 0 })`). On `pending`, keep it for
   the next round. Otherwise:
   - `existing` = row by canonical URL (`getFeedByUrl` on the listed URL, then on its canonical
     form); `guidRow` = a row with the parsed album's `podcast_guid` under another URL.
   - Act on `decideListedAlbumStore`:
     - update-existing: `upsertFeed({ ...buildAddByRssFeedRecord(existingUrl, existing, preview), ...credentialStatus }, mappedFeed ?? undefined)`,
       never passing `followed` (a followed album stays followed).
     - insert-parsed: `upsertFeed({ ...buildAddByRssFeedRecord(feedUrl, undefined, preview), resourceType: 'albums', followed: false, ...credentialStatus }, mappedFeed)`.
       Title falls back to the listing's `title` when the preview has none.
     - insert-needs-credentials: the same record with no bundle, `title` from the listing,
       `requiresCredentials: true`, `lastAuthFailure` from `resolveAddByRssCredentialStatus`.
     - skip-duplicate, keep-pending: nothing.
     - log-failure: `recordRefreshFailure({ feedUrl, requestId }, result, 'add-by-rss-listed-feeds')`.
   - When a bundle was stored, `storeArtistRelations(context, feedUrl, result)` (album entries
     carry no list; this stores its pointer matches).
   - Clear `pendingRequestId` on every listing row with that URL.
   A thrown status read logs once (same session dedupe) and keeps the id.
   Between rounds, `await sleep(LISTED_FEED_POLL_DELAY_MS)` while any remain, up to
   `LISTED_FEED_POLL_ROUNDS`.
4. Directory artwork: `directory` rows with `artworkChecked` false, one per `channelIdText`. For
   each, `getChannelById(context, channelIdText)`; on success
   `setListedFeedArtwork(publisher, guid, primaryChannelListArtworkUrl(channel.channel_images) ?? null)`
   on every row with that `channelIdText`; on a thrown request leave it for the next run.

Export the two constants from the pure module so tests and the job share them.

## Sync

- `syncJobKinds.ts`: add `'add-by-rss-listed-feeds'` after `'add-by-rss-parse'`, label
  `'sync.job.rss_feeds'`.
- `syncJobPlan.ts`: `SyncTrigger` gains `'add-by-rss-listed-feeds'`. In `planSyncRun`, next to the
  `add-by-rss-pull-to-refresh` branch: signed out → `[]`; else
  `[{ kind: 'add-by-rss-listed-feeds', priority: 'background' }]`.
- `syncJobs.ts`: `createAddByRssListedFeedsJob(deps, priority)` with
  `buildJob('add-by-rss-listed-feeds', priority, 'add-by-rss-listed-feeds', run, 60000)`. `run`:
  account snapshot (null → return); `evaluateFeatureAccess('add_by_rss_refresh', deriveMembershipState(account))`
  (denied → return); `addByRssRepository.runListedFeedWork(deps.getAuthContext(), account.id_text, sleep)`.
  Add the case to `buildSyncJobs`. In `createAddByRssParseJob`, after `applyRefreshResult`, when
  `await addByRssRepository.hasListedFeedWork()`, `context.enqueue(createAddByRssListedFeedsJob(deps, priority))`
  (the queue drops a second copy while one waits).
- `requestAddByRssRefresh.ts`: add `registerAddByRssListedFeedsRequest` and
  `requestAddByRssListedFeedsSync`, the same shape as the refresh pair. Update the file's doc to
  cover both.
- `SyncProvider.tsx`: in the effect that registers the refresh callback, also register
  `() => requestSync('add-by-rss-listed-feeds')` and clear it on cleanup. Do not add the trigger to
  `NETWORK_INTENT_TRIGGERS` (nobody is watching this one).
- `errorLogPresentation.ts`: `isCreatorHostedEntry` also accepts `'add-by-rss-listed-feeds'`.

## Add flow (`useAddByRssAddFlow.ts`)

Pass `{ followed: true }` as the fourth argument to its `addByRssRepository.parseNow` call.

## Must stay true

- A feed that is not an artist and names no publisher behaves exactly as today, with no extra
  request.
- No album parse is started for a public album (the server already started it).
- A credential value never reaches a log, the error log, or a listing row.
- A failure anywhere in this work never fails the artist's add or refresh.

## Tests

- `domain.test.ts`: a parsed status with `publisherListedFeeds` surfaces it on the result; one
  without leaves it undefined; `attempts: 1` calls `fetchStatus` once and returns `pending`
  without sleeping.
- `addByRssListedFeeds.test.ts`: one `it` per `decideListedAlbumStore` branch, and
  `directoryLookupDue` (null state → true; same guids with stored matches → false; changed guids →
  true; stored guids with `directoryMatches: null` → true).
- `syncJobKinds.test.ts`: the new kind has the `sync.job.rss_feeds` label (extend the existing
  every-kind-has-a-label case if it enumerates).
- `syncQueue.test.ts`, in `describe('planSyncRun')`: `'add-by-rss-listed-feeds'` plans the one
  job signed in and nothing signed out.

## Release scratchpad

```markdown
## Mobile stores the albums an Add by RSS artist lists

- Surfaces: mobile
- Change: adding or refreshing an Add by RSS artist feed now stores every album it lists. Add by
  RSS albums are fetched in the background and kept on the device, linked to the artist, without
  being followed; directory albums are linked with their artwork. Albums on another domain never
  receive the artist's username and password; one that needs its own waits under the artist in
  Needs Username and Password. Each Add by RSS album's publisher pointer is also matched against
  the directory so its artist can be shown. Nothing is written to the public directory.
- Who notices: members who add Add by RSS artist feeds (the screens arrive in the following entries)
- Operator steps: none
```
