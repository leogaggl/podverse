# 07 — Mobile identity remap

**Cursor model:** Opus 5.5 · **Reasoning:** high

## Summary

A phone keeps subscriptions, downloads, and listening progress across an absorb merge, including
when the listener is signed out. The app asks the server which ids moved, rewrites local keys,
and leaves downloaded files where they are. It does not unfollow a show just because the old
channel id 404s.

Depends on `POST /identity/resolve` and the `410` body from
[06-api-and-web-redirects.md](./06-api-and-web-redirects.md). Do not edit server merge SQL.
Do not add `merged_into` onto `DTOItem` or `DTOChannel`. Those DTOs are stored on disk; this
change is a key rewrite, not a DTO change (**dto-changes-are-device-data-migrations**).

## Sync job

Add kind `identity-remap` to `SYNC_JOB_KINDS` in
[apps/mobile/src/sync/syncJobKinds.ts](apps/mobile/src/sync/syncJobKinds.ts), with a label key in
the `mobile` catalog originals (`en-US`, `es`, `fr`, `el-GR`). Match the voice of
`sync.job.episodes`. Register the job in [apps/mobile/src/sync/syncJobs.ts](apps/mobile/src/sync/syncJobs.ts)
so it runs one at a time on the existing queue and shows on the sync indicator
(**mobile-sync-orchestration**). It is not interactive work.

The resolve call is public. The job runs signed out and signed in. It does not read account-only
routes. After a signed-in remap, enqueue the existing `account-refresh` so the snapshot picks up
the new follow ids. Do not hand-edit `account_snapshot`.

### When it runs

1. **Instead of dropping a follow.** In
   [apps/mobile/src/data/repositories/directoryChannelGone.ts](apps/mobile/src/data/repositories/directoryChannelGone.ts),
   a channel episode-list `410` with `merged_into`, or a `404`, calls resolve for that
   `id_text` before the current unfollow. A mapping remaps and does not unfollow. No mapping
   keeps today's unfollow and `directory_channel_gone` log.
2. **Daily pass.** `kv_meta` key `identity_remap_checked_at`. If older than 24 hours, resolve
   every local channel `id_text` (subscribed channels), every download `item_id_text`, every
   playback `resource_id_text`, and item `id_text`s found in cached playlist payloads. Chunk at
   500. Update the timestamp even when nothing moved, so a quiet library does not resolve on
   every launch.

Failures are quiet (existing sync error log). Do not surface a dialog.

## Remap

One pure function in `apps/mobile/src/data/identityRemap.ts` (no React Native imports) plus a
repository that applies its plan to SQLite and AsyncStorage. Unit-test the function.

SQLite migration **version 22** in `apps/mobile/src/data/db/migrations.ts` and the matching
`schema.ts` edit. Table `identity_remap_applied`:

- `from_id_text` text primary key
- `to_id_text` text not null
- `applied_at` integer not null

Skip a `from_id_text` already applied to the same `to_id_text`. Never edit migration 21 or
earlier.

| Store | Rewrite |
| --- | --- |
| `subscribed_channel` | Insert the survivor row if missing (copy title and art from the old row; the next sync corrects them). Delete the old row. If both exist, delete the old row only. |
| `channel_auto_download` | Move the channel key. If the survivor key exists, keep it and delete the old. |
| `auto_download_candidate` | Move `item_id_text` so the episode is not downloaded again. |
| `channel_seen`, `channel_live_status` | Move the channel key. Keep the later timestamp when both exist. |
| `section_chrome_flags` | Move `channel:<id>` and `item:<id>` keys. |
| `download` | Update `item_id_text` and `channel_id_text`. **Do not change `file_path` and do not rename the file.** Playback must open `file_path` (it already does in `downloadManager.ts`). Do not rebuild the filename from the new id. |
| `playback_local_state`, `playback_outbox` | Update `resource_id_text`. When both ids exist, keep `completed` if either is completed, else the greater position, and delete the other row. |
| `channel_item`, `channel_item_window` | Delete the old channel's rows. The next `channel-items` sync fills the survivor. Downloads stay via `file_path`. |
| `playlist` / `playlist_resource` `payload_json` | Replace item `id_text` values the map knows. Leave numeric ids; the next playlist sync replaces the payload. |
| `kv_meta` `channel_action_chrome` | Move the `id_text` key. |
| `queue_cache` | Delete the rows. The next `queue-hydrate` refetches. Do not rewrite nested queue JSON. |
| AsyncStorage `sort.channel:` and `sort.item:` | Copy the value to the new key, delete the old. Use the existing pref helpers, not a new key format. |
| `pv_mobile_last_playback` | If its `id_text` moved, replace it. |

After the writes, call the existing native library and downloads cache projection (the same
writers subscription and download mutations already use) so car browse does not keep the old id.
Do not add a new cache format.

Add-by-RSS rows are not in the map. Leave them.

## Tests

- Unit: two subscribed channels, survivor already subscribed, download row, playback row on both
  ids, sort key. Assert one subscription, file path unchanged, progress kept, sort key moved,
  second apply is a no-op.
- Maestro flow `apps/mobile/e2e/identity-remap.yaml` against the E2E API with a seeded absorb
  (same fixture shape as the web spec in plan 06). Subscribe on the old id, run sync, assert the
  library shows the survivor once. Assert a completed download's file is still the played file
  (the flow may stub playback; it must not re-download). Follow **mobile-e2e-screenshots**.

## Scratchpad

Append to `release-notes/scratchpad.md`:

```markdown
## The phone keeps a show that was merged

- Surfaces: mobile, api
- Change: Subscriptions, downloads, and listening progress follow a show when its duplicate feed
  is merged. Downloaded audio is not fetched again. Signed-out subscriptions are included.
- Who notices: mobile listeners subscribed to a duplicate RSS feed
```

## Done when

- A `410` or a resolve hit rewrites local keys and does not unfollow.
- A download still plays from the original file.
- The daily pass does not call resolve more than once per 24 hours when nothing else asks.

## Operator verification

**Mobile Maestro** — **Mobile E2E Metro**, **Mobile E2E API**, and **Mobile E2E iOS** /
**Mobile E2E Android** must already be up. Do not paste those leave-running commands here.

```bash
npm --prefix apps/mobile run test
npm run mobile:e2e:test -- identity-remap
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
```
