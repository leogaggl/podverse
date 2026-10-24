**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 51 — OpenAPI security and permission on each operation

Plan 12 adds the `apiKeyAuth` scheme, `ApiKeyPermissionRequirement`, and
`x-api-key-permission` on `GET /auth/me`. Plan 13 adds the key endpoints with session
security only. Plan 20 is the route-to-permission table. This plan copies that table onto
every other operation a key may call, and states in the spec introduction how to send a key.

A tool reads three things: the introduction (how to send the header), each operation's
`security` (whether `apiKeyAuth` is allowed), and `x-api-key-permission` (which bit). Do not
invent a second extension name.

podverse-mcp is out of scope (R54). Do not create or edit a podverse-mcp checkout, an MCP
config snippet, or any file outside this plan's `## Files`.

## Rows

R11, R21, R22, R54, R78

## Runs after

20, 50

## Files

apps/api/openapi.yml
apps/api/src/lib/docs/openapiApiKeyPermissions.test.ts
release-notes/scratchpad.md

## Source table

Read `.llm/plans/completed/developer-api-keys/20-api-key-route-access-shared.md` (prompt 20
moves it there when it finishes) from
`## Route-to-permission table` through the end of `### notifications`, and the
`### Never accept a key` table. Do not edit that file.

Expand every `{a|b|c}` segment into one operation per literal, same method, resource, and
action. Paths in that table are already OpenAPI `{param}` form. Copy the counts in plan 20
§ Expanded operation counts. The expanded total is **161** operations:

| Section | Operations |
| --- | --- |
| account | 7 |
| settings | 6 |
| subscriptions | 33 |
| add_by_rss | 9 |
| playlists | 31 |
| queue | 32 |
| history | 5 |
| clips | 5 |
| notifications | 33 |

If the expansion is not 161, stop and report the section that does not match. Do not drop or
add a path to make the count fit.

History is 5 because `POST /stats/listen` and `POST /stats/open` are in plan 20 § Never accept
a key. Clips is the five operations in plan 20 § clips. Those two stats routes are not part of
the 161.

`GET /auth/me` is one of the 161. Plan 12 already sets its `security` and
`x-api-key-permission`. Do not edit that operation. This plan marks the other 160. The test
still expects `GET /auth/me`.

## Security shape

Document-level `security` (the block immediately before `paths:`) stays `bearerAuth` and
`cookieAuth` only. Do not add `apiKeyAuth` there. That would mark every operation as
accepting a key.

Every operation already has its own `security` key. None inherit the document default.

**Required** (154 operations: the 161, minus `GET /auth/me`, minus the six optional paths
below). Keep the existing `bearerAuth` and `cookieAuth` entries and add `apiKeyAuth`. If the
operation has no `cookieAuth` or `bearerAuth` entry, stop and report that path. Do not invent
a public operation into a required one.

```yaml
      security:
        - bearerAuth: []
        - cookieAuth: []
        - apiKeyAuth: []
      x-api-key-permission:
        resource: playlists
        action: read
```

`resource` and `action` are the table's values, unquoted (`account`, `settings`,
`subscriptions`, `add_by_rss`, `playlists`, `queue`, `history`, `clips`, `notifications`;
`create`, `read`, `update`, `delete`). Put `x-api-key-permission` immediately after the
`security` block.

**Optional** (a missing credential still works; a key that is sent is checked). These six
are the only ones. `optionalEnsureAuthenticated` in the handler, and plan 20's notes, are
the source. Replace the whole `security` value. Do not leave `security: []` in place, and do
not leave the two that currently require a session as required.

| Method | Path | Resource | Action | Spec today |
| --- | --- | --- | --- | --- |
| GET | `/account/{id_text}` | account | read | bearer + cookie, described as authenticated |
| GET | `/playlist/{playlist_id_text}` | playlists | read | bearer + cookie, described as authenticated |
| GET | `/playlist/{playlist_id_text}/resources` | playlists | read | `security: []` |
| GET | `/playlist/{playlist_id_text}/resources/queue-by-list-position` | playlists | read | `security: []` |
| GET | `/playlist/{playlist_id_text}/resources/shuffle` | playlists | read | `security: []` |
| GET | `/clip/{clip_id_text}` | clips | read | `security: []` |

