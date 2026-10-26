# Request: browse responsiveness, mobile pagination, livestream order

## Request

On the website, when I click the tracks chip on the browse page, it took a very long time before
the track took the active state. I think it's because when the 60 rows loaded, some of them had
very large images, and some even had GIFs. For cases like this, we want to make sure that the
loading of this content, which may be third-party content remotely hosted on someone else's
server, does not block the UI behavior and make the UI itself slow so that clicking the tracks
button should be immediate. And we want the best user experience around that.

Also, on the mobile app, pagination does not seem to be working on browse. Make sure that when you
scroll near the bottom, we have an auto pagination, infinite scroll sort of behavior. Check which
screens may lack that currently.

The live stream sorting for live on web at least is returning in the wrong order because we can
see that it is an ascending date going back from 2024 to 2026. The live grouping should be in
descending with the most recent content near the top.

Confirm that mobile also displays live streams correctly.

I'm unsure if this is something that the back end simply has to return in the correct order or if
it gets sorted on the front end.

## Operator answers

- **Scheduled (pending) livestream order:** soonest upcoming start first. The Live now group sorts
  newest start first, as the request says.
- **Scheduled items whose start time is long past** (for example still pending from 2024): hide
  scheduled items whose start time is more than a set window in the past. The planner proposes the
  window and records it as a decision.
- **Remote image scope:** client only. The chip switches to active immediately; images lazy-load
  and decode asynchronously in fixed-size slots so they cannot block input or shift layout. No
  server-side image proxy or resize, and animated GIFs are not converted to stills.
- **Mobile infinite scroll scope:** Browse plus every other mobile list backed by a paginated API
  that lacks auto-pagination near the bottom. The plan lists which screens it found and fixes them.

### Review of the first planning pass

Answers to D1–D15 in `00-SUMMARY.md` § Decisions to review. Keep means the planner's choice stands.

- **D1 (plan 10) — change.** While the new list loads, hide the old rows and show a spinner in the
  list area. On click the active chip takes its selected state immediately. The chip row must not
  jump or move horizontally. Do not leave the old list visible under a transparent spinner, and do
  not replace the chip row with a skeleton. Operator: "hide the old rows, show a spinner, and on
  click the active chip should immediately take on its selected state. the chip row horizontally
  should not jump or move if it doesn't need to."
- **D2 (plan 10) — keep.** The last chip clicked wins, including going back to the starting chip.
- **D3 (plan 20) — keep.** Hide scheduled items 24 hours after their start.
- **D4 (plan 20) — keep.** Live items stay listed with no time window; the oldest sink to the
  bottom of the Live group.
- **D5 (plans 20, 21, 22) — keep.** The 24-hour window applies on every list that shows scheduled
  items, including channel livestream lists and `liveItemType=pending` lists.
- **D6 (plan 20) — keep.** Channel livestream lists show the soonest scheduled start first.
- **D7 (plans 20, 21, 22) — keep.** A scheduled Add by RSS item with no start time stays listed and
  sorts last.
- **D8 (plan 38) — keep.** Home Clips and Home Livestreams save each new page on the device, and
  Home re-reads that storage.
- **D9 (plan 38) — change.** Remove A-Z from clip lists on the API, web, and mobile. Clips defaults
  to Recent. A saved A-Z preference for clips falls back to Recent. Podcasts, episodes, and
  channels keep A-Z. This replaces the plan 38 choice that Home Clips A-Z stays on the first page.
  Operator: "Clips should never have an A-Z sorting. this should not even be an option in the api,
  web, or mobile, or anywhere." Confirmed option: remove A-Z from clip lists everywhere; Clips
  defaults to Recent.
- **D10 (plan 38) — keep.** A background sync resets Home's saved list to page 1.
- **D11 (plan 32) — clarify.** While a title filter is typed, do not auto-load. Show More appears
  only when the feed still has another page and is hidden once the feed is fully loaded.
  Operator: "Show More button should appear but only if there are more expected." Plan 32 already
  shows the button only when `hasMore` is true, so it needs no behavior change.
- **D12 (plan 36) — keep.** History re-fetches every page already shown when the queue changes.
- **D13 (plan 31) — keep.** Browse livestream pages are appended in the server's order; an item
  that appears twice keeps its first position.
- **D14 (plans 32–34) — keep.** Show More buttons become an automatic loading row. A failed page
  shows Retry under the rows already shown, and Retry reloads that page. The D11 exception for a
  typed title filter stays.
- **D15 (plan 30) — keep.** Taste Profile keeps its Load More buttons. Profile stays at one page
  per section.

### Review of the second planning pass

Answers to the choices Close listed after steps 05 and 06. Keep means the written plan stands.

- **Chip row (plan 10) — keep.** When the new list arrives, rebuild the chip row and restore its
  sideways scroll and keyboard focus. Do not switch to one shared chip frame that never rebuilds.
- **Plan 10 loading details — keep all five.** While a list loads, Sort, Category, and the gear
  keep their space but are hidden and cannot be used. A chip cut off at the row's edge slides
  fully into view once, when clicked. The row's sideways position is remembered for the life of
  the browser tab. The page keeps its vertical scroll on a chip change. Add by RSS and
  Recommendations use the same in-list spinner.
- **Management Stats Title column — keep.** The Stats table keeps its Title sort when the type is
  Clip. No plan. It is an operator column sort on listen counts, not a listener clip-list sort.
- **Three gaps — plan them.** Changing Home Clips between Recent and Popularity refetches page 1
  now and replaces the saved list. A background sync still resets that list to page 1 (D10).
  Sign-out clears the Home clips cache the way it already clears the Home livestreams cache. The
  livestream training script matches the settled order.

## Glossary

- "tracks chip" — the Tracks media-type chip on web Browse (`MediaListChips`).
- "live grouping" / "live stream sorting" — the Livestreams list on Browse (and Home subscribed),
  grouped Live now first, then Scheduled.

## Orientation

- `apps/web/src/app/browse/page.tsx` — web Browse route; switches list clients by chip type,
  including `LivestreamsPageClient` for `livestreams`.
- `apps/web/src/components/MediaListChips/MediaListChips.tsx` — the chip row the request says
  activates slowly.
- `apps/web/src/app/_media-lists/livestreams/` — `livestreamsListSsr.ts` and
  `LivestreamsPageContext.tsx` both call `reqLiveItemGetManyUpcoming`; neither sorts client-side.
- `packages/orm/src/services/item/item.ts` `getManyUpcomingLiveItems` — the order comes from here:
  `live_item_status_id DESC` (Live before Pending), then `start_time ASC`, then `id ASC`. It
  filters on Live and Pending status only, with no start-time window. This is the ascending order
  the request reports.
- `apps/mobile/src/screens/browse/` — `BrowseScreen.tsx`, `browseFeedData.ts`, `browseTypes.ts`:
  mobile Browse, where pagination is reported not to work.
