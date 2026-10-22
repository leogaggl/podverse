# Lint fix failures

## Request

debug

`npm run lint:fix` on branch `feature/mobile-app-init-34` failed. The log's own summary:

```text
--- Lint summary ---
i18n:compile: passed
Type-check: failed (175 TS error(s))
Lint:      failed (1 error(s), 0 warning(s))
Prettier:  passed
```

Workspace `lint:fix` runs completed. The one lint error:

```text
/Users/mitcheldowney/repos/pv/podverse/apps/mobile/src/screens/home/addByRss/useAddByRssFeedCheck.ts
  131:11  error  Unsafe usage of ReturnStatement  no-unsafe-finally
```

Type-check failed in `@podverse/parser`, `@podverse/api`, `@podverse/web`, and mobile. The same parser, api, and web errors are printed again in the type-check summary. The web `.next` module-not-found errors are printed three times (`.next/dev/types`, `.next/types/app/...`, `.next/types/validator.ts`).

Parser:

```text
src/lib/rss/liveItem/channelLiveItemFlag.ts(8,26): error TS2344: Type '"id" | "may_have_live_items" | "medium_id"' does not satisfy the constraint 'keyof Channel'.
  Type '"may_have_live_items"' is not assignable to type 'keyof Channel'.
src/lib/rss/liveItem/channelLiveItemFlag.ts(16,5): error TS2353: Object literal may only specify known properties, and 'may_have_live_items' does not exist in type 'ChannelDto'.
src/lib/rss/liveItem/liveItem.ts(136,37): error TS2345: Argument of type 'Channel' is not assignable to parameter of type 'Pick<Channel, "id" | "may_have_live_items" | "medium_id">'.
  Property 'may_have_live_items' is missing in type 'Channel' but required in type 'Pick<Channel, "id" | "may_have_live_items" | "medium_id">'.
```

API:

```text
src/controllers/liveItem.ts(11,15): error TS2305: Module '"@podverse/helpers"' has no exported member 'ChannelLiveItemSortKey'.
src/controllers/liveItem.ts(13,3): error TS2305: Module '"@podverse/helpers"' has no exported member 'compareChannelLiveItems'.
src/controllers/liveItem.ts(137,59): error TS2339: Property 'getManyUpcomingLiveItems' does not exist on type 'ItemService'.
src/controllers/liveItem.ts(174,63): error TS2339: Property 'getManyUpcomingLiveItems' does not exist on type 'ItemService'.
```

Web, source (the `.next` errors are the generated-type block below):

```text
src/app/_media-lists/livestreams/livestreamsListSsr.ts(36,32): error TS2551: Property 'reqLiveItemGetManyUpcoming' does not exist on type 'ApiRequestService'. Did you mean 'reqLiveItemGetMany'?
src/app/_media-lists/livestreams/LivestreamsPageContext.tsx(77,55): error TS2551: Property 'reqLiveItemGetManyUpcoming' does not exist on type 'ApiRequestService'. Did you mean 'reqLiveItemGetMany'?
src/utils/addByRSS/channelLiveItems.ts(1,15): error TS2305: Module '"@podverse/helpers"' has no exported member 'ChannelLiveItemSortKey'.
src/utils/addByRSS/channelLiveItems.ts(3,3): error TS2305: Module '"@podverse/helpers"' has no exported member 'compareChannelLiveItems'.
```

Web, generated `.next` types. Each of these is `TS2307` Cannot find module `.../page.js`, and the matching `validator.ts` line is `TS2344` `__InvalidParamMatchingKeys` does not satisfy `never`. Routes named in the log:

- `src/app/add-by-rss/[resource]/page.js`
- `src/app/add-by-rss/albums/page.js`
- `src/app/add-by-rss/artists/page.js`
- `src/app/add-by-rss/episodes/page.js`
- `src/app/add-by-rss/music/livestream/page.js`
- `src/app/add-by-rss/podcast/livestream/page.js`
- `src/app/add-by-rss/podcasts/page.js`
- `src/app/add-by-rss/tracks/page.js`
- `src/app/albums/page.js`
- `src/app/artists/page.js`
- `src/app/clips/page.js`
- `src/app/episodes/page.js`
- `src/app/music/livestreams/page.js`
- `src/app/podcasts/livestreams/page.js`
- `src/app/podcasts/page.js`
- `src/app/tracks/page.js`

