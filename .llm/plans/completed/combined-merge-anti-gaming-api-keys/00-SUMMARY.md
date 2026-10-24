# combined-merge-anti-gaming-api-keys — summary

Merge the two feature branches that are not yet in `feature/combined`, reconcile their linear
migrations, make the whole tree build, lint, and type-check, then run **abcsmoketest** on the
result. The whole set runs through `driver.sh` in this folder, in the `podverse_combined`
worktree, which already has `feature/combined` checked out. COPY-PASTA: `COPY-PASTA.md`.

## Request

> I need you to create a plan that will merge the remaining branches into feature combined that
> have not yet been merged in there. And also, you need to reconcile any SQL file issues, such as
> if the numbers are incorrect.
>
> Then run our new smoke tests ABC process. After you have merged and fixed all the merge
> conflicts and fixed all the linting and type check errors you can find, you are then to run the
> smoke test process. And if you identify problems, you should fix them as you go, but if you run
> into something critical that the operator needs help with, you will let me know.

## Operator answers

- Commit and push `feature/combined` after every step, as the earlier combined-merge run did.
- The abcsmoketest files are committed and pushed to `develop` first; the driver merges
  `origin/develop` into `feature/combined` before the feature branches.
- Last night's open abctestall run is discarded. `.llm/plans/active/abctestall-deferred.md` is
  kept, so smoke failures add to it.

## Requirement ledger

- **R1** "merge the remaining branches into feature combined that have not yet been merged" —
  Plan: 01, 02
- **R2** "reconcile any SQL file issues, such as if the numbers are incorrect" — Plan: § Linear
  migration numbers, 01, 02, 03
- **R3** "fixed all the merge conflicts" — Plan: 02 (01 has none)
- **R4** "fixed all the linting and type check errors you can find" — Plan: 01, 02, 03
- **R5** "run our new smoke tests ABC process" — Plan: `driver.sh` (`./scripts/abctest/run.sh
  smoke`)
- **R6** "if you identify problems, you should fix them as you go" — Plan: § Merge step rules,
  03, and the abcsmoketest runner steps
- **R7** "if you run into something critical that the operator needs help with, you will let me
  know" — Plan: § Deferred file, the smoke run's BLOCKED stop, and the driver's summary

## Branches

Every other feature branch is already an ancestor of `feature/combined`. These two were each cut
from the `feature/combined` tip `e53766df5` and are one commit ahead of it:

| Step | Branch                           | Commit      | Adds                                                     |
| ---- | -------------------------------- | ----------- | -------------------------------------------------------- |
| 01   | `feature/popularity-anti-gaming` | `284b33c35` | 220 files; app migrations `0027`–`0030`; Taste Profile   |
| 02   | `feature/developer-api-keys`     | `9f013f413` | 163 files; app migration `0031`; API key auth and routes |

## Order

Anti-gaming goes first so the app chain stays gapless after every commit: `0027`–`0030` land,
then `0031`. The reverse order would leave `0031` after `0026` with a gap until step 02.

A simulated merge (`git merge-tree`, 2026-10-23) found:

- 01: no textual conflicts.
- 02 (after 01): `.cursor/rules/rule-index.mdc`, `infra/k8s/base/api/source/api.env`,
  `infra/k8s/base/db/source/bootstrap/0004_app_linear_baseline.sql.gz`,
  `infra/k8s/base/ops/kustomization.yaml`, `release-notes/scratchpad.md`,
  `scripts/mobile/e2e-test.sh`. These auto-merge but both sides changed them, so check them
  semantically: `apps/api/openapi.yml`, `apps/management-web/src/lib/managementPermissions.ts`,
  `apps/mobile/src/navigation/index.tsx`, `apps/mobile/src/screens/more/MoreSettingsScreen.tsx`,
  `packages/helpers-requests/src/api/_request.ts`, `packages/helpers/src/dtos/index.ts`,
  `packages/helpers/src/index.ts`, `packages/orm/src/db/entities.ts`, `packages/orm/src/index.ts`,
  the `consumer` and `mobile` i18n catalogs, and `tools/web/seed-e2e.mjs`.

## Linear migration numbers

