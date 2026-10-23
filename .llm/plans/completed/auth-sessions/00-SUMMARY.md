# Auth sessions and remote logout — summary

Request and operator answers: [00-REQUEST.md](00-REQUEST.md). Prompts and models: `COPY-PASTA.md`
(written by the planning run's Close step).

## Planning notes

- Other work is landing in the tree. Plans anchor by symbol, route, and key prefix rather than line
  numbers, and each implementation plan starts by re-checking that its listed paths still exist.
- Rows quoted from the Recommended design are asks too: the operator accepted it with "Proceed with
  what you recommend". A "Settled" note means the request already decides the row and the plan
  transcribes that decision.
- **Open questions are asked once, by area A's step (planning step 02).** It runs alone in wave 1,
  and its schema touches most of them (device label, revoke reason, idle expiry, a management
  sibling table). It asks all five open questions from 00-REQUEST.md in one stop and records the
  answers under `## Operator answers` in 00-REQUEST.md. Every later step reads them there. The rows
  stay with the area that implements the answer.
- Linear migration file numbers are taken at implementation time: the `realtime-banner-notifications`
  set also adds app migrations. Plans name a migration by topic and say "the next free number in
  `linear-migrations/app/`" (or `management/`), not a fixed number.
- The current API auth is in `apps/api/src/lib/auth/index.ts` (one web JWT for
  `AUTH_JWT_EXPIRATION`, never renewed; a mobile access/refresh pair, refresh not rotated; no
  server-side revocation). `verifyTokenAndMembership` and `refreshMobileToken` already load the
  account through `getAccountMatchingJwtIdentity`, which is where the session check rides.

## Requirement ledger

- **R1** (area B) "It seems fishy to me that the web has such a long expiration while mobile has a short one." (answer from the code: why the two differ) — Plan: 20
- **R2** (area B) "we are not a highly sensitive information app, so we do not want to forcibly log out users anytime soon" — Plan: 20
- **R3** (area B) "But I think that year expiration may be a misunderstanding about how token refreshes work. I'm not sure." (answer from the code) — Plan: 20
- **R4** (area B) "the user should be able to not visit the website for many weeks and still be logged in when they get there" (web) — Plan: 20
- **R5** (area B) "Are there any changes you would recommend for us to get that user experience?" — Settled: the Recommended design, accepted with "Proceed with what you recommend" — Plan: 20
- **R6** (area D) "It seems, but I'm not sure, like that is already how it works on mobile, where a login will stay valid for a long, long time" (answer from the mobile client code: when and how it refreshes, and what survives an app restart) — Plan: 40
- **R7** (area B) "but you're telling me 900 seconds is the expiration, which is confusing to me" (explain access versus refresh lifetimes) — Plan: 20
- **R8** (area B) "if you think web is doing something incorrectly, that we can. Still, get the end result user experience that we're looking for without that year long expiration" — Plan: 20
- **R9** (area B) "I want you to include in this plan set to fix that process." — Settled: this separate set holds the fix — Plan: 20
- **R10** (Close) "create high-level placeholder files for making the changes we want to make later" — Settled: this plan set is those files — Plan: this set, plans 10–66; plans 70–71 in `auth-sessions-stream-close`
- **R11** (area B) "add the ability to forcibly remotely log out accounts" (the server mechanism; the surfaces are R26–R29, R31) — Plan: 20
- **R12** (area B) "the best possible setup for our auth handling between web and mobile and any other potential future client" (also the answer "not a web-only patch") — Plan: 20
- **R13** (area B) "A user who has not visited for many weeks is still logged in when they return, on web and on mobile." (server lifetimes for both clients) — Plan: 20
- **R14** (area B) "No forced logouts in normal use." (includes refresh-rotation edge cases such as two refreshes racing, or a refresh response lost in transit) — Plan: 20
- **R15** (area A) "Sessions can be ended from the server." — Plan: 10
- **R16** (area A) "Each login creates a session row: account, client type (web, mobile, future clients), a device label, created, last seen, revoked." — Plan: 10
- **R17** (area B) "The web cookie and the mobile refresh token each identify their session. A future client uses the same mechanism." — Plan: 20
- **R18** (area B) "Every authenticated request checks the session in the account lookup it already makes: a revoked or missing session is a 401." — Plan: 20
- **R19** (area B) "Revocation takes effect on the next request, with no wait for a token to expire." (mobile access tokens included) — Plan: 20
- **R20** (area B) "A web request on a session last renewed more than a day ago extends the cookie and the session's last seen." — Plan: 20
- **R21** (area C) "The cookie lifetime becomes an idle limit, not a limit from login." (web: the renewed cookie reaches the browser on every kind of visit, including pages rendered on the web server through `apps/web/src/utils/auth/ssrAuth.ts` and `apps/web/src/middleware.ts`) — Plan: 30
- **R22** (area B) "Mobile keeps short access tokens and long refresh tokens, with the refresh token rotated on every refresh and bound to its session." — Plan: 20
- **R23** (area B) "Using an already-rotated refresh token is treated as theft: it revokes that session." — Plan: 20
- **R24** (area D) "with the refresh token rotated on every refresh" (mobile client: store each rotated token durably and never send a rotated one, so normal use is never read as theft) — Plan: 40
- **R25** (area B) "One idle limit for every client, so web and mobile behave the same." — Plan: 20
- **R26** (area B) "The user can sign out one session or every other session." (API: list sessions, sign out one, sign out every other; shape per R41) — Plan: 22
- **R27** (area C) "The user can sign out one session or every other session." (web) — Plan: 32
- **R28** (area D) "The user can sign out one session or every other session." (mobile) — Plan: 42
- **R29** (area E) "An admin can force-logout an account from management-web (management API)." — Plan: 50, 51
- **R30** (area B) "A password change … end[s] every other session." (API set-password, reset-password, and any other password change path) — Plan: 21, 23
- **R31** (area E) "A password change … end[s] every other session." (an admin setting a user's password through `POST /users/:id/password` in the management API ends that user's sessions) — Plan: 50, 51
- **R32** (area A) "and account deletion, end every other session." (deletion from the API and from the management API) — Plan: 10
- **R33** (area B) "`logout` and `revokeMobileToken` revoke the calling session on the server." — Plan: 20
- **R34** (area G) "Revoking a session publishes an event that closes that session's open streams right away." — Plan: `auth-sessions-stream-close` 70, 71
- **R35** (area G) "Until this lands, that set caps a stream's lifetime at 30 minutes." (whether the cap stays once revocation events close streams) — Plan: `auth-sessions-stream-close` 70
- **R36** (area B) "Rollout keeps existing logins. Tokens issued before sessions exist must not log everyone out at deploy." (superseded by R63 in the first review: no legacy-token path) — Plan: (superseded by R63)
- **R37** (area B) "The planning run picks how: a one-time grace path that turns a valid legacy token into a session on first use, or another approach with the same user outcome." (superseded by R63) — Plan: (superseded by R63)
- **R38** (area A) "retention and cleanup of old rows" (Likely areas) — Plan: 10, 11
- **R39** (area B) "env vars and docs" (Likely areas: the `AUTH_*` lifetimes in `apps/api/.env.example`, `apps/api/ENV.md`, config, startup validation, and k8s env) — Plan: 20
- **R40** (area B) Open question 1: "Idle limit length. Proposed: 365 days, matching mobile today." (asked by step 02) — Plan: 20
- **R41** (area B) Open question 2: "Does the user get a screen listing their sessions (device label, last seen) with per-session sign-out, on web and mobile, or only a "Sign Out of All Other Devices" action?" (API shape; asked by step 02) — Plan: 22
- **R42** (area E) Open question 3: "Can an admin end one session, or only all of an account's sessions?" (asked by step 02) — Plan: 50, 51
- **R43** (area B) Open question 4: "Should the signed-out device show a reason ("You were signed out from another device"), or the ordinary logged-out state?" (what the 401 carries; asked by step 02) — Plan: 20
- **R44** (area C) Open question 4: "Should the signed-out device show a reason" (web: what the signed-out browser shows) — Plan: 31, 33
- **R45** (area D) Open question 4: "Should the signed-out device show a reason" (mobile: what the signed-out app shows) — Plan: 41, 42
- **R46** (area F) Open question 5: "Do management-web admin logins use the same session model, or stay as they are?" (asked by step 02) — Plan: 60, 61, 62, 63, 64, 65, 66
- **R47** (area B, planning step 09) First review: "changing your own password ends every other session, and the browser or device that made the change stays signed in" (the app; the route is R52, the screens R53 and R54) — Plan: 23
- **R48** (area F) First review: "changing your own password ends every other session, and the browser or device that made the change stays signed in" (management; "plan 63 already matches") — Plan: 63
- **R49** (area B, planning step 09) First review: "A forgotten-password reset ends every session." — Plan: 21
- **R50** (areas E and F) First review: "An admin setting another user password still ends all of that user sessions." — Plan: 50, 63
- **R51** (area B, planning step 09) First review: "Add a signed-in POST /account/change-password that takes the current and new password, ends every other session, and keeps the caller session" — Plan: 23
- **R52** (area C, planning step 12) First review: "add a Change Password form in web Settings → Account" — Plan: 35
- **R53** (area D, planning step 12) First review: "and a matching mobile Settings screen" — Plan: 44
- **R54** (areas C and D, planning step 12) First review: "with catalog keys, Playwright, and Maestro coverage" (the change-password forms) — Plan: 35, 44
- **R55** (area B, planning step 09) First review: "Invite completion (POST /account/set-password) ends every session." — Plan: 21
- **R56** (area C, planning step 11) First review: "remove the confirm-password field from every form: web Sign Up" — Plan: 34
- **R57** (area C, planning step 11) First review: "Reset Password" (web) — Plan: 34
- **R58** (area C, planning step 11) First review: "and Set Password" (web) — Plan: 34
- **R59** (area D, planning step 11) First review: "mobile Sign Up" — Plan: 43
- **R60** (area F, planning step 11) First review: "management-web Redeem Admin Invite" — Plan: 52
- **R61** (area E, planning step 11) First review: "and Edit User" (management-web) — Plan: 52
- **R62** (areas C and D, planning step 12) First review: "The new change-password forms use one current-password field and one new-password field, with no show-password toggle." — Plan: 35, 44
- **R63** (all areas, planning step 10) First review: "plans should make the deepest correct changes, including greenfield schema edits with no upgrade or compatibility paths" (supersedes R36 and R37) — Plan: 10, 20, 30, 60, 62
- **R64** (area B, one-at-a-time review after the second pass) "Sign-up rule for change password, and also apply it to reset and set-password so all four paths match" — Plan: 21, 23

## Areas

### A. Session model (plans 10–19)

- **Rows:** R15, R16, R32, R38
- **Scope:** the app-database linear SQL migration and entity for session rows (account, client
  type, device label, created, last seen or last renewed, idle expiry, revoked at and reason, and
  whatever refresh-rotation state area B needs, such as the current refresh token id), the ORM
  service (create, touch, find active, revoke one, revoke all for an account, revoke all but one),
  deletion with the account, retention and cleanup of expired and revoked rows (a workers purge on
  the existing retention pattern), and the `0004_` baseline regeneration per the linear-migration
  rule. Also asks the five open questions (Planning notes).
- **Starts from:** `packages/orm/src/entities/account/` (for example `accountFCMDevice.ts` and
  `accountWebPushDevice.ts`, which already hold per-device rows),
  `packages/orm/src/services/account/`, `infra/k8s/base/ops/source/database/linear-migrations/app/`,
  `apps/workers/src/config/index.ts` (`resolveRetentionDays`) and
  `apps/workers/src/commands/orm/notifications/platformPurge.test.ts` as the purge pattern.
- **Depends on:** none.
- **Shared files:** with E and F — the ORM session service they call. With F — the baseline
  regeneration (`make db_regen_linear_baseline` rewrites both `0004_` and `0005_`) if F adds a
  management migration. With the `realtime-banner-notifications` set — the app migration
  sequence and the `0004_` baseline.

### B. API auth (plans 20–29)

- **Rows:** R1, R2, R3, R4, R5, R7, R8, R9, R11, R12, R13, R14, R17, R18, R19, R20, R22, R23, R25,
  R26, R30, R33, R36, R37, R39, R40, R41, R43
- **Scope:** login creating a session for web and mobile; the session id carried by the web JWT and
  the mobile tokens; the session check inside `verifyTokenAndMembership` and `refreshMobileToken`;
  web cookie and session renewal at most once a day; one idle limit for every client; refresh
  rotation with reuse detection that cannot fire in normal use (racing refreshes, a lost
  response); `logout` and `revokeMobileToken` revoking the calling session; password change and
  reset ending every other session; user session endpoints (list, sign out one, sign out every
  other) per the device-list answer; the 401 reason per the notify answer; env vars and docs; shared DTOs and payload guards in `@podverse/helpers` and request
  helpers in `@podverse/helpers-requests`; OpenAPI and integration tests. Answers R1, R3, and R7 in
  its plan prose.
- **Starts from:** `apps/api/src/lib/auth/index.ts`, `apps/api/src/routes/auth.ts`,
  `apps/api/src/routes/account.ts` and `apps/api/src/controllers/account/account.ts`
  (`resetPassword`, set-password, `delete`), `packages/helpers/src/lib/auth.ts`
  (`isMobileRefreshJwtPayload`), `apps/api/src/config/index.ts`,
  `apps/api/src/lib/startup/validation.ts`, `apps/api/.env.example`, `apps/api/ENV.md`,
  `apps/api/openapi.yml`.
- **Depends on:** A (session entity and service).
- **Shared files:** with C and D — the session DTOs, 401 reason code, and request helpers they
  consume. With G — the revocation call sites in `apps/api/src/lib/auth/index.ts` and the account
  controller where G publishes. With E — the revocation semantics E reuses from the management API.

### C. Web client (plans 30–39)

- **Rows:** R21, R27, R44
- **Scope:** making sure the renewed cookie reaches the browser on server-rendered visits as well as
  client requests (`ssrAuth.ts`, `middleware.ts`); the web session management UI in Settings per
  the device-list answer; the signed-out state or reason per the notify answer; i18n; Playwright
  coverage.
- **Starts from:** `apps/web/src/utils/auth/ssrAuth.ts`, `apps/web/src/middleware.ts`,
  `apps/web/src/app/settings/SettingsClient.tsx`, the web auth context and logout flow.
- **Depends on:** B (renewal contract, session endpoints, 401 reason).
- **Shared files:** with D and E — the shared i18n catalogs, if they add keys to the same layer.

### D. Mobile client (plans 40–49)

- **Rows:** R6, R24, R28, R45
- **Scope:** answering whether mobile already keeps a login for a long time (R6); storing each
  rotated refresh token durably and keeping refresh single-flight so a rotated token is never
  resent; the mobile session management screen per the device-list answer; the signed-out state or
  reason per the notify answer; i18n; Maestro coverage per **mobile-test-economics**.
- **Starts from:** `apps/mobile/src/auth/authRequestWithRefresh.ts`,
  `apps/mobile/src/auth/AuthProvider.tsx`, `apps/mobile/src/auth/loginWithMobileToken.ts`,
  `apps/mobile/src/auth/logoutWithMobileRevoke.ts`,
  `apps/mobile/src/screens/more/MoreSettingsScreen.tsx`.
- **Depends on:** B (rotation contract, session endpoints, 401 reason).
- **Shared files:** with C and E — the shared i18n catalogs.

### E. Admin force-logout (plans 50–59)

- **Rows:** R29, R31, R42
- **Scope:** a management API route that ends an account's sessions (one or all, per the admin
  granularity answer), with superuser or permission checks matching the users routes; ending a
  user's sessions when an admin sets their password; the management-web control on the user
  detail page; i18n; management API integration tests, OpenAPI, and a Playwright spec.