```yaml
      security:
        - {}
        - bearerAuth: []
        - cookieAuth: []
        - apiKeyAuth: []
      x-api-key-permission:
        resource: clips
        action: read
```

Replace the descriptions of the first two, which currently say a credential is required:

- `GET /account/{id_text}`: `Returns an account by id. With no credentials, a public or unlisted account is returned and a private account is not found. The owner, signed in or using a key with account read, receives their own account even when it is private. A key that lacks account read is refused rather than treated as anonymous.`
- `GET /playlist/{playlist_id_text}` `get` only (leave `patch` and `delete` on that path as required): `Returns a playlist. With no credentials, a public playlist is returned. The owner, signed in or using a key with playlists read, can read a private playlist. A key that lacks playlists read is refused rather than treated as anonymous.`

On the other four optional operations, keep the existing description and append:
`An API key needs <resource> <action>. A request with no credentials is still accepted. A key that lacks that permission is refused.`

On every required operation this plan edits, keep the existing description and append:
`An API key needs <resource> <action>.`

When the description is a folded block (`>` or `>-`), add the sentence inside the block.
When it is one line, append on that line. Do not reflow unrelated lines.

## Closed operations

The `### Never accept a key` table, including `GET`/`POST /auth/api-keys` and
`DELETE /auth/api-keys/{api_key_id_text}` from plan 13, gets neither `apiKeyAuth` nor
`x-api-key-permission`. That table includes `POST /stats/listen` and `POST /stats/open`:
leave both without `apiKeyAuth` and without `x-api-key-permission`. Leave their `security` as
plan 13 and the existing file have them (session schemes, or `security: []` where the route
does not read a credential).

Routes with no sign-in never read a key. They stay `security: []` with no extension. Do not
add `apiKeyAuth` to a public catalog, login, webhook, or profile-by-id operation, or to the
six process routes plan 50 adds (`GET /`, `/health`, `/health/ready`, `/meta`, `/docs`,
`/docs.yaml`).

## Introduction

Replace `info.description` (line 4, one line today) with:

```yaml
  description: >
    HTTP API for Podverse. Paths are relative to the server URL (`/api/v2`).

    API keys are created in Settings → Developer on web or mobile and shown once.
    Send a key as `Authorization: Bearer pvk_…`. An operation accepts a key only when
    its `security` list includes `apiKeyAuth`. `x-api-key-permission` on that operation
    names the resource and the CRUD action the key needs (`create`, `read`, `update`,
    or `delete`). A session cookie or a session JWT (`bearerAuth`) is a different
    credential. When a request sends both a cookie and a key, the cookie is used.
    While the account's membership is expired, every key is rejected. Operations that
    omit `apiKeyAuth` refuse a key. When `security` includes an empty requirement
    (`{}`), the call still works with no credentials, and a key that is sent is checked.
    The `apiKeyAuth` scheme description lists the actions each resource supports.
```

This matches plan 12's scheme text: cookie wins, expired membership rejects every key, and
only operations that list `apiKeyAuth` accept one. The supported-actions sentence lives on
the scheme, not in this introduction.

## Scheme description (R78)

Plan 12 adds `apiKeyAuth`. Replace only its `description`. Leave `type`, `scheme`, and
`bearerFormat` as plan 12 wrote them. Do not edit `bearerAuth`,
`ApiKeyAuthorizationErrorResponse`, or `ApiKeyPermissionRequirement`.

The description lists the same cells as `API_KEY_SUPPORTED_ACTIONS` in plan 10 § Supported
actions, in `API_KEY_RESOURCES` order. Each clause is the resource, then its actions joined
with `, ` (the array order in that constant). Clauses are joined with `; `.

