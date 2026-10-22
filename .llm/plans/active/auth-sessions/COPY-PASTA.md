# Auth sessions and remote logout — COPY-PASTA

How to use:

1. Select **Cursor model** and **Reasoning** in the Cursor UI (the line above each fence).
1. Copy the fenced block only, paste, and the agent runs it.
1. Tick the box when that prompt is done.

Request and settled review answers: [00-REQUEST.md](./00-REQUEST.md). Ledger and decisions:
[00-SUMMARY.md](./00-SUMMARY.md). Order and file ownership:
[00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).

**Optional — run the set unattended (Root tab):**
`./scripts/abcplan/run.sh run auth-sessions`. It runs one fresh agent per prompt on that prompt's
model, stops at the first blocker, and resumes with
`./scripts/abcplan/run.sh run auth-sessions --resume 'Your answer.'`. The script passes
`--parallel`, so every prompt under one phase heading runs at once. Prompts in one phase share no
file, and none of them writes the release scratchpad: each puts its entry in its final message,
and prompt 44 appends them. Running them one after the other is also correct.

Before Phase 1, start Docker: plans 10 and 60 regenerate the linear baseline archives.

This set does not need `realtime-banner-notifications`, and the two can run in separate
worktrees. They edit some of the same files (the API auth files, `openapi.yml`, `api.env`) and
both add linear migrations, so whichever branch merges second resolves those conflicts,
renumbers its migration past the other's, and reruns `make db_regen_linear_baseline`. Closing a
session's open streams is the separate `auth-sessions-stream-close` set, run after both merge.

Phases run in order; prompts inside a phase run at once.

| Phase | Prompts | Model and reasoning |
| --- | --- | --- |
| 1 | 10, 43 | 10 Opus 5.5 high; 43 Cursor Grok 4.7 high |
| 2 | 11, 20, 60 | 11 Cursor Grok 4.7 medium; 20 Opus 5.5 high; 60 Opus 5.5 high |
| 3 | 21, 40, 50, 61 | 21 Cursor Grok 4.7 extra high; 40 Opus 5.5 extra high; 50 Cursor Grok 4.7 extra high; 61 Cursor Grok 4.7 medium |
| 4 | 22, 51, 62 | 22 Cursor Grok 4.7 extra high; 51 Cursor Grok 4.7 high; 62 Opus 5.5 high |
| 5 | 23, 30, 63 | 23 Cursor Grok 4.7 extra high; 30 Opus 5.5 high; 63 Cursor Grok 4.7 extra high |
| 6 | 31, 64 | Cursor Grok 4.7 extra high |
| 7 | 32 | Cursor Grok 4.7 high |
| 8 | 33, 41 | Cursor Grok 4.7 extra high |
| 9 | 42 | Cursor Grok 4.7 high |
| 10 | 65 | Cursor Grok 4.7 extra high |
| 11 | 66 | Cursor Grok 4.7 extra high |
| 12 | 34 | Cursor Grok 4.7 high |
| 13 | 52 | Cursor Grok 4.7 high |
| 14 | 35 | Cursor Grok 4.7 extra high |
| 15 | 44 | Cursor Grok 4.7 extra high |

Why the expensive ones: 10 and 60 are the session schemas and rotation rules every later prompt
builds on; 20 and 62 rewrite API and management API auth (login, per-request check, renewal,
rotation with reuse detection); 30 is cookie renewal across server-rendered visits; 40 is mobile
refresh single-flight and durable token storage, which is concurrency work. Fast stays off.

Phases 7–14 hold one prompt each because each of those prompts edits catalog originals or runs
`npm run i18n:compile`, which rewrites every layer.

If a Cursor Grok 4.7 prompt stalls or makes the same mistake twice, rerun it one reasoning level
higher (after extra high, **Codex 5.3 · high**), and record the change on the prompt here.

## Phase 1

