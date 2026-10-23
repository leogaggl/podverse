**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 05 — Whole-tree verification on combined

Every merge is committed. Make the whole tree build, lint, and validate before abctestall.

## Rows

R4, R6

## Runs after

04

## Files

Whatever the checks below require; expected: `package-lock.json`, `apps/mobile/package-lock.json`,
the `0004_`/`0005_` baselines, and files the merges left inconsistent.

## Steps

Read the final messages `.artifacts/plan-runner/combined-merge/01.md`–`04.md` and the deferred
file first. A step whose final message says `MERGE-OUTCOME: ABORT`, or whose branch is not an
ancestor of `HEAD` (`git merge-base --is-ancestor origin/<branch> HEAD`), was skipped; check
markers and numbering against what was actually merged, not against the table.

Run each from the repo root, fix what fails, and rerun until clean. At most three rounds per
error; what remains goes to the deferred file with the exact output.

1. `npm run build:packages`
1. `npm run build:apps`
1. `npm run lint:fix`, then `npm run lint` must pass with no errors.
1. `npm run openapi:check` and `npm run i18n:validate`
1. Migrations: `make db_verify_linear_baseline`. The app and management chains are gapless and
   each number is used once (`ls infra/k8s/base/ops/source/database/linear-migrations/app`); the
   markers name the last file of each chain; every file is listed in
   `infra/k8s/base/ops/kustomization.yaml`. If `kubectl` is on PATH, run
   `kubectl kustomize --load-restrictor LoadRestrictionsNone infra/k8s/base/api` and the same for
   `infra/k8s/base/management-api`, and confirm the rendered initContainers use the markers.
1. Mobile SQLite versions in `apps/mobile/src/data/db/migrations.ts` are unique and increasing.
1. `./scripts/development/update-lockfile-linux.sh` (needs Docker). It leaves host `node_modules`
   alone; do not add a reinstall.
1. `git add -A`. Never commit or push; the driver does.

Do not run unit, API, E2E, or Maestro tests; abctestall runs next.

Report `RUNNER-STATUS: DONE` even when items were deferred. Report `BLOCKED` only when a command
cannot run at all (Docker down). This replaces the runner's "stop after two failed rounds"
instruction for this set.

## Tests

None added.

## Release scratchpad

none
