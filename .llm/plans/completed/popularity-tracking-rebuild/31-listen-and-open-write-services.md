**Cursor model:** Opus 5.5 · **Reasoning:** extra high

# 31 — Listen and open write services (listener identity zone)

Two ORM services record counted listens and profile/playlist opens into the tables plan 10
creates: the listen event, the anonymous daily totals, and the per-show taste profile with its two
decaying scores. They run inside the listener identity zone, take an `account_id`, and never return
a listener id. Plan 32 wires them to the API.

Read first: the migration plan 10 wrote
(`infra/k8s/base/ops/source/database/linear-migrations/app/*_popularity_tracking_foundation.sql`),
`docs/features/POPULARITY-TRACKING.md` § "Daily totals are filled at write time" and the listener-id
section, the entities plan 11 added under `packages/orm/src/entities/stats/`, and
`packages/orm/src/services/stats/listenerIdentity/statsListener.ts`. Where this plan and the SQL
disagree on a column, the SQL wins; say so in your final message.

## Rows

R5, R13, R25, R33, R39, R42, R43, R46, R57, R62, R65, R69, R70

## Runs after

10, 11, 30

## Files

- `packages/orm/src/services/stats/listenerIdentity/statsWriteGuard.ts` (new)
- `packages/orm/src/services/stats/listenerIdentity/statsListenWrite.ts` (new)
- `packages/orm/src/services/stats/listenerIdentity/statsOpenWrite.ts` (new)
- `packages/orm/src/index.ts`
- `docs/features/POPULARITY-TRACKING.md`
- `apps/api/src/test/stats-listen-write.integration.test.ts` (new)

## What must stay true

- **Zone.** All three files live in `packages/orm/src/services/stats/listenerIdentity/`. The two
  services exported from `@podverse/orm` take an `account_id` and return only a result union from
  plan 30 (`PopularityListenResult`, `PopularityOpenResult`). No listener id leaves the zone, in a
  return value, an error message, or a log line. `statsWriteGuard.ts` is not exported.
- **One transaction per report**, on `AppDataSourceReadWrite` (the read role cannot see
  `stats_listener`). Everything below happens inside it.
- **Consent is re-checked inside the transaction.** The first statement reads the account's
  decision with
  `SELECT listen_stats_accepted, listen_stats_agreement_version FROM account_settings WHERE account_id = $1 FOR SHARE`
  and evaluates it with `isPopularityTrackingAllowed` against the `agreement_version` the caller
  passes. A missing row or a decision that does not allow tracking returns `not_allowed` and
  writes nothing. The row lock is what keeps a listen that started before an opt-out from
  recreating a listener id after the opt-out deleted it; area G's opt-out must update
  `account_settings` and delete the `stats_listener` row in one transaction (stated in the doc).
- **A listener id is created only for a write that stores something.** Use
  `StatsListenerService.findListenerId` first. Call `getOrCreateListenerId` (with the transaction's
  manager) only once the report is known to store an event: a counted new listen, or an open that
  is not the viewer's own content. A below-threshold first report for an account with no listener
  id leaves no `stats_listener` row.
- **Per-listener lock.** After the listener id is known, take
  `SELECT pg_advisory_xact_lock(hashtextextended('popularity_listen:' || $1::text, 0))` with the
  listener id, exactly as the doc fixes. Every later read of that listener's events, and every
  daily-total and taste write, happens after it.
- **Server receive time is the only clock.** Read `now()` once (`SELECT now() AS now`) and use it
  as the event's `created_at`. The UTC calendar day of that value is the daily-total day, and the
  same value is the time taste scores fade to and from. Reports carry no device time. Day bounds
  are UTC midnight to the next UTC midnight.
- **Totals only go up**, and listens to a hidden show still count toward them (R62). Hiding affects
  only taste rows (R57).
- **Opens never touch taste rows** (R43).

## `statsWriteGuard.ts` — shared steps

Internal to the zone. Small functions both services call, each taking the transaction's
`EntityManager`:

- `isTrackingAllowedForUpdate(manager, accountId, agreementVersion): Promise<boolean>` — the
  `FOR SHARE` read and `isPopularityTrackingAllowed` check above.
- `lockListener(manager, listenerId): Promise<void>` — the advisory lock.
- `readTransactionNow(manager): Promise<Date>` — `SELECT now() AS now`, narrowed with a type guard
  (no `as` on query results; narrow `unknown` rows the way the rest of the ORM does).
- `utcDayBounds(now: Date): { day: string; start: Date; end: Date }` — `day` is `YYYY-MM-DD`.

## `StatsListenWriteService` — `statsListenWrite.ts`

