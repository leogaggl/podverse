**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# Auto-download doc names tables, not old migration files

`docs/development/mobile/MOBILE-AUTO-DOWNLOAD.md` cites SQLite migration 18 and Postgres file `0011_account_device_auto_download_channel.sql`. After the squash those numbers are false. The tables stay. Name the tables.

## Rows

R10

## Runs after

none

## Files

- docs/development/mobile/MOBILE-AUTO-DOWNLOAD.md

## Tests

none. Documentation only.

## Release scratchpad

none

## Edits

Under "Device data", delete the heading line `SQLite migration 18:`. Keep the two bullets that name `channel_auto_download` and `auto_download_candidate`, and keep the sentence that the status column is text so an extra status value does not need a new SQLite migration. That sentence is a constraint of the column as it stands.

In the server table, the `account_device_auto_download_channel` cell names the columns `(account_id, installation_id, channel_id)` and the file `0001_app_schema.sql`. Delete `Linear migration 0011_account_device_auto_download_channel.sql`.

Do not edit any other section. Do not edit `apps/mobile/src/data/**` or the Postgres SQL. Those belong to other areas.
