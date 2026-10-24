**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# Rewrite proposal citations of pre-squash migration numbers

`docs/proposals/` has three sentences that name a Postgres migration file or a mobile
`user_version` the first-deploy squash removes. Rewrite those sentences so they name the table
or column. Leave every other file in the tree.

## Rows

R16

## Runs after

none

## Files

- docs/proposals/mobile/_master-plan_/phase-2/details/727-notification-subscribe-defaults.md
- docs/proposals/mobile/_master-plan_/phase-2/details/719-sync-event-log.md
- docs/proposals/mobile/_master-plan_/phase-2/details/771-playlist-data-layer-and-offline-cache.md

## Tests

none. Proposal docs only. No product, API, web, or mobile behavior change.

## Release scratchpad

none

## Edit these three spots

Do not rewrap surrounding paragraphs. Do not change status, acceptance criteria, or verification
blocks except where a line below says to.

### 727 — Postgres file names

In `### Schema`, replace the bullet that starts `Linear migration `0008_*.sql`` (it continues
onto the next line with `` `0007_popularity_tracking_consent.sql` ``) with:

```markdown
- `account_settings_notification.auto_enable_on_subscribe` is `boolean not null default false`
  in `0001_app_schema.sql`.
```

Leave the ORM, seed, old-phone, and `make db_regen_linear_baseline` bullets under that heading.
Leave the acceptance line about older mobile snapshots. The detail stays **Status:** done.

### 719 — mobile user_version 7

In `## As built` / `### Storage`, the sentence begins `` `sync_event_log` (migration 7) ``.
Delete the parenthetical so it begins `` `sync_event_log` in the mobile SQLite database ``.
Keep the rest of the sentence (the autoincrement `id` tiebreaker).

### 771 — mobile user_version 16 and 17

The phase-2 index already marks this detail done
(`001-MASTER-PLAN-PHASE-2.md`, P2.1.6 row). The header still says planned, and the schema
section still says to add migration 17 after version 16. Both numbers disappear when mobile
SQLite becomes one first migration. The `playlist` and `playlist_resource` tables already exist
in `apps/mobile/src/data/db/schema.ts`.

1. Change the header `**Status:** planned` to `**Status:** done`.
2. Replace the heading `### Schema (migration 17)` with `### Schema`.
3. Replace the paragraph that begins `Add forward-only migration **17**` with:

```markdown
`playlist` and `playlist_resource` are in the mobile SQLite schema
(`apps/mobile/src/data/db/schema.ts`, applied by the first migration in
[`migrations.ts`](apps/mobile/src/data/db/migrations.ts)):
```

4. Leave the table of purposes and the `payload_json` / `kv_meta` paragraphs.
5. Replace the acceptance bullet `Migration 17 creates `playlist` and `playlist_resource`; `LATEST_MIGRATION_VERSION` is 17.` with:

```markdown
- `playlist` and `playlist_resource` are in the mobile SQLite schema.
```

## Leave the rest of docs/proposals

A sentence stays when it does not name a migration file or a `user_version` integer the squash
deletes.

- **v4 / podverse-rn.** Every `legacy` hit under `docs/proposals/` is the v4 app, a v4 screen,
  a v4 hash or menu, or a platform API (`expo-file-system` is not in this tree; the hits here
  are legacy ExoPlayer packages and the legacy Expo Go flow). `PHASES.md` tells Phase 2 to work
  from screenshots of `../podverse-rn`. Do not edit those.
- **Add-by-RSS dual hash.** `docs/proposals/mobile/app-development-process/DOCS-MOBILE-PROCESS-SHARED-VS-DIVERGENT.md`
  (the paragraph that starts `` `add_by_rss_hash_id` is the same on every device ``) describes
  the current hash: payloads without `feed_url` still use `{channel_id_text, guid}`. That is
  current behavior. Do not edit it. The SQL filename for that hash lives in area E's file, not
  here (see the note below).
- **Future mobile upgrades.** `897-defer-mobile-schema-drift-checks.md` requires upgrade tests
  from an existing install. After this squash, later mobile migrations still append. Leave it.
- **Done specs that name no file.** `743-offline-playback-reconciliation.md` (backfill existing
  rows; JSON already on installed phones) and `734-download-pause-resume-concurrency.md`
  (`SQLite migration:` plus column names) and `704-notifications-read-unread-rename.md`
  (`A linear migration renames the column`) and `432-download-metadata-schema.md`
  (`next user_version`, no integer). Leave them.
- **Phase 1 history** under `phase-1/` and `_draft-tracks/`, including
  `186-old-new-app-coexistence.md` (v4 and nextgen on one API). Leave it.
- Do not edit SQL, code, `.llm/plans/`, or `release-notes/scratchpad.md`.

## Self-check

From the repo root, these patterns must have no matches under `docs/proposals/`:

- `0007_popularity_tracking_consent`
- `0008_`
- `migration 17`
- `(migration 7)`
- `latest (`16``

`user_version` may still match `432-download-metadata-schema.md` only.

## Note for area E

`packages/helpers/src/lib/addByRSSHash.ts` (area E) comments name
`0020_add_by_rss_feed_identity.sql` and rows written before feed identity. Area I does not edit
that file. The proposal paragraph cited above does not name the SQL file.
