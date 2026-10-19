# Execution order

Decisions: [00-SUMMARY.md](./00-SUMMARY.md). Prompts: [COPY-PASTA.md](./COPY-PASTA.md).

## Before phase 1

- `archived-content-slimming` is finished and committed. Both sets edit `archiver.ts` and
  `archiver.test.ts`.
- Use the next unused app migration number (0018 unless taken).
- This set does not need `feed-description-tiers` 09.

## Phases

| Phase | Prompts | Wait for |
| --- | --- | --- |
| 1 | 01 schema, entities, DTOs | Section above |
| 2 | 02 snapshot capture, takedown, clip and playlist API, copy | Phase 1 |
| 3 | 03 follow conversion, archived 410, empty show deletion, seed | Phase 2 |
| 4 | 04 web, 05 mobile | Phase 3 |

## File ownership

| Prompt | Owns | Must not edit |
| --- | --- | --- |
| 01 | `0018_removed_content_references.sql`, regenerated `0004`/`0005` gz, both readiness markers; `clip`, `playlistResource`, `channel` entities; new `packages/helpers/src/dtos/removedSource.ts`; clip and playlist resource DTO fields | Services, API, UI |
| 02 | New `packages/orm/src/services/removedReferences.ts`; new `packages/helpers/src/lib/removedSource.ts` (`isRemovedSource`); `archiver.ts` takedown path; `queueResourceActiveItemFilter.ts`; clip and playlist services; apps/api clip and playlist controllers, routes, `openapi.yml`; consumer and mobile catalog originals; integration tests | Follow conversion, web, mobile, seed |
| 03 | New `archivedFollowConversion.ts`, `archivedChannelCleanup.ts`; `archiver.ts` `archiveAll` order; workers `feedProbe.ts` and `archiveAll` wiring; optional `maxBodyBytes` in `fetchWithTimeout`; channel episode list controller; `DTOChannelGone`; `openapi.yml` for that endpoint; management `feedFlagStatusAppDb.ts` left join; `tools/web/seed-e2e.mjs` and both seed constant files; integration tests | Clip and playlist code, web, mobile |
| 04 | apps/web clip rows, clip page, playlist rows, channel page archived notice, Add-by-RSS cache fill for a server-added follow, new web E2E spec | Catalog, seed, mobile, API |
| 05 | apps/mobile row mappers, `ClipDetailScreen`, playlist detail rows, `directoryChannelGone.ts`, Add-by-RSS refresh for a server-added follow, new Maestro flow | Catalog, seed, web, API |

Every prompt appends its own entry to `release-notes/scratchpad.md`.

## Rollout (operator)

1. Deploy. The API waits for the new migration marker.
2. The next `archiveAll` converts follows for shows already archived, up to 100 shows per run,
   then deletes empty shows. Watch the worker log for the counts.
3. No backfill is needed for clips. Nothing was taken down under the new code yet, and clips
   already lost to past takedowns cannot be recovered.

Push `infra/k8s/` changes to the Argo CD tracked branch so alpha picks up the marker.