- [ ] **10 — Account session table, entity, and ORM service**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/auth-sessions/10-account-session-schema.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (greenfield, D1, D2, D5).
Take the next free number in linear-migrations/app/ (re-list the folder first) and write plain
forward DDL; do not edit 0001_*. Store only SHA-256 hashes of refresh ids; the previous refresh
id stays valid until the new one is first used, with no time limit. Run
make db_regen_linear_baseline and make db_verify_linear_baseline yourself. If Docker is not
available, finish the rest of the plan, leave the archives untouched, and report BLOCKED asking
the operator to start Docker.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 44
appends it.
When the plan is done, move 10-account-session-schema.md to .llm/plans/completed/auth-sessions/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **43 — Mobile sign-up keeps one password field**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/auth-sessions/43-mobile-remove-confirm-password.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
Edit only SignUpScreen.tsx. Stop calling getPassword2ErrorKey but do not delete it; plan 34
deletes it and its catalog keys.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 44
appends it.
When the plan is done, move 43-mobile-remove-confirm-password.md to
.llm/plans/completed/auth-sessions/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 2

Docker stays up: plan 60 regenerates the baseline archives.

- [ ] **11 — Daily purge of old account session rows**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/auth-sessions/11-account-session-purge.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D6).
Rows go 30 days after idle expiry (ACCOUNT_SESSION_RETENTION_DAYS, default 30), on the existing
platformPurge retention pattern. Make a targeted insertion in infra/k8s/base/cron/kustomization.yaml;
plan 61 adds its own entry later.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 44
appends it.
When the plan is done, move 11-account-session-purge.md to .llm/plans/completed/auth-sessions/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **20 — Session-bound API auth: login, per-request check, renewal, rotation, logout**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/auth-sessions/20-api-session-auth.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (greenfield, D1, D4,
D9–D13, D17, D18).
One AUTH_SESSION_IDLE_EXPIRATION (365 days) replaces the web JWT and mobile refresh lifetimes;
web renews at most once a day; no legacy-token path. Keep the shared DEFAULT_AUTH_* exports the
management API still imports; plan 62 deletes them. Later prompts rely on endAccountSessions,
req.user.session_id_text, clearAuthCookie, accountSessionStoreStub,
TEST_ACCOUNT_SESSION_ID_TEXT, and startTestApp({ accountSessions }). The 'real' branch and
auth.test.ts's afterAll both unmock the password module, so real-store files check real bcrypt.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 44
appends it.
When the plan is done, move 20-api-session-auth.md to .llm/plans/completed/auth-sessions/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **60 — Admin session table, entity, and service**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/auth-sessions/60-admin-session-schema.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (greenfield, D45).
Mirror plan 10's account session model in the management database. Take the next free number in
linear-migrations/management/ (re-list first); do not edit 0001_management_schema.sql. Run
make db_regen_linear_baseline and make db_verify_linear_baseline yourself. If Docker is not
available, finish the rest of the plan, leave the archives untouched, and report BLOCKED asking
the operator to start Docker.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 44
appends it.
When the plan is done, move 60-admin-session-schema.md to .llm/plans/completed/auth-sessions/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 3

- [ ] **21 — Password reset and invite completion end every session; account deletion clears the cookie**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/auth-sessions/21-password-reset-ends-sessions.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (the first review's
password-change answers).
A forgotten-password reset and invite completion (POST /account/set-password) end every session.
AccountService.resetPassword applies the sign-up password rule and returns 'changed' or
'invalid_new_password'; both routes answer an invalid password with 400 and change nothing.
Stop and report if any plan 20 symbol the plan names is missing.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 44
appends it.
When the plan is done, move 21-password-reset-ends-sessions.md to
.llm/plans/completed/auth-sessions/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **40 — Mobile refresh never presents a rotated-away or unsaved refresh token**

**Cursor model:** Opus 5.5 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/auth-sessions/40-mobile-refresh-rotation-safety.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D1, D27, D28).
Refresh is single-flight, and each rotated refresh token is stored durably before it is used; a
failed storage write keeps the old token and carries on. The saved token always wins over a
caller-passed one. Mobile reads built packages, so plan 20's exports come from dist.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 44
appends it.
When the plan is done, move 40-mobile-refresh-rotation-safety.md to
.llm/plans/completed/auth-sessions/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **50 — Admin force-logout and admin password set end every user session**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/auth-sessions/50-admin-force-logout-api.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D37, D38).
Call plan 10's revokeAccountSessions with exceptSessionIdText null: admin_force_logout for the
new route, admin_password_set for POST /users/:id/password. Force-logout returns
{ message: 'User signed out', sessions_ended }, and 200 with 0 when there are none.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 44
appends it.
When the plan is done, move 50-admin-force-logout-api.md to .llm/plans/completed/auth-sessions/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **61 — Daily purge of old admin session rows**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/auth-sessions/61-admin-session-purge.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D42).
The purge is a management API one-shot, not a worker. Keep plan 11's entry in
infra/k8s/base/cron/kustomization.yaml and plan 60's migration marker in management-api.env.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 44
appends it.
When the plan is done, move 61-admin-session-purge.md to .llm/plans/completed/auth-sessions/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 4

