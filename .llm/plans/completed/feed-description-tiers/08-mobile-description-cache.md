# 08 — Mobile: previews, lazy show notes, offline notes

**Cursor model:** Opus 5.5 · **Reasoning:** high

## Summary

Rows read the stored `preview`. The full player stops depending on the list payload carrying
full notes. It reads them from an on-device cache, which fills from the description endpoint
(06), warms when an item becomes the active playback target, and stays pinned while the item is
downloaded, so notes work offline. Summary and About show when notes were shortened.

Depends on 01, 03, and 06. Do not edit the catalog, the seed, web, or the API. Runs in parallel
with 07. Follow **mobile-data-layer**, **mobile-sync-orchestration**,
**dto-changes-are-device-data-migrations**, and **about-summary-web-mobile-alignment**.

## Device data

Every new DTO field is optional. Payloads already on phones (`channel_item.payload_json`,
`playable_item.payload_json`, `add_by_rss_feed.mapped_feed_json`) lack `preview` and
`is_truncated`. Reads go through `getDescriptionPreviewText` and `isDescriptionTruncated`,
which tolerate both shapes. Do not rewrite existing payload rows.

## Rows

Switch `htmlToPlainTextPreview(...item_description?.value)` to
`getDescriptionPreviewText(item.item_description)`:

- `apps/mobile/src/lib/rows/homeRowMappers.ts` (`ItemHomeRowSource` gains the optional fields)
- `apps/mobile/src/screens/home/homeFeedData.ts` (both reads)

Update `homeRowMappers.test.ts` and `homeFeedData.test.ts`: a payload with `preview` uses it,
and an old payload with only `value` still produces a snippet.

## Description cache

SQLite: add table `item_description_cache` in `apps/mobile/src/data/db/schema.ts`, plus a
forward-only migration in `migrations.ts`. Use the next unused version (22 or later; read the
file and never reuse a number).

| Column | Type | Notes |
| --- | --- | --- |
| `item_id_text` | text, primary key | |
| `value` | text, nullable | null means the item has no notes |
| `preview` | text, nullable | |
| `is_truncated` | integer 0/1 | |
| `link_url` | text, nullable | |
| `pinned` | integer 0/1, default 0 | set while a download exists |
| `fetched_at` | integer | ms epoch |

Repository `apps/mobile/src/data/repositories/itemDescriptionCacheRepository.ts`, in the style
of the existing repositories:

- `get(itemIdText)`, `put(row)`, `pin(itemIdText)`, `unpin(itemIdText)`
- `evictUnpinned(keep = 200)` deletes the oldest unpinned rows by `fetched_at`. Call it after
  `put`.
- Pure helpers for row mapping and the eviction choice, exported for tests.

Resolver `apps/mobile/src/lib/content/resolveItemDescription.ts`:

```ts
type ResolvedItemDescription = {
  html: string | null;
  preview: string;
  isTruncated: boolean;
  linkUrl: string | null;
  source: 'payload' | 'cache' | 'network' | 'none';
};
```

Order:

1. The payload's `item_description.value`, when present. This covers today's lists, detail
   payloads, and Add-by-RSS bundles. Add-by-RSS items have no server id, so they always stop
   here.
2. The cache row.
3. When online, `api.reqItemDescriptionGetByIdOrIdText(itemIdText)`, written to the cache.
4. Otherwise the payload preview, and `source: 'none'`.

Hook `useItemDescription(item)` wraps the resolver. It returns the preview immediately and the
full notes when ready. It never blocks first paint. Failures are logged, never shown
(**mobile-sync-orchestration**). This is an on-demand read, not a sync job; do not register it
with the sync runner.

Writers, so the cache is warm before the full player opens:

- `EpisodeDetailScreen`, `TrackDetailScreen`, and `ClipDetailScreen`: after the detail fetch
  succeeds, `put` the description with `link_url` from `item_about.website_link_url`.
- When an item becomes the active playback target, resolve its description in the background.
  Find the place that already reacts to active-target changes; do not add a second listener.
