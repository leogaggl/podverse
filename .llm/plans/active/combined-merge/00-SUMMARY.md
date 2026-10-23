# combined-merge — summary

Merge four finished feature branches into one branch, `combined`, reconcile them (including the
linear database migrations), push after every successful merge, then run abctestall on the
result. The whole set runs unattended through `overnight.sh` in this folder.

## Requirement ledger

- **R1** "create a new branch named combined" — Plan: `overnight.sh` (the branch exists locally at
  the `develop` tip; the driver's first push creates it on GitHub)
- **R2** "decide the order that you want to handle these feature branches" — Plan: § Order
- **R3** "bring them into this new combined branch and resolve merge conflicts as you go" — Plan:
  01, 02, 03, 04
- **R4** "run lint fix as you go and fix issues as you see them" — Plan: 01–05 (§ Merge step rules,
  rule 7)
- **R5** "if you run into an issue that you truly cannot resolve without operator assistance ...
  set that aside for later in a deferred document" — Plan: § Deferred file
- **R6** "reconciling any issues you see, including the database import process" — Plan: § Linear
  migration numbers, 02, 03, 04, 05
- **R7** "every time you have a successful merge into combined, you push that to the combined branch
  using my profile" — Plan: `overnight.sh`
- **R8** "proceed to generate ABC Test All and run ABC Test All" — Plan: `overnight.sh`
- **R9** "a single command in the command line terminal that will handle this entire flow" — Plan:
  `overnight.sh`
- **R10** "use Grok 4.7 as much as possible because of cost reasons" — Plan: every step is Cursor
  Grok 4.7

## Order

| Step | Branch                                  | Why here                                                                                                                                                                                    |
| ---- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01   | `feature/realtime-banner-notifications` | Smallest (158 files), current with `develop`, merges with no textual conflict. Keeps app `0022`. Brings the root lockfile change (ioredis).                                                  |
| 02   | `feature/artist-album-attribution`      | Current with `develop`. Few textual conflicts (markers, kustomization, docs, scratchpad). Takes app `0023` and keeps mobile SQLite version 25.                                              |
| 03   | `feature/auth-sessions`                 | Cross-cutting auth change. Goes before popularity because popularity shares 55 files with it; resolving auth first lets the popularity merge adapt to final auth helpers.                   |
| 04   | `feature/popularity-tracking-rebuild`   | Last: the most overlap with the others, a destructive migration (drops legacy stats), a mobile SQLite version clash, and conflicts in DTOs, seeds, cron, and ESLint config. It adapts to all. |
| 05   | (verification)                          | Whole-tree checks after all four merges, Linux lockfile refresh, baseline verify.                                                                                                          |

A simulated sequential merge (`git merge-tree`) on 2026-10-23 found these textual conflicts. More
appear only semantically (duplicate migration numbers do not conflict in git).

- 01: none
- 02: `apps/workers/ENV.md`, `infra/k8s/base/api/source/api.env`,
  `infra/k8s/base/db/source/bootstrap/0004_app_linear_baseline.sql.gz`,
  `infra/k8s/base/ops/kustomization.yaml`, `release-notes/scratchpad.md`,
  `scripts/mobile/e2e-test.sh`
- 03: the same six plus `apps/api/src/lib/auth/index.ts`, `apps/api/src/test/helpers/index.ts`,
  `infra/k8s/base/management-api/source/management-api.env`
- 04: `apps/api/src/routes/account.ts`, `apps/mobile/src/components/feedback/ConfirmDialog.tsx`,
  `apps/mobile/src/data/db/migrations.ts`, `apps/mobile/src/data/db/migrations.test.ts`,
  `apps/web/src/components/MediaPlayer/MEDIA-PLAYER-DECISION-MATRIX.md`,
  `apps/web/src/components/Settings/Panels/SettingsAccount/SettingsAccount.tsx`,
  `apps/workers/APPS-WORKERS.md`, `apps/workers/ENV.md`,
  `apps/workers/src/lib/startup/categoriesForCommand.test.ts`, `eslint.config.mjs`,
  `infra/k8s/base/api/source/api.env`, `infra/k8s/base/cron/kustomization.yaml`,
  `infra/k8s/base/db/source/bootstrap/0004_app_linear_baseline.sql.gz`,
  `infra/k8s/base/ops/kustomization.yaml`, `packages/helpers/src/dtos/index.ts`,
  `release-notes/scratchpad.md`, `tools/web/seed-e2e.mjs`

## Linear migration numbers

`develop` ends at app `0021_channel_may_have_live_items.sql` and management
`0003_billing_permissions.sql`. Each branch numbered its app migration `0022`. Final numbers:

| Branch                 | Branch file                                    | Final file on `combined`                       |
| ---------------------- | ---------------------------------------------- | ---------------------------------------------- |
| realtime notifications | `app/0022_account_notification_read_at.sql`    | `app/0022_account_notification_read_at.sql`    |
| artist/album           | `app/0022_channel_verified_publisher.sql`      | `app/0023_channel_verified_publisher.sql`      |
| auth sessions          | `app/0022_account_session.sql`                 | `app/0024_account_session.sql`                 |
| auth sessions          | `management/0004_admin_session.sql`            | `management/0004_admin_session.sql`            |
| popularity             | `app/0022_popularity_tracking_foundation.sql`  | `app/0025_popularity_tracking_foundation.sql`  |
| popularity             | `app/0023_drop_legacy_stats.sql`               | `app/0026_drop_legacy_stats.sql`               |

Readiness markers after each step:

| After step | `API_EXPECTED_MIGRATION_FILENAME`         | `MANAGEMENT_API_EXPECTED_MIGRATION_FILENAME` |
| ---------- | ----------------------------------------- | -------------------------------------------- |
| 01         | `0022_account_notification_read_at.sql`   | `0003_billing_permissions.sql`               |
| 02         | `0023_channel_verified_publisher.sql`     | `0003_billing_permissions.sql`               |
| 03         | `0024_account_session.sql`                | `0004_admin_session.sql`                     |
| 04         | `0026_drop_legacy_stats.sql`              | `0004_admin_session.sql`                     |

No branch was published: alpha runs `staging` images, so no deployed database has applied a branch
migration under its old name. A local dev database that applied a branch file under its old name
needs a reset; that is the operator's, not this set's.

## Mobile SQLite migration versions

`develop` ends at version 24 in `apps/mobile/src/data/db/migrations.ts`. Artist/album adds version
25 and keeps it. Popularity also adds 25; step 04 renumbers it to 26 and updates
`migrations.test.ts` and any schema version constant to match.

## Merge step rules

Steps 01–04 follow these. Each step's plan adds its own specifics.

Starting state: the driver ran `git merge --no-ff --no-commit origin/<branch>` on `combined`.
`MERGE_HEAD` is set; textual conflicts are unmerged paths. The driver commits and pushes after the
step; the step never does.

1. **Check the state.** `git rev-parse MERGE_HEAD` must equal `git rev-parse origin/<branch>`. If
   it does not, report `RUNNER-STATUS: BLOCKED — merge state is not origin/<branch>`.
1. **Read intent.** The branch's archived plan set is now in the tree under
   `.llm/plans/completed/<branch slug>/`; read its `00-SUMMARY.md`. Also read
   `git log --format=%B HEAD..MERGE_HEAD`.
1. **Resolve every unmerged path** (`git diff --name-only --diff-filter=U`). Compare base, ours,
   and theirs with `git show :1:<path>`, `:2:<path>`, `:3:<path>`.
   - Code: keep both features' behavior. Do not drop either side's additions to make it compile.
   - Docs, `release-notes/scratchpad.md` (keep every entry from both sides), `apps/workers/ENV.md`,
     i18n originals, OpenAPI files, seed scripts, `eslint.config.mjs`, and lists in
     `scripts/mobile/e2e-test.sh`: the union of both sides, in the file's existing order.
   - Lockfiles (`package-lock.json`, `apps/mobile/package-lock.json`):
     `git checkout --ours -- <file>`, then rule 6 folds in the branch's dependency changes. Never
     hand-edit a lockfile.
   - `infra/k8s/base/db/source/bootstrap/0004_app_linear_baseline.sql.gz` and `0005_*`:
     `git checkout --ours -- <file>`; rule 4 regenerates them. Never hand-merge them.
   - Marker env lines and kustomization lists: rule 4 sets the values.
1. **Linear migrations.** Apply § Linear migration numbers. Two files with the same number are a
   conflict even when git reports none. For each file to renumber: `git mv` it, then find every
   reference with `rg -n -g '!.llm/**' '<old name without .sql>'` and update it: the `files` lists
   and the `podverse-ops-migration-scripts` literals in `infra/k8s/base/ops/kustomization.yaml`,
   `API_EXPECTED_MIGRATION_FILENAME` in `infra/k8s/base/api/source/api.env`,
   `MANAGEMENT_API_EXPECTED_MIGRATION_FILENAME` in
   `infra/k8s/base/management-api/source/management-api.env`, database scripts, docs, tests, and
   `release-notes/scratchpad.md`. Set the markers from § Linear migration numbers. Then run
   `make db_regen_linear_baseline` and `make db_verify_linear_baseline`. Follow
   **migration-readiness-marker-sync**, **linear-baseline-0004**, and
   **linear-sql-greenfield-only**. Change migration SQL bodies only when an incoming migration
   refers to a table or column an earlier merged migration renamed or dropped.
1. **Mobile SQLite.** Apply § Mobile SQLite migration versions when the branch touches
   `apps/mobile/src/data/db/`.
1. **Dependencies.** When `git diff HEAD --name-only` lists any `package.json` or
   `package-lock.json`, run `npm install` at the root; when it lists `apps/mobile/package.json` or
   `apps/mobile/package-lock.json`, also run `npm --prefix apps/mobile install`. Stage the updated lockfiles. The
   Linux lockfile refresh waits for step 05.
1. **Checks.** Run `npm run build:packages`, then `npm run lint:fix`. `lint:fix` runs i18n compile,
   workspace and mobile type-check, workspace and mobile lint, and Prettier. Fix every error the
   merge caused: both features meeting in one file, a renamed helper one side still calls, a DTO
   field both sides changed. Rerun until clean, at most three rounds per error. What remains goes
   to the deferred file with the exact error text. Do not run unit, API, E2E, or Maestro tests;
   abctestall runs them after step 05.
1. **Stage.** `git add -A`. Leave no `<<<<<<<` or `>>>>>>>` lines anywhere. Never run
   `git commit`, `git push`, `git merge --abort`, `git reset`, `git stash`, `git clean`, or
   `git checkout <branch>`.
1. **Defer instead of stopping.** When a choice needs the operator, make the choice that keeps both
   features working and the tree compiling, then append an entry to the deferred file (§ Deferred
   file). Keep going.
1. **Abort a branch only as a last resort**: when it cannot be integrated without an operator
   decision spanning many files, such as two features rewriting the same subsystem in incompatible
   ways. Write the deferred entry, leave the tree as it is, and put
   `MERGE-OUTCOME: ABORT — <reason>` on its own line before the status line. The driver aborts the
   merge and moves on. Otherwise put `MERGE-OUTCOME: READY`.
1. **Status.** Report `RUNNER-STATUS: DONE` for both outcomes. Report `BLOCKED` only when a tool
   the step needs cannot run at all (Docker down, npm registry unreachable). This replaces the
   runner's "stop after two failed rounds" instruction for this set.
1. **Final message:** each conflict and how you resolved it, renumbered files, dependency
   installs, check results (last `lint:fix` outcome), deferred entries, and notes for later steps.

## Deferred file

`.llm/plans/active/combined-merge-deferred/00-SUMMARY.md`. Create it on the first entry with the
title `# combined-merge — deferred`. Each entry is a `## <step> — <short gap>` section naming the
branch, the files, what conflicted, what you chose, the main alternative, and the question the
operator must settle. The driver appends its own entries there too (skipped merges, failed pushes,
a stopped abctestall run). The driver commits the file with the next commit.

## Driver

`overnight.sh` runs the set. It is the only thing that commits or pushes:

1. Preflight: on `combined`, tracked tree clean, Docker up, plan-runner installed and logged in,
   port 8081 free. Commits this plan set and pushes `combined` (first push), so a push failure
   shows up while the operator is still awake.
1. Once: `make local_env_worktree_setup` and `npm run deps:init`.
1. Steps 01–04: starts the merge, runs the step with
   `./scripts/abcplan/run.sh run combined-merge --stop-after NN`, then commits the merge and pushes.
   If the step aborted the branch, blocked, or left conflict markers, it aborts the merge, records a
   deferred entry, and goes on to the next branch.
1. Step 05, then commit and push.
1. Mobile prep: `deps-init --skip-clean --with-native`, starts Mobile E2E Metro from this checkout
   in the background, `npm run mobile:e2e:ios`.
1. `./scripts/abctest/run.sh all`, then commits and pushes the sweep's fixes and its deferred file.
1. Archives this set to `.llm/plans/completed/combined-merge/` when abctestall finished.

Log: `.artifacts/combined-merge/overnight.log`. Step messages:
`.artifacts/plan-runner/combined-merge/NN.md`.
