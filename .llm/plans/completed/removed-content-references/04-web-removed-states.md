# 04 — Web: Content Removed, archived show notice

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

## Summary

Web shows removed clips and playlist entries as **Content Removed** instead of breaking or
hiding them, and tells visitors when a show has left the directory. Depends on 02 (copy, API)
and 03 (seed, 410). Do not edit the catalog, the seed, mobile, or the API. Runs in parallel
with 05.

## Removed check

Use `isRemovedSource` from `@podverse/helpers` (added in 02) on every surface below. Do not
repeat the `source_removed_at` check inline (**reuse-beyond-components**).

`info.removed.clip_source_removed`, `playlist_entry_removed`, and `show_not_in_directory` take
`{brand_name}`. Pass `config.public.brand.name`, the same way other brand strings do.

## Clip rows — `ListClipRow.tsx`

When removed:

- Artwork area: the existing empty or placeholder artwork. No episode image; the snapshot has
  none.
- Primary line: the clip title the user wrote. Secondary line: `removed_source.item_title` and
  `channel_title` when present, then the label `info.removed.content_removed`.
- No play control, no time-range play affordance, and no link to the episode.
- Owner actions that exist today (delete, edit title) stay.

Rows in playlists and queues render through `ListClipRow`, so they inherit this.

## Playlist rows — `ListPlaylistResourceRow.tsx`

For a removed item or soundbite entry (`source_removed_at` set, `item` and `item_soundbite`
null):

- The same placeholder artwork. Primary line: `removed_source.item_title` (or
  `soundbite_title`) when present, otherwise `info.removed.playlist_entry_removed`. Then the
  label.
- The existing remove-from-playlist action works.
- Not playable. **Play All** and next-item logic skip removed entries. Find where the playlist
  builds its play order and filter there, once.

## Clip page — `app/clip/[clip_id]/page.tsx`

- **410 (not the owner):** render the page shell with `info.removed.clip_source_removed`. No
  titles, no player. Respond 410 through Next.js. Set `robots` to noindex.
- **Owner with a removed clip:** the clip title, the time range with `formatHHMMSS`
  (**playback-timestamp-format**), the snapshot episode and show titles, the sentence
  `info.removed.clip_source_removed`, and the existing owner delete action. No player. Noindex.
- If the page also fetches the channel for SEO, skip that fetch when the clip has no item.

## Channel page — archived show

Podcast, album, and artist pages load channel detail (still 200) and the episode list (now 410
for archived, 404 for takedown):

- 410 with `gone.reason === 'archived'`: keep the header from channel detail. In place of the
  episode list, render `info.removed.show_not_in_directory`. Hide the Follow control, because
  following an archived show does nothing.
- 404 from the list: the existing not-found handling.

Put the list-410 handling in the shared fetcher used by all three pages, not three times.

## Add-by-RSS follow added by the server

A member whose follow was converted has an `account_following_add_by_rss_channels` entry but no
IndexedDB cache (`apps/web/src/utils/addByRSS/storage.ts`). Read how the web Add-by-RSS list
behaves for a follow with no cache:

- If it already enqueues a parse (`/account/add-by-rss/parse` or `/parse/all`), change nothing.
- Otherwise, when the list loads, enqueue one parse for each followed URL with no cache, using
  the existing request helper and the existing pending state.

## E2E — `apps/web/e2e/removed-content.spec.ts`

Use the seeded fixtures from 03 and the existing login helper.

1. Signed in as the E2E user, open **E2E Removed Playlist**. The removed entry shows **E2E
   Removed Episode** and **Content Removed**, with no play button. The Active entry is
   unchanged.
2. Open **E2E Removed Clip**'s page. It shows the clip title, the episode and show titles, and
   the removed sentence. No player.
3. Signed out, open the same clip URL. It shows the removed sentence and neither title.
4. Open **E2E Archived Show**'s page. It shows the show title and **This show is no longer in
   the Podverse directory.** There is no Follow button.

Screenshot each verified element (**e2e-screenshot-verified-element**).

## Scratchpad

```markdown
## Web shows removed clips and playlist entries as Content Removed

- Surfaces: web
- Change: Clips and playlist entries whose episode was removed stay visible to their owner as
  Content Removed, with the episode and show titles, and can be deleted. Other visitors see only
  that the content was removed. Pages of shows that left the directory say so in place of the
  episode list.
- Who notices: web users with clips or playlists of removed shows
```

## Done when

- No web surface throws or shows an empty row for a clip or entry with no item.
- No hardcoded English.
- Comments must not cite this plan or any plan number.

## Operator verification

**Root** — do not set `E2E_API_GATE_MODE`.

```bash
make e2e_test_web_report_spec SPEC=e2e/removed-content.spec.ts
open .artifacts/e2e-reports/latest/index.html
```
