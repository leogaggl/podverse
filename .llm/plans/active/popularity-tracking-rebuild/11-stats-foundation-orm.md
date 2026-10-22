**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 11 — Popularity tracking foundation: ORM entities, listener mapping service, range constants

TypeORM entities for every table plan 10 creates, the zone-internal `StatsListenerService` that
maps an account to its listener id, and the shared range constants in `@podverse/helpers`. The
old `stats_*` entities and services are untouched here; plan 19 removes them.

Read the migration plan 10 wrote (`infra/k8s/base/ops/source/database/linear-migrations/app/*_popularity_tracking_foundation.sql`)
and `docs/features/POPULARITY-TRACKING.md` first. Entity columns must match the SQL exactly; where
this plan and the SQL disagree, the SQL wins and you note it in your final message.

## Rows

R20, R21, R24, R26, R28, R29, R41, R51, R70

## Runs after

10

## Files

- `packages/orm/src/entities/stats/statsListener.ts` (new)
- `packages/orm/src/entities/stats/statsListenEvent.ts` (new)
- `packages/orm/src/entities/stats/statsOpenEvent.ts` (new)
- `packages/orm/src/entities/stats/statsTasteProfile.ts` (new)
- `packages/orm/src/entities/stats/statsTasteProfileHidden.ts` (new)
- `packages/orm/src/entities/stats/statsDailyChannel.ts` (new)
- `packages/orm/src/entities/stats/statsDailyItem.ts` (new)
- `packages/orm/src/entities/stats/statsDailyClip.ts` (new)
- `packages/orm/src/entities/stats/statsDailyPlaylist.ts` (new)
- `packages/orm/src/entities/stats/statsDailyAccount.ts` (new)
- `packages/orm/src/entities/stats/statsPopularityChannel.ts` (new)
- `packages/orm/src/entities/stats/statsPopularityItem.ts` (new)
- `packages/orm/src/entities/stats/statsPopularityClip.ts` (new)
- `packages/orm/src/entities/stats/statsPopularityPlaylist.ts` (new)
- `packages/orm/src/entities/stats/statsPopularityAccount.ts` (new)
- `packages/orm/src/services/stats/listenerIdentity/statsListener.ts` (new)
- `packages/orm/src/db/entities.ts`
- `packages/orm/src/index.ts`
- `packages/helpers/src/lib/statsPopularityRange.ts` (new)
- `packages/helpers/src/lib/statsPopularityRange.test.ts` (new)
- `packages/helpers/src/index.ts`

## Entity conventions

Copy the style of `packages/orm/src/entities/account/accountFollowingChannel.ts` (composite
`@PrimaryColumn` keys, `ManyToOne` with `onDelete: 'CASCADE'` and a `JoinColumn`) and
`packages/orm/src/entities/account/accountContentLog.ts` (`timestamptz`, bigint id typed as
`string`, a short doc comment on the class).

- Relation imports, all `import type`: `Account` from `@orm/entities/account/account.js`,
  `Channel` from `@orm/entities/channel/channel.js`, `Item` from `@orm/entities/item/item.js`,
  `Clip` from `@orm/entities/clip.js`, `Playlist` from `@orm/entities/playlist/playlist.js`.
- Add no inverse relations on `Account`, `Channel`, `Item`, `Clip`, or `Playlist`. Event and
  taste entities have **no** relation to `StatsListener`; they carry `listener_id` as a plain
  `uuid` column. The name `StatsListener` may appear only in its own entity file, in
  `db/entities.ts`, and inside `services/stats/listenerIdentity/` (plan 12 enforces this).
- `timestamptz` columns are `Date`; `date` columns are `string` (`YYYY-MM-DD`); `bigint` is
  `string`; `double precision` is `number`.
- Each class gets a one- or two-sentence doc comment stating what a row is. Comments describe the
  code as it stands; point at `docs/features/POPULARITY-TRACKING.md` where a rule is longer than
  a sentence. No plan or step numbers.

## Entities

### `StatsListener` — `stats_listener`

- `@PrimaryColumn({ type: 'uuid', default: () => 'gen_random_uuid()' }) listener_id!: string;`
- `@Column({ type: 'integer', unique: true }) account_id!: number;`
- `@OneToOne('Account', (account: Account) => account.id, { onDelete: 'CASCADE' })` with
  `@JoinColumn({ name: 'account_id' }) account!: Relation<Account>;`
