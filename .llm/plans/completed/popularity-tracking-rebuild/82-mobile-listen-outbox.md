**Cursor model:** Opus 5.5 · **Reasoning:** high

# 82 — Mobile playback sends counted listens through a durable outbox

Mobile stops posting channel, clip, and item stats on every play and resume, and stops riding
stats on playback outbox rows. `PlaybackProvider` feeds the shared listen session tracker
(plan 80) from the engine's progress, seek, pause, and end signals. Each report the tracker emits
is stored in a new account-keyed SQLite table and sent to `POST /stats/listen` (plan 32) when the
app is online. A report waits through offline time and replays later. A replayed listen counts
and fades from the time the server receives it.

Mobile records no profile or playlist opens (R44): this plan adds no open sending, and nothing on
mobile calls `reqStatsOpen`.

## Rows

R34, R44, R65, R71

## Runs after

32, 80

## Files

- `apps/mobile/src/data/db/migrations.ts`
- `apps/mobile/src/data/db/schema.ts`
- `apps/mobile/src/data/db/migrations.test.ts`
- `apps/mobile/src/data/repositories/statsListenOutbox.ts` (new)
- `apps/mobile/src/data/repositories/statsListenOutbox.test.ts` (new)
- `apps/mobile/src/data/repositories/statsRepository.ts`
- `apps/mobile/src/data/repositories/statsRepository.test.ts` (delete)
- `apps/mobile/src/data/repositories/playbackOutboxRepository.ts`
- `apps/mobile/src/data/repositories/index.ts`
- `apps/mobile/src/data/index.ts`
- `apps/mobile/src/data/README.md`
- `apps/mobile/src/lib/playback/buildPlaybackTarget.ts`
- `apps/mobile/src/playback/PlaybackProvider.tsx`
- `apps/mobile/src/playback/playbackEventSource.test.ts`
- `apps/mobile/src/sync/syncJobs.ts`
- `apps/mobile/src/sync/carBackgroundSync.ts`
- `apps/mobile/vitest.config.ts`

## Decisions this plan carries

- **A dedicated outbox, not the playback outbox.** Playback outbox rows collapse and are evicted
  at the 500-event cap, and a listen report must survive both. The new table holds one row per
  listen session (`client_listen_id`), and a later report of the same session merges into it.
- **Age rules.** A replayed listen counts and fades from the time the server receives it. The
  request body has no `listened_at`. The server looks up an earlier report of a session within
  7 days and treats an update older than that as a new listen. A row holding only an update (its
  first report already went through) is dropped 6 days after it counted, so it still arrives
  inside that lookup and is never counted twice. A row whose first report has not reached the
  server is dropped 30 days after it counted. That 30 days is the outbox's storage bound, not a
  server clamp. `counted_at` stays on the row for these age rules and is not sent. Main
  alternative: send late updates and rely on the daily first-of-day rule, which would still
  double the session's event row.
- **Response handling** follows plan 32. Any 2xx removes the row. 400, 403, 404, and 410 are final,
  so the row is dropped. 401, 429, 5xx, and no response leave the row and stop the pass; the next
  drain retries with the same id.
- **Consent.** A report is stored only for a signed-in account whose Popularity Tracking decision
  allows it, the same check playback uses today (`shouldSkipListenStatsForAccount`). At drain time
  an account whose decision is `listen_stats_accepted === false` has its pending rows deleted.
  While the current agreement version is unknown (empty), the drain sends nothing and keeps
  the rows. The server re-checks consent on every report.
- **Car listening while the JS runtime is not running is not counted.** The tracker sees only
  progress that reaches JS. A car-started source is adopted into a fresh session once JS runs
  (`adoptEngineSource`), so later listening counts but earlier listening does not. The main
  alternative, deriving listens from the native playback journal, is larger and is left out.
- **Sending is single-flight.** A report that arrives while a drain is running is sent by the next
  drain: the next report, the `playback-replay` sync job, or a car sync.

## SQLite — migration 24

`apps/mobile/src/data/db/migrations.ts`: append after version 23, in the same style:

