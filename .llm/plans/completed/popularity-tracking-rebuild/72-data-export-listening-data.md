**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 72 — Account data export includes Popularity Tracking data

`GET /account/download-data` returns everything stored about the account. Popularity Tracking now
stores account-linked rows: Taste Profile rows, Hidden From Taste Profile rows, and listen and open
events kept for the retention period. Add all four to the export under one `popularity_tracking`
key. The pseudonymous listener id itself is never exported: zone services never return it
(plan 12's rule), and the listener's data is fully described without it.

Every decision below is fixed; transcribe it.

## Rows

R70. This plan also answers the area G question of whether the account data export includes the
Taste Profile and the hidden list. It does, together with stored listen and open records.

## Runs after

10, 11, 70

## Files

- `packages/helpers/src/dtos/account/accountDataExport.ts`
- `packages/orm/src/services/stats/listenerIdentity/listeningDataExport.ts` (new)
- `packages/orm/src/services/account/accountDataExport.ts`
- `packages/orm/src/index.ts`
- `docs/features/POPULARITY-TRACKING.md`
- `apps/api/src/test/account-data-export-popularity.integration.test.ts` (new)

## DTOs — `packages/helpers/src/dtos/account/accountDataExport.ts`

Add these above `DTOAccountDataExport`, and add `popularity_tracking: DTOAccountDataExportPopularityTracking;`
to `DTOAccountDataExport` after `listen_stats_decided_at`. The export is a downloaded file, not a
persisted device payload, so no device migration applies.

```typescript
export interface DTOAccountDataExportTasteProfileRow {
  channel_id_text: string;
  channel_title: string | null;
  listen_count: number;
  completion_count: number;
  first_listened_at: string;
  last_listened_at: string;
  recent_score: number;
  long_term_score: number;
  scores_updated_at: string;
}

export interface DTOAccountDataExportHiddenFromTasteProfileRow {
  channel_id_text: string;
  channel_title: string | null;
  hidden_at: string;
}

export interface DTOAccountDataExportListenEvent {
  created_at: string;
  channel_id_text: string;
  item_id_text: string;
  item_title: string | null;
  clip_id_text: string | null;
  seconds_heard: number;
  completed: boolean;
}

export interface DTOAccountDataExportOpenEvent {
  opened_at: string;
  account_id_text: string | null;
  playlist_id_text: string | null;
}

/** Stored Popularity Tracking data linked to the account; empty lists when tracking never stored anything or was turned off. */
export interface DTOAccountDataExportPopularityTracking {
  taste_profile: DTOAccountDataExportTasteProfileRow[];
  hidden_from_taste_profile: DTOAccountDataExportHiddenFromTasteProfileRow[];
  listen_events: DTOAccountDataExportListenEvent[];
  open_events: DTOAccountDataExportOpenEvent[];
}
```

The export gives stored values as they are: every time is a server receive time exactly as
stored (an added-back row's times are its add-back time), and scores are as of
`scores_updated_at`. A listen record's only time is the event's `created_at`, under that column's
own name. It is a record, not the display the Settings list shows.

## Zone service — `packages/orm/src/services/stats/listenerIdentity/listeningDataExport.ts`

```typescript
export class ListeningDataExportService {
  async getForAccount(account_id: number): Promise<DTOAccountDataExportPopularityTracking>;
}
```

- Export it from `packages/orm/src/index.ts` beside the other listener identity zone services.
  Doc comment: builds the export section for one account; never returns a listener id.
- `AppDataSourceReadWrite.manager` throughout. `StatsListenerService.findListenerId(account_id)`.
  When null, return four empty arrays.
- Taste rows: `find` on `StatsTasteProfile` `where { listener_id }`, `relations: { channel: true }`,
  order `last_listened_at: 'DESC', channel_id: 'DESC'`.
- Hidden rows: `StatsTasteProfileHidden`, `relations: { channel: true }`, order `hidden_at: 'DESC'`.
- Listen events: `StatsListenEvent`, `where { listener_id }`,
  `relations: { channel: true, item: true, clip: true }`, order `created_at: 'ASC'`.
  `created_at` is the entity's `created_at`.
- Open events: `StatsOpenEvent`, `relations: { account: true, playlist: true }`, order
  `created_at: 'ASC'`. `opened_at` is `created_at`. Map `account?.id_text ?? null` and
  `playlist?.id_text ?? null`.
- Map with explicit module-level functions. Use `.toISOString()` for dates. Never copy
  `listener_id`, and never spread an entity.

## `AccountDataExportService.exportUserData` — `packages/orm/src/services/account/accountDataExport.ts`

- Add `popularity_tracking: DTOAccountDataExportPopularityTracking;` to the method's inline
  return type, after `listen_stats_decided_at`. Import the type from `@podverse/helpers` with
  `import type`.
- Before building `exportData`, call
  `const popularityTracking = await new ListeningDataExportService().getForAccount(account_id);`
  and add `popularity_tracking: popularityTracking` after `listen_stats_decided_at` in `exportData`.

`apps/api/openapi.yml` is not edited: `ApiGetAccountDownloadDataResponse200` is a free-form
object (`additionalProperties: true`), so the response contract does not change. The controller
and `apps/api/src/test/account.test.ts` mock the service and need no change.

## Doc — `docs/features/POPULARITY-TRACKING.md`

One short paragraph in the consent lifecycle section: the account data export includes the Taste
Profile, the hidden list, and stored listen and open records under `popularity_tracking`. It never
includes the listener id. After an opt-out the section is empty.

## Tests

`apps/api/src/test/account-data-export-popularity.integration.test.ts`, DB-backed, with the
harness of `popularity-tracking-opt-out.integration.test.ts` (plan 70). Call
`new AccountDataExportService().exportUserData(accountId)` directly. Do not go through the route,
which has a rate limiter.

1. An account with a seeded `stats_listener` row, one taste row, one hidden row, one listen event
   with a clip, and one open event of a playlist: `popularity_tracking` has one entry in each list
   with the seeded `channel_id_text`, `item_id_text`, `clip_id_text`, and `playlist_id_text`.
   The listen record's `created_at` equals the seeded event's `created_at` as an ISO string.
   `JSON.stringify(result)` does not contain the seeded `listener_id`.
1. An account with no `stats_listener` row: all four lists are empty.

## Release scratchpad

```markdown
## Data export includes Popularity Tracking data

- Surfaces: api (`GET /account/download-data`), helpers
- Change: the account data export has a new `popularity_tracking` section: Taste Profile rows,
  the Hidden From Taste Profile list, and stored listen and open records. Each listen record is
  dated by `created_at`, the time the server received it. It does not include the pseudonymous
  listener id. The section is empty for listeners who never turned tracking on or who
  turned it off.
- Who notices: listeners who download their data
- Operator steps: none
```