- **Starts from:** `apps/management-api/src/routes/users.ts` (`POST /:id/password`,
  `DELETE /:id`), `apps/management-api/src/orm/db/appDb.ts`, `apps/management-api/openapi.yml`,
  `apps/management-web/src/app/(management)/users/[id]/`.
- **Depends on:** A (ORM session service), B (revocation semantics and reason).
- **Shared files:** with G — the management API revocation call sites where G publishes. With C
  and D — i18n catalogs, if the same layer.

### F. Management admin sessions (plans 60–69)

- **Rows:** R46
- **Scope:** per the management-web auth answer. If admin logins stay as they are, the step answers
  R46 and writes no plan. If they use the same model, it plans a management-database session table
  and the matching changes in the management API auth, mirroring areas A and B.
- **Starts from:** `apps/management-api/src/lib/auth/index.ts`,
  `apps/management-api/src/orm/services/adminAccount.ts`,
  `infra/k8s/base/ops/source/database/linear-migrations/management/`.
- **Depends on:** A and B (the model it mirrors).
- **Shared files:** with A — the baseline regeneration, when F adds a management migration.

### G. Realtime revocation hook (plans 70–79)

Moved to the `auth-sessions-stream-close` set (plans 70 and 71) after the second pass, so this set
and `realtime-banner-notifications` can run in separate worktrees. That set runs after both merge.

