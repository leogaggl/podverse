# Auth sessions: ending a session closes its live streams — COPY-PASTA

How to use:

1. Select **Cursor model** and **Reasoning** in the Cursor UI (the line above each fence).
1. Copy the fenced block only, paste, and the agent runs it.
1. Tick the box when that prompt is done.

Summary and prerequisites: [00-SUMMARY.md](./00-SUMMARY.md). Order and file ownership:
[00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).

**Optional — run the set unattended (Root tab):**
`./scripts/abcplan/run.sh run auth-sessions-stream-close`. It runs one fresh agent per prompt on
that prompt's model, stops at the first blocker, and resumes with
`./scripts/abcplan/run.sh run auth-sessions-stream-close --resume 'Your answer.'`.

Before Phase 1: `auth-sessions` and `realtime-banner-notifications` are both merged into this
branch, and `make db_verify_linear_baseline` passes (see 00-SUMMARY.md).

| Phase | Prompts | Model and reasoning |
| --- | --- | --- |
| 1 | 70 | Opus 5.5 high |
| 2 | 71 | Cursor Grok 4.7 extra high |

Why Opus for 70: it ties session ends to the realtime stream hub across pods, which is
concurrency work other surfaces depend on. Fast stays off.

If the Cursor Grok 4.7 prompt stalls or makes the same mistake twice, rerun it on
**Codex 5.3 · high**, and record the change on the prompt here.

## Phase 1

- [x] **70 — Ending a session closes its open account event streams**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/auth-sessions-stream-close/70-session-ended-stream-close.md
Follow 00-EXECUTION-ORDER.md and the decisions in 00-SUMMARY.md (D47–D53).
If apps/api/src/lib/accountEventStream/accountEventStreamHub.ts or
packages/orm/src/lib/accountEventPublisher.ts does not exist, stop and report BLOCKED: the
realtime-banner-notifications set must be merged first. Do not build a substitute stream or
publisher. If plan 10's revoke functions in packages/orm/src/services/account/accountSession.ts
are missing, stop and report BLOCKED: the auth-sessions set must be merged first.
Publish from plan 10's ORM revoke functions; the event lists the ended session ids; the 30-minute
stream cap stays. Keep the auth-sessions and realtime edits in openapi.yml and lib/auth/index.ts.
Do not run tests. Append the plan's release scratchpad entry.
When the plan is done, move 70-session-ended-stream-close.md to
.llm/plans/completed/auth-sessions-stream-close/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 2

- [x] **71 — Web: the stream's session-ended event signs the page out at once; then archive the set**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/auth-sessions-stream-close/71-web-stream-session-ended.md
Follow 00-EXECUTION-ORDER.md and the decisions in 00-SUMMARY.md (D54).
If apps/web/src/lib/notifications/stream/notificationStreamCoordinator.ts does not exist, stop
and report BLOCKED: the realtime-banner-notifications set's plans 30 and 31 must be merged first.
A session.ended event with a null notice does not stop the stream. Keep the auth-sessions edits
in sessionEndedNotice.ts and web-session-ended-notice.spec.ts.
Do not run tests. Append the plan's release scratchpad entry.

Then close the set. Confirm 70-session-ended-stream-close.md is in
.llm/plans/completed/auth-sessions-stream-close/. Move 71-web-stream-session-ended.md,
00-SUMMARY.md, 00-EXECUTION-ORDER.md, and COPY-PASTA.md there, and remove the empty active
directory.

End with the cumulative verification for the whole set, assuming no earlier prompt was tested.
One fenced bash block, fish-safe, labeled Root. Tell the operator that Docker must be running.
Note that there is no dependency change, so no lockfile step, and no catalog change, so no i18n
compile.

Root:
npm run build:packages
npm run lint
npm run type-check
npm run test:unit
make test_deps
npm run test:e2e:api
make e2e_test_web_report_spec SPEC=e2e/web-session-ended-notice.spec.ts
open .artifacts/e2e-reports/latest/index.html
```
