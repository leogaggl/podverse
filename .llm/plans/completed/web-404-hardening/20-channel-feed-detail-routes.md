**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# Channel and feed detail routes — re-check, no page edits

Re-check of the dynamic channel and feed pages. After plan 10, none of them needs a page edit.
Podcast and album already load the channel through `getChannelForSeoPage`, which plan 10 runs
through `loadOrNotFound`. Artist, the Podcast Index feed page, and takedown notice do not throw
an API 404 when the entity is missing. Their 200-with-null handling, redirects, and metadata
fallbacks stay.

Do not add a second 404 mechanism in these pages.

## Rows

R13, R14, R15, R16, R17, R29, R30, R31, R32

## Runs after

10

## Files

none

## Re-check

Dynamic channel and feed pages under `apps/web/src/app` are only the five below. Embed and Add by
RSS channel pages are area D. There is no `/video/[channel_id]` page.

Plan 10 wraps these fetchers, all in `apps/web/src/lib/seo/fetchers.ts`:
`getChannelForSeoPage`, `getPublisherRemoteItemsForChannelSeoPage`,
`getPodcastIndexFeedForSeoPage`, `getInternalFeedForSeoPage`,
`getChannelByPodcastIndexIdForSeoPage`. This plan does not edit that file.

`loadOrNotFound` maps only axios status 404. A 200 body, including `null` or `{ channel: null }`,
passes through. A 400 or 500 is rethrown.

### `/podcast/[channel_id]` — R14

`apps/web/src/app/podcast/[channel_id]/page.tsx`, default export `PodcastPage`.

- The entity load is `getChannelForSeoPage(channel_id)` (line 116). `GET /channel/:id` answers
  404 through `handleReturnDataOrNotFound` in `ChannelController.getByIdOrIdText` when the row is
  missing or has no `channel_about`. After plan 10 that 404 is `notFound()` inside the fetcher.
  There is no `if (!ssrChannel) notFound()` on the page.
- `generateMetadata` (line 66) try/catches and returns `buildNoindexMetadata()`. Keep that catch.
  It also receives the not-found signal from the cached fetcher and returns the fallback. The page
  body still renders Not Found, because React `cache` memoizes the rejection (plan 10).
- Keep `permanentRedirectIfMerged` and the `public_visible === false` redirect to
  `/podcast-index/feed/:id` (line 117). Keep `enforceCanonicalChannelRoute`.
- `itemList.kind === 'missing'` then `notFound()` (line 167) stays. `loadChannelItemList` turns an
  item-list 404 into `{ kind: 'missing' }`. That 404 still happens when the channel GET succeeded
  and the item list's lifecycle check is takedown (`ItemController.episodeListChannel` in
  `apps/api/src/controllers/item.ts`). The `public_visible` redirect does not cover every takedown
  row (it also requires a Podcast Index id). `kind === 'archived'` (HTTP 410) stays
  `directoryRemoved`. Do not pass the item list, soundbites, live items, or podroll through
  `loadOrNotFound`.
- Soundbites (`reqItemSoundbiteGetManyByChannelIdText`) answer 200 with a list. Live items
  (`reqLiveItemGetManyByChannel`) answer 404 only when the channel is missing or has no
  `channel_about`, which cannot happen after `getChannelForSeoPage` returns. Podroll
  (`reqPodrollGetForChannel`) answers 200. Leave those calls as they are.

### `/album/[channel_id]` — R15

`apps/web/src/app/album/[channel_id]/page.tsx`, default export `AlbumPage`.

Same channel endpoint and the same fetcher as podcast. Unknown id is Not Found via plan 10. No
`if (!ssrChannel) notFound()`.

- `generateMetadata` (line 59) try/catches and returns `{}`. Keep `{}`. Do not switch it to
  `buildNoindexMetadata()`.
- Keep the merged redirect, the `public_visible === false` redirect (line 110), and
  `enforceCanonicalChannelRoute`.
- `itemList.kind === 'missing'` then `notFound()` (line 135) stays, for the same takedown reason
  as podcast. The album list uses `reqItemGetManyByChannelBySeason`, which goes through the same
  `episodeListChannel` guard. `kind === 'archived'` stays `directoryRemoved`.
- Live items and podroll stay unwrapped, same as podcast.

### `/artist/[channel_id]` — R17

`apps/web/src/app/artist/[channel_id]/page.tsx`, default export `ArtistPage`. The old audit missed
this route.

- The entity load is `getPublisherRemoteItemsForChannelSeoPage` (line 79), which calls
  `GET /publisher-feed/channel/:id`. `PublisherFeedController` has no 404.
  `PublisherFeedService.getPublisherFeedRemoteItemsForChannel` returns
  `{ channel: null, verifiedAlbums: [], notYetAddedAlbumRefs: [], tracks: [] }` when the row is
  missing, and the controller sends that as HTTP 200. A bad id string is still 200 with
  `channel: null` (`idOrIdText` is `Joi.string().required()`).
- The page does not treat that null as missing. It passes `response.channel` to
  `enforceCanonicalChannelRoute`, which reads `channel.medium_id`. A null channel throws there.
  The error page stays. Do not add `if (response.channel === null) notFound()`. R31 forbids mapping
  this 200 result to `notFound()` because the page has no missing branch today.
- `generateMetadata` (line 38) try/catches and returns `{}`. A null channel throws inside the try
  (it reads `channel.title`) and the catch returns `{}`. Keep that.
