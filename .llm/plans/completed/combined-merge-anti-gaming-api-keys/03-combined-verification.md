**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 03 — Whole-tree verification on feature/combined

Both merges are committed. Make the whole tree build, lint, type-check, and validate before the
smoke run.

## Rows

R2, R4, R6

## Runs after

02

## Files

Whatever the checks below require; expected: `package-lock.json`, `apps/mobile/package-lock.json`,
the `0004_`/`0005_` baselines, and files the merges left inconsistent.

## Steps

Read `.artifacts/plan-runner/combined-merge-anti-gaming-api-keys/01.md` and `02.md` and the
deferred file first. A step whose final message says `MERGE-OUTCOME: ABORT`, or whose branch is
not an ancestor of `HEAD` (`git merge-base --is-ancestor origin/<branch> HEAD`), was skipped;
check markers and numbering against what was actually merged, not against the summary's table.

Run each from the repo root, fix what fails, and rerun until clean. At most three rounds per
error; what remains goes to the deferred file with the exact output.

1. `npm run build:packages`
1. `npm run build:apps`
1. `npm run lint:fix`, then `npm run lint` must pass with no errors.
1. `npm run type-check:mobile`, when root `package.json` has that script.
1. `npm run openapi:check` and `npm run i18n:validate`
1. Migrations: `make db_verify_linear_baseline`. The app chain is gapless `0001`–`0031` and the
   management chain `0001`–`0004`, each number used once
   (`ls infra/k8s/base/ops/source/database/linear-migrations/app`); the markers name the last
   file of each chain; every file is listed once in `infra/k8s/base/ops/kustomization.yaml`. If
   `kubectl` is on PATH, run
   `kubectl kustomize --load-restrictor LoadRestrictionsNone infra/k8s/base/api` and the same for
   `infra/k8s/base/management-api`, and confirm the rendered init containers use the markers.
1. Mobile SQLite versions in `apps/mobile/src/data/db/migrations.ts` are unique and increasing.
1. `./scripts/development/update-lockfile-linux.sh` (needs Docker). It leaves host `node_modules`
   alone; do not add a reinstall.
1. `git add -A`. Never commit or push; the driver does.

Do not run unit, API, E2E, or Maestro tests; the smoke run does next.

Report `RUNNER-STATUS: DONE` even when items were deferred. Report `BLOCKED` only when a command
cannot run at all (Docker down). This replaces the runner's "stop after two failed rounds"
instruction for this set.

## Tests

None added.

## Release scratchpad

none