`feature/combined` ends at app `0026_drop_legacy_stats.sql` and management
`0004_admin_session.sql`. Neither branch adds a management migration or needs a renumber.

| Branch       | Files                                                                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| anti-gaming  | `app/0027_stats_listen_event_popularity_counted.sql`, `app/0028_listen_stats_opt_out_cooldown.sql`, `app/0029_stats_flagged_listener.sql`, `app/0030_stats_all_time_recount.sql` |
| API keys     | `app/0031_account_api_key.sql`                                                                                                                |

Readiness markers after each step:

| After step | `API_EXPECTED_MIGRATION_FILENAME`     | `MANAGEMENT_API_EXPECTED_MIGRATION_FILENAME` |
| ---------- | ------------------------------------- | -------------------------------------------- |
| 01         | `0030_stats_all_time_recount.sql`     | `0004_admin_session.sql`                     |
| 02         | `0031_account_api_key.sql`            | `0004_admin_session.sql`                     |

`0031` creates `account_api_key` and references only `public.account`; it does not depend on
`0027`–`0030`. No deployed database has applied either branch's migrations.

## Mobile SQLite migration versions

Neither branch changes `apps/mobile/src/data/db/migrations.ts`. Step 03 still confirms the
versions are unique and increasing.

## Merge step rules

Steps 01 and 02 follow these. Each plan adds its own specifics.

Starting state: the driver ran `git merge --no-ff --no-commit origin/<branch>` on
`feature/combined`. `MERGE_HEAD` is set; textual conflicts are unmerged paths. The driver commits
and pushes after the step; the step never does.

1. **Check the state.** `git rev-parse MERGE_HEAD` must equal `git rev-parse origin/<branch>`. If
   not, report `RUNNER-STATUS: BLOCKED — merge state is not origin/<branch>`.
1. **Read intent.** The branch's archived plan set is in the tree under
   `.llm/plans/completed/<branch slug>/`; read its `00-SUMMARY.md`. Also read
   `git log --format=%B HEAD..MERGE_HEAD`.
1. **Resolve every unmerged path** (`git diff --name-only --diff-filter=U`). Compare base, ours,
   and theirs with `git show :1:<path>`, `:2:<path>`, `:3:<path>`.
   - Code: keep both features' behavior. Do not drop either side's additions to make it compile.
   - Docs, `.cursor/rules/rule-index.mdc`, `release-notes/scratchpad.md` (keep every entry from
     both sides), i18n originals and overrides, OpenAPI files, seed scripts, `eslint.config.mjs`,
     and lists in `scripts/mobile/e2e-test.sh`: the union of both sides, in the file's existing
     order.
   - Lockfiles (`package-lock.json`, `apps/mobile/package-lock.json`):
     `git checkout --ours -- <file>`, then rule 6 folds in the branch's dependency changes. Never
     hand-edit a lockfile.
   - `infra/k8s/base/db/source/bootstrap/0004_app_linear_baseline.sql.gz` and `0005_*`:
     `git checkout --ours -- <file>`; rule 4 regenerates them. Never hand-merge them.
   - Marker env lines and kustomization lists: rule 4 sets the values.
1. **Linear migrations.** Apply § Linear migration numbers. Two files with one number are a
   conflict even when git reports none. Every app file `0001`–`0031` is listed once, in order, in
   the `files` lists and the `podverse-ops-migration-scripts` literals of
   `infra/k8s/base/ops/kustomization.yaml`. Set the markers in
   `infra/k8s/base/api/source/api.env` and
   `infra/k8s/base/management-api/source/management-api.env` from the table. Then run
   `make db_regen_linear_baseline` and `make db_verify_linear_baseline`. Follow
   **migration-readiness-marker-sync**, **linear-baseline-0004**, and
   **linear-sql-greenfield-only**. Do not change migration SQL bodies unless an incoming file
   refers to an object an earlier merged migration renamed or dropped.
1. **Mobile SQLite.** Apply § Mobile SQLite migration versions when the merge touches
   `apps/mobile/src/data/db/`.
1. **Dependencies.** When `git diff HEAD --name-only` lists any `package.json` or
   `package-lock.json`, run `npm install` at the root; when it lists `apps/mobile/package.json` or
   `apps/mobile/package-lock.json`, also run `npm --prefix apps/mobile install`. Stage the
   updated lockfiles. The Linux lockfile refresh waits for step 03.