- [ ] **22 — Session list and sign-out endpoints**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/auth-sessions/22-account-session-endpoints.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D15, D16).
Routes live under /auth/sessions; deleting your own session acts as logout. Keep plans 20 and
21's edits in openapi.yml and _request.ts.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 44
appends it.
When the plan is done, move 22-account-session-endpoints.md to
.llm/plans/completed/auth-sessions/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **51 — Force Logout on the management user page**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/auth-sessions/51-admin-force-logout-page.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D39, D40).
The admin stays on the user detail page after Force Logout. Leave EditUserPageClient.tsx alone;
plan 52 edits it. Make targeted insertions in the management catalog originals under the users
keys; do not run npm run i18n:compile.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 44
appends it.
When the plan is done, move 51-admin-force-logout-page.md to .llm/plans/completed/auth-sessions/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **62 — Session-bound management API auth**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/auth-sessions/62-management-session-auth.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (greenfield, D41, D43, D44).
Admin web and mobile logins each get an admin_session row, with the same renewal, rotation, and
reasons as plan 20. Delete DEFAULT_AUTH_JWT_EXPIRATION and
DEFAULT_AUTH_MOBILE_REFRESH_TOKEN_EXPIRATION once nothing reads them. Keep plan 61's retention
var. Plans 63 and 65 rely on endAdminSessions and req.user.session_id_text.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 44
appends it.
When the plan is done, move 62-management-session-auth.md to .llm/plans/completed/auth-sessions/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 5

- [ ] **23 — Signed-in change password ends every other session**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/auth-sessions/23-account-change-password.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (the first review's
change-password answers).
POST /account/change-password keeps the caller's session and ends every other one. A wrong
current password is a 400 with code current_password_incorrect. The new-password rule comes
from plan 21's AccountService.resetPassword result; add no ORM method. Keep plans 20–22's edits in
openapi.yml, _request.ts, api.env, and the API config files.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 44
appends it.
When the plan is done, move 23-account-change-password.md to .llm/plans/completed/auth-sessions/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **30 — Web: renewed session cookie reaches the browser on server-rendered visits**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/auth-sessions/30-web-session-cookie-renewal.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D18, D19).
The middleware asks the API to renew only when the cookie is at least a day old, and forwards
Set-Cookie from the API, including a clear. No legacy-token handling.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 44
appends it.
When the plan is done, move 30-web-session-cookie-renewal.md to
.llm/plans/completed/auth-sessions/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **63 — Setting an admin password ends that admin's sessions**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/auth-sessions/63-admin-password-ends-sessions.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D46 as settled).
An admin setting their own password keeps the browser they used and ends every other session;
setting another admin's password ends all of theirs; redeeming an invite ends every session.
Keep plan 62's edits in the management openapi.yml and vitest.admin-session.real.config.ts.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 44
appends it.
When the plan is done, move 63-admin-password-ends-sessions.md to
.llm/plans/completed/auth-sessions/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 6

- [ ] **31 — Web: show why the browser was signed out**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/auth-sessions/31-web-session-ended-notice.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D20, D21).
The reason shows in a dialog after the sign-out reload, once per tab. Add the
authentication.session_ended.* keys with targeted insertions in the four consumer originals; do
not edit overrides or compiled files. Keep plan 30's edits in accountSessions.ts and the web spec
order.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 44
appends it.
When the plan is done, move 31-web-session-ended-notice.md to
.llm/plans/completed/auth-sessions/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **64 — Admin session list and sign-out endpoints**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/auth-sessions/64-admin-session-endpoints.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D41).
API only; management-web gets no session list. Keep plans 62 and 63's edits in the management
openapi.yml.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 44
appends it.
When the plan is done, move 64-admin-session-endpoints.md to .llm/plans/completed/auth-sessions/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 7

