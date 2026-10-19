# Execution order

Decisions: [00-SUMMARY.md](./00-SUMMARY.md). Prompts: [COPY-PASTA.md](./COPY-PASTA.md).

## Before phase 1

- `removed-content-references` is finished and committed. This set calls
  `convertArchivedShowFollows`, `captureRemovedReferences`, and the archived-show 410 path.
- Use the next unused app migration number. 0018 belongs to that earlier set, so this set is
  `0019_account_content_log.sql` unless the tree already moved on.
- Do not start while `archived-content-slimming` or `removed-content-references` is still
  editing `archiver.ts`.

## Phases

| Phase | Prompts | Wait for |
| --- | --- | --- |
| 1 | 01 schema, DTO, copy | Section above |
| 2 | 02 retire detection, 03 batched pending archive | Phase 1. 02 and 03 can run at the same time |
| 3 | 04 log writes, follow end, purge | Phase 2 |
| 4 | 05 API, OpenAPI, seed fixture | Phase 3 |
| 5 | 06 web, 07 mobile | Phase 4. 06 and 07 can run at the same time |

The fixture is in 05 so 06 and 07 do not edit the same seed files.

## File ownership

| Prompt | Owns | Must not edit |
| --- | --- | --- |
| 01 | Next migration, regenerated `0004`/`0005` gz, both readiness markers; `podcastIndexDeadFeedSync` entity plus `last_retire_eligible_count`; new `account_content_log` entity and ORM export; `packages/helpers` DTO; consumer and mobile catalog originals in en-US, es, fr, el-GR | Services, workers, API, web, mobile screens |
| 02 | `flagAndMerge.ts`; a pure helper next to `deadFeedDuplicateChains.ts` and its test; `addRecentlyUpdatedFeedsFromPodcastIndex.ts`; workers config, `validation.ts`, `ENV.md`, `.env.example`, `infra/k8s/base/workers/source/workers.env`; the existing worker-command description | `archiver.ts`, the log service, catalogs, API, UI |
| 03 | `processPendingArchiveFeeds` in `archiver.ts` and the matching `archiver.test.ts` cases | `archiveAll` order, follow conversion, takedown, flag-and-merge |
| 04 | New `accountContentLog.ts` service and unit test; follow-conversion and takedown hooks; end-remaining-follows step in `archiveAll`; purge command, registry, startup category, cron, retention env | `processPendingArchiveFeeds`, catalogs, API routes, UI, seed |
| 05 | `GET /account/content-log`, OpenAPI, API integration test, `helpers-requests` client; one seed row in `tools/web/seed-e2e.mjs` and both seed-constant files | Catalogs, web UI, mobile UI, workers |
| 06 | Settings `advanced` tab and panel; `e2e/removed-content-log.spec.ts` | Catalogs, seed, mobile, API |
| 07 | More Advanced row, `MoreRemovedContentScreen`, navigation route; signed-in skip in `directoryChannelGone.ts`; `apps/mobile/e2e/removed-content-log.yaml`; `removed-content-log` in `flow_needs_e2e_api` | Catalogs, seed, web, API |

Every prompt appends its own entry to `release-notes/scratchpad.md`. Comments in product code
describe the code as it stands and do not cite a plan or a step number.

## Rollout (operator)

Base env stays `PODCAST_INDEX_DEAD_FEED_RETIRE_MODE=off`. On alpha workers only:

1. Set `dry_run`. The next hourly run downloads the CSV, logs the eligible count, and stores
   `last_retire_eligible_count`. It changes no lifecycle.
2. Read that count. A jump that looks wrong stays on `dry_run`.
3. Set `apply`. Each hour retires at most 200 feeds. `archiveAll` (06:00 and 18:00 UTC)
   archives them in batches.
4. A later jump above the brake retires nothing and does not move the stored count. One
   `dry_run` accepts the new count. Then set `apply` again.

`PODCAST_INDEX_DUPLICATE_MERGE_MODE` is not part of this rollout.

Push `infra/k8s/` changes to the Argo CD tracked branch so alpha picks up the migration
marker, the new cron, and the env keys.