- **Rows:** R34, R35
- **Scope:** when a session is revoked from the API or the management API, publish an event through
  the account event stream's Redis fanout so that session's open streams close at once; tie the
  stream to its session; decide whether the 30-minute stream cap stays.
- **Starts from:** the `realtime-banner-notifications` set's plans 10–19 (stream contract, Redis
  fanout and wiring, API stream), and areas B and E's revocation call sites.
- **Depends on:** B and E (the revocation points it publishes from). Outside this set: the
  `realtime-banner-notifications` stream and fanout must land before G's implementation runs.
- **Shared files:** with B — `apps/api/src/lib/auth/index.ts` or the revocation helper B creates.
  With E — `apps/management-api/src/routes/users.ts` or the management revocation helper.

## Order

First planning pass, four waves:

- **Wave 1:** A (step 02). Asks the five open questions.
- **Wave 2:** B (step 03), after A.
- **Wave 3:** C, D, E, and F at once (steps 04–07), after B; E and F also after A.
- **Wave 4:** G (step 08), after B and E.

Second pass, after the first review (answers in 00-REQUEST.md under "### Review of the first planning pass"), two waves:

- **Wave 1, at once:**
  - Step 09 revises plan 21 (R49, R55) and writes plan 23, the signed-in change-password route (R47, R51).
  - Step 10 removes every legacy-token and compatibility path from the existing plans except 21 (R63, superseding R36 and R37).
  - Step 11 writes the confirm-password removal plans: 34 (web), 43 (mobile), and 52 (management-web) (R56–R61).
