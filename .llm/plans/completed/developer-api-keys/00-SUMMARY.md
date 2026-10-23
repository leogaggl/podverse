# Developer API keys — summary

Request and operator answers: [00-REQUEST.md](00-REQUEST.md). Prompts and models: `COPY-PASTA.md`
(written by the planning run's Close step).

## Planning notes

- Plan against `feature/combined`. The account-session work (`account_session`, `sid` claims,
  `checkAccountSession`, the Sessions UI on web and mobile) is already on this branch; API keys sit
  beside it and do not replace or reshape it.
- An API key is a third credential: not the web session cookie, not the mobile access/refresh
  pair. It arrives as `Authorization: Bearer …`, so the auth path must tell a key apart from a
  Bearer session JWT before JWT verification (`readRequestToken` in
  `apps/api/src/lib/auth/sessionTokens.ts`, `verifyTokenAndMembership` in
  `apps/api/src/lib/auth/index.ts`).
- Metaboost (`../metaboost`) is the reference for the CRUD bitmask only (create=1, read=2,
  update=4, delete=8). It has no user-issued key tables; issuance, hashing, revocation, expiry, and
  last-used tracking are new design here.
- Auth is applied inside controllers, not in `apps/api/src/routes/*.ts`: about 40 controller files
  under `apps/api/src/controllers/` call `ensureAuthenticated` or `optionalEnsureAuthenticated`.
  Per-route permission enforcement (area B) touches those callers; the key branch in the auth
  middleware itself (area A) does not.
- The latest app linear migration is `0026_drop_legacy_stats.sql`. Area A's migration is
  `0031_…`, because the popularity anti-gaming branch owns `0027`–`0030` and merges first (R81);
  it regenerates the `0004_` baseline (root `AGENTS.md`). Parallel worktrees may collide
  on that number (**git-worktree-sibling** § Across parallel worktrees).
- `apps/api/openapi.yml` (about 19.5k lines, about 257 paths against about 262 route handlers) is
  already served at `<baseUrl>/docs.yaml` and Swagger UI at `<baseUrl>/docs` by
  `apps/api/src/lib/docs/registerSwaggerDocs.ts`. It declares `cookieAuth` and a `bearerAuth`
  scheme with `bearerFormat: JWT`. `.cursor/rules/openapi-sync.mdc` and root `npm run openapi:check`
  apply. It is a large file; anchor edits by path and component name.
- Management-api and management-web get no key UI or admin revoke in this set. Account deletion
  from any surface must still remove a user's keys (a schema concern for area A).
- Rows that name a surface in parentheses split one ask by surface. Area A owns the shared model
  and API; area B owns enforcement on existing routes; areas C and D own what the user sees; area
  E owns the spec's accuracy.
- A "Settled" note means the operator answers already decide the row and the plan transcribes it.

## Requirement ledger

- **R1** (area A) "you can look to MetaBoost for an example. You may also deviate from MetaBoost if you think it's inadequate" (the permission model and key handling; record any deviation and why) — Plan: plan 10
- **R2** (area A) "I thought that we had fairly well established CRUD and bearer token handling in it." (question: what Metaboost actually has; Settled in Orientation: the bitmask is borrowable, Bearer handling is session JWT only) — Plan: plan 10
- **R3** (area C) "This token issuance process and permission setting would need an experience within the web" — Plan: plan 31
- **R4** (area D) "and mobile app" (the token issuance and permission setting experience on mobile) — Plan: plans 40, 42
- **R5** (area C) "Is there already a developer tab, page, screen?" — Settled: no on web or mobile — Plan: plan 30
- **R6** (area C) "We would want something like that." (web) — Plan: plan 30
- **R7** (area D) "We would want something like that." (mobile) — Plan: plan 41
- **R8** (area A) "it should still be easy to use for developers" (API: key format, header, and clear error responses when a key is missing a permission, expired, revoked, or blocked) — Plan: plans 10, 12
- **R9** (area C) "it should still be easy to use for developers" (web Developer tab) — Plan: plans 30, 31
- **R10** (area D) "it should still be easy to use for developers" (mobile Developer screen) — Plan: plans 40, 41
- **R11** (area E) "it should still be easy to use for developers" (the spec explains how to send a key and what each operation needs) — Plan: plan 51
- **R12** (area A) "did we add the option for Bearer token auth for Agents/MCP-servers?" — Plan: plan 12
- **R13** (area A) "Would that be a different process than how mobile login works?" — Settled in Glossary: a key is distinct from the session JWT and the mobile access/refresh pair — Plan: plan 12
- **R14** (area A) "the Bearer token is something generated on in the Web UI and shown once" (API: the secret is returned only in the create response and stored hashed) — Plan: plans 11, 13
- **R15** (area C) "the Bearer token is something generated on in the Web UI and shown once" (web) — Plan: plan 31
- **R16** (area D) "the Bearer token is something generated on in the Web UI and shown once" (mobile) — Plan: plan 42
- **R17** (area A) "creating and revoking keys" (API endpoints) — Plan: plan 13
- **R18** (area A) "which we could allow custom CRUD permissions for" (the stored permission model) — Plan: plans 10, 11
- **R19** (area B) "which we could allow custom CRUD permissions for" (enforcement on each authenticated route) — Plan: plans 20, 21, 22, 23
- **R20** (area B) "that way the agent could use the bearer token and mcp server to affect change" (a key with write permissions can create, update, and delete on the routes those permissions cover) — Plan: plans 20, 21, 22, 23
- **R21** (area E) "make suer the openapi.yaml file (or what ever it is called) is kept up to date" — Plan: plans 50, 51
- **R22** (area E) "that is what the MCP server needs to do stuff" (the spec is usable by a tool that reads it: security per operation, the permission each operation needs) — Plan: plan 51
- **R23** (area A) "per-resource CRUD checkboxes in the Metaboost bitmask style (for example playlists, queue, subscriptions, clips, history)" (the resource catalog and bitmask in `@podverse/helpers`) — Plan: plan 10
- **R24** (area C) "per-resource CRUD checkboxes" (web) — Plan: plan 31
- **R25** (area D) "per-resource CRUD checkboxes" (mobile) — Plan: plan 42
- **R26** (area A) "with presets such as Read Only and Full Access" (preset definitions shared by both clients) — Plan: plan 10
- **R27** (area C) "with presets such as Read Only and Full Access" (web) — Plan: plan 31
- **R28** (area D) "with presets such as Read Only and Full Access" (mobile) — Plan: plan 42
- **R29** (area A) "Never allowed for a key, whatever its permissions: creating, listing, or revoking API keys" — Plan: plans 12, 13
- **R30** (area B) "Never allowed for a key, whatever its permissions: ... changing password or email or deleting the account" — Plan: plans 20, 22
- **R31** (area B) "Never allowed for a key, whatever its permissions: ... billing and membership purchases." — Plan: plan 20
- **R32** (area A) "Who can create keys: any account" — Plan: plan 13
- **R33** (area A) "expired accounts should not be able to use the endpoints gated by these keys" — Settled: "its keys are rejected on every route, including routes the web app leaves open to expired members (`skipMembershipStatus`)" — Plan: plan 12
- **R34** (area A) "an expired account can still open the Developer page to view and revoke keys" (API: list and revoke accept an expired session) — Plan: plan 13
- **R35** (area A) "but cannot create keys" (API: create rejects an expired session) — Plan: plan 13
- **R36** (area C) "an expired account can still open the Developer page to view and revoke keys" (web) — Plan: plan 30
- **R37** (area C) "but cannot create keys" (web) — Plan: plan 31
- **R38** (area D) "an expired account can still open the Developer page to view and revoke keys" (mobile) — Plan: plans 40, 41
- **R39** (area D) "but cannot create keys" (mobile) — Plan: plans 40, 41, 42
- **R40** (area A) "the user picks 30 / 90 / 365 days or No Expiration; default 90 days" (API: accepted values, stored expiry, rejecting an expired key) — Plan: plans 10, 11, 12, 13
- **R41** (area C) "the user picks 30 / 90 / 365 days or No Expiration; default 90 days" (web) — Plan: plan 31
- **R42** (area D) "the user picks 30 / 90 / 365 days or No Expiration; default 90 days" (mobile) — Plan: plan 42
- **R43** (area C) "a Developer tab in web Settings" — Settled: `/settings?tab=developer` — Plan: plan 30
- **R44** (area D) "mobile More → Settings → Developer" — Plan: plan 41
- **R45** (area C) "Both surfaces create, list, and revoke keys" (web) — Plan: plans 30, 31
- **R46** (area D) "Both surfaces create, list, and revoke keys" (mobile) — Plan: plans 41, 42
- **R47** (area C) "a link to the API's OpenAPI spec served by the API itself" (web) — Plan: plan 30
- **R48** (area D) "a link to the API's OpenAPI spec served by the API itself" (mobile, from the API base the app is using) — Plan: plans 40, 41
- **R49** (area A) "a last-used time per key" (API: recording and returning it) — Plan: plans 11, 12, 13
- **R50** (area C) "a last-used time per key" (web) — Plan: plan 30
- **R51** (area D) "a last-used time per key" (mobile) — Plan: plans 40, 41
- **R52** (area C) "No MCP config snippet." (web) — Plan: plan 30
- **R53** (area D) "No MCP config snippet." (mobile) — Plan: plan 41
- **R54** (area E) "podverse-mcp is a placeholder for now and we are not sure if we will use it yet." — Settled: out of scope — Plan: plan 51
- **R55** (area E) "the deliverable is that `apps/api/openapi.yml` is accurate and served by the API" (drift between routes and spec, and the served URLs) — Plan: plan 50
- **R56** (area A) "including the new key auth scheme and endpoints" (the security scheme and the key endpoints in the spec) — Plan: plans 12, 13
- **R57** (area A) "Management-web: admins do not see or revoke users' keys in this set." — Plan: plans 11, 13
- **R58** (area A) "That branch carries the account-session work (`feature/auth-sessions`), which API keys must fit beside." — Plan: plan 12
- **R59** (area A, step 07) "a key can never do anything its owner cannot do as a normal signed-in user" (D4: the rule stated in plan 12) — Plan: plan 12
- **R60** (area A, step 07) "a key cannot bypass `requiredCapability`, terms, or membership on a route that declares `apiKeyAccess`" (D4: integration tests) — Plan: plan 12
- **R61** (area A, step 07) "the management API answers a `pvk_` Bearer token with 401" (D4: management-api integration test) — Plan: plan 14
- **R62** (area A, step 07) "The limit is **20** keys per account, expired keys included. Creating a 21st returns 409." (D6) — Plan: plans 10, 13
- **R63** (area A, step 07) "Keys survive password change, password reset, and admin sign-outs." (D9: password reset added) — Plan: plan 13
- **R64** (area A, step 07) "The management API (`apps/management-api/src/lib/crud.ts`, `apps/management-api/src/lib/authz/requireCrud.ts`) ... switch to the shared `packages/helpers/src/lib/crudBitmask.ts`" (D12) — Plan: plan 14
- **R65** (area A, step 07) "management web (`apps/management-web/src/lib/managementPermissions.ts`) switch to the shared ... `crudBitmask.ts`" (D12) — Plan: plan 14
- **R66** (area A, step 07) "`packages/helpers/src/managementAdminRoles/` uses the same bit constants. No behavior change and no management API keys." (D12) — Plan: plan 14
- **R67** (area B, step 08) "`/stats/listen` and `/stats/open` stay closed to keys (no `apiKeyAccess`)." (D21) — Plan: plans 20, 23
- **R68** (area C, step 09) "Link to both the interactive docs (`{api base}/docs`) and the raw spec (`{api base}/docs.yaml`)." (D23, web) — Plan: plan 30
- **R69** (area C, step 09) "an account that never had a membership sees a heading such as "API Keys Require a Membership" with the same Buy Membership action ... Expired accounts keep the existing expired copy." (D29, web) — Plan: plan 31
- **R70** (area D, step 11) "The same gate and copy apply on mobile." (D29, mobile) — Plan: plans 41, 42
- **R71** (area D, step 11) "One row opens `{api base}/docs` in the system browser; a second row copies the `{api base}/docs.yaml` URL to the clipboard." (D30) — Plan: plans 40, 41
- **R72** (area E, step 10) "Document `/`, `/health`, `/health/ready`, `/meta`, `/docs`, and `/docs.yaml` in `apps/api/openapi.yml` as public operations (`security: []`)." (D34) — Plan: plan 50
- **R73** (area E, step 10) "Check every list route's validator and mark `page` required wherever the validator requires it" (D35) — Plan: plan 50
- **R74** (area A, step 07) "Add a shared supported-actions-per-resource list to `@podverse/helpers`." (D37; unsupported: account create and delete; settings create, read, and delete; add_by_rss update; history create and delete) — Plan: plan 10
- **R75** (area A, step 07) "Presets still store the full mask, so Full Access picks up an action when a route starts using it." (D37) — Plan: plan 10
- **R76** (area C, step 09) "Web and mobile render a dash in each unsupported cell so the grid stays aligned" (D37, web) — Plan: plans 30, 31
- **R77** (area D, step 11) "Web and mobile render a dash in each unsupported cell so the grid stays aligned" (D37, mobile) — Plan: plans 40, 41, 42
- **R78** (area E, step 10) "the API docs describe the same list" (D37) — Plan: plan 51
- **R79** (area B, step 08) every `apiKeyAccess` label names a cell in the supported-actions list, and every supported cell guards at least one route (D37 and D21 kept consistent with the route table) — Plan: plan 20
- **R80** (area D, step 11) "mobile reuses web's `consumer` keys under `settings.developer.*`. Only strings that exist on mobile alone go in the `mobile` layer, on a path that does not collide with `consumer`. Drop the planned `settings.account.api_keys.*` set." (D38) — Plan: plan 41
- **R81** (second review, item 1) the key table's migration is `0031_account_api_key.sql`, because the popularity anti-gaming branch owns app migrations `0027`–`0030` and reaches `feature/combined` first — Plan: plan 11
- **R82** (second review, item 2) the create endpoint answers `api_key_permissions_empty` when no supported cell is set, using the same shared `apiKeyPermissionsGrantSupported` check as the web and mobile forms — Plan: plans 10, 13, 31, 40

## Areas

### A. API key core (plans 10–19)

- **Rows:** R1, R2, R8, R12, R13, R14, R17, R18, R23, R26, R29, R32, R33, R34, R35, R40, R49,
  R56, R57, R58
- **Scope:** the key table (linear migration `0031_…`, hash only, permissions, expiry, last-used,
  revoked, cascade on account delete) and baseline regeneration; the ORM entity and service; the
  key format and generation; the resource catalog, CRUD bitmask helpers, presets, expiration
  options, and DTOs in `@podverse/helpers`; the auth middleware branch that recognizes a key
  before JWT verification, sets `req.user` with the key's permissions, rejects revoked, expired,
  and expired-membership keys on every route, and records last-used without a write per request;
  the create, list, and revoke endpoints (session auth only, never a key; an expired account may
  list and revoke but not create); `@podverse/helpers-requests` calls both clients use; the
  OpenAPI security scheme and the key endpoints; API integration tests.
- **Starts from:** `apps/api/src/lib/auth/index.ts` (`verifyTokenAndMembership`,
  `ensureAuthenticated`), `apps/api/src/lib/auth/sessionTokens.ts` (`readRequestToken`,
  `BEARER_HEADER_PATTERN`), `apps/api/src/lib/auth/accountSessionStore.ts`,
  `infra/k8s/base/ops/source/database/linear-migrations/app/0024_account_session.sql`,
  `apps/api/src/controllers/account/accountSession.ts` and its route,
  `packages/helpers/src/dtos/account/accountSession.ts`,
  `packages/helpers-requests/src/api/auth/sessions.ts`, `packages/orm/`, and the Metaboost
  bitmask files named in 00-REQUEST.md § Orientation.
- **Depends on:** no area in this set.
- **Shared files:** with B — `apps/api/src/lib/auth/index.ts` (A adds the key branch and the
  permission data on `req.user`; B adds the per-route permission check that reads it). With C and
  D — the DTOs, resource catalog, presets, expiration options, and request calls in
  `packages/helpers` and `packages/helpers-requests`, which they consume and do not edit. With E —
  `apps/api/openapi.yml` (A adds the scheme and key endpoints; E audits the rest).

### B. Route permission enforcement (plans 20–29)

- **Rows:** R19, R20, R30, R31
- **Scope:** mapping every authenticated API route to a resource from A's catalog and the CRUD bit
  it needs; the check that rejects a key lacking it (and passes session auth through unchanged);
  how `optionalEnsureAuthenticated` routes treat a key; the routes a key can never reach whatever
  its permissions (password, email, account delete, billing, membership purchases and claim
  tokens), beyond the key endpoints A already blocks; a route-to-permission table the spec step can
  read; API integration tests across route families.
- **Starts from:** the controllers that call `ensureAuthenticated` / `optionalEnsureAuthenticated`
  under `apps/api/src/controllers/` (account, playlist, queue, clip, stats, channel, item,
  liveItem, profileContent, membershipClaimToken, mq, metaboost, legal), `apps/api/src/routes/`
  (including `billing.ts`, `account.ts`, `accountSettings.ts`, `auth.ts`, `product/`), and area
  A's plans for the catalog and the `req.user` shape.
- **Depends on:** A (resource catalog, bitmask helpers, key identity on `req.user`).
- **Shared files:** with A — `apps/api/src/lib/auth/index.ts`. With E — E documents B's mapping in
  `apps/api/openapi.yml`; B does not edit the spec.

### C. Web Developer tab (plans 30–39)

- **Rows:** R3, R5, R6, R9, R15, R24, R27, R36, R37, R41, R43, R45, R47, R50, R52
- **Scope:** a Developer tab at `/settings?tab=developer` (signed-in only, like the other
  restricted tabs); the key list with permissions summary, expiry, created and last-used times, and
  revoke with confirm; the create flow with name (if A adds one), per-resource CRUD checkboxes,
  presets, and the 30 / 90 / 365 / No Expiration choice defaulting to 90; showing the secret once
  with copy and a clear "you will not see this again"; an expired account sees and revokes keys but
  cannot create (**membership-expiry-ux-contract**); a link to `<api base>/docs` or `/docs.yaml`;
  no MCP snippet; i18n in title case per **ui-copy-casing**; Playwright spec.
- **Starts from:** `apps/web/src/components/Settings/Settings.tsx` (`tabFromQueryParam`, `tabData`,
  the restricted-tab redirect), `apps/web/src/components/Settings/Panels/SettingsAccount/SettingsSessions.tsx`
  and `ModalSignOutOtherDevices.tsx`, `apps/web/e2e/settings-account-sessions.spec.ts`, and area
  A's DTOs and request calls.
- **Depends on:** A (DTOs, catalog, presets, expiration options, request calls, error codes).
- **Shared files:** with D — the shared i18n catalog layer if both add keys there (choose the
  layer per **i18n**; if both use `shared`, the keys must be the same set). With A — consumes A's
  packages without editing them.

### D. Mobile Developer screen (plans 40–49)

- **Rows:** R4, R7, R10, R16, R25, R28, R38, R39, R42, R44, R46, R48, R51, R53
- **Scope:** a Developer row in More → Settings and its screen (signed-in only); list, create, and
  revoke with the same fields and rules as web; showing the secret once with copy; the expired
  account rule; the OpenAPI link built from the API base the app is using (the app can point at a
  custom API, see `MoreCustomApiScreen.tsx`); offline behavior like the Sessions screen; no MCP
  snippet; i18n; Maestro coverage per **mobile-test-economics**.
- **Starts from:** `apps/mobile/src/screens/more/MoreSettingsScreen.tsx`,
  `MoreSettingsSessionsScreen.tsx`, `accountSessionRows.ts`, `apps/mobile/src/auth/accountSessions.ts`,
  `apps/mobile/e2e/auth-sessions.yaml`, the More stack navigator, and area A's DTOs and request
  calls.
- **Depends on:** A (as for C).
- **Shared files:** with C — the shared i18n catalog layer (as above). With A — consumes A's
  packages without editing them.

### E. OpenAPI accuracy (plans 50–59)

- **Rows:** R11, R21, R22, R54, R55
- **Scope:** finding and fixing drift between `apps/api/src/routes/` and `apps/api/openapi.yml`
  (missing or stale paths, methods, parameters, and auth); per-operation `security` that lists the
  key scheme where a key is accepted and omits it where it never is; the permission each operation
  needs, from B's table, in a form a tool reading the spec can use; how-to text for sending a key;
  confirming `/docs` and `/docs.yaml` serve the current file; keeping `npm run openapi:check`
  passing and `apps/management-api/openapi.yml` in sync where shared components are copied
  (`openapi-sync.mdc`). podverse-mcp stays out of scope.
- **Starts from:** `apps/api/openapi.yml` (large; anchor by path and `components` name),
  `apps/api/src/lib/docs/registerSwaggerDocs.ts`, `apps/api/src/app.ts`, `.spectral.yaml`,
  `.cursor/rules/openapi-sync.mdc`, and areas A and B's plans.
- **Depends on:** A (the key scheme and endpoints it adds to the same file) and B (the
  route-to-permission table).
- **Shared files:** with A — `apps/api/openapi.yml`.

## Order

First planning pass, three waves:

- **Wave 1:** A (step 02).
- **Wave 2:** B, C, and D at once (steps 03, 04, 05), each after A.
- **Wave 3:** E (step 06), after A and B.

Second pass, after the first review (answers in 00-REQUEST.md § Review of the first planning
pass; rows R59–R80). D12 reverses "Management code is untouched": area A now plans a management
change that only switches to the shared CRUD-bit helper. The supported-actions list is fixed as
`API_KEY_SUPPORTED_ACTIONS` in `packages/helpers/src/lib/apiKey.ts`, so areas A and B can plan at
once. Area D waits for area C because mobile reuses C's `consumer` keys.

- **Wave 1:** A (step 07: plans 10, 12, 13, and a new management plan in 14–19) and B (step 08:
  plans 20, 23) at once.
- **Wave 2:** C (step 09: plans 30, 31) and E (step 10: plans 50, 51) at once.
- **Wave 3:** D (step 11: plans 40, 41, 42).

Second review, after Close (answers in 00-REQUEST.md § Review of the second planning pass; rows
R81–R82): edited plans 10, 11, 13, 31, 40, and 42 in place. The phase order and file ownership
are unchanged.

Implementation runs in seven phases, with file ownership per phase, in
[00-EXECUTION-ORDER.md](00-EXECUTION-ORDER.md): 10; 11 and 14; 12; 13; 20, 30, 40, and 50; 21,
22, 23, 31, 41, and 51; then 42, which closes the set.

## Decisions to review

Choices the planners made that the request did not settle. Answer by number (D1, D2, …): accept,
or say what to change.

### Area A — API key core (step 02)

- **D1** (step 02, plan 12) The permission check lives in the auth middleware, and routes are closed to keys by default. A route option `apiKeyAccess?: { resource, action }` opens a route; without it a key gets 403 `api_key_not_allowed`. Area B only labels routes. Alternative: area B writes the per-route check.
- **D2** (step 02, plans 10, 11) Permissions are stored as one JSONB map per key, not one column per resource as Metaboost does. A new resource needs no migration; a resource missing from a stored key means no permission.
- **D3** (step 02, plans 11, 13) Revoking a key deletes its row; the next request with it gets 401 `api_key_invalid`. Alternative: a soft-revoke column plus a later purge job.
- **D4** (step 02, plan 10) Nine resources: account, settings, subscriptions, add_by_rss, playlists, queue, history, clips, notifications, each with all four actions. Presets are only Read Only and Full Access.
- **D5** (step 02, plans 10, 11) Keys carry a required name (up to 50 characters) and a 4-character hint shown as `pvk_…abcd`. Token is `pvk_` plus 43 random characters.
- **D6** (step 02, plan 13) At most 50 keys per account, expired ones included; the 51st create gets 409 `api_key_limit_reached`.
- **D7** (step 02, plans 10, 12) Last-used time is written at most once every five minutes per key.
- **D8** (step 02, plan 12) A bad key fails loudly on public routes too: an invalid or expired key on an optional-sign-in route gets 401 instead of being treated as signed out, and route permission rules apply there.
- **D9** (step 02, plans 12, 13) Keys survive password changes and admin sign-outs; they end only when revoked, expired, or the account is deleted.
- **D10** (step 02, plans 10, 13) The create body's expiry field is `expires_in_days`: 30, 90, 365, or `null` for no expiration; omitted means 90.
- **D11** (step 02, plan 12) `GET /auth/me` accepts keys with `account` read, as the developer's "who am I" check.
- **D12** (step 02, plan 10) Management API and management web keep their own CRUD-bit copies rather than moving to the shared helper.

### Area B — Route permission enforcement (step 03)

- **D13** (step 03, plan 20) Action mapping: `GET` and read-only `POST`s need read; adding a row (follow, add to playlist or queue, enqueue a parse) needs create; `PATCH`, `PUT`, and state-changing `POST`s (mark read, toggle like, promote, replay) need update; `DELETE` and unfollow need delete. Alternative: adding playlist or queue items counts as update of the parent.
- **D14** (step 03, plans 20, 21) Optional-sign-in public routes (`GET /playlist/{id}`, `GET /clip/{id}`) still check the key: a key without the read bit gets 403. Alternative: fall back to anonymous access.
- **D15** (step 03, plan 20) The queue's history zone counts as `queue`, not `history`, because one now-playing call moves the previous item there in the same request.
- **D16** (step 03, plan 20) Followed-playlist lists need `subscriptions` read, not `playlists`.
- **D17** (step 03, plans 20, 22) Every parse request needs `add_by_rss` create, including parse-all and on-demand refresh, because each pair shares one rate-limit wrapper. Alternative: split the wrappers so refresh needs update.
- **D18** (step 03, plan 20) Bulk unfollow needs only `subscriptions` delete, even when it also removes Add by RSS feeds. Alternative: a second permission check inside the handler.
- **D19** (step 03, plan 20) All settings writes need `settings` update, including adding or removing a notification type. Settings are read through `GET /auth/me` (`account` read).
- **D20** (step 03, plan 20) Closed to keys beyond the operator's list: `/auth/check-session`; the full data export; terms acceptance; listen-stats consent and its agreement text; the two MetaBoost assertion-minting routes. Alternative: open some, for example the export with `account` read.
- **D21** (step 03, plans 20, 23) Listen and open reports (`/stats/*`) accept keys with `history` create, still subject to account consent, the stats capability, and the rate limit. Alternative: keep them closed so agents cannot add to popularity counts.
- **D22** (step 03, plans 20, 23) Push device registration and the notification event stream use the `notifications` resource. A stream already open when its key is revoked stays open until its lifetime cap, as with an ended session.

### Area C — Web Developer tab (step 04)

- **D23** (step 04, plan 30) The API reference link goes to `{api base}/docs` (Swagger UI). Alternative: `/docs.yaml`.
- **D24** (step 04, plan 30) The Developer tab sits after Advanced and before Keyboard, signed-in only.
- **D25** (step 04, plan 30) A list row shows the preset name, or one line per resource when the mask matches neither preset.
- **D26** (step 04, plan 31) The create form opens on Read Only and 90 days.
- **D27** (step 04, plan 31) Custom is the label when the mask matches neither preset; choosing Custom leaves the checkboxes as they are.
- **D28** (step 04, plan 31) Closing the one-time token dialog does not ask for confirmation.
- **D29** (step 04, plan 31) An account with no membership is blocked from create the same way as an expired one (both fail `hasValidMembership`) and sees the existing membership modal.

### Area D — Mobile Developer screen (step 05)

- **D30** (step 05, plans 40, 41) The docs row opens Swagger UI at `{api base}/docs` in the system browser. Alternative: link to the YAML file.
- **D31** (step 05, plan 42) A new key starts as Read Only. Alternatives: Full Access or an empty mask.
- **D32** (step 05, plan 41) Created, expiry, and last-used show local date and time (`formatDateTimeAbbrev`); the Sessions row shows date only.

### Area E — OpenAPI accuracy (step 06)

- **D33** (step 06, plan 50) Path parameter names stay as they are: fourteen public GETs spell a segment camelCase in Express and snake_case in the spec; renaming would change generated clients without changing the URL.
- **D34** (step 06, plan 50) Process routes (`GET /`, `/health`, `/health/ready`, `/meta`, `/docs`, `/docs.yaml`) stay out of the spec.
- **D35** (step 06, plan 50) `page` is corrected to required only on the four public profile lists; other lists were not checked against their validators.
- **D36** (step 06, plan 51) Key errors stay documented once: operations gain `apiKeyAuth` and `x-api-key-permission`; existing 403 schemas are unchanged. Plan 12's `ApiKeyAuthorizationErrorResponse` is used on `GET /auth/me`.

### Raised in planners' notes (open, no choice made)

- **D37** (step 03 notes; affects plans 31, 42) Some permission bits open no route: `account` create and delete; `settings` create, read, and delete; `add_by_rss` update; `history` delete. Should the web and mobile create forms hide those checkboxes, disable them, or show them with an explanation? Presets would grant them either way.
- **D38** (steps 04 and 05 notes; plans 30, 41) Web puts its strings in the `consumer` layer under `settings.developer.*`; mobile puts its own in the `mobile` layer under `settings.account.api_keys.*`, with mostly the same English. Should mobile reuse web's `consumer` keys (one vocabulary, mobile-only leaves stay in `mobile`), or keep the two separate catalogs as planned?
