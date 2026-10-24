**Cursor model:** Opus 5.5 · **Reasoning:** high

# 20 — Squash the mobile SQLite chain into one first migration

## Rows

R3, R6, R25

## Runs after

none

## Files

apps/mobile/src/data/db/migrations.ts
apps/mobile/src/data/db/runMigrations.ts
apps/mobile/src/data/db/migrations.test.ts

## Goal

`MIGRATIONS` in `apps/mobile/src/data/db/migrations.ts` holds versions 1 through 26 today. After
this plan it holds exactly one entry, `version: 1`, whose statements create today's final schema
directly. A fresh install runs that one migration and records `PRAGMA user_version = 1`. Later
mobile schema changes append `version: 2`, `3`, … after it and are never rewritten.

`schema.ts` does not change: the final schema is the same, only the path to it is shorter. Do not
edit `schema.ts` in this plan (plan 23 owns its comments).

This is the one sanctioned exception to "never edit a migration that has shipped" in
`.cursor/rules/dto-changes-are-device-data-migrations.mdc`. The only mobile tester deletes the
app (operator answer in `00-REQUEST.md`). The rule stays as written; do not edit it.

## What the squashed version 1 contains

One `Migration` object, `version: 1`, with every `CREATE TABLE` and `CREATE INDEX` the current
chain ends with. Build it from the current file as follows; the result must match a device that
ran versions 1–26 column for column, so `PRAGMA table_info` agrees on both.

1. Copy each `CREATE TABLE` statement verbatim, in the current order of first appearance
   (`kv_meta`, `account_snapshot`, `queue_cache`, `add_by_rss_feed`, `download`,
   `subscribed_channel`, `sync_event_log`, `channel_item`, `channel_item_window`, `channel_seen`,
   `channel_live_status`, `section_chrome_flags`, `playback_outbox`, `playback_local_state`,
   `playlist`, `playlist_resource`, `channel_auto_download`, `auto_download_candidate`,
   `add_by_rss_credential_index`, `playable_item`, `identity_remap_applied`,
   `item_description_cache`, `add_by_rss_listed_feed`, `stats_listen_outbox`).
2. Every table uses `CREATE TABLE IF NOT EXISTS`. Version 15 wrote `CREATE TABLE
   section_chrome_flags` without it; the squashed statement adds `IF NOT EXISTS`.
3. Fold every `ALTER TABLE … ADD COLUMN` into its table's `CREATE TABLE`, appended after the
   original columns in the order the alters ran, with the exact type and constraint text:

| Table | Columns appended, in this order |
| --- | --- |
| `add_by_rss_feed` | `latest_item_pub_date_ms INTEGER`, `requires_credentials INTEGER NOT NULL DEFAULT 0`, `last_auth_failure TEXT`, `may_have_livestreams INTEGER NOT NULL DEFAULT 0`, `followed INTEGER NOT NULL DEFAULT 1`, `podcast_guid TEXT`, `publisher_guids_json TEXT`, `publisher_directory_json TEXT` |
| `download` | `channel_id_text TEXT`, `channel_title TEXT`, `dismissed_from_list INTEGER NOT NULL DEFAULT 0` |
| `subscribed_channel` | `popularity_rank INTEGER`, `kind TEXT NOT NULL DEFAULT 'podcasts'` |
| `sync_event_log` | `details_json TEXT` |
| `channel_item` | `popularity_rank INTEGER` |

   Keep every `DEFAULT`. Insert paths rely on them (an `add_by_rss_feed` insert without
   `followed` is a follow; `subscribed_channel.kind` defaults to `podcasts`).
4. Copy every `CREATE INDEX` / `CREATE UNIQUE INDEX` verbatim, each placed after its table. That
   includes the three that came with alters: `idx_add_by_rss_feed_podcast_guid`,
   `idx_download_channel_id`, `idx_subscribed_channel_kind`.
5. Drop the version 24 `UPDATE add_by_rss_feed SET may_have_livestreams = 1 …` statement. It
   seeded rows that existed before the column; a fresh database has none.
6. Version 1 contains no `ALTER TABLE`, `UPDATE`, `DELETE`, or `DROP` statement.

Keep `LATEST_MIGRATION_VERSION` and the `Migration` type as they are. `LATEST_MIGRATION_VERSION`
evaluates to 1.

### Comments in `migrations.ts`

Comments describe the schema as it stands (`.cursor/rules/comments-future-forward.mdc`):

- Keep a short comment above a table when it states a constraint the DDL cannot show. Carry over,
  reworded where needed: the `add_by_rss_feed.latest_item_pub_date_ms` reason (recency order
  without deserializing bundles), the `channel_live_status` reason, `popularity_rank` on
  `subscribed_channel` / `channel_item`, the `download` channel identity and
  `dismissed_from_list` meaning, `subscribed_channel.kind` as the Home chip bucket,
  `section_chrome_flags` keys, the two playback tables, playlist tables,
  `channel_auto_download.enabled_at` watermark, `auto_download_candidate` one decision per item,
  `sync_event_log.details_json` structured diagnostics, the `add_by_rss_feed` credential columns
  (username and password live in SecureStore, never in SQLite) and
  `add_by_rss_credential_index`, `playable_item`, `identity_remap_applied`,
  `item_description_cache`, `may_have_livestreams` (never cleared, outlasts a live item that left
  the feed), `followed` / guid columns and `add_by_rss_listed_feed`, `stats_listen_outbox`.
- Drop every phrase that only describes an older device: "Existing rows default to podcasts; the
  next subscribe or directory sync stamps the real kind", "Rows written before this column exist
  keep a null", "Seeded from the bundles already on the device".