- `@CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;`
- Doc comment: the only link between an account and its pseudonymous listener id; read only
  inside the listener identity zone.

### `StatsListenEvent` — `stats_listen_event`

- `@PrimaryColumn({ type: 'timestamptz', default: () => 'now()' }) created_at!: Date;`
- `@PrimaryColumn({ type: 'bigint', default: () => "nextval('stats_listen_event_id_seq')" }) id!: string;`
- `@Column({ type: 'uuid' }) listener_id!: string;`
- `channel_id`, `item_id`: `@Column({ type: 'integer' })` plus `ManyToOne` `channel` / `item`.
- `clip_id`: `@Column({ type: 'integer', nullable: true }) clip_id!: number | null;` plus a
  nullable `ManyToOne` `clip!: Relation<Clip> | null;`.
- `@Column({ type: 'uuid', nullable: true }) client_listen_id!: string | null;`
- `@Column({ type: 'integer', default: 0 }) seconds_heard!: number;`
- `@Column({ type: 'boolean', default: false }) completed!: boolean;`
- Doc comment: one row per counted listen; `created_at` is the server receive time, the only
  clock (daily-totals day and taste decay); monthly partitions by `created_at`; the parent table
  is the only one the app addresses.
- The entity has no device listen time column; the table has none.

### `StatsOpenEvent` — `stats_open_event`

- `created_at`, `id` (sequence `stats_open_event_id_seq`), `listener_id` as above.
- `account_id` and `playlist_id`: nullable integer columns with nullable `ManyToOne` `account` /
  `playlist`. Doc comment says exactly one is set and that opens never feed taste profiles.

### `StatsTasteProfile` — `stats_taste_profile`

- `@PrimaryColumn({ type: 'uuid' }) listener_id`, `@PrimaryColumn({ type: 'integer' }) channel_id`,
  `ManyToOne` `channel`.
- `listen_count`, `completion_count`: `integer`, default 0.
- `first_listened_at`, `last_listened_at`, `scores_updated_at`: `timestamptz`, all server receive
  times.
- `recent_score`, `long_term_score`: `@Column({ type: 'double precision', default: 0 })`.
- Doc comment: one row per listener and show (podcast, album, or artist channel); scores decay
  and are faded to the current time before comparison.

### `StatsTasteProfileHidden` — `stats_taste_profile_hidden`

- `listener_id` and `channel_id` primary columns, `ManyToOne` `channel`,
  `@CreateDateColumn({ type: 'timestamptz' }) hidden_at!: Date;`.
- Doc comment: a show the listener removed from their taste profile; listening never adds it back
  while the row exists.

### Daily totals

Five classes, one per file. For each, `<type>` and the class:

| File | Class | Table | Key column | Relation |
| --- | --- | --- | --- | --- |
| `statsDailyChannel.ts` | `StatsDailyChannel` | `stats_daily_channel` | `channel_id` | `channel: Channel` |
| `statsDailyItem.ts` | `StatsDailyItem` | `stats_daily_item` | `item_id` | `item: Item` |
| `statsDailyClip.ts` | `StatsDailyClip` | `stats_daily_clip` | `clip_id` | `clip: Clip` |
| `statsDailyPlaylist.ts` | `StatsDailyPlaylist` | `stats_daily_playlist` | `playlist_id` | `playlist: Playlist` |
| `statsDailyAccount.ts` | `StatsDailyAccount` | `stats_daily_account` | `account_id` | `account: Account` |

- `@PrimaryColumn({ type: 'integer' })` key column, `@PrimaryColumn({ type: 'date' }) day!: string;`
- `@Column({ type: 'integer', default: 0 }) listener_count!: number;`
- `completion_count` (same shape) on channel, item, and clip only.
- Doc comment: anonymous count of distinct listeners (and, for listen types, finishers) per UTC
  day; filled at write time and never decremented. On `StatsDailyAccount`, say the account is the
  profile that was opened.

### Range totals

Five classes, same file and class naming with `Popularity` in place of `Daily`
(`StatsPopularityChannel` → `stats_popularity_channel`, and so on).

- `@PrimaryColumn({ type: 'integer' })` key column with its `ManyToOne` relation.
- `day_count`, `week_count`, `month_count`, `all_time_count`: `integer`, default 0.
- Doc comment: range totals derived from the daily table by the popularity refresh job; the range
  lengths are `STATS_POPULARITY_RANGE_LOOKBACK_DAYS`.

## Registration and exports

