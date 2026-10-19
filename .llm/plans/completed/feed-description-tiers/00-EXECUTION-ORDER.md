# Execution order

Decisions: [00-SUMMARY.md](./00-SUMMARY.md). Prompts: [COPY-PASTA.md](./COPY-PASTA.md).

Phases run in order. Wait for every prompt in a phase to finish before the next phase. Prompts
in the same phase do not share files and may run at the same time.

## Before phase 1

`pi-duplicate-feed-merge` is finished. This set already used app migration `0016`. Later sets
take the next unused migration number and the next unused SQLite version in `migrations.ts`.
Never reuse a number.

## Phases

| Phase | Prompts | Wait for |
| --- | --- | --- |
| 1 | 01 ingest helpers, 02 Partytime raw description | Section above |
| 2 | 03 schema, ORM, and DTO fields | Phase 1 |
| 3 | 04 parser and workers, 05 management tier controls, 06 API contract | Phase 2 |
| 4 | 07 web, 08 mobile | Phase 3 |
| 5 | 09 narrow list payloads | Phases 1–4, which are already done |

01 and 02 are in different repos. parser-mapping keeps its own copy of the Partytime types
(`packages/parser-mapping/src/types/partytime.ts`), so 04 adds `descriptionRaw` there and
compiles without the new Partytime release. The release and the Podverse bump (end of 02) must
land before phase 3 deploys. Until then `descriptionRaw` is absent and the parser falls back to
`description`.

Phase 5 lands in the same alpha deploy as phases 1–4. Prompts 01–08 are done. Run 09 next.
There is no store-build wait: nobody is testing alpha, and the app database can be wiped. A
phone with a cached list row from before this release still has `value`;
`getDescriptionPreviewText` covers that row.

## File ownership

| Prompt | Owns | Must not edit |
| --- | --- | --- |
| 01 | `packages/helpers/src/lib/descriptionDocument.ts` (lenient builder, serializer, shared allowlist), new `descriptionLimits.ts`, `descriptionIngest.ts`, `descriptionPreview.ts`, their tests, helpers `index.ts` exports | DTOs, parser-mapping, renderers |
| 02 | Partytime `src/parser/item.ts`, `feed.ts`, `types.ts`, tests, `release-notes/5.2.0.md` | Anything in the Podverse repo |
| 03 | `0016_description_length_tiers.sql`, regenerated `0004`/`0005` gz, `api.env` and `ops/kustomization.yaml` markers, ORM entities `feed`, `itemDescription`, `channelDescription`, helpers DTOs for item description, channel description, and feed, new `feedForceReparseScheduler.ts`, ORM `index.ts` exports | Parser, routes, clients |
| 04 | parser-mapping `compat/partytime/item.ts`, `channel.ts`, `compatFull.ts`; parser description handlers, item and channel handler threading, `parser.ts` telemetry write; ORM description services; workers `runDue.ts` handler, `parseFeed.ts` option, backfill command, command registry, startup categories, suspended backfill CronJob and its kustomization entry | management-api, apps/api, clients |
| 05 | management-api `routes/feeds.ts`, `schemas/feedOperationsPolicy.ts`, `lib/feed/feedFlagStatusAppDb.ts`, `lib/database/tablePolicy.ts`, `openapi.yml`, feeds integration test; `packages/management-api-requests/src/feeds.ts`; management-web flag-status page; management catalog originals; `feeds-flag-status.spec.ts` | apps/api, parser, consumer catalog |
| 06 | apps/api item routes and controller, `apps/api/openapi.yml`, item integration test; new `packages/helpers/src/dtos/item/itemDescriptionDetail.ts` and its DTO export; helpers-requests item description request; consumer catalog originals; `tools/web/seed-e2e.mjs` truncated fixture | Web, mobile, management |
| 07 | apps/web list rows, new `DescriptionTruncationNotice.tsx`, `CoreEpisodeSummary`, `LivestreamSummary`, `ContentAboutDescription` and their callers, Add-by-RSS pages, new `episode-show-notes.spec.ts` | Catalog, seed, mobile |
| 08 | apps/mobile `homeRowMappers.ts`, `homeFeedData.ts`, `DescriptionText.tsx`, channel About cells, full player, detail screens, SQLite migration and schema, `itemDescriptionCacheRepository.ts`, `resolveItemDescription.ts` and its hook, `downloadManager.ts` pin and unpin, new `show-notes.yaml`, `about-summary-web-mobile-alignment.mdc` | Catalog, seed, web, API |
| 09 | ORM `select: false` on `value`, item and channel services, API detail and description reads, DTO `value` optional, reader fixes on every surface, seed previews, `apps/api/openapi.yml` | — |

Every prompt appends its own entry to `release-notes/scratchpad.md`. Append only; never rewrite
another entry.

## Rollout (operator, when this set deploys to alpha)

Deploy the whole set together, after 09 is in the tree. The API, workers, and web ship with
migration `0016`, the preview fields, and list responses that omit `value`. Install a mobile
binary that includes 08 on any phone pointed at alpha. Nobody is already on an older alpha
binary.

1. Confirm Podverse is on `podverse-partytime` 5.2.0 (end of 02). Deploy. The API init
   container waits for `0016_description_length_tiers.sql`.
2. Repair stored rows, or wipe the app database and let parses fill them again. The base
   CronJob is suspended, so a repair runs by hand. The command is in 04. It re-sanitizes
   stored rows, then schedules reparses for at most 200 feeds, each `run_after` 60 seconds
   apart so one cron pass never claims a burst. A wipe skips the repair.
3. In management **Flag Status**, filter **Shortened Descriptions Only**. Open the
   Podcasting 2.0 feed that started this. If the suggested tier is above Standard, apply it.
   Within about 10 minutes, confirm full notes in the web episode page and the mobile full
   player.
4. When the repair was used, rerun it until it reports no feeds left to schedule. It is
   idempotent.

Push `infra/k8s/` changes to the Argo CD tracked branch so alpha syncs the new CronJob and the
migration marker.