1. **Checks.** Run `npm run build:packages`, then `npm run lint:fix`. `lint:fix` runs i18n
   compile, workspace and mobile type-check, workspace and mobile lint, and Prettier. Fix every
   error the merge caused. Rerun until clean, at most three rounds per error. What remains goes
   to the deferred file with the exact error text. Do not run unit, API, E2E, or Maestro tests;
   the smoke run does that after step 03.
1. **Stage.** `git add -A`. Leave no `<<<<<<<` or `>>>>>>>` lines anywhere. Never run
   `git commit`, `git push`, `git merge --abort`, `git reset`, `git stash`, `git clean`, or
   `git checkout <branch>`.
1. **Defer instead of stopping.** When a choice needs the operator, make the choice that keeps
   both features working and the tree compiling, then append an entry to the deferred file
   (§ Deferred file). Keep going.
1. **Abort a branch only as a last resort**: when it cannot be integrated without an operator
   decision spanning many files. Write the deferred entry, leave the tree as it is, and put
   `MERGE-OUTCOME: ABORT — <reason>` on its own line before the status line. The driver aborts
   the merge and moves on. Otherwise put `MERGE-OUTCOME: READY`.
1. **Status.** Report `RUNNER-STATUS: DONE` for both outcomes. Report `BLOCKED` only when a tool
   the step needs cannot run at all (Docker down, npm registry unreachable). This replaces the
   runner's "stop after two failed rounds" instruction for this set.
1. **Final message:** each conflict and how you resolved it, migration and marker changes,
   dependency installs, the last `lint:fix` outcome, deferred entries, and notes for later steps.

## Deferred file

`.llm/plans/active/combined-merge-anti-gaming-api-keys-deferred/00-SUMMARY.md`. Create it on the
first entry with the title `# combined-merge-anti-gaming-api-keys — deferred`. Each entry is a
`## <step> — <short gap>` section naming the branch, the files, what conflicted, what you chose,
the main alternative, and the question the operator must settle. The driver adds its own entries
(skipped merges, failed pushes, a stopped smoke run) and commits the file with the next commit.

Test failures the smoke run cannot fix go to `.llm/plans/active/abctestall-deferred.md`, per
**abcsmoketest**.

## Driver

`driver.sh` runs the set. It is the only thing that commits or pushes:

1. Preflight: on `feature/combined`; tracked tree clean; Docker up; plan-runner installed and
   logged in; `origin/develop` has `.cursor/skills/abcsmoketest/SKILL.md`; ports 8081, 4230, and
   2111 are free or held by this checkout.
1. Retires last night's run: removes open `.llm/plans/active/abctest-all-*` runs, archives
   `.llm/plans/active/combined-merge/` to `completed/`, and deletes
   `.llm/plans/active/combined-merge-deferred/`, whose only entry is that stopped run. Commits this
   set with those moves and pushes.
1. Once: `make local_env_worktree_setup` and `npm run deps:init`.
1. Merges `origin/develop` (clean; brings in abcsmoketest), commits, pushes.
1. Steps 01–02: starts each merge, runs the step with
   `./scripts/abcplan/run.sh run combined-merge-anti-gaming-api-keys --stop-after NN`, commits the
   merge, pushes. An aborted, blocked, or unresolved step drops that merge and records a deferred
   entry.
1. Step 03, then commit and push.
1. Mobile prep: stops this checkout's own Metro, runs
   `bash scripts/dev/deps-init.sh --skip-clean --with-native`, starts Mobile E2E Metro, the
   mobile E2E API, and mobile test-assets from this checkout, then `npm run mobile:e2e:ios`.
1. `./scripts/abctest/run.sh smoke`, then commits and pushes its fixes.
1. Archives this set when the smoke run finished.

When the smoke run stops for the operator, the driver commits and pushes its partial fixes and
prints the question. Rerun the driver with `--resume 'Your answer.'`; it passes that to the smoke
run and finishes from there.

Log: `.artifacts/combined-merge-anti-gaming-api-keys/driver.log`. Step messages:
`.artifacts/plan-runner/combined-merge-anti-gaming-api-keys/NN.md`.