- Keep `permanentRedirectIfMerged` and `enforceCanonicalChannelRoute`.
- Podroll and `loadChannelItemList` stay unwrapped. `kind === 'missing'` is ignored here (only
  `kind === 'archived'` sets `directoryRemoved`). Do not add `notFound()` for that missing list.
  The page entity is the channel, which this list does not decide.

### `/podcast-index/feed/[podcast_index_id]` — R16

`apps/web/src/app/podcast-index/feed/[podcast_index_id]/page.tsx`, default export
`PodcastIndexFeedPage`.

- `getPodcastIndexFeedForSeoPage` calls `GET /external-services/podcast-index/feed/:id`.
  A non-numeric id is 400 (`Joi.number().integer()`). A numeric id whose Podcast Index lookup
  returns null is 500 (`PodcastIndexController.podcastById`). Neither is 404. After plan 10 the
  loader rethrows both, so a bad id still shows the error page. Do not change the API to answer
  404, and do not catch the 500 in the page.
- `if (!ssrFeed) return notFound()` (line 75) stays. It runs when the upstream body is HTTP 200
  and `feed` is absent. That is the page already treating that null as missing (R31). It is not
  an unreachable check after a throwing fetch.
- `getInternalFeedForSeoPage` and `getChannelByPodcastIndexIdForSeoPage` answer 200 with a null
  body when the row is missing (`FeedController.getByPodcastIndexId`,
  `ChannelController.getbyPodcastIndexId`). The page uses optional chaining on both and does not
  call `notFound()` for them. Keep that. The comment above the channel fetch (line 79) stays true.
- `generateMetadata` (line 26) try/catches and returns `{}`, including when `!ssrFeed` inside the
  try. Keep it.
- Keep `permanentRedirectIfMerged` and `redirectToChannelPageByMediumServer` when a parsed channel
  exists and policy allows it.

### `/takedown-notice/[podcast_index_id]` — R17

`apps/web/src/app/takedown-notice/[podcast_index_id]/page.tsx`, default export
`TakedownNoticePage`. The old audit missed this route. The page calls
`ssrApiRequestService.reqFeedGetByPodcastIndexId` directly (line 16). That is the same
`GET /feed/:podcast_index_id` as `getInternalFeedForSeoPage`.

- A missing feed is HTTP 200 with a null body (`FeedController` comment: always 200 on not found).
  `TakedownNoticeClient` already handles null: it redirects to `/` (or to the Podcast Index feed
  when a feed exists but should not stay on this page). The page does not call `notFound()`. Do
  not add it. Do not wrap the call in `loadOrNotFound` (the endpoint never answers 404, so the
  wrap would not change a missing feed). Do not switch the call to `getInternalFeedForSeoPage`
  for its own sake.
- A non-numeric id, or an integer below 1, is 400 from Joi. The page has no try/catch, so that
  400 still shows the error page. Keep that. R5 says a non-404 stays visible.
- `generateMetadata` does not fetch. It returns `buildNoindexMetadata()`. Keep it.
- This page does not call `permanentRedirectIfMerged`. Do not add it.

### Shared helpers this plan does not edit

- `apps/web/src/lib/channel/loadChannelItemList.ts` keeps its own status read. It is the item-list
  boundary (404 → missing, 410 archived → archived, anything else rethrown). Plan 10 left it
  alone. Do not switch it to `getErrorResponseStatus` in this plan.
- `apps/web/src/utils/redirect/permanentRedirectIfMerged.ts` calls `reqIdentityResolve` (200 with
  empty arrays when nothing merged) and, only when a merge exists, `reqChannelGetByIdOrIdText`
  for the survivor. A missing survivor throws. That file is also used by item routes (area C).
  Leave it. Do not wrap the survivor fetch.
- `apps/web/e2e/detail-route-not-found.spec.ts` is plan 10. It already covers an unknown podcast
  id. Album uses the same fetcher. Do not add cases.

## Implementation

Change no files. Do not append a release-notes entry.

Read these and confirm they still match the re-check:

- `PodcastPage` and `generateMetadata` in `apps/web/src/app/podcast/[channel_id]/page.tsx`
- `AlbumPage` and `generateMetadata` in `apps/web/src/app/album/[channel_id]/page.tsx`
- `ArtistPage` and `generateMetadata` in `apps/web/src/app/artist/[channel_id]/page.tsx`
- `PodcastIndexFeedPage` and `generateMetadata` in
  `apps/web/src/app/podcast-index/feed/[podcast_index_id]/page.tsx`
- `TakedownNoticePage` in `apps/web/src/app/takedown-notice/[podcast_index_id]/page.tsx`

If a page no longer matches, stop and report BLOCKED. Do not add `loadOrNotFound`, `notFound()`,
or a try/catch to force an unknown id onto the not-found page.

## Tests

none. No page behavior changes in this plan. Unknown podcast and episode ids are plan 10's spec
`apps/web/e2e/detail-route-not-found.spec.ts`. Do not add artist, album, Podcast Index, or
takedown cases there: artist and takedown are 200 with null, and a bad Podcast Index id is 400
or 500.

## Release scratchpad

none. Plan 10's entry already covers podcast and album showing Not Found for an API 404. Artist,
Podcast Index feed, and takedown notice keep their current missing-id behavior.
