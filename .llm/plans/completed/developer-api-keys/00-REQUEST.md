# Request: developer API keys

## Request

for the type of feature that Archie and Mitch are talking about, you can look to MetaBoost for an
example. You may also deviate from MetaBoost if you think it's inadequate, although, I thought that
we had fairly well established CRUD and bearer token handling in it.

This token issuance process and permission setting would need an experience within the web and
mobile app. Is there already a developer tab, page, screen? We would want something like that.

This is a fairly advanced feature, but developers, it should still be easy to use for developers.
Ask if you have any questions.

### The conversation the request refers to (screenshot, transcribed)

> **Archie:** did we add the option for Bearer token auth for Agents/MCP-servers?
>
> **mdowney:** I'm not sure. Would that be a different process than how mobile login works? The
> mobile login sends a token in a response. While the web login sets it on cookies. It's not really
> "mobile login" but "non-web login" or something
>
> **Archie:** usually the Bearer token is something generated on in the Web UI and shown once.
>
> **mdowney:** ok so creating and revoking keys, which we could allow custom CRUD permissions for?
> metaboost had that built from the ground up but no i don't think it's in pv yet. i'd like to have
> that in pv tho so i'll work on it
>
> **Archie:** pretty much yes. that way the agent could use the bearer token and mcp server to
> affect change. also make suer the openapi.yaml file (or what ever it is called) is kept up to
> date, that is what the MCP server needs to do stuff

## Operator answers

- **Is there a developer page today?** No (checked): web has only `/settings`, mobile has the
  More → Settings screens. A new Developer page is wanted.
- **Permission granularity:** per-resource CRUD checkboxes in the Metaboost bitmask style (for
  example playlists, queue, subscriptions, clips, history), with presets such as Read Only and Full
  Access.
- **Never allowed for a key, whatever its permissions:** creating, listing, or revoking API keys;
  changing password or email or deleting the account; billing and membership purchases.
- **Who can create keys:** "any account, but expired accounts should not be able to use the
  endpoints gated by these keys."
  - Follow-up: while an account's membership is expired, its keys are **rejected on every route**,
    including routes the web app leaves open to expired members (`skipMembershipStatus`). Chosen
    because it is the simplest rule to explain to developers.
  - Follow-up: an expired account can still open the Developer page to **view and revoke** keys,
    but **cannot create** keys.
- **Expiration:** the user picks 30 / 90 / 365 days or No Expiration; default 90 days.
- **Placement:** a Developer tab in web Settings; mobile More → Settings → Developer. Both
  surfaces create, list, and revoke keys (the key is shown once at creation). The operator chose
  "`/settings/developer`" before anyone checked that web Settings selects tabs with `?tab=`, so
  the web URL is `/settings?tab=developer`, matching the other tabs.
- **Developer page extras:** a link to the API's OpenAPI spec served by the API itself, and a
  last-used time per key. No MCP config snippet.
- **podverse-mcp repo:** "podverse-mcp is a placeholder for now and we are not sure if we will use
  it yet." Out of scope; the deliverable is that `apps/api/openapi.yml` is accurate and served by
  the API, including the new key auth scheme and endpoints.
- **Management-web:** admins do not see or revoke users' keys in this set.

### Review of the first planning pass

The operator's answers to D1–D38 in `00-SUMMARY.md` § Decisions to review. "Accepted" means the
plan stays as written.

**Area A, API key core**

- **D1:** accepted.
- **D2:** accepted.
- **D3:** accepted.
- **D4:** accepted, with an explicit rule added to plan 12: a key can never do anything its owner
  cannot do as a normal signed-in user. Keys authenticate as the owner only, go through the same
  terms, membership, and capability checks (`requiredCapability`), and reach only routes that
  declare `apiKeyAccess`. `apps/api` has no admin routes, and the management API never accepts a
  `pvk_` token. Add integration tests that prove it: a key cannot bypass `requiredCapability`,
  terms, or membership on a route that declares `apiKeyAccess`, and the management API answers a
  `pvk_` Bearer token with 401.
- **D5:** accepted.
- **D6:** changed. The limit is **20** keys per account, expired keys included. Creating a 21st
  returns 409.