- **Wave 2:** step 12 writes the change-password forms, plan 35 (web) and plan 44 (mobile) (R52–R54, R62), after steps 09 and 11.

Implementation order: [00-EXECUTION-ORDER.md](00-EXECUTION-ORDER.md), 15 phases. Plans 70 and 71
need the `realtime-banner-notifications` set's stream and publisher, so they moved to the
`auth-sessions-stream-close` set, which runs after this set and the realtime set are both merged.

R48 and R50 need no new plan: plans 50 and 63 already match. Every decision stands as written except D14 (replaced by the password-change answers) and D7 and D8 (dropped with the legacy-token path).

## Decisions settled after the second pass

The operator settled these one at a time after the second planning pass. They stand as written in
the plans named.

- **Set split.** Plans 70 and 71 moved to `auth-sessions-stream-close`. This set and
  `realtime-banner-notifications` run in separate worktrees; whichever merges second resolves the
  shared files, renumbers its migration, and reruns `make db_regen_linear_baseline`.
- **Wrong current password** (plan 23): 400 with `current_password_incorrect`. The operator asked
  for best practice; a 401 would sign the client out, and the rate limit is what stops guessing.
- **Password rule** (plans 21, 23, R64): every path that sets a password uses the sign-up rule.
  `AccountService.resetPassword` applies it and returns `'changed'` or `'invalid_new_password'`;
  reset, set-password, and change password all call it. Plan 23 adds no ORM method.
