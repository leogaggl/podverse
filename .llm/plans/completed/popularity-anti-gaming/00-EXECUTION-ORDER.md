# Popularity anti-gaming — execution order

Prompts and models: [COPY-PASTA.md](./COPY-PASTA.md). Request and settled review answers:
[00-REQUEST.md](./00-REQUEST.md). Ledger and areas: [00-SUMMARY.md](./00-SUMMARY.md).

Phases run in order. Prompts inside a phase run at once, and they share no file. In a phase with
several prompts, each prompt puts its release-notes entry in its final message instead of writing
`release-notes/scratchpad.md`; a later single-prompt phase appends those entries.

Docker must be running from Phase 3 on: plans 11, 14, 30, and 40 each add a linear migration and
regenerate the baseline archives with `make db_regen_linear_baseline`.

## Order and why

| Phase | Plans | Runs after | Why this phase |
| --- | --- | --- | --- |
| 1 | 20 | none | Renames the opt-in to Taste Profile; every later plan is written against its names, paths, and env keys |
| 2 | 10, 13 | 20 | 10 adds the 20-second floor and `too_soon`; 13 writes the legal copy for every new limit. Disjoint files |
| 3 | 11 | 10 | Two daily listen caps and `stats_listen_event.popularity_counted` (migration `0027_`), on 10's write path |
| 4 | 12 | 11 | Daily open cap, on the same API config, env files, OpenAPI, and tests as 11 |
| 5 | 14 | 12 | Opt-out cooldown and kept listener id (migration `0028_`), on the write-path files 10–12 leave |
| 6 | 30 | 14 | Auto-flagging and exclusion (migration `0029_`), on the code 14 leaves |
| 7 | 31, 33 | 30 (33 also 13) | 31 is the management API over 30's tables; 33 is legal copy. Disjoint files |
| 8 | 32, 40, 42 | 31; 14 and 30; 13, 14, 33 | 32 is the management web page; 40 is all-time recounting (migration `0030_`); 42 is legal copy. Disjoint files |
| 9 | 41 | 40 | Day, week, and month windows from events; closes the set |

Migration numbers on `feature/combined`: the last app migration is `0026_drop_legacy_stats.sql`.
Plan 11 takes `0027_`, 14 `0028_`, 30 `0029_`, 40 `0030_`. Each moves the readiness marker in
`infra/k8s/base/api/source/api.env` and `infra/k8s/base/ops/kustomization.yaml`; these are
serialized because no two of them share a phase.

## Files each prompt owns in shared phases

### Phase 2

- **10:** `packages/helpers/src/lib/popularityListen.ts`, `statsListenWrite.ts`,
  `apps/api/src/controllers/stats/statsListen.ts`, the API config, startup validation, env files
  (`apps/api/.env.example`, `apps/api/ENV.md`, `infra/k8s/base/api/source/api.env`,
  `dev/env-overrides/local/rate-limit.env.example`, `scripts/local-env/setup.sh`),
  `apps/api/openapi.yml`, `docs/features/POPULARITY-AND-TASTE-PROFILE.md`,
  `apps/api/src/test/stats-listen-write.integration.test.ts`, `apps/api/src/test/stats.track.test.ts`.
- **13:** `apps/api/legal/taste-profile-agreement/{en-US,es,fr,el-GR}.md` and
  `apps/api/legal/terms/{en-US,es,fr,el-GR}.md`.

### Phase 7

- **31:** `apps/management-api/src/{schemas,lib/stats,routes}/…flaggedListeners…`,
  `apps/management-api/src/routes/stats.ts`, `apps/management-api/src/lib/database/tablePolicy.test.ts`,
  `apps/management-api/openapi.yml`, `packages/management-api-requests/src/stats.ts`,
  `.cursor/rules/popularity-listener-id-separation.mdc`, `docs/features/POPULARITY-AND-TASTE-PROFILE.md`.
- **33:** the eight legal Markdown files listed under Phase 2's plan 13.

### Phase 8

- **32:** `apps/management-web/src/lib/routes.ts`, `apps/management-web/src/lib/managementPermissions.ts`,
  `apps/management-web/src/app/(management)/stats/StatsPageClient.tsx`, the new
  `apps/management-web/src/app/(management)/stats/flagged-listeners/` files,
  `packages/i18n-catalog/management/originals/{en-US,es,fr,el-GR}.json`,
  `apps/management-web/e2e/stats-flagged-listeners.spec.ts`, `apps/management-web/e2e/stats-page.spec.ts`.
- **40:** migration `0030_stats_all_time_recount.sql`, `infra/k8s/base/ops/kustomization.yaml`,
  `infra/k8s/base/api/source/api.env`, the two baseline archives, the stats event and daily
  entities, `statsListenWrite.ts`, `statsOpenWrite.ts`, `applyChannelMerge.ts`,
  `popularityListen.ts`, the API config, startup validation, `.env.example`, `ENV.md`,
  `docs/features/POPULARITY-AND-TASTE-PROFILE.md`, and the listen-write, channel-merge, and
  test-env-startup tests.
- **42:** the eight legal Markdown files listed under Phase 2's plan 13.

## Release scratchpad

- Append their own entry: 20, 12, 14, 30.
- Put the entry in the final message: 10, 13 (Phase 2), 31, 33 (Phase 7), 32, 40, 42 (Phase 8).
- 11 appends 10's and 13's entries, then its own.
- 41 appends 31's, 33's, 32's, 40's, and 42's entries, then its own.

Final messages are in `.artifacts/plan-runner/popularity-anti-gaming/<NN>.md`.
