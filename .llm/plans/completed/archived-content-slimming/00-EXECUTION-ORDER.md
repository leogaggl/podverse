# Execution order

Decisions: [00-SUMMARY.md](./00-SUMMARY.md). Prompts: [COPY-PASTA.md](./COPY-PASTA.md).

## Before phase 1

- `feed-description-tiers` 01 (helpers) and 03 (schema with `preview`, `is_truncated`,
  `source_length`) are merged. This set reuses them.
- Its backfill does not have to have run. Slimming computes a preview from `value` when
  `preview` is null.
- Use the next unused app migration number (0017 unless taken). Never reuse a number.

## Phases

| Phase | Prompts | Wait for |
| --- | --- | --- |
| 1 | 01 schema and markers | Section above |
| 2 | 02 slimming pass, parser reversal, report command | Phase 1 |
| 3 | 03 seed, surfaces, E2E | Phase 2 |

## File ownership

| Prompt | Owns | Must not edit |
| --- | --- | --- |
| 01 | `0017_archived_slimming.sql`, regenerated `0004`/`0005` gz, `api.env` and `ops/kustomization.yaml` markers, `archived_slimmed_at` on the `item` and `channel` entities | Services, parser |
| 02 | New `packages/orm/src/services/archivedSlimming.ts` and its test; `archiver.ts` (call order, shared channel cleanup list); `archiver.test.ts`; `ItemService.update` marker clear; parser channel handler marker clear; `buildArchivedDescriptionValue` in `packages/helpers/src/lib/descriptionPreview.ts`; workers report command, registry, startup categories; one API integration test | Web, mobile, seed |
| 03 | `tools/web/seed-e2e.mjs` archived fixture; web and mobile seed constant files; any web or mobile chip that renders when empty; new web E2E spec; new Maestro flow | ORM services, parser |

Every prompt appends its own entry to `release-notes/scratchpad.md`.

## Rollout (operator)

1. Deploy. The API waits for the new migration marker.
2. Run the report once. It reads only, from the read replica.
3. Let `archiveAll` run. Each run slims up to 20,000 episodes and 200 shows.
4. Rerun the report. Unslimmed counts fall toward zero; removable bytes fall with them.

Push `infra/k8s/` changes to the Argo CD tracked branch so alpha picks up the marker.