- `packages/orm/src/db/entities.ts`: import all fifteen new classes beside the existing
  `@orm/entities/stats/...` imports (keep the import block sorted the way it is), and add them to
  the `entities` array after `StatsTrackEventPlaylist`.
- `packages/orm/src/index.ts`: after the existing `export * from './entities/stats/statsTrackEventPlaylist.js';`
  line, export the fourteen new entity files **other than** `statsListener.ts`, alphabetically.
  Do not export `entities/stats/statsListener.js` or `services/stats/listenerIdentity/statsListener.js`.

## `StatsListenerService` — `packages/orm/src/services/stats/listenerIdentity/statsListener.ts`

Zone-internal. Open the file with a short doc comment: services in this directory are the only
code that reads `stats_listener`; this class is not exported from `@podverse/orm`; services here
that the index exports take an `account_id` and never return a listener id; see
`docs/features/POPULARITY-TRACKING.md`.

Uses `AppDataSourceReadWrite` only (the read role cannot select the table). Each method takes an
optional `EntityManager` so a caller's transaction can include it; default to
`AppDataSourceReadWrite.manager`.

```typescript
export class StatsListenerService {
  async getOrCreateListenerId(account_id: number, manager?: EntityManager): Promise<string>;
  async findListenerId(account_id: number, manager?: EntityManager): Promise<string | null>;
  async deleteForAccount(account_id: number, manager?: EntityManager): Promise<boolean>;
}
```

- `getOrCreateListenerId`: one statement through the query builder —
  `insert().into(StatsListener).values({ account_id }).orUpdate(['account_id'], ['account_id']).returning(['listener_id']).execute()` —
  and read `listener_id` from `result.raw[0]`. Concurrent first calls for one account return the
  same id. When `result.raw[0]` has no string `listener_id`, throw
  `new Error('stats listener: insert returned no listener id')`. A missing account surfaces as the
  foreign-key error; do not pre-check the account.
- `findListenerId`: `findOne({ where: { account_id }, select: { listener_id: true } })`, returning
  `listener_id` or `null`.
- `deleteForAccount`: `delete({ account_id })`; return `true` when `affected` is greater than 0.
  The doc comment says the cascade removes that listener's listen events, open events, taste rows,
  and hidden rows, and that daily and range totals stay.
- No rotation, no `updated_at`, no other methods. Types only; no `as` casts beyond reading
  `result.raw`, which is `any` in TypeORM — narrow it with a type guard instead of a cast.

## Helpers — `packages/helpers/src/lib/statsPopularityRange.ts`

```typescript
/** UTC days before today that each popularity range includes, so a range of N always covers at least the last N × 24 hours. */
export const STATS_POPULARITY_RANGE_LOOKBACK_DAYS = {
  day: 1,
  week: 7,
  month: 30,
} as const;

export type StatsPopularityLookbackRange = keyof typeof STATS_POPULARITY_RANGE_LOOKBACK_DAYS;

export const STATS_POPULARITY_COUNT_FIELDS = {
  day: 'day_count',
  week: 'week_count',
  month: 'month_count',
  'all-time': 'all_time_count',
} as const;

export type StatsPopularityRange = keyof typeof STATS_POPULARITY_COUNT_FIELDS;
export type StatsPopularityCountField = (typeof STATS_POPULARITY_COUNT_FIELDS)[StatsPopularityRange];
```

The range keys match `QueryParamsStatsRange` in `@podverse/helpers-requests` (`day`, `week`,
`month`, `all-time`). Export the file from `packages/helpers/src/index.ts` on the line after
`export * from './lib/statsAggregatedCountField.js';`. Leave `statsAggregatedCountField.ts` alone;
the readers' plans replace its callers.

## Tests

- `packages/helpers/src/lib/statsPopularityRange.test.ts`: every lookback is a positive integer
  and day < week < month; `STATS_POPULARITY_COUNT_FIELDS` has exactly the keys `day`, `week`,
  `month`, `all-time` and its values are the four `stats_popularity_*` column names.
- `StatsListenerService` behavior (one id per account, stable across calls, delete cascades) is
  covered by the DB-backed API tests of the write path and opt-out plans, which call it through
  their zone services; this plan adds no ORM unit test for it.
- The `StatsListenEvent` columns, with no device listen time, are covered by plan 31's write-path
  integration test, which inserts and reads events through this entity's table.

## Release scratchpad

none (no behavior change until the write path uses these entities)