- Rewrite the file header. It states: migrations are forward-only; append a new entry with the
  next integer `version` and never edit or reorder one that has shipped; `version` is written
  with `PRAGMA user_version` by `runMigrations` and must be an authored integer literal; each
  schema change also edits `schema.ts` by hand. Drop the line "Domain tables use new migrations
  appended after the existing versions." Keep the pointer to the **mobile-data-layer** skill;
  drop the pointer to the proposals decision doc.

## Install still on the old chain (R6)

Answer to the R6 question, from `runMigrations.ts` as it is today: an install that ran the old
chain has `user_version = 26`. With `MIGRATIONS` holding only version 1, `runMigrations` finds
nothing pending and runs nothing. Its tables already match the squashed schema, so the app keeps
working, until the next mobile migration ships as `version: 2`. That install would skip it
forever (2 < 26) and fail later on a missing column or table, far from the cause. Developer
simulators and emulators that ran the old chain are in the same position.

This plan makes that state fail at open instead:

- In `runMigrations`, after `readUserVersion`, compare against `LATEST_MIGRATION_VERSION`
  (import it from `./migrations`). When `currentVersion > LATEST_MIGRATION_VERSION`, throw an
  `Error` whose message names both numbers and says the database was written by a different
  schema chain and the app must be reinstalled, for example:
  `SQLite user_version 26 is newer than this build's latest migration 1; reinstall the app.`
  Run no statement and write no `PRAGMA` before throwing.
- This is a permanent invariant, not upgrade code: a database whose version is above every
  migration this build knows was written by a schema this build cannot read (the old chain, or a
  newer build followed by an older one on a developer device).
- Nothing else changes in the open path. `initializeDatabase` in `db/index.ts` rejects,
  `App.tsx` already logs `[data] database initialization failed`, and repositories that await
  `initializeDatabase()` reject. Do not add a reset, a file delete, or a fallback. Do not edit
  `App.tsx` (area C file).
- Update the `runMigrations` doc comment to state the guard in one sentence.

The tester's step is in § Operator reinstall step below.

## Tests

Rewrite `apps/mobile/src/data/db/migrations.test.ts` (unit, vitest, already in the include list
of `apps/mobile/vitest.config.ts`). Keep `createRecordingDatabase`. Remove every per-version
`describe` (versions 16, 20, 23, 24, 25, 26) and the "continues to parse pre-upgrade queue_cache
payload JSON" case; those cover upgrades from states that no longer exist. Add:

- `MIGRATIONS` has exactly one entry, `version` 1, and `LATEST_MIGRATION_VERSION` is 1.
- On a database at `user_version` 0, `runMigrations` runs every statement of version 1 and then
  `PRAGMA user_version = 1;`.
- Version 1 creates every table `schema.ts` declares: assert
  `create table if not exists <name>` for each of the 24 table names listed above.
- Version 1 carries the folded columns with their constraints: at least
  `followed integer not null default 1`, `may_have_livestreams integer not null default 0`,
  `requires_credentials integer not null default 0`, `kind text not null default 'podcasts'`,
  `dismissed_from_list integer not null default 0`, `details_json text`,
  `latest_item_pub_date_ms integer`, and the indexes `idx_add_by_rss_feed_podcast_guid`,
  `idx_download_channel_id`, `idx_subscribed_channel_kind`.
- Version 1 contains no `alter table`, `update `, `delete from`, or `drop table`.
- Version 1 has no column for a feed secret: the SQL contains neither `password` nor `username`
  (carried over from the version 20 case; it states a standing constraint).
- On a database at `user_version` 1, `runMigrations` executes nothing.
- On a database at `user_version` 26, `runMigrations` rejects with the guard error and executes
  nothing (the recording array stays empty).

Do not add a schema-drift check between `schema.ts` and `MIGRATIONS`; that is deferred by the
operator (`897-defer-mobile-schema-drift-checks`).

## Operator reinstall step (the set's last prompt carries it)

The operator asked that the only mobile tester delete the app. The set's last prompt lists:

- **The tester** deletes the Podverse app from the phone, then installs the new build. Deleting
  the app removes the SQLite database, downloads, and prefs. On iOS, the Keychain can keep the
  sign-in and Add by RSS feed credentials across a reinstall, so the tester may open the new
  build already signed in; the account's subscriptions then sync down, and Add by RSS feeds that
  need a username and password ask for them again.
- **Developers** with a manual simulator or emulator that ran the old chain uninstall and
  reinstall. E2E devices need nothing: Maestro flows start from `clearState`.

Mobile iOS tab:

```bash
npm run mobile:ios:uninstall
npm run mobile:ios -- --device "iPhone 17 Pro"
```

Mobile Android tab:

```bash
npm run mobile:android:uninstall
npm run mobile:android -- --device Pixel_6_Pro_API_33
```

A device that skips this step fails at database open with the guard message in the Metro log.

## Release scratchpad

```markdown
## Mobile database starts over at one first migration

- Surfaces: mobile
- Change: the on-device SQLite chain (versions 1–26) is replaced by a single first migration that
  creates the current schema directly. Opening a database whose `user_version` is above the
  build's latest migration now fails at open with a reinstall message instead of running on an
  unknown schema.
- Who notices: the mobile tester and developers whose device ran an earlier build; a fresh install
  sees no difference
- Operator steps: delete and reinstall the app on any device that ran an earlier build
  (`npm run mobile:ios:uninstall` / `npm run mobile:android:uninstall` for manual dev devices)
```