- `apps/mobile/src/downloads/downloadManager.ts`: when a download completes, resolve then
  `pin`. When a download row is deleted, `unpin`. A download started offline pins on the next
  successful resolve.

## Screens

- `apps/mobile/src/screens/player/FullPlayerScreen.tsx`: replace
  `currentItem?.item_description?.value` with `useItemDescription(currentItem)`.
  `fullPlayerSummaryPreview.ts` keeps building the collapsed preview from the resolved HTML.
  While only the preview is known, show it; do not show an empty Summary.
- `EpisodeDetailScreen`: while the detail fetch is in flight, the collapsed text comes from the
  cached payload's preview.

## Truncation notice — `apps/mobile/src/components/content/DescriptionText.tsx`

Add an optional prop:

```ts
truncation?: { kind: 'item' | 'channel'; linkUrl: string | null };
```

Render it after the prose when the text is expanded, or when it is short enough that no **Show
More** appears. Never inside the collapsed preview.

- Item Summary (episode, track, livestream, clip, full player): with a valid `http(s)` link, a
  pressable labeled `info.truncation.read_full_show_notes` that opens the link the same way
  `DescriptionText` opens body links. Without a link, the sentence
  `info.truncation.show_notes_shortened`.
- Channel About (`channelAboutCells.ts`, `ChannelAboutSection.tsx`): the sentence
  `info.truncation.description_shortened` only. The website link is already in mobile About,
  just below.
- `accessibilityRole="link"` and an accessible label from the visible text
  (**screen-reader-accessibility**). Spacing uses the existing prose gap token
  (**even-content-spacing**).

## Rule update — `.cursor/rules/about-summary-web-mobile-alignment.mdc`

Add a **Shortened notes** row to the placement table. Web: a link after the prose, to the item
link (Summary) or the website (About). Mobile Summary: the same link after the expanded prose.
Mobile About: the sentence only, because the website link is already in About. Add one line:
rows read the stored `preview`, and the full notes load on detail.

## Tests

Unit (`npm --prefix apps/mobile run test`):

- `resolveItemDescription`: payload wins; cache is used when the payload lacks a value; the
  network result is written to the cache; offline with no cache falls back to the preview; and
  an Add-by-RSS item never calls the network.
- Cache eviction keeps pinned rows and the newest 200 unpinned rows.
- Migration: the new version creates the table on a database at the previous version.

Maestro: new `apps/mobile/e2e/show-notes.yaml` (**mobile-maestro-timeouts**,
**mobile-e2e-screenshots**):

1. Open the seeded podcast, then **E2E Long Show Notes**.
2. Summary shows the seeded heading. Tap **Show More**. **Read Full Show Notes** is visible.
3. Play the episode and open the full player. The Summary sheet shows the heading.
4. Screenshot each step.

## Scratchpad

Append to `release-notes/scratchpad.md`:

```markdown
## Mobile loads full show notes on demand and keeps them offline

- Surfaces: mobile
- Change: List rows use a short stored preview. The full player loads show notes from a small
  on-device cache that warms when an episode starts playing and is kept for downloaded
  episodes, so notes are available offline. Summary shows "Read Full Show Notes" when Podverse
  shortened the notes. New SQLite table item_description_cache.
- Who notices: mobile listeners, especially offline with downloads
```

## Done when

- The full player shows notes for an item whose payload has no `value`.
- A downloaded episode shows its notes in airplane mode.
- No new DTO field is required on read.
- Code comments must not cite this plan or any plan number.

## Operator verification

**Mobile**

```bash
npm run type-check:mobile
npm --prefix apps/mobile run test
```

**Mobile Maestro**: **Mobile E2E Metro**, **Mobile E2E API**, **Mobile E2E test-assets**, and
**Mobile E2E iOS** / **Mobile E2E Android** must already be running. Seed first with
`make mobile_e2e_seed` in **Mobile**.

```bash
npm run mobile:e2e:test -- show-notes
open .artifacts/mobile-e2e-reports/latest/failures.json
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
```