```yaml
    description: >
      A long-lived API key created in Settings → Developer on web or mobile and shown once.
      Send it as `Authorization: Bearer pvk_…`. A key works only on operations that list
      `apiKeyAuth` in `security`; `x-api-key-permission` names the resource and CRUD action the
      key needs there. Supported actions: account read, update; settings update; subscriptions
      create, read, update, delete; add_by_rss create, read, delete; playlists create, read,
      update, delete; queue create, read, update, delete; history read, update; clips create,
      read, update, delete; notifications create, read, update, delete. Account create and
      delete, settings create, read, and delete, add_by_rss update, and history create and
      delete open no route. A key is rejected on every operation while the account's membership
      has expired. Keys never manage keys, change a password or email, delete the account, or
      reach billing.
```

Do not state a per-account key limit here. Plan 13 already says 20 on `POST /auth/api-keys`.

## Do not

- Do not edit `ApiKeyAuthorizationErrorResponse` or any field of `apiKeyAuth` other than
  `description` (plan 12).
- Do not add or change a 403 schema. Key error bodies stay defined once, on the scheme and
  on `GET /auth/me`. Existing 403 responses stay as they are.
- Do not edit `apps/management-api/openapi.yml`.
- Do not rename path parameters.
- Do not rewrite the file. Grep the path, read a window, edit that operation
  (`apps/api/openapi.yml` is about 19,500 lines).

## Tests

`apps/api/src/lib/docs/openapiApiKeyPermissions.test.ts` (unit, Vitest, no database). Read
`apps/api/openapi.yml` from disk (`../../../openapi.yml` relative to `src/lib/docs`). No new
dependency and no YAML parser: scan by indent. A path is a line `  /…:`. A method is a line
`    get:` (or post, put, patch, delete). An operation runs until the next method line or
the next path line.

The test holds the expanded 161 rows (`method`, `path`, `resource`, `action`, `optional`
boolean). Build that array from plan 20's table, with the six paths in the optional table
above set `optional: true` and every other row `optional: false`. Do not include
`POST /stats/listen` or `POST /stats/open`. Assert the array length is 161 and the
per-section counts match the table above.

Import `API_KEY_RESOURCES`, `API_KEY_SUPPORTED_ACTIONS`, and `apiKeyResourceSupportsAction`
from `@podverse/helpers`. For each row, `apiKeyResourceSupportsAction(resource, action)` is
true. No row uses an unsupported cell: account create or delete; settings create, read, or
delete; add_by_rss update; history create or delete.

For each row, the operation's text includes `- apiKeyAuth: []`, `x-api-key-permission:`,
`resource: <resource>`, and `action: <action>`. Optional rows also include `- {}`,
`bearerAuth`, and `cookieAuth`. Required rows include `bearerAuth` and `cookieAuth` and do
not include a line `- {}`.

Exactly 161 operations contain `x-api-key-permission`. No other operation contains
`apiKeyAuth` or `x-api-key-permission`. Assert that explicitly for `GET /auth/sessions`,
`GET /auth/api-keys`, `POST /auth/api-keys`, `DELETE /auth/api-keys/{api_key_id_text}`,
`POST /account/delete`, `GET /billing/status`, `POST /billing/paypal/orders`,
`POST /stats/listen`, and `POST /stats/open`.

Build `Supported actions: ` plus each `${resource} ${actions.join(', ')}` from
`API_KEY_SUPPORTED_ACTIONS` in `API_KEY_RESOURCES` order, clauses joined by `; `. The
`apiKeyAuth` description is a folded block (`description: >`): trim each of its following
indented lines, join them with a single space, and assert that text contains the generated
sentence.

The document-level `security` block before `paths:` does not contain `apiKeyAuth`.
`info.description` contains `Authorization: Bearer pvk_` and `x-api-key-permission`.

No comments or test names that cite a plan number.

## Release scratchpad

```markdown
## The API spec names the permission each key needs

- Surfaces: api
- Change: Each operation that accepts an API key lists `apiKeyAuth` and
  `x-api-key-permission` (the resource and create, read, update, or delete). The `apiKeyAuth`
  description lists the actions each resource supports. Key management, sessions, password,
  email, account deletion, billing, listen and open reports, and every other closed route do
  not accept a key. The spec introduction tells callers to send `Authorization: Bearer pvk_…`.
  Six operations that work with no credentials stay optional and still check a key when one is
  sent.
- Who notices: developers and agents that read the spec to call the API
- Operator steps: none
```