```typescript
export type StatsListenTarget = { kind: 'item'; id_text: string } | { kind: 'clip'; id_text: string };

export type StatsListenReport = {
  account_id: number;
  agreement_version: string;
  daily_cap: number;
  target: StatsListenTarget;
  client_listen_id: string;
  seconds_heard: number;
  completed: boolean;
};

export class StatsListenWriteService {
  async recordListen(report: StatsListenReport): Promise<PopularityListenResult>;
}
```

### Order of work

1. Consent check → `not_allowed`.
1. Resolve the target with raw queries on the transaction manager:
   - Item: `SELECT i.id, i.channel_id, c.medium_id, ia.duration FROM item i JOIN channel c ON c.id = i.channel_id LEFT JOIN item_about ia ON ia.item_id = i.id WHERE i.id_text = $1`.
     No row → `not_found`. `item_about.duration` is `decimal` (string); parse it to a number,
     `null` when absent or not finite.
   - Clip: `SELECT id, item_id, source_removed_at, start_time, end_time FROM clip WHERE id_text = $1`.
     No row → `not_found`; `source_removed_at` set or `item_id` null → `clip_source_removed`
     (same rule as `isClipSourceRemoved`; reuse it when its `Pick` type fits the row). Then load
     the clip's item with the item query by `i.id`. The listened duration is
     `end_time - start_time` when `end_time` is set; otherwise `item duration - start_time` when
     the item duration is known and larger than `start_time`; otherwise `null`.
1. `listenerId = findListenerId(account_id)`. When `null` and the report does not meet
   `isCountedListen({ secondsHeard, durationSeconds })` → `below_threshold`. When `null` and it
   does, `listenerId = getOrCreateListenerId(account_id, manager)`.
1. Lock the listener; read `now`.
1. **Existing report.** Look up the same session:
   `SELECT created_at, id, seconds_heard, completed, item_id, channel_id, clip_id FROM stats_listen_event WHERE listener_id = $1 AND client_listen_id = $2 AND created_at >= $3 LIMIT 1`
   with `$3 = now - 7 days` (`LISTEN_REPORT_LOOKBACK_DAYS = 7`, a module constant), measured on
   the stored `created_at`, so the scan stays on the listener's recent rows
   (`stats_listen_event_listener_created_idx`). When found, go to **Update path**. A report whose
   session was first stored more than seven days ago is a new listen.
1. Below threshold → `below_threshold`.
1. **Cap and first-of-day in one query** over the listener's events in today's UTC bounds:
   `COUNT(*)`, and `bool_or(...)` for: same item, same channel, same clip (when a clip), and the
   completed variants of those three. `COUNT(*) >= daily_cap` → `daily_cap_reached` (writes
   nothing; the listener id may already exist, which is fine).
1. Insert the event with explicit `created_at = now`, `seconds_heard` clamped to
   `ceil(duration)` when the duration is known, `client_listen_id`, `completed`, `item_id`,
   `channel_id`, `clip_id`.
1. Daily totals, per the doc's upsert shape: for each of item, channel, and (clip listens) clip,
   add `listener_count + 1` when this is the listener's first listen of that entity today, and
   `completion_count + 1` when the report is completed and the listener had no completed listen of
   that entity today. Skip the upsert when both increments are 0.
1. Taste rows (below). Return `counted`.

### Update path

- New `seconds_heard` = the larger of stored and reported (after the duration clamp); new
  `completed` = stored OR reported. Never lower either.
- Nothing changed → `unchanged`.
- `UPDATE stats_listen_event SET seconds_heard = …, completed = … WHERE created_at = $1 AND id = $2`
  (the primary key, so only one partition is touched).
- When `completed` turned from false to true: on the **event's own** UTC day (from its
  `created_at`), add `completion_count + 1` to each of its entities' daily rows unless another of
  the listener's events that day already completed that entity. Then add the completion to taste
  rows (below). Return `updated`.
- The update path never applies the threshold or the daily cap; the session was already counted.

### Taste rows (R13, R25, R39, R41, R57)

- **Shows touched:** the item's channel. When that channel's `medium_id` is `MediumEnum.Music` or
  `MediumEnum.MusicL`, also the artist channel found by
  `SELECT c.id FROM channel_publisher cp JOIN channel_publisher_remote_item r ON r.channel_publisher_id = cp.id JOIN channel c ON c.podcast_guid = r.feed_guid WHERE cp.channel_id = $1 AND c.medium_id = $2 AND c.id <> $1`
  with `$2 = MediumEnum.PublisherMusic`. Episodes and tracks never get rows.
