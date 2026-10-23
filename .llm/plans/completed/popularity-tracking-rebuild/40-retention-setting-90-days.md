**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 40 — Raw listen event retention defaults to 90 days

The operator set raw listen event retention to 90 days as a server setting (R40). The setting
already exists as `STATS_TRACK_EVENT_RETENTION_DAYS` (workers and API) and its web mirror
`NEXT_PUBLIC_STATS_TRACK_EVENT_RETENTION_DAYS`; today every default and committed value is 30.
This plan moves every one of them to 90 and rewrites the descriptions so they describe the new
stores. It changes no code paths: the API fills `{retention_days}` in the explanation and terms
from this value, the web app shows it in settings help, and the partition job (plan 41) reads it.

The env name stays `STATS_TRACK_EVENT_RETENTION_DAYS`. Renaming it would touch the API, workers,
web sidecar, local env scripts, and the alpha GitOps repo for no behavior change.

## Rows

R40

## Runs after

none

## Files

- `packages/helpers/src/lib/time.ts`
- `infra/k8s/base/api/source/api.env`
- `infra/k8s/base/workers/source/workers.env`
- `infra/k8s/base/web/source/web-sidecar.env`
- `apps/api/.env.example`
- `apps/workers/.env.example`
- `apps/web/sidecar/.env.example`
- `dev/env-overrides/local/legal.env.example`
- `apps/web/playwright.e2e-server-env.ts`
- `packages/helpers-config/src/podverseTestEnv.ts`
- `apps/api/ENV.md`
- `apps/workers/ENV.md`

## Edits

Change only the retention key's value and its comment in each file. Other plans in this set edit
other keys in the same env files (`API_EXPECTED_MIGRATION_FILENAME`, the agreement version, rate
limits); leave those lines alone.

- `packages/helpers/src/lib/time.ts` — `DEFAULT_STATS_TRACK_EVENT_RETENTION_DAYS = 90`. Replace the
  doc comment with: `/** Default days raw popularity listen and open events are kept. A monthly partition is dropped once every row in it is older than this (STATS_TRACK_EVENT_RETENTION_DAYS). */`
  The API (`popularityTrackingContent.ts`, `termsContent.ts`), web config, web sidecar validation,
  and workers config all read this constant, so their fallbacks follow without edits.
- `infra/k8s/base/api/source/api.env` line `STATS_TRACK_EVENT_RETENTION_DAYS=30` → `=90`.
- `infra/k8s/base/workers/source/workers.env` line `STATS_TRACK_EVENT_RETENTION_DAYS=30` → `=90`,
  with a comment line directly above it in the style of the neighboring retention keys:
  `# Raw popularity listen and open events. statsEventPartitionsMaintain drops a whole month once every row in it is older than this.`
- `infra/k8s/base/web/source/web-sidecar.env` line `NEXT_PUBLIC_STATS_TRACK_EVENT_RETENTION_DAYS=30` → `=90`.
- `apps/api/.env.example` — `STATS_TRACK_EVENT_RETENTION_DAYS="90"`.
- `apps/workers/.env.example` — under `##### Stats`, replace the comment with
  `# Raw popularity listen and open events (default 90 days). A whole month is dropped once every`
  `# row in it is older than this, so a row can stay up to about a month longer.` and set
  `STATS_TRACK_EVENT_RETENTION_DAYS="90"`.
- `apps/web/sidecar/.env.example` — comment `# Mirrors workers STATS_TRACK_EVENT_RETENTION_DAYS (default 90 days)` and value `"90"`.
- `dev/env-overrides/local/legal.env.example` — `STATS_TRACK_EVENT_RETENTION_DAYS="90"`.
  `scripts/local-env/setup.sh` already applies this one key to the API, workers, and web env files;
  it needs no change.
- `apps/web/playwright.e2e-server-env.ts` — `NEXT_PUBLIC_STATS_TRACK_EVENT_RETENTION_DAYS: '90'`.
- `packages/helpers-config/src/podverseTestEnv.ts` — `STATS_TRACK_EVENT_RETENTION_DAYS: '90'`.
- `apps/api/ENV.md` — the `STATS_TRACK_EVENT_RETENTION_DAYS` bullet ends `Empty uses 90 days.`
- `apps/workers/ENV.md` — the retention table row becomes
  `| \`STATS_TRACK_EVENT_RETENTION_DAYS\` | 90 | Raw popularity listen and open events, a whole month at a time |`
  (re-pad the table so its pipes stay aligned; this file is checked by Prettier).

Search once more for `STATS_TRACK_EVENT_RETENTION_DAYS` and `NEXT_PUBLIC_STATS_TRACK_EVENT_RETENTION_DAYS`
outside `node_modules`, `dist`, and `.llm/`. Any committed `30` left for either key, other than in
another repo, is a miss; fix it in this plan.

## Not in this repo

The alpha GitOps repo (`../k.podcastdj.com/apps/podverse-alpha`) already sets
`STATS_TRACK_EVENT_RETENTION_DAYS=90` in `api/source/api.env` and
`NEXT_PUBLIC_STATS_TRACK_EVENT_RETENTION_DAYS=90` in `web/source/web-sidecar.env`; the operator
pushes that change together with the alpha ref bump for this set. Its workers env does not set the
key, so workers inherit the base 90. Do not edit that repo. An operator's home `legal.env` copied
from the old example still says 30; the release scratchpad entry below covers that.

## Tests

No new tests. `apps/workers/src/config/retentionConfig.test.ts` reads the default through the
constant and keeps passing. No test asserts the number 30 in served copy.

## Release scratchpad

```markdown
## Raw popularity listen data is kept 90 days

- Surfaces: api, web, workers, k8s base env
- Change: `STATS_TRACK_EVENT_RETENTION_DAYS` defaults to 90 (was 30) and the base API, workers,
  and web sidecar env files set 90. The Popularity Tracking explanation and terms fill
  `{retention_days}` from it, the web settings help shows it, and the partition job drops a whole
  month of raw listen and open events once every row in it is older than this.
- Who notices: listeners reading the explanation or terms; operators of deployments
- Operator steps: other deployments that pin either key to 30 should set 90 or remove the pin
  (alpha's GitOps values are already 90). Local: update `STATS_TRACK_EVENT_RETENTION_DAYS` in your
  home `legal.env`, then `make local_env_setup`.
```