- [ ] **32 — Web: signed-in devices in Settings**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/auth-sessions/32-web-settings-session-list.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D23–D26).
Signed-In Devices sits in Settings → Account between Download My Data and Delete Account. Only
Sign Out of All Other Devices asks for confirmation. Add settings.account.sessions.* with
targeted insertions, and keep plan 31's keys, accountSessions.ts helpers, and spec order lines.
Do not run tests. Append the plan's release scratchpad entry.
When the plan is done, move 32-web-settings-session-list.md to
.llm/plans/completed/auth-sessions/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 8

- [ ] **33 — Web: an open page notices its session was ended**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/auth-sessions/33-web-session-ended-client-requests.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D21, D22).
An open page signs out on its first refused request, through plan 31's reportSessionEndedError.
Keep plans 20, 22, and 23's edits in _request.ts and plan 31's in sessionEndedNotice.ts and
web-session-ended-notice.spec.ts.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 44
appends it.
When the plan is done, move 33-web-session-ended-client-requests.md to
.llm/plans/completed/auth-sessions/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [ ] **41 — Mobile shows why the server signed it out**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/auth-sessions/41-mobile-signed-out-reason.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D29–D32).
Store the reason in the auth.forced_logout_notice pref. Reuse plan 31's
authentication.session_ended.* keys and parseAuthSessionEndedError, inserting into the objects
plan 31 created. Keep plan 40's edits in authRequestWithRefresh.ts, AuthProvider.tsx,
backgroundAuthDeps.ts, and vitest.config.ts. Run npm run i18n:compile.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 44
appends it.
When the plan is done, move 41-mobile-signed-out-reason.md to .llm/plans/completed/auth-sessions/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 9

- [ ] **42 — Mobile Signed-In Devices screen**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/auth-sessions/42-mobile-session-list.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D33–D36).
Match web plan 32's behavior and reuse its settings.account.sessions.* keys, inserting into the
objects plan 32 created. Register auth-sessions in flow_needs_e2e_api after auth-logout.
navigation/index.tsx is large: Grep for the More settings stack. Keep plans 40 and 41's edits in
vitest.config.ts.
Do not run tests. Append the plan's release scratchpad entry.
When the plan is done, move 42-mobile-session-list.md to .llm/plans/completed/auth-sessions/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 10

- [ ] **65 — Superuser force-logout of another admin**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/auth-sessions/65-superuser-force-logout.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
Only a superuser can force-logout another admin. Keep plans 62–64's edits in the management
openapi.yml and plan 51's management catalog keys. Skip apps/management-web/src/lib/requests/admins.ts
when the package re-export already covers the new function. Run npm run i18n:compile.
Do not run tests. Append the plan's release scratchpad entry.
When the plan is done, move 65-superuser-force-logout.md to .llm/plans/completed/auth-sessions/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 11

- [ ] **66 — Management-web cookie renewal and the signed-out reason**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/auth-sessions/66-management-web-session-renewal.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
Mirror web plans 30 and 31 in management-web. Add keys beside plan 65's in the management
originals with targeted insertions. Run npm run i18n:compile.
Do not run tests. Append the plan's release scratchpad entry.
When the plan is done, move 66-management-web-session-renewal.md to
.llm/plans/completed/auth-sessions/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 12

- [ ] **34 — Web sign-up, reset, and set-password keep one password field**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/auth-sessions/34-web-remove-confirm-password.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (confirm-password removal).
Delete getPassword2ErrorKey and the authentication.confirm_password and
authentication.password_mismatch keys once nothing reads them; plan 43 already stopped calling
it. Run npm run i18n:compile.
Do not run tests. Append the plan's release scratchpad entry.
When the plan is done, move 34-web-remove-confirm-password.md to
.llm/plans/completed/auth-sessions/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 13

- [ ] **52 — Management invite redeem and edit-user keep one password field**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/auth-sessions/52-management-web-remove-confirm-password.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (confirm-password removal).
Update the confirm-field fill in plan 51's users-detail-force-logout.spec.ts; stop and report if
that spec is missing. Keep plans 51, 65, and 66's management catalog keys. Run
npm run i18n:compile.
Do not run tests. Append the plan's release scratchpad entry.
When the plan is done, move 52-management-web-remove-confirm-password.md to
.llm/plans/completed/auth-sessions/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 14