- **Hidden shows:** drop every channel that has a `stats_taste_profile_hidden` row for this
  listener (`channel_id = ANY($2::int[])`). The daily totals above are already written regardless.
- **Times:** `first_listened_at`, `last_listened_at`, and `scores_updated_at` keep their column
  names and hold server receive times, like every other time this service writes.
- **New listen:** one upsert per remaining channel with weight
  `POPULARITY_TASTE_LISTEN_WEIGHT + (completed ? POPULARITY_TASTE_COMPLETION_WEIGHT : 0)` at event
  time `t = now` (the event's `created_at`):
  - Insert values: `listen_count 1`, `completion_count` 1 or 0, `first_listened_at = last_listened_at = scores_updated_at = t`, both scores = weight.
  - On conflict: `listen_count + 1`, `completion_count + EXCLUDED.completion_count`,
    `first_listened_at = LEAST(...)`, `last_listened_at = GREATEST(...)`, and for each score with
    its half-life `h` (pass `POPULARITY_TASTE_HALF_LIFE_DAYS.recent` / `.longTerm` as parameters):
    - when `t >= scores_updated_at`: `score × 0.5^(days(t − scores_updated_at) / h) + weight`
    - otherwise (`t` is earlier than the stored time: a completion for an event stored before a
      later listen, or a transaction whose `now()` is a moment before the one that wrote the row):
      `score + weight × 0.5^(days(scores_updated_at − t) / h)`
    - `scores_updated_at = GREATEST(scores_updated_at, t)`
    - `days(x)` is `extract(epoch FROM x) / 86400.0`; use `power(0.5, …)`.
- **Completion on the update path:** `UPDATE` only (no insert) the existing rows of the remaining
  channels: `completion_count + 1` and each score gains `POPULARITY_TASTE_COMPLETION_WEIGHT` with
  the same two-branch formula at `t` = the event's stored `created_at`. `last_listened_at` and
  `first_listened_at` do not change on this path. A missing row (the show was hidden, or added
  back fresh, since the listen) is left alone.
- **Pause and resume (R39):** nothing extra. While tracking is stopped without the listener
  choosing it, no report reaches this service (the API gates answer 403, and the consent check here
  returns `not_allowed`), so rows stay as they are. The next counted listen fades each stored score
  across the whole gap before adding, which is the resume.

## `StatsOpenWriteService` — `statsOpenWrite.ts`

```typescript
export type StatsOpenTarget = { kind: 'account'; id_text: string } | { kind: 'playlist'; id_text: string };

export type StatsOpenReport = {
  account_id: number;
  agreement_version: string;
  target: StatsOpenTarget;
};

export class StatsOpenWriteService {
  async recordOpen(report: StatsOpenReport): Promise<PopularityOpenResult>;
}
```

1. Consent check → `not_allowed`.
1. Resolve: `SELECT id FROM account WHERE id_text = $1`, or
   `SELECT id, account_id FROM playlist WHERE id_text = $1`. No row → `not_found`. The opened
   account is the viewer, or the playlist's `account_id` is the viewer → `own_content` (checked
   before any listener id exists).
1. `getOrCreateListenerId`, lock, read `now`.
1. When the listener already has a `stats_open_event` today for that `account_id` / `playlist_id`
   → `unchanged`. Repeat opens store no row.
1. Insert the open event (`created_at = now`), upsert `stats_daily_account` or
   `stats_daily_playlist` with `listener_count + 1`. Return `counted`.

Opens have no daily cap; the API rate limit covers them.

## Exports — `packages/orm/src/index.ts`

After the stats entity exports plan 11 added, add:

```typescript
export * from './services/stats/listenerIdentity/statsListenWrite.js';
export * from './services/stats/listenerIdentity/statsOpenWrite.js';
```

Do not export `statsWriteGuard.js` or `statsListener.js` (plan 12's source-guard test checks the
latter).

## Doc — `docs/features/POPULARITY-TRACKING.md`

Fill the write-path section plan 10 added (its heading names the write path and the counted-listen
rule). Present tense, no plan numbers, short. Cover:

- The counted-listen rule (60 seconds or 25%, whichever first; media seconds heard), and that it
  lives in `@podverse/helpers` `popularityListen` for every surface.
- One report per listening session, keyed by the device's `client_listen_id`: the first report
  that meets the rule stores the event; later reports for the same session raise seconds heard and
  mark it finished, and never count it twice. A session first stored more than seven days ago
  (by receive time) is a new listen.
- Server receive time is the only clock. Reports carry no device time; the event's `created_at`
  decides the daily-total day, is the time taste scores fade from, and fills the taste rows'
  `first_listened_at` and `last_listened_at`. A report sent after offline time counts and decays
  from when it arrives.