- **D7:** accepted.
- **D8:** accepted.
- **D9:** accepted. Keys survive password change, password reset, and admin sign-outs.
- **D10:** accepted.
- **D11:** accepted.
- **D12:** reversed. Use shared helpers wherever they apply. The management API
  (`apps/management-api/src/lib/crud.ts`, `apps/management-api/src/lib/authz/requireCrud.ts`) and
  management web (`apps/management-web/src/lib/managementPermissions.ts`) switch to the shared
  `packages/helpers/src/lib/crudBitmask.ts`, and `packages/helpers/src/managementAdminRoles/`
  uses the same bit constants. No behavior change and no management API keys. This supersedes
  the earlier "this set makes no management changes".

**Area B, route permissions**

- **D13–D20:** accepted.
- **D21:** changed. `/stats/listen` and `/stats/open` stay closed to keys (no `apiKeyAccess`).
  `history` create then guards no route (see D37).
- **D22:** accepted.

**Area C, web Developer tab**

- **D23:** changed. Link to both the interactive docs (`{api base}/docs`) and the raw spec
  (`{api base}/docs.yaml`).
- **D24–D28:** accepted.
- **D29:** accepted that accounts without a valid membership cannot create keys, with a copy
  change: an account that never had a membership sees a heading such as "API Keys Require a
  Membership" with the same Buy Membership action, instead of "Your membership has expired."
  Expired accounts keep the existing expired copy. The same gate and copy apply on mobile.

**Area D, mobile Developer screen**

- **D30:** changed. One row opens `{api base}/docs` in the system browser; a second row copies
  the `{api base}/docs.yaml` URL to the clipboard.
- **D31:** accepted.
- **D32:** accepted.

**Area E, OpenAPI accuracy**

- **D33:** accepted.
- **D34:** changed. Document `/`, `/health`, `/health/ready`, `/meta`, `/docs`, and `/docs.yaml` in
  `apps/api/openapi.yml` as public operations (`security: []`).
- **D35:** changed. Check every list route's validator and mark `page` required wherever the
  validator requires it, not only the four public profile lists.
- **D36:** accepted.

**Open questions**

- **D37:** hide the checkboxes no route uses. Add a shared supported-actions-per-resource list to
  `@podverse/helpers`. Web and mobile render a dash in each unsupported cell so the grid stays
  aligned, and the API docs describe the same list. The unsupported cells are account create and
  delete; settings create, read, and delete; add_by_rss update; history create and delete.
  Presets still store the full mask, so Full Access picks up an action when a route starts using
  it.
- **D38:** mobile reuses web's `consumer` keys under `settings.developer.*`. Only strings that
  exist on mobile alone go in the `mobile` layer, on a path that does not collide with
  `consumer`. Drop the planned `settings.account.api_keys.*` set.

### Review of the second planning pass

The operator's answers to the choices the second-pass steps (07–11) and Close left open.
"Accepted" means the plan stays as written.

1. **Migration number:** changed. The popularity anti-gaming branch owns app migrations
   `0027`–`0030` and reaches `feature/combined` first, so the key table is
   `0031_account_api_key.sql` (plan 11).
2. **Empty key:** changed. The create endpoint answers `api_key_permissions_empty` when no
   supported cell is set; unsupported bits alone do not count. The API, web, and mobile share one
   check, `apiKeyPermissionsGrantSupported` in `@podverse/helpers` (plans 10, 13, 31, 40, 42).
3. **Plan 14 scope:** accepted. Every management spot holding CRUD-bit literals switches.
4. **Probe routes in plan 12's tests:** accepted.
5. **Never-had dialog:** accepted. Heading "API Keys Require a Membership", body "Buy a
   membership to create an API key."
6. **Dash accessible name:** accepted. Per cell, for example "Account Create is not available."
7. **Raw spec link label:** accepted. "OpenAPI Spec".
8. **Spec path `/`:** accepted. Only the versioned ping under `/api/v2`.
9. **Other required queries:** accepted. `range` and `shuffleHash` are documented as required
   with `page`.
10. **Mobile expired copy:** accepted. Mobile's existing expired gate.
11. **Mobile-only strings:** accepted. Under `settings.developer` in the mobile layer.
12. **Mobile copy-row subtitle:** accepted. The mobile-only `spec_copy_hint`.
13. **Mobile screen title:** accepted. Row "Developer", screen title "API Keys".

## Glossary