```typescript
  {
    version: 24,
    statements: [
      // One row per listen session waiting to reach the server. A later report of the same
      // session merges into its row; the row goes once the server accepts the latest state.
      `CREATE TABLE IF NOT EXISTS stats_listen_outbox (
        client_listen_id TEXT PRIMARY KEY NOT NULL,
        account_id_text TEXT NOT NULL,
        target_kind TEXT NOT NULL,
        target_id_text TEXT NOT NULL,
        seconds_heard INTEGER NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0,
        first_report INTEGER NOT NULL DEFAULT 1,
        counted_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_stats_listen_outbox_account
        ON stats_listen_outbox (account_id_text, counted_at);`,
    ],
  },
```

`apps/mobile/src/data/db/schema.ts`: after `playbackLocalState` (search `playback_local_state`),
add:

```typescript
/** Listen reports waiting for `POST /stats/listen`, one row per listen session. */
export const statsListenOutbox = sqliteTable('stats_listen_outbox', {
  clientListenId: text('client_listen_id').primaryKey(),
  accountIdText: text('account_id_text').notNull(),
  targetKind: text('target_kind').notNull(),
  targetIdText: text('target_id_text').notNull(),
  secondsHeard: integer('seconds_heard').notNull(),
  completed: integer('completed').notNull().default(0),
  firstReport: integer('first_report').notNull().default(1),
  countedAt: integer('counted_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export type StatsListenOutboxRow = typeof statsListenOutbox.$inferSelect;
```

## Pure rules — `apps/mobile/src/data/repositories/statsListenOutbox.ts` (new)

No RN, Expo, or SQLite imports, so Vitest can load it. It imports
`type ListenSessionReport` from `@podverse/playback-core` and `type StatsListenRequestBody` from
`@podverse/helpers-requests` (plan 32's name).

```typescript
const DAY_MS = 86_400_000;

/** Rows kept per account; the oldest by `countedAtMs` go first. */
export const STATS_LISTEN_OUTBOX_MAX_ROWS_PER_ACCOUNT = 500;
/** Rows sent per drain pass. */
export const STATS_LISTEN_DRAIN_BATCH_LIMIT = 50;
/** Outbox storage bound: a session the server has never seen is dropped this long after it counted. */
export const STATS_LISTEN_FIRST_REPORT_MAX_AGE_MS = 30 * DAY_MS;
/** An update-only row is dropped this long after it counted, inside the server's 7-day session lookup. */
export const STATS_LISTEN_UPDATE_MAX_AGE_MS = 6 * DAY_MS;

export type StatsListenOutboxRecord = {
  clientListenId: string;
  accountIdText: string;
  targetKind: 'item' | 'clip';
  targetIdText: string;
  secondsHeard: number;
  completed: boolean;
  firstReport: boolean;
  countedAtMs: number;
  updatedAtMs: number;
};

export function statsListenOutboxRecordFromReport(input: {
  report: ListenSessionReport;
  accountIdText: string;
  nowMs: number;
}): StatsListenOutboxRecord;

/** Same session: larger seconds heard, completion sticks, earliest counted time, latest update. */
export function mergeStatsListenOutboxRecord(
  existing: StatsListenOutboxRecord | null,
  incoming: StatsListenOutboxRecord
): StatsListenOutboxRecord;

export function isStatsListenOutboxRecordExpired(
  record: StatsListenOutboxRecord,
  nowMs: number
): boolean;

/** 401, 429, 5xx, and no response retry; any other failure status drops the row. */
export function classifyStatsListenSendFailure(status: number | null): 'drop' | 'retry';

/** Request body for one listen report. The server stamps receive time; no listen-time field. */
export function toStatsListenRequestBody(
  record: StatsListenOutboxRecord
): StatsListenRequestBody;

/** Ids to evict so at most `max` records remain, oldest `countedAtMs` first. */
export function selectStatsListenOutboxEvictions(
  records: readonly Pick<StatsListenOutboxRecord, 'clientListenId' | 'countedAtMs'>[],
  max: number
): string[];
```

Implement each as its comment says. `mergeStatsListenOutboxRecord` with `existing === null`
returns `incoming`; otherwise it keeps `existing`'s id, account, and target, takes
`Math.max` of `secondsHeard`, ORs `completed` and `firstReport`, takes the smaller `countedAtMs`,
and uses `incoming.updatedAtMs`. `isStatsListenOutboxRecordExpired` compares
`nowMs - countedAtMs` with the first-report limit when `firstReport` is true, else with the update
limit. `toStatsListenRequestBody` sets `clip_id_text` or `item_id_text` by `targetKind`,
`client_listen_id`, `seconds_heard` (whole, clamped to 0–86,400), and `completed`. It sets no
`listened_at`.

## `apps/mobile/src/data/repositories/statsRepository.ts` — rewrite

Replace the file. Remove `PlaybackStatsTargets`, `trackPlaybackStats`, and `replayPlaybackStats`.
The new repository:

```typescript
export const statsRepository = {
  /** Store one listen report for the account, then send pending reports unless offline. */
  recordListen: async (
    context: MobileAuthRequestContext,
    accountIdText: string,
    report: ListenSessionReport
  ): Promise<void> => { … },

  /** Send the account's pending listen reports. Never rejects. */
  drainListens: async (
    context: MobileAuthRequestContext,
    accountIdText: string
  ): Promise<void> => { … },
};
```

- **`recordListen`**: `await initializeDatabase()`; read the row for `report.clientListenId`; merge
  with `mergeStatsListenOutboxRecord`; insert or update it; then evict past
  `STATS_LISTEN_OUTBOX_MAX_ROWS_PER_ACCOUNT` for the account (select
  `clientListenId, countedAt`, run `selectStatsListenOutboxEvictions`, delete those ids). Wrap the
  whole body in `try`/`catch` that swallows the error; a stats write never fails playback. Then, when
  `!isEffectivelyOffline()`, `void statsRepository.drainListens(context, accountIdText)`.
- **`drainListens`**: single-flight through a module-level `let drainInFlight: Promise<void> | null`;
  while one runs, return it. The pass:
  1. Return when `isEffectivelyOffline()`.
  2. `const account = await accountRepository.getSnapshot()`; return when it is `null` or its
     `id_text` is not `accountIdText`.
  3. When `account.account_settings?.listen_stats_accepted === false`, delete every row for the
     account and return.
  4. When `getPopularityTrackingCurrentVersion()` is `''` or
     `!isPopularityTrackingAllowed(account.account_settings, getPopularityTrackingCurrentVersion())`,
     return and keep the rows.
  5. Delete the account's expired rows (`isStatsListenOutboxRecordExpired` with `Date.now()`).
  6. Read up to `STATS_LISTEN_DRAIN_BATCH_LIMIT` rows ordered by `counted_at` ascending.
     `counted_at` orders the pass and feeds the age rules; it is not sent.
  7. For each row, stop when `isEffectivelyOffline()`. Send it with
     `requestWithMobileAuthRefresh(context, (api) => api.reqStatsListen(toStatsListenRequestBody(record)))`.
     On success, delete it with `WHERE client_listen_id = ? AND updated_at = ?` (the `updatedAt`
     that was sent); when no row was deleted because a newer report merged in meanwhile, set its
     `first_report` to 0. On failure, `classifyStatsListenSendFailure(getApiErrorStatus(error))`:
     `'drop'` deletes the row and continues, `'retry'` ends the pass.
  The whole pass sits in `try`/`catch` that swallows errors, and `finally` clears `drainInFlight`.

Imports: `getDb`, `initializeDatabase`, `schema` from `../db`; `isEffectivelyOffline` from
`../../net/connectivity`; `getApiErrorStatus` from
`../../lib/apiErrorStatus`; `requestWithMobileAuthRefresh` from
`../../auth/authRequestWithRefresh`; `accountRepository` from `./accountRepository`;
`getPopularityTrackingCurrentVersion` from `../../popularityTracking/popularityTrackingGate`;
`isPopularityTrackingAllowed` from `@podverse/helpers` (the gate module already imports it from
there); drizzle `and`, `asc`, `eq`, `inArray` as needed. Map rows to records and back in this file
(`completed` and `firstReport` are 0/1 integers in SQLite).

Keep the file's top doc comment short: what the outbox holds, that reports are sent once the
counted-listen rule is met, and that failures never block playback.

## `playbackOutboxRepository.ts` — stop carrying stats

- Remove the `PlaybackStatsTargets` and `statsRepository` imports (lines 39–40),
  `parseStatsReplayPayload` (about line 200), `replayBufferedStats` (about line 552), and the
  `await replayBufferedStats(context, rows);` call in `replayOneQueueBatch` (about line 641).
- Remove helpers that are left with no caller (for example `normalizeNonEmptyString`, if
  `parseStatsReplayPayload` was its only user). Leave `parsePayloadObject` and `isRecord` if other
  code still calls them.

## Exports

- `apps/mobile/src/data/repositories/index.ts` line 81: remove the `PlaybackStatsTargets` type
  export; keep `statsRepository`.
- `apps/mobile/src/data/index.ts` line 69: remove `PlaybackStatsTargets` from the type list.
- `apps/mobile/src/lib/playback/buildPlaybackTarget.ts`: remove `playbackTargetToStatsTargets`
  (line 157) and `PlaybackStatsTargets` from its `../../data` type import (line 12).

## `PlaybackProvider.tsx`

Remove: the `PlaybackStatsTargets` type import (line 73), the `playbackTargetToStatsTargets`
import (line 110), `hasPlaybackStatsTargets` (line 538), and the callbacks
`resolvePlaybackStatsTargets`, `toStatsReplayPayload`, and `trackPlaybackStatsBestEffort`
(lines 912–948), with their entries in dependency arrays. Keep the
`shouldSkipListenStatsForAccount` import; the report handler uses it.

Add (import `createListenSessionTracker`, `listenSessionTargetFromPlaybackTarget`, and
`type ListenSessionReport`, `type ListenSessionTracker` from `@podverse/playback-core`, and
`createUuid` from `../lib/createUuid`):

- After `buildContext` (line 722), a ref kept current the same way `statusRef` and `accountRef`
  are:

  ```typescript
  const buildContextRef = useRef(buildContext);
  useEffect(() => {
    buildContextRef.current = buildContext;
  }, [buildContext]);
  ```

- A lazily created tracker:

  ```typescript
  const listenSessionRef = useRef<ListenSessionTracker | null>(null);
  const getListenSession = useCallback((): ListenSessionTracker => {
    if (listenSessionRef.current === null) {
      listenSessionRef.current = createListenSessionTracker({
        now: () => Date.now(),
        createClientListenId: createUuid,
        onReport: (report: ListenSessionReport) => {
          if (statusRef.current !== 'authenticated') {
            return;
          }
          const account = accountRef.current;
          if (account === null || shouldSkipListenStatsForAccount(account)) {
            return;
          }
          void statsRepository.recordListen(buildContextRef.current(), account.id_text, report);
        },
      });
    }
    return listenSessionRef.current;
  }, []);
  ```

  `getListenSession` reads only refs, so its identity is stable. Add it to the dependency arrays of
  the callbacks below that call it.

Wire it in (search by name; line numbers are from the current file):

- **`playTarget`** (line 1189): in the `catch` after `applyLoad` (line 1236), call
  `getListenSession().end();` before `return;`. After the successful load, beside
  `pauseAtRef.current = decision.pauseAtSeconds ?? null;`, call:

  ```typescript
  getListenSession().load({
    directive: decision.listenSession,
    target: listenSessionTargetFromPlaybackTarget(target),
    mediaDurationSeconds:
      params.mediaFileDurationHintSeconds !== undefined && params.mediaFileDurationHintSeconds > 0
        ? params.mediaFileDurationHintSeconds
        : null,
  });
  ```

  In the `if (shouldAutoPlay && params.shouldSkipPlayEventWrite !== true)` block (line 1278),
  delete `statsTargets`, the `payload: toStatsReplayPayload(statsTargets)` line, and the
  `if (outboxWritten) { trackPlaybackStatsBestEffort(statsTargets); }` block; keep the
  `writePlaybackEvent` call (`await` it as before, or `void` it when its result is no longer read).
- **`adoptEngineSource`** (line 2477): after `activeTargetRef.current = target;` (line 2529), call
  `getListenSession().load({ directive: 'start', target: listenSessionTargetFromPlaybackTarget(target), mediaDurationSeconds: durationSeconds > 0 ? durationSeconds : null });`.
  `enrichAdoptedSource` replaces the target with the same item, so it does not touch the session.
- **`clearNowPlaying`** (line 1162): call `getListenSession().end();` before
  `activeTargetRef.current = null;`.
- **`progress` handler** (line 2905): after the `identityMatches` early return (line 2936) and
  before the `pauseAt` check, call:

  ```typescript
  if (event.durationSeconds > 0) {
    getListenSession().setMediaDuration(event.durationSeconds);
  }
  getListenSession().recordPosition({
    positionSeconds: event.positionSeconds,
    isPlaying: isPlayingRef.current,
    playbackRate: playbackRateRef.current,
  });
  ```

  Samples held back by the download hand-off or a pending seek return earlier and never reach the
  tracker; the tracker completes a clip session itself when a sample reaches the clip's end.
- **`ended` handler** (line 2822): after the engine/active id mismatch `return`, call
  `getListenSession().recordCompleted();` before `void advance('complete');`.
- **`playbackState` handler** (line 2854): when `event.state === 'paused'`, call
  `getListenSession().recordPause();` (after the download-swap early return).
- **`pause`** (line 3033): call `getListenSession().recordPause();` after
  `nativePlaybackBridge.pause();`.
- **`resume`** (line 3089): delete `statsTargets`, the `payload` line, and the
  `trackPlaybackStatsBestEffort` block; keep the `writePlaybackEvent` call; update the dependency
  array. Resume sends no stats; the session already counts heard seconds.
- **`seekTo`** (line 3115): call `getListenSession().recordSeek();` after
  `nativePlaybackBridge.seek(seconds);`.
- **Sign-out**: in the auth status effect's `if (status === 'anonymous') {` block (line 2741), call
  `getListenSession().reset();` so a signed-out device sends nothing for the earlier account's
  session.
## Sync

- `apps/mobile/src/sync/syncJobs.ts`, `createPlaybackReplayJob` (line 460): after
  `drainAndReconcile` returns, `await statsRepository.drainListens(deps.getAuthContext(), account.id_text);`.
  Import `statsRepository` from `../data/repositories/statsRepository` beside the other repository
  imports. No new job kind; the listen drain rides the `playback-replay` job.
- `apps/mobile/src/sync/carBackgroundSync.ts`, `refreshForCar` steps (line 81): add
  `['listens', () => statsRepository.drainListens(context, accountIdText)],` after the `'outbox'`
  step.

## Docs and test config

- `apps/mobile/src/data/README.md`, after the `playbackOutboxRepository` sentence (line 92):
  describe `statsRepository` — listen reports waiting for `POST /stats/listen` in
  `stats_listen_outbox`, one row per listen session, with the merge, age, and response rules in the
  pure sibling `statsListenOutbox.ts`. The request body has no listen time; `counted_at` stays on
  the row for the age rules.
- `apps/mobile/vitest.config.ts`: replace `'src/data/repositories/statsRepository.test.ts'` with
  `'src/data/repositories/statsListenOutbox.test.ts'` in `include`, and rewrite the header comment's
  sentence about "the best-effort replay of buffered listen stats" to describe the listen outbox
  rules (`src/data/repositories/statsListenOutbox.ts` — pure; the SQLite half stays in
  `statsRepository.ts`).

## Tests

- `apps/mobile/src/data/repositories/statsListenOutbox.test.ts` (new):
  - `statsListenOutboxRecordFromReport` copies the target, id, seconds, completion, counted time,
    and first-report flag, and stamps `updatedAtMs` with `nowMs`.
  - `mergeStatsListenOutboxRecord`: `null` gives the incoming record; a smaller incoming
    `secondsHeard` keeps the larger; completion stays true once true; `firstReport` stays true while
    either side is true; the earlier `countedAtMs` wins.
  - `isStatsListenOutboxRecordExpired`: a first-report row is kept at 29 days and dropped past 30
    (the outbox storage bound, not a server clamp); an update-only row is kept at 5 days and
    dropped past 6, inside the server's 7-day session lookup.
  - `classifyStatsListenSendFailure`: 400, 403, 404, and 410 drop; 401, 429, 500, 503, and `null`
    retry.
  - `toStatsListenRequestBody`: an item record sets `item_id_text` and no `clip_id_text`, a clip
    record the reverse; the body has no `listened_at` and the function takes the record only;
    `seconds_heard` is whole and at most 86,400.
  - `selectStatsListenOutboxEvictions` returns the oldest ids beyond the cap and nothing at or under
    it.
- `apps/mobile/src/data/db/migrations.test.ts`: add a `describe('migration 24 stats listen outbox')`
  in the style of the migration 23 block — on a database at version 23 it creates
  `stats_listen_outbox` and its index and records `PRAGMA user_version = 24;`.
- Delete `apps/mobile/src/data/repositories/statsRepository.test.ts`; the repository now needs
  SQLite, and its rules are covered by `statsListenOutbox.test.ts`.
- `apps/mobile/src/playback/playbackEventSource.test.ts` lines 100–116: rename the test to
  "carries the canonical resource data next to other payload keys" and use a neutral key
  (`{ note: 'kept' }`) in place of `stats_targets`.

No Maestro flow: nothing on screen changes (**mobile-test-economics**).

## Release scratchpad

```markdown
## Mobile reports counted listens through a durable outbox

- Surfaces: mobile
- Change: mobile playback no longer posts channel, clip, and item stats on every play and resume,
  and stats no longer ride playback outbox rows. The app measures media seconds actually heard
  (seeks and skipped time do not count) and records a listen once it meets the counted-listen rule
  (60 seconds or 25% of the item, whichever comes first), with updates on completion and for each
  further minute heard. Reports are kept in a new SQLite table (migration 24,
  `stats_listen_outbox`) and sent to `POST /stats/listen` when online, including after offline
  listening. A replayed listen counts and fades from the time the server receives it. Soundbites
  and chapters count toward their item;
  Add by RSS and live items are not reported; mobile records no profile or playlist opens. Only a
  signed-in account whose Popularity Tracking decision allows it stores or sends anything, and a
  declined decision deletes reports still waiting on the device. Listening the car plays while the
  app's JavaScript is not running is not counted.
- Who notices: listeners who allow Popularity Tracking (nothing visible); operators reading
  popularity data
- Operator steps: ship with an API that serves `/stats/listen`; the migration runs on app start
```