Mobile:

```text
src/data/repositories/homeLivestreamsCacheRepository.ts(76,11): error TS2551: Property 'reqLiveItemGetManyUpcoming' does not exist on type 'ApiRequestService'. Did you mean 'reqLiveItemGetMany'?
src/lib/addByRss/liveRows.ts(1,15): error TS2305: Module '"@podverse/helpers"' has no exported member 'ChannelLiveItemSortKey'.
src/lib/addByRss/liveRows.ts(3,3): error TS2305: Module '"@podverse/helpers"' has no exported member 'compareChannelLiveItems'.
src/lib/addByRss/localResourceData.test.ts(126,7): error TS2741: Property 'guid' is missing in type '{ duration: number; enclosure: { length: number; type: string; url: string; }; explicit: false; pubDate: Date; title: string; }' but required in type 'Episode'.
src/screens/browse/browseFeedData.ts(121,11): error TS2551: Property 'reqLiveItemGetManyUpcoming' does not exist on type 'ApiRequestService'. Did you mean 'reqLiveItemGetMany'?
```

Packages that type-checked clean in that same run include `@podverse/helpers`, `@podverse/orm`, `@podverse/helpers-requests`, `@podverse/parser-mapping`, and `@podverse/workers`.

## Operator answers

None. No product question was open before planning.

### Review of the first planning pass

The operator kept all five planner decisions as written ("Keep all five planner decisions as
written"). Nothing in the plans changes, so there is no second pass.

- **D1** (plan 10): when a package `dist/` is out of date, the lint runner skips type-check and
  names `npm run build:packages`. It does not build packages itself.
- **D2** (plan 11): web `type-check` uses a source-only `tsconfig.type-check.json`.
- **D3** (plan 11): `apps/management-web` gets the same source-only config.
- **D4** (plan 12): the failed-workspace reprint stays, and the lint summary counts each error once.
- **D5** (plan 10): `scripts/ci/lint-changed.mjs` gets no freshness check.

## Glossary

None.

## Orientation

Facts checked in this tree before the planning run. Confirm them; do not treat them as the fix.

- `ChannelLiveItemSortKey` and `compareChannelLiveItems` are defined in `packages/helpers/src/lib/liveItemVisibility.ts` and re-exported from `packages/helpers/src/index.ts` (`export * from './lib/liveItemVisibility.js'`). A search of `packages/helpers/dist` found neither name.
- `may_have_live_items` is on `packages/orm/src/entities/channel/channel.ts`, `packages/orm/src/services/channel/channel.ts`, and `packages/helpers/src/dtos/channel/channel.ts`. Parser reads it in `packages/parser/src/lib/rss/liveItem/channelLiveItemFlag.ts`. A search of `packages/orm/dist` found neither `may_have_live_items` nor `getManyUpcomingLiveItems`.
- `ItemService.getManyUpcomingLiveItems` is in `packages/orm/src/services/item/item.ts`. API calls it from `apps/api/src/controllers/liveItem.ts`.
- `reqLiveItemGetManyUpcoming` is in `packages/helpers-requests/src/api/liveItem/liveItem.ts` and on `ApiRequestService` in `packages/helpers-requests/src/api/_request.ts`. A search of `packages/helpers-requests/dist` found no matches. Callers: `apps/web/src/app/_media-lists/livestreams/livestreamsListSsr.ts`, `apps/web/src/app/_media-lists/livestreams/LivestreamsPageContext.tsx`, `apps/mobile/src/data/repositories/homeLivestreamsCacheRepository.ts`, `apps/mobile/src/screens/browse/browseFeedData.ts`.
- The lint `return` is inside the `finally` of `checkFeed` in `apps/mobile/src/screens/home/addByRss/useAddByRssFeedCheck.ts` (around the `isMountedRef` check before `setIsChecking(false)`).
- The missing `guid` is the second item in `guidlessFeed` inside `describe('addByRssEpisodeItemKey')` in `apps/mobile/src/lib/addByRss/localResourceData.test.ts`. That item is titled `No Guid`. The following test expects a guidless item matched by enclosure to return the index `'1'`.