- **MetaBoost / Metaboost**: the sibling repo `../metaboost` (also the `metaboost` workspace).
- **pv**: Podverse, this monorepo.
- **Archie**: the "su || cd" user in the screenshot.
- **Bearer token / key / API key**: a long-lived, user-issued credential sent as
  `Authorization: Bearer …`, distinct from the session JWT and the mobile access/refresh pair.
- **openapi.yaml**: `apps/api/openapi.yml`.
- **MCP server**: an agent tool server that reads the OpenAPI spec and calls the API with a
  Bearer key.

## Base branch

This set branches from **`feature/combined`**, not `develop`, and its PR targets
`feature/combined`. That branch carries the account-session work (`feature/auth-sessions`), which
API keys must fit beside. Plan against the code on this branch.

## Orientation

- `apps/api/src/lib/auth/index.ts` — `ensureAuthenticated` / `optionalEnsureAuthenticated` read
  the request token (`readRequestToken`, cookie or Bearer), then `verifyTokenAndMembership`
  verifies the JWT, loads the account and its `account_session` row (`checkAccountSession`) in
  parallel, sets `req.user` (including `session_id_text`), renews the session when due, then
  applies terms, membership, and capability checks (`skipMembershipStatus`,
  `skipTermsAcceptance`, `requiredCapability`). `ended` sessions reject or continue as anonymous.
- `apps/api/src/lib/auth/sessionTokens.ts` — signs and classifies web and mobile session JWTs
  (claims `id`, `id_text`, `sid`, `token_use`); `BEARER_HEADER_PATTERN`; `RequestToken` with
  `source: 'cookie' | 'bearer'`. An API key is a different credential and needs its own branch
  here or before it.
- `apps/api/src/lib/auth/accountSessionStore.ts` — start, check, renew, rotate, end, and list
  sessions; revoke reasons.
- `infra/k8s/base/ops/source/database/linear-migrations/app/0024_account_session.sql` — one row
  per login (`client_type` `web`/`mobile`, `last_seen_at`, `idle_expires_at`, hashed refresh
  tokens, `revoked_at`/`revoked_reason`). A useful shape reference for a key table (hash only,
  last-used, revoked). The latest app migration on this branch is `0026_drop_legacy_stats.sql`.
- Web sessions UI: `apps/web/src/components/Settings/Panels/SettingsAccount/SettingsSessions.tsx`
  and `ModalSignOutOtherDevices.tsx`. Mobile: `apps/mobile/src/screens/more/MoreSettingsSessionsScreen.tsx`
  and `accountSessionRows.ts`. These are the closest list-and-revoke patterns to follow.
- `apps/web/src/components/Settings/Settings.tsx` — tabs keyed by `?tab=` (`tabFromQueryParam`,
  `tabData`); signed-out users are redirected away from restricted tabs. Panels live under
  `apps/web/src/components/Settings/Panels/`.
- `apps/api/src/lib/docs/registerSwaggerDocs.ts` — the API already serves `apps/api/openapi.yml`
  at `<baseUrl>/docs.yaml` and Swagger UI at `<baseUrl>/docs`, unconditionally (registered in
  `apps/api/src/app.ts`).
- `apps/api/openapi.yml`, `apps/management-api/openapi.yml` — kept in sync per
  `.cursor/rules/openapi-sync.mdc`; root `npm run openapi:check` validates and lints both.
- `apps/mobile/src/screens/more/MoreSettingsScreen.tsx` and its `MoreSettings*Screen.tsx` siblings
  — mobile settings screens.
- Linear SQL migrations: `infra/k8s/base/ops/source/database/linear-migrations/` (see root
  `AGENTS.md` for baseline regeneration).
- Metaboost reference, CRUD bitmasks (create=1, read=2, update=4, delete=8, 0–15):
  `../metaboost/infra/k8s/base/ops/source/database/linear-migrations/management/0001_management_schema.sql`
  (`admin_permissions`) and `.../app/0001_app_schema.sql` (`bucket_admin`, `bucket_role`).
  Metaboost has **no** user-issued API key tables; its `apps/api/src/middleware/requireAuth.ts`
  accepts the session cookie first, then a Bearer session JWT. The permission model is the part to
  borrow; key issuance, hashing, revocation, and last-used tracking are new design.