- **Rate limit** (plan 23): 4 per account per 10 minutes, `ACCOUNT_CHANGE_PASSWORD_MAX_PER_10_MINUTES`.
- **Same password** (plan 23): accepted, and the other sessions still end.
- **`revoked_count`** (plan 23): in the response.
- **Pending reset links** (plan 23): a change voids them.
- **Lapsed membership or unaccepted terms** (plan 23): change password still works.
- **Legacy cleanup** (plans 20, 62): plan 62 deletes the shared `DEFAULT_AUTH_*` exports;
  "Re-authentication required" is removed; each API keeps one no-session-id rejection test.
- **Web form placement** (plan 35): a modal opened from a Change Password section, matching
  Change Email. The operator reversed the inline layout.
- **Success copy** (plans 35, 44): a fixed sentence with no device count.
- **E2E accounts** (plans 35, 44): dedicated per-platform accounts.
- **Password-module mock leak** (plans 20, 21, 23): `startTestApp({ accountSessions: 'real' })`
  and `auth.test.ts`'s `afterAll` unmock `lib/auth/password.js`, and each file that checks real
  passwords keeps a pair of cases (right password succeeds, wrong one fails) so a leaked fake
  fails one of them.

## Decisions to review

Product choices the planning steps made that the request and answers did not settle. Each names
its step and plan, the choice, and the main alternative. Answer by number (for example "D14: keep
the requester's browser signed in"); an item with no answer stands as written.

Two points run across areas and are worth a look first:

- **D14 and D46** treat a password change differently. In the app, reset and set-password end
  every session, including the browser that made the change (plan 21). In management, an admin
  setting their own password keeps the browser they used (plan 63). The request (R30) says "end
  every other session".
- **D11** was changed by a later step. Plan 20 now leaves the cookie alone on public routes (step
  04's edit, D18), so D11 is listed as it stands in plan 20 today.

### Step 02 — Area A, session model (plans 10, 11)

- **D1** (plan 10) Refresh rotation: the previous refresh token stays accepted with no time limit
  until the client presents the current one; presenting either rotates; any other token ends the
  session as suspected theft. *Alternative:* a short grace window (about a minute) for the previous
  token, which would sign out a device that retries a lost refresh after the window.
- **D2** (plan 10) The database stores only SHA-256 hashes of refresh token ids, and the ORM
  function mints the ids. *Alternative:* store raw ids, or have the API mint them.
- **D3** (plan 10) An admin setting a user's password gets its own reason, `admin_password_set`,
  but the device shows "Your password was changed". *Alternative:* show "An administrator signed
  you out".
- **D4** (plan 10, implemented in plan 20) A new login on a browser that already holds a session
  ends the old session with reason `signed_out`, so the device list shows no duplicates.
  *Alternative:* let the old row expire on its own.
- **D5** (plan 10) Each row stores its own idle expiry, so changing the idle limit applies at each
  session's next renewal. *Alternative:* compute it from config on every read, which would expire
  or revive every session at once.
- **D6** (plan 11) Expired and ended rows share one retention rule: deleted 30 days after idle
  expiry (`ACCOUNT_SESSION_RETENTION_DAYS`, default 30). Ending a session does not change idle
  expiry, so a signed-out device that returns within 365 days still sees its reason.
  *Alternative:* a separate, shorter retention for ended rows.

### Step 03 — Area B, API auth (plans 20, 21, 22)

- **D7** (plans 10, 20) Existing tokens move onto sessions by hash: one session row per legacy
  token, unique constraint plus find-or-create, so parallel first requests share a row.
  *Alternative:* a new row on each first use (duplicate rows), or a cutoff date that signs everyone
  out.
- **D8** (plan 20) Old mobile access tokens get a plain 401; the app then refreshes and moves onto
  a session. *Alternative:* accept them until their 15 minutes run out.
- **D9** (plan 20) Device label format is `Browser · OS` from the User-Agent; mobile sends an
  optional `device_label`, falling back to the platform header. *Alternative:* an English phrase
  such as "Chrome on macOS".
- **D10** (plan 20) Web tokens sent as a bearer header get their row renewed but no new token.
  *Alternative:* return a new token in a response header.
- **D11** (plan 20, as amended by step 04) Public routes treat an ended session as signed out and
  return no 401; they leave the cookie in place so the next signed-in route can return the reason.
  *Alternative:* return a 401 with the notice on every route.
- **D12** (plan 20) One `AUTH_SESSION_IDLE_EXPIRATION` replaces `AUTH_JWT_EXPIRATION` and
  `AUTH_MOBILE_REFRESH_TOKEN_EXPIRATION` in the API only; the renewal interval is a fixed one day in
  code. *Alternative:* separate lifetimes per client, or the renewal interval as an env var.
- **D13** (plan 20, R18) The session check runs next to the account lookup as a separate indexed
  query, not a join. *Alternative:* fold it into the TypeORM account query.
- **D14** (plan 21) Reset-password and set-password end every session, including the requester's,
  because those routes are public and the request carries no session to keep. *Alternative:* keep
  the requesting browser's session. See the cross-area note above.
- **D15** (plan 22) The session list's `last_seen_at` is accurate only to within a day.
  *Alternative:* touch the row on every request.
- **D16** (plan 22) Session routes live under `/auth/sessions`, and deleting your own session acts
  as logout. *Alternative:* `/account/sessions`, which collides with the catch-all
  `GET /account/:id_text`.
- **D17** (plan 20) `/auth/mobile/revoke` ends the session for any validly signed refresh token and
  always returns 200. *Alternative:* require the current or previous token.

### Step 04 — Area C, web client (plans 30–33)

- **D18** (plan 20 edit) Public routes keep the cookie when the session has ended; the next route
  that requires sign-in returns the reason and clears it. *Alternative:* keep clearing on public
  routes and send the reason in a response header the web reads on successful responses.
- **D19** (plan 30) The middleware asks the API for renewal only when the cookie is at least a day
  old. *Alternative:* call the API on every page request, or add a separate renewal route.
- **D20** (plans 31, 33) The reason appears in a dialog after the sign-out reload, once per tab.
  *Alternative:* a toast or a banner.
- **D21** (plans 31, 33) An ended session clears this browser's Add by RSS credentials, only when
  the server gave a reason; a plain failure such as an unreachable API keeps them. *Alternative:*
  leave the credentials in place.
- **D22** (plan 33) An open page signs out on its first refused request. *Alternative:* wait for
  the next full page load.
- **D23** (plan 32) The Signed-In Devices list sits in Settings → Account, between Download My
  Data and Delete Account. *Alternative:* a separate Settings tab.
- **D24** (plan 32) Signing out one other device needs no confirmation; "Sign Out of All Other
  Devices" does. *Alternative:* a confirmation on every row.
- **D25** (plan 32) This device's row has a Sign Out button that works like Logout.
  *Alternative:* no button on this device's row.
- **D26** (plan 32) "Last Used" shows a date only, since the API tracks it to within a day.
  *Alternative:* date and time.

### Step 05 — Area D, mobile client (plans 40–42)

- **D27** (plan 40) A failed secure-storage write after a refresh keeps the old refresh token and
  carries on; the server still accepts the previous token (D1). *Alternative:* sign out, or throw.
- **D28** (plan 40) Callers may still pass a refresh token, but the saved token always wins.
  *Alternative:* thread the saved token through every caller.
- **D29** (plan 41) The reason is stored in a new pref, `auth.forced_logout_notice`, next to the
  existing timestamp. *Alternative:* change the stored timestamp's format.
- **D30** (plan 41) The dialog shows the reason sentence, then the existing local-data warning,
  joined by a space on one line. *Alternative:* a separate line.
- **D31** (plan 41) Sign-outs that happen in background work now also leave the notice for the
  user; today they sign out silently. *Alternative:* keep them silent.
- **D32** (plan 41) The client's `refresh_token_reuse_detected` check is removed, because plan 20
  answers reuse with a 401 carrying the `security` reason. *Alternative:* keep the check.
- **D33** (plan 42) The mobile session list matches web plan 32: Sign Out on every row (this
  device's row works like Logout), no confirm for one other session, confirm for Sign Out of All
  Other Devices, and this device listed first. *Alternative:* no button on this device's row.
- **D34** (plan 42) Mobile device labels: "iPhone · iOS", "iPad · iOS", "<manufacturer model> ·
  Android", otherwise the platform alone. *Alternative:* an English phrase, per D9.
- **D35** (plan 42) The Signed-In Devices settings row is always shown; signed out, the screen
  shows a login prompt rather than a membership gate. *Alternative:* hide the row when signed out.
- **D36** (plan 42) In Maestro, Sign Out of All Other Devices is cancelled, never confirmed,
  because the iOS and Android slots share the seeded account. *Alternative:* a seeded account per
  platform so the flow can confirm it.

### Step 06 — Area E, admin force-logout (plans 50, 51)

- **D37** (plan 50) Force-logout returns `{ message: 'User signed out', sessions_ended }`; the
  password route stays message-only. *Alternative:* a message only.
- **D38** (plan 50) An account with no sessions still returns 200 with `sessions_ended: 0`.
  *Alternative:* 404.
- **D39** (plan 51) After Force Logout the admin stays on the user detail page. *Alternative:*
  redirect to the users list, as delete does.
- **D40** (plan 51) The edit page's password success sentence now says the user was signed out of
  every device. *Alternative:* keep "Password changed successfully."

### Step 07 — Area F, management admin sessions (plans 60–66)

- **D41** (plan 64) No session list in management-web; the API can list and end the signed-in
  admin's own sessions, and the management control is Force Logout. *Alternative:* a screen under
  My Settings.
- **D42** (plan 61) The admin-session purge runs as a management API one-shot, because workers have
  no management-database connection. *Alternative:* give workers those credentials.
- **D43** (plan 62) Bearer still wins over the cookie in the management API. *Alternative:* read the
  cookie first, as the main API does.
- **D44** (plan 62) Management revoke still answers "Mobile token family revoked". *Alternative:*
  the main API's new wording.
- **D45** (plan 60) Admin session times are stored with a time zone. *Alternative:* the
  timezone-less timestamps the older management tables use.
- **D46** (plan 63, from the step's plan summary) Redeeming an invite ends every session; an admin
  setting their own password ends every other session and keeps the browser they used; setting
  another admin's password ends all of theirs. See the cross-area note above.

### Step 08 — Area G, realtime revocation hook (plans 70, 71)

- **D47** (plan 70) The stream-close event is published from plan 10's ORM revoke functions, which
  also catch refresh-token reuse. *Alternative:* publish from `accountSessionStore.ts` and
  `endUserAccountSessions`, as steps 03 and 06 suggested.
- **D48** (plan 70) The event lists the ended session ids. *Alternative:* "every session except X",
  which could close a new login's stream if the event arrives late.
- **D49** (plan 70) The stream route's session-ended 401 keeps the `jwt` cookie, because
  `EventSource` cannot read the 401 body. *Alternative:* plan 20's rule of clearing it on every
  signed-in 401.
- **D50** (plan 70, R35) The 30-minute stream cap stays, covering events lost in a Redis outage,
  deleted accounts, and rebalancing after a scale-out. *Alternative:* drop or lengthen the cap, or
  re-check every open stream's session when Redis recovers.
- **D51** (plan 70) Account deletion publishes no stream event; the stream ends at the cap and the
  device's next request is a 401. *Alternative:* publish from both deletion paths.
- **D52** (plan 70) The hub remembers ended sessions for 60 seconds, so a stream that registers just
  after its session ended still closes. *Alternative:* accept that gap until the cap.
- **D53** (plan 70) No mobile change: the mobile stream ignores the event, and its reconnect gets
  the notice from the refresh 401 (plan 41) within about a second. *Alternative:* a mobile handler
  for `session.ended`.
- **D54** (plan 71) A `session.ended` event with a null notice does not stop the web stream (your
  own sign-out, or a new login replacing the session in the same browser). *Alternative:* stop on
  every `session.ended`, leaving a newly signed-in page without a stream until it reloads.