- The daily cap (a server setting, `STATS_LISTEN_DAILY_CAP`) counts stored listens per listener
  per UTC day; reports for an already-stored session are not capped.
- Taste rows: which shows (channel, plus the artist for music via the publisher remote item),
  weights (1 per counted listen, 1 more when it finishes), half-lives (14 and 180 days), the
  two-branch decay for a completion of an event stored before the row's last update, hidden shows
  skipped, and pause and resume.
- Opens: once per opener per day, own profile and own playlist ignored, never in taste rows.
- Consent is re-checked under a row lock on `account_settings`; opting out updates that row and
  deletes the `stats_listener` row in the same transaction.

## Tests — `apps/api/src/test/stats-listen-write.integration.test.ts`

DB-backed, following `stats-guid-rotation.integration.test.ts` (real `startTestApp`, only
`CategoryService` mocked) and `add-by-rss-feed-identity.integration.test.ts` for seeding. Call the
two services directly; plan 32's route test covers HTTP. Seed in `beforeAll` with a run-unique
suffix: two accounts (consent accepted with a test version through
`AccountSettingsListenStatsService.update`), a podcast channel with an item whose `item_about`
duration is 200, a clip on that item, a music album channel with a track item and a
`channel_publisher` + `channel_publisher_remote_item` whose `feed_guid` equals an artist channel's
`podcast_guid` (artist `medium_id` `PublisherMusic`), and a playlist owned by the second account.
Delete what you created in `afterAll` (accounts first, so cascades remove listener rows). Read
rows with raw SQL through `ormContext.dataSourceReadWrite.manager`.

Cases:

1. A counted item listen returns `counted` and stores one event, one `stats_listener` row for the
   account, item and channel daily rows with `listener_count` 1, and one taste row with
   `listen_count` 1 and both scores 1.
1. A second session on the same item the same day returns `counted`: two events, daily
   `listener_count` still 1, taste `listen_count` 2, still exactly one `stats_listener` row.
1. Repeating a session unchanged returns `unchanged`; repeating it with `completed: true` returns
   `updated`, marks the event completed, sets item and channel daily `completion_count` to 1, and
   adds 1 to taste `completion_count` and to each score.
1. 49 seconds on the 200-second item returns `below_threshold` and stores nothing; for an account
   with no listener id yet it also creates no `stats_listener` row.
1. With consent turned off, `recordListen` and `recordOpen` return `not_allowed` and write nothing.
1. With `daily_cap: 2` after two stored listens, a new session returns `daily_cap_reached`, while a
   completion report for an existing session still returns `updated`.
1. With the podcast channel in the listener's Hidden From Taste Profile rows, a counted listen to a
   different item on that channel returns `counted`, raises that item's daily row, and creates or
   changes no taste row for the channel.
1. A track listen writes taste rows for both the album and the artist channel, and daily rows only
   for the track and the album.
1. A clip listen stores `clip_id` with the clip's item and channel and raises the clip's daily row;
   a clip with `source_removed_at` set returns `clip_source_removed`.
1. Decay: set a taste row's scores to 1 and `scores_updated_at` back 14 days, then record a
   counted listen; `recent_score` is close to 1.5 and `long_term_score` close to
   `fadeTasteScore({ score: 1, …, halfLifeDays: 180 }) + 1`.
1. Completion of an older event: store a counted, not-completed listen in a fresh session, then
   move that event back 3 days
   (`UPDATE stats_listen_event SET created_at = created_at - interval '3 days' WHERE id = $1`;
   Postgres moves it to the right partition), insert item and channel daily rows for that earlier
   UTC day with `listener_count` 1 and `completion_count` 0, and set the taste row's scores to 1
   with `scores_updated_at = now()`. A `completed: true` report for that session (still inside the
   7-day lookup) returns `updated`, raises `completion_count` to 1 on the earlier day's rows,
   leaves today's daily rows unchanged, and leaves each score close to `1 + 0.5^(3 / h)` for its
   half-life.
   `last_listened_at` is unchanged.
1. Opens: the second account's profile returns `counted` once and `unchanged` on repeat, with
   `stats_daily_account.listener_count` 1; the viewer's own profile returns `own_content`; a
   playlist open raises `stats_daily_playlist`; no open creates a taste row.
1. Concurrency: five `recordListen` calls in parallel for a fresh consented account, same item,
   distinct `client_listen_id`s, give exactly one `stats_listener` row, five events, and daily
   `listener_count` 1.

## Release scratchpad

none (plan 32's entry covers the write path once the API uses it)