- [ ] **35 — Web Change Password form in Settings**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/auth-sessions/35-web-change-password-form.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (change-password answers).
A Change Password section on the Account tab whose button opens a modal, like Change Email, with
one current-password field and one new-password field, no show-password toggle and no confirm
field. Use plan 23's reqAccountChangePassword. You own the
catalog keys plan 44 also uses. Keep plan 32's edits in SettingsAccount.tsx, the originals, and
the spec order. Run npm run i18n:compile.
Do not run tests. Append the plan's release scratchpad entry.
When the plan is done, move 35-web-change-password-form.md to
.llm/plans/completed/auth-sessions/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 15

- [ ] **44 — Mobile Change Password screen; then archive the set**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/auth-sessions/44-mobile-change-password-screen.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (change-password answers).
Use plan 35's catalog keys and edit no catalog. The flow changes only the per-platform
change-password accounts, never e2e-user@example.com, and stays under 4 requests per 10 minutes.
Keep plan 42's edits in MoreSettingsScreen.tsx, navigation/index.tsx, and e2e-test.sh, and plans
30 and 35's in seed-e2e.mjs.
Do not run tests. Append the plan's release scratchpad entry.

Before your own entry, append to release-notes/scratchpad.md every "Release notes entry" from
the final messages of prompts 10, 43, 11, 20, 60, 21, 40, 50, 61, 22, 51, 62, 23, 30, 63, 31, 64,
33, and 41 in .artifacts/plan-runner/auth-sessions/ (10.md, 43.md, …), in that order, unchanged.
Skip one that already appears in the scratchpad.

Then close the set. Move 44-mobile-change-password-screen.md to
.llm/plans/completed/auth-sessions/ and confirm every other numbered plan is there. Move
00-REQUEST.md, 00-SUMMARY.md, 00-EXECUTION-ORDER.md, and COPY-PASTA.md there, and remove the
empty active directory. Leave .llm/plans/active/auth-sessions-stream-close/ alone. If prompt 10 or
60 reported the linear baseline archives were not regenerated, put make db_regen_linear_baseline
first in the Root block.

End with the cumulative verification for the whole set, assuming no earlier prompt was tested.
One fenced bash block per tab, fish-safe, labeled with the tab name. Tell the operator that
Docker, Mobile E2E Metro, Mobile E2E API, and Mobile E2E iOS or Mobile E2E Android must be
running, and that Mobile E2E API must be restarted after make test_deps and the package build so
it serves the session and change-password routes and the new seeded accounts. Do not put
leave-running commands in the blocks. Say to run the Mobile Maestro block only after the Root web
reports finish: auth-sessions.yaml and the web session specs end sessions for seeded users. Note
that there is no dependency change, so no lockfile step. Say that auth-sessions-stream-close runs
after this branch and realtime-banner-notifications are both merged.

Root:
npm run i18n:compile
npm run i18n:validate
npm run build:packages
npm run lint
npm run type-check
npm run test:unit
npm --prefix apps/mobile run test
make db_verify_linear_baseline
make test_deps
npm run test:e2e:api
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/api
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/management-api
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/workers
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/cron
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/db
make e2e_test_report_scoped WEB_SPEC=e2e/web-session-renewal.spec.ts,e2e/web-session-ended-notice.spec.ts,e2e/settings-account-sessions.spec.ts,e2e/settings-account-change-password.spec.ts,e2e/sign-up-legal-consent.spec.ts,e2e/set-password-invite-session.spec.ts MGMT_SPEC=e2e/users-detail-force-logout.spec.ts,e2e/admins-force-logout.spec.ts,e2e/auth-session-notice.spec.ts
open .artifacts/e2e-reports/latest/index.html

Mobile Maestro:
npm run mobile:e2e:test -- auth-login,auth-logout,auth-sessions,auth-change-password
open .artifacts/mobile-e2e-reports/latest/failures.json
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
```

- [ ] **abcaicast** (optional)

After this set, do you want an abcaicast for this work?
