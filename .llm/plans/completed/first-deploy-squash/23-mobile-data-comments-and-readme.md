**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 23 — Mobile data layer: comments, README, and guidance after the squash

## Rows

R9, R25

## Runs after

none

## Files

apps/mobile/src/data/db/schema.ts
apps/mobile/src/data/README.md
apps/mobile/src/data/repositories/syncEventLog.test.ts

## Scope

Rewrite or drop text in area B files that describes an earlier device state, an earlier build,
or a plan step (`.cursor/rules/comments-future-forward.mdc`). Behavior does not change.
`migrations.ts`, `runMigrations.ts`, `migrations.test.ts` (plan 20), `db/index.ts`,
`addByRssRepository.ts` (plan 21), and `nativeCache/projection.ts` (plan 22) are not in this
plan.

## `apps/mobile/src/data/db/schema.ts`

1. `addByRssFeed` doc comment: delete the parenthetical "(retiring the slim AsyncStorage store)".
   The sentence reads "This is the source of truth for the mobile RSS list and add-by-RSS
   playback."
2. `subscribedChannel` doc comment: delete "(9b.8, 701)" from the first line. It reads "The
   device's **directory** channel follows, keyed by channel `id_text`."
3. `kvMeta` doc comment: replace "Domain-specific metadata can use forward-only migrations
   alongside this table." with "A domain that needs its own columns gets its own table."

Leave every other comment; they state current behavior.

## `apps/mobile/src/data/README.md`

1. Storage boundaries paragraph: delete "(stubs until Track 12)". The sentence reads
   "…repositories that own queue / downloads / library index project their state to that native
   cache on mutation — see …".
2. Heading `## Prefs store notes (Track 16.1)` becomes `## Prefs store notes`.
3. `## db/ — SQLite + Drizzle` list, replace the `schema.ts`, `migrations.ts`, "Migration `16`",
   and `runMigrations.ts` bullets with:
   - `schema.ts` — Drizzle table definitions, one per table `migrations.ts` creates. Maintained
     by hand beside the migrations.
   - `migrations.ts` — forward-only migration list. Version 1 creates the whole schema; each later
     change appends the next integer version and never edits a shipped one.
   - `runMigrations.ts` — applies pending migrations in a transaction, tracked via
     `PRAGMA user_version`, and refuses a database whose version is above the latest migration.

   This drops the hand-kept table list, which already omitted most tables.
4. Repository seam paragraph: "`downloadsRepository` (Phase F offline downloads index in
   `download`; …" becomes "`downloadsRepository` (offline downloads index in `download`; …".
5. `nativeCache/` bullet: delete "(schema 12.1 / `380`)" and ", 12.2–12.3", and end that
   sentence with "while JS is not running". It reads "Each stamps the versioned envelope and
   forwards to the media-engine bridge, which persists durably on device (iOS/Android
   `PodverseNativeCache`) so car/watch read it while JS is not running."

Keep the links to `DOCS-MOBILE-DATA-LAYER-OFFLINE.md`; that doc is area I's to sweep.

## `apps/mobile/src/data/repositories/syncEventLog.test.ts`

Rename the case `'reads rows written before details existed, or by something else, as empty'`
to `'reads missing or unreadable details as empty'`. The assertions stay. `details_json` is
nullable and new rows may omit it, so the behavior under test is current.

## Guidance checked, no edit (R9)

- `.cursor/rules/dto-changes-are-device-data-migrations.mdc`: every sentence stays true after the
  squash. "Append a migration … with the next integer version" and "Never edit a migration that
  has shipped" describe the chain from version 1 onward. Do not edit it.
- `.cursor/skills/mobile-data-layer/SKILL.md`: names no migration number or open pass. Do not
  edit it.

## Tests

`apps/mobile/src/data/repositories/syncEventLog.test.ts`: test name only (above). No new tests.

## Release scratchpad

none
