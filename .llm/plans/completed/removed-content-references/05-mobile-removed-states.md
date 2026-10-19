# 05 — Mobile: Content Removed, archived show follows

**Cursor model:** Opus 5.5 · **Reasoning:** high

## Summary

Mobile renders removed clips and playlist entries as **Content Removed**. When a followed show
is archived, mobile drops the directory follow as today. For members whose follow the server
converted, it logs the move and refreshes Add by RSS, so the show reappears there.

Depends on 02 and 03. Do not edit the catalog, the seed, web, or the API. Runs in parallel with
04. Follow **mobile-sync-orchestration**, **dto-changes-are-device-data-migrations**, and
**mobile-anonymous-vs-account-features**.

## Removed check

Use `isRemovedSource` from `@podverse/helpers` (added in 02) everywhere below. Do not repeat
the `source_removed_at` check inline (**reuse-beyond-components**).

`info.removed.clip_source_removed`, `playlist_entry_removed`, and `show_not_in_directory` take
`{brand_name}`. Pass the brand name the way other mobile `{brand_name}` strings do.

## Rows — `apps/mobile/src/lib/rows/homeRowMappers.ts`

- `clipToHomeRow`: the null-item branch already exists. When removed, the subtitle is the
  snapshot episode and show titles when present, followed by `info.removed.content_removed`.
  No artwork. Not playable: the row's primary press opens clip detail and never starts
  playback.
- `playlistResourceToHomeRow`: a removed item or soundbite entry shows the snapshot title, or
  `info.removed.playlist_entry_removed`, with the label. Not playable.
- Old cached payloads (`kv_meta` `home.clips.subscribed`, `playlist_resource.payload_json`) have
  no removed fields and render as before.

Update `homeRowMappers.test.ts` for both removed shapes and an old-shape payload.

## Playback order

Find where a playlist or a clip list builds the play order, the queue it hands to playback.
Skip removed entries there, once. **Play All** on **E2E Removed Playlist** plays the Active
entry only.

## Clip detail — `ClipDetailScreen.tsx`

- **Owner, removed:** the clip title, the time range with `formatHHMMSS`, the snapshot titles,
  `info.removed.clip_source_removed`, and the existing delete action. No player controls and no
  Summary.
- **410 (not the owner):** `info.removed.clip_source_removed` only.

## Playlist detail

Removed rows keep their position and the existing remove action.

## Archived show follows — `apps/mobile/src/data/repositories/directoryChannelGone.ts`

- `shouldResolveBeforeDrop`: also true for 410 whose body has `gone.reason === 'archived'`.
  Read it with a type guard, like `mergedChannelIdText`; no `as`.
- After `identityRemapRepository.remapChannel` returns null, drop the follow as today.
- When `gone.add_by_rss_feed_url` is a non-empty string:
  - log `error_log.directory_channel_converted` (the code `directory_channel_converted`, outcome
    `reconciled`) instead of the gone line;
  - then, if the account's `evaluateFeatureAccess('add_by_rss_refresh', ...)` allows it,
    enqueue the existing Add-by-RSS refresh job once. Use the sync runner's existing enqueue,
    not a direct parse call.
- Otherwise, log the existing `directory_channel_gone` line.
- A 410 with `merged_into` keeps its current path.

Signed-out and non-member users therefore see today's behavior. Add-by-RSS is a membership
feature.

## Add-by-RSS follow added by the server

Read `addByRssRepository.requestRefreshAll` and `applyRefreshResult`. The server's
`parse/all` returns request ids for every followed URL on the account, including converted
ones. Confirm that a result for a URL with no local `add_by_rss_feed` row creates that row,
with the title and image from the follow. If it does not, add that path. It must be idempotent
and must not touch rows that already exist.

## Tests

Unit (`npm --prefix apps/mobile run test`):

- `directoryChannelGone`: an archived 410 with a URL drops the follow, logs converted, and
  enqueues one refresh for a member. Without a URL it logs gone and enqueues nothing. A merge
  410 still remaps.
- Add-by-RSS refresh: an unknown URL creates one local row; a second refresh does not
  duplicate it.
- Row mappers, as above.

Maestro — `apps/mobile/e2e/removed-content.yaml`, signed in as the E2E user with the same
sign-in steps other account flows use:

1. **Library**, then **My Clips**. **E2E Removed Clip** shows **Content Removed**.
2. Open it. The removed sentence shows, with no play control.
3. Open **E2E Removed Playlist**. The removed entry shows **Content Removed**.

## Scratchpad

```markdown
## Mobile keeps removed clips and moves archived shows to Add by RSS

- Surfaces: mobile
- Change: Clips and playlist entries whose episode was removed show as Content Removed, keep
  their place, and can be deleted. They do not play. When a followed show leaves the directory
  and the server moved a member's follow to Add by RSS, the sync log says so and Add by RSS
  refreshes so the show reappears there.
- Who notices: mobile users with clips or playlists of removed shows; members following shows
  that leave the directory
```

## Done when

- No mobile surface crashes or plays a removed clip or entry.
- No new DTO field is required on read.
- Comments must not cite this plan or any plan number.

## Operator verification

**Mobile**

```bash
npm run type-check:mobile
npm --prefix apps/mobile run test
make mobile_e2e_seed
```

**Mobile Maestro**: **Mobile E2E Metro**, **Mobile E2E API**, **Mobile E2E test-assets**, and
**Mobile E2E iOS** / **Mobile E2E Android** must already be running.

```bash
npm run mobile:e2e:test -- removed-content
open .artifacts/mobile-e2e-reports/latest/failures.json
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
```
