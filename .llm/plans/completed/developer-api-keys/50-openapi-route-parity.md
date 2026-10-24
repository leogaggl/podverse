**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 50 — OpenAPI route parity and served spec

`apps/api/src/routes/` and `apps/api/openapi.yml` already match on method and path shape,
except four signed-in profile lists that the routes mount and the spec omits. This plan adds
those operations, documents the six public process routes, and marks `page` required on every
list whose validator requires it.

The key scheme, the key endpoints, and per-operation `apiKeyAuth` are not this plan. Plans 12
and 13 add the scheme and `/auth/api-keys`. Plan 51 marks which operations accept a key and
replaces the `apiKeyAuth` description. This plan does not edit `components.securitySchemes`.

## Rows

R21, R55, R72, R73

## Runs after

13

## Files

apps/api/openapi.yml
apps/api/src/lib/docs/registerSwaggerDocs.test.ts
release-notes/scratchpad.md

## What was compared

Routes are mounted with `router.use(\`${config.api.prefix}${config.api.version}/<segment>\`, router)`
and methods relative to that segment (`API_PREFIX` `/api`, `API_VERSION` `/v2`). The spec's
`servers` URL already includes `/api/v2`, and its paths are relative to that base. Express
`:param` and OpenAPI `{param}` are the same segment.

269 route operations, 265 spec operations. After treating parameter names as one segment:

- Missing from the spec: `GET /my-profile/podcasts/az`, `GET /my-profile/albums/az`,
  `GET /my-profile/playlists/az`, `GET /my-profile/clips/recent`
  (`apps/api/src/routes/profileContent.ts`, `myProfileRouter`).
- In the spec but not in `apps/api/src/routes/`: none, before the six process routes below.
  Those six are mounted outside `apps/api/src/routes/` and are added on purpose (R72).
- Same shape, different parameter spelling (leave these names as they are):

  - `GET /channel/{idOrIdText}` vs `/channel/{id_or_id_text}`
  - `GET /item/{idOrIdText}` and `GET /item/{idOrIdText}/description` vs `{id_or_id_text}`
  - `GET /item/queue/pub-date/{idText}` and `GET /item/queue/season/{idText}` vs `{id_text}`
  - `GET /item/channel/{oldest|recent|season/backward|season/forward|shuffle|top}/{channelIdOrIdText}`
    vs `{channel_id_or_id_text}`
  - `GET /live-item/channel/{channelIdOrIdText}` vs `{channel_id_or_id_text}`
  - `GET /podroll/channel/{idOrIdText}` vs `{id_or_id_text}`
  - `GET /publisher-feed/channel/{idOrIdText}` vs `{id_or_id_text}`

Do not rename those parameters. The URL shape matches, and the spec name is what a generated
client substitutes. Handlers keep reading the Express names (`idOrIdText`, `channelIdOrIdText`,
`idText`).

Do not edit `apps/management-api/openapi.yml`. Nothing copied between the two specs changes.
Do not edit `components.securitySchemes`, `/auth/me`, or `/auth/api-keys`.

## Public process routes (R72)

Large file: grep the anchor, read a window, insert beside it. Do not read the whole file.

These six are public. Each operation sets `security: []`. Do not add `apiKeyAuth`,
`bearerAuth`, or `cookieAuth`. The spec `servers` URLs already end in `/api/v2`, so the path
keys are relative to that base. `GET /` in the spec is `GET /api/v2/` (`app.get(\`${baseUrl}/\`)`
in `apps/api/src/app.ts`). The unversioned `GET /` in the same file returns the same JSON and
is not a second operation: a path `/` under a server that omitted `/api/v2` would collide with
this one. Do not add a server.

Add tag `meta` to the `tags` list (after `stats`, near line 39). Insert the six paths
immediately after the `paths:` line (near line 4600), before `  /account:`. `tags: [meta]`.
`summary` is `GET` plus the path.

Add schemas after `MessageResponse` (near line 115). Required properties are the fields the
handler always sends.

```yaml
    ApiGetRootResponse200:
      type: object
      required:
        - status
        - message
      properties:
        status:
          type: string
          example: ok
        message:
          type: string
          example: API is online
    ApiGetHealthResponse200:
      type: object
      required:
        - status
        - message
        - fixturesEnabled
      properties:
        status:
          type: string
          example: ok
        message:
          type: string
          example: The server is running.
        fixturesEnabled:
          type: boolean
          description: True when this server is serving end-to-end fixtures.
    ApiGetHealthReadyResponse:
      type: object
      required:
        - status
        - message
      properties:
        status:
          type: string
          enum:
            - ok
            - unavailable
        message:
          type: string
    ApiGetMetaResponse200:
      type: object
      required:
        - version
        - release
        - status
      properties:
        version:
          type: string
          description: API version path segment, such as /v2.
          example: /v2
        release:
          type: string
          example: X.Y.Z-staging.N
        status:
          type: string
          example: ok
```

Operations. Copy this shape. 200 is `application/json` except the two docs routes.

| Path | operationId | Handler | 200 | Other |
| --- | --- | --- | --- | --- |
| `/` | `apiGetRoot` | `apps/api/src/app.ts` `app.get(\`${baseUrl}/\`)` | `ApiGetRootResponse200`. Body `{ status: 'ok', message: 'API is online' }`. | none |
| `/health` | `apiGetHealth` | `registerHealthRoutes` liveness | `ApiGetHealthResponse200`. `message` is `The server is running.` `fixturesEnabled` is `config.e2e.fixturesEnabled`. | none |
| `/health/ready` | `apiGetHealthReady` | `registerHealthRoutes` readiness | `ApiGetHealthReadyResponse`, `status: ok`, `message: Ready`, after `SELECT 1` and a key-value check both succeed. | 503 `ApiGetHealthReadyResponse`: `status: unavailable`, `message` `Database not reachable` or `KeyValDB not reachable` |
| `/meta` | `apiGetMeta` | `apps/api/src/app.ts` `app.get(\`${baseUrl}/meta\`)` | `ApiGetMetaResponse200`. `version` is `config.api.version`, `release` is `config.api.release`, `status` is `ok`. | none |
| `/docs` | `apiGetDocs` | `registerSwaggerDocs` | `text/html`, schema `type: string`. Swagger UI HTML whose spec URL is this server's `/docs.yaml`. | none |
| `/docs.yaml` | `apiGetDocsYaml` | `registerSwaggerDocs` | `application/yaml`, schema `type: string`. The OpenAPI file this server is running. | 500 `application/json`, schema `MessageResponse`, `message` `Failed to load OpenAPI spec` |

Descriptions:

- `/`: Online ping. Returns `{ status: 'ok', message: 'API is online' }`.
- `/health`: Liveness. The process is up. This is the probe route; the unversioned host root is the same JSON as `GET /` and is outside this server URL.
- `/health/ready`: Readiness. 200 when the database and the key-value store answer. 503 when either does not.
- `/meta`: Version, release, and status of this API server.
- `/docs`: Interactive API docs (HTML). The page loads the spec from this server's `/docs.yaml`.
- `/docs.yaml`: The OpenAPI document served by this server.

No parameters. No 401. Do not document a 500 on `/docs`.

## Public profile `page`

`ProfileContentController` validates every profile list with `pageQuerySchema`
(`apps/api/src/lib/validation/querySchemas.ts`): `page` is a required integer, minimum 1.
The four public operations still reference `PageQueryOptional` (required false). Inside each
operation only, replace that one parameter ref with `PageQueryRequired`. Do not use a
file-wide replace. Anchors:

- `/profile/{account_id_text}/podcasts/az` (`apiGetProfileAccountIdTextPodcastsAz`, near line 17277)
- `/profile/{account_id_text}/albums/az` (`apiGetProfileAccountIdTextAlbumsAz`, near line 17121)
- `/profile/{account_id_text}/playlists/az` (`apiGetProfileAccountIdTextPlaylistsAz`)
- `/profile/{account_id_text}/clips/recent` (`apiGetProfileAccountIdTextClipsRecent`)

Leave their `security: []` and their descriptions. They are public and are not in the key table.

## Page on every list (R73)

Checked every handler that validates `page` or calls `getPaginationParams`
(`apps/api/src/controllers/helpers/pagination.ts` treats a missing page as 1). Joi
`.required()` means the spec marks `page` required. `.default(1)` and `.optional()` stay
optional. A list with no page validator stays as the spec has it.

`pageQuerySchema`, `pageRangeQuerySchema`, `mediumPageQuerySchema`,
`mediumPageRangeQuerySchema`, `mediumCategoryPageQuerySchema`, and
`mediumCategoryPageRangeQuerySchema` all require `page`. `pageDefaultQuerySchema` defaults it.

Replace `PageQueryOptional` with `PageQueryRequired` inside these operations only. Leave
`medium`, `range`, and `LimitQueryOptional` as they are.

- `GET /playlist/private/az`
- `GET /playlist/private/oldest`
- `GET /playlist/private/recent`
- `GET /playlist/private/top`
- `GET /playlist/private/followed/az`
- `GET /playlist/private/followed/oldest`
- `GET /playlist/private/followed/recent`
- `GET /playlist/private/followed/top`
- `GET /playlist/public/top`

These operations omit `page` even though the validator requires it. Add
`$ref: "#/components/parameters/PageQueryRequired"`. Do not change `security` or the
description. Where a `parameters` list already exists, append the ref. Where it does not,
insert a `parameters` block between `security` and `responses`.

- `GET /account/recent` (`getManyPublicRecent`, `pageQuerySchema`). No `parameters` block today.
- `GET /account/subscribed/az` (`getManySubscribedAZ`, `pageQuerySchema`).
- `GET /account/subscribed/recent` (`getManySubscribedRecent`, `pageQuerySchema`).
- `GET /account/top` (`getManyPublicTop`, `pageRangeQuerySchema`). Also add
  `$ref: "#/components/parameters/StatsRangeQueryRequired"`. `range` is required by that schema
  and the operation documents no query parameters.
- `GET /account/subscribed/top` (`getManySubscribedTop`, `pageRangeQuerySchema`). Also add
  `StatsRangeQueryRequired`.
- `GET /item/channel/season/backward/{channel_id_or_id_text}` (`getManyByChannelBySeasonBackward`,
  `pageQuerySchema`). Keep the path parameter. Add the page ref after it.
- `GET /item/channel/season/forward/{channel_id_or_id_text}` (`getManyByChannelBySeasonForward`,
  `pageQuerySchema`). Same.
- `GET /item/channel/shuffle/{channel_id_or_id_text}` (`getManyByChannelShuffle`). `page` is
  required, and `shuffleHash` is a required string in the same schema. Keep the path parameter.
  Add the page ref and this query parameter:

```yaml
        - name: shuffleHash
          in: query
          required: true
          schema:
            type: string
```

Already `PageQueryRequired`. Do not edit their page parameter:

- `GET /channel/category/recent`, `GET /channel/category/top`, `GET /channel/global/recent`,
  `GET /channel/global/top`, `GET /channel/subscribed/az`, `GET /channel/subscribed/recent`,
  `GET /channel/subscribed/top`
- `GET /clip/public/category/oldest`, `GET /clip/public/category/recent`,
  `GET /clip/public/category/top`, `GET /clip/public/channel/oldest/{channel_id_text}`,
  `GET /clip/public/channel/recent/{channel_id_text}`,
  `GET /clip/public/channel/top/{channel_id_text}`,
  `GET /clip/public/item/oldest/{item_id_text}`, `GET /clip/public/item/recent/{item_id_text}`,
  `GET /clip/public/item/top/{item_id_text}`, `GET /clip/public/oldest`,
  `GET /clip/public/recent`, `GET /clip/public/subscribed/recent`,
  `GET /clip/public/subscribed/top`, `GET /clip/public/top`
- `GET /item/category/recent`, `GET /item/category/top`,
  `GET /item/channel/oldest/{channel_id_or_id_text}`,
  `GET /item/channel/recent/{channel_id_or_id_text}`,
  `GET /item/channel/top/{channel_id_or_id_text}`, `GET /item/global/recent`,
  `GET /item/global/top`, `GET /item/subscribed/recent`, `GET /item/subscribed/top`
- `GET /live-item/category/recent`, `GET /live-item/category/top`,
  `GET /live-item/global/recent`, `GET /live-item/global/top`,
  `GET /live-item/subscribed/recent`, `GET /live-item/subscribed/top`
  (each calls through to `ItemController`, whose schema still requires `page`),
  `GET /live-item/global/upcoming`, `GET /live-item/subscribed/upcoming`
  (`mediumPageQuerySchema`, which also requires `page`)

`page` stays optional. Do not edit these:

- `GET /account/channel-seen` and `GET /account/channel-seen/add-by-rss` (Joi `default: 1`;
  spec `required: false`)
- `GET /account/taste-profile` and `GET /account/taste-profile/hidden` (local schema,
  `default: 1`)
- `GET /account/notifications` (`default: 1`)
- `GET /playlist/{playlist_id_text}/resources` (no page validator;
  `getPaginationParams` defaults a missing page to 1)
- `GET /playlist/{playlist_id_text}/resources/shuffle` (`pageDefaultQuerySchema`)
- `GET /queue/{queue_id_text}/resources/history-paginated` (no page validator;
  `getPaginationParams` defaults a missing page to 1)
- `GET /item-soundbite/channel/{channel_id_text}` and `GET /item-soundbite/item/{item_id_text}`
  (`page` is `.optional()` and the spec omits it; leave it omitted)

Checked and not page lists. Do not add `page`: `GET /item/queue/pub-date/{id_text}` and
`GET /item/queue/season/{id_text}` (required `direction` only),
`GET /playlist/{playlist_id_text}/resources/queue-by-list-position` (no page),
`GET /live-item/channel/{channel_id_or_id_text}` (one response, no page query),
`GET /playlist/private/likes` (no page).

## My-profile operations

Large file: grep the anchor, read a window, insert beside it. Do not read the whole file.

Insert four paths immediately before `  /publisher-feed/channel/{id_or_id_text}:` (near line
17329), after the public podcasts operation. `tags: [profile]`. `security` is session only
(plan 51 adds `apiKeyAuth`):

```yaml
      security:
        - bearerAuth: []
        - cookieAuth: []
```

No path parameters. One query parameter: `$ref: "#/components/parameters/PageQueryRequired"`.
Responses: 200, 400 `ValidationErrorResponse`, 401 `AuthenticationErrorResponse`, 403
`AuthorizationErrorResponse`, 500 `InternalServerErrorResponse`. No 404. The handler never
sends one; a missing session is 401.

200 schemas already exist (near line 2847). Reuse them. Do not add schemas.

| Path | operationId | 200 schema | Description |
| --- | --- | --- | --- |
| `/my-profile/podcasts/az` | `apiGetMyProfilePodcastsAz` | `ApiGetProfileAccountIdTextPodcastsAzResponse200` | The signed-in account's followed podcast channels, A–Z. `page` is required. A session does not need a current membership. |
| `/my-profile/albums/az` | `apiGetMyProfileAlbumsAz` | `ApiGetProfileAccountIdTextAlbumsAzResponse200` | The signed-in account's followed music channels, A–Z. `page` is required. A session does not need a current membership. |
| `/my-profile/playlists/az` | `apiGetMyProfilePlaylistsAz` | `ApiGetProfileAccountIdTextPlaylistsAzResponse200` | The signed-in account's playlists, A–Z, including playlists that are not public. `page` is required. A session does not need a current membership. |
| `/my-profile/clips/recent` | `apiGetMyProfileClipsRecent` | `ApiGetProfileAccountIdTextClipsRecentResponse200` | The signed-in account's clips, newest first, including clips that are not public. `page` is required. A session does not need a current membership. |

`summary` is `GET` plus the path, matching the operations around them. Copy the response
status blocks from `apiGetProfileAccountIdTextPodcastsAz` and drop the 404 block. The 200
`$ref` is the schema in the table.

Handlers (`apps/api/src/controllers/profileContent.ts`): `getMyProfilePodcastsAZ`,
`getMyProfileAlbumsAZ`, `getMyProfilePlaylistsAZ`, `getMyProfileClipsRecent`. Each calls
`ensureAuthenticated` with `skipMembershipStatus: true`.

## Tests

`apps/api/src/lib/docs/registerSwaggerDocs.test.ts` (unit, Vitest, no database). Import
`express` and `supertest`, and `registerSwaggerDocs` from `./registerSwaggerDocs.js`.

The handlers are unchanged, so there is no API integration test. The test locks the spec
text the server already serves.

- Mount `registerSwaggerDocs(app, '/api/v2')` on a new Express app.
- `GET /api/v2/docs.yaml` is 200, content type `application/yaml`, and the body contains
  `operationId: apiGetRoot`, `/health/ready`, `/meta:`, `/docs.yaml:`,
  `/my-profile/podcasts/az`, `/my-profile/albums/az`, `/my-profile/playlists/az`, and
  `/my-profile/clips/recent`.
- `GET /api/v2/docs` is 200, content type `text/html`, and the body contains `/api/v2/docs.yaml`.
- Read `apps/api/openapi.yml` in the test (resolve it from `import.meta.url` the same way
  `resolveOpenApiPath` does: `../../openapi.yml` from `src/lib/docs` is `apps/api/openapi.yml`).
  An operation is the text from its method line (`    get:`) until the next method line or the
  next path line (`  /…:`). The root path line is `  /:`.

For each of these, the operation contains `#/components/parameters/PageQueryRequired` and does
not contain `PageQueryOptional`:

- the four public profile paths and the four my-profile paths
- the nine playlist paths in the replace list above
- `GET /account/recent`, `GET /account/subscribed/az`, `GET /account/subscribed/recent`,
  `GET /account/top`, `GET /account/subscribed/top`
- `GET /item/channel/season/backward/{channel_id_or_id_text}`,
  `GET /item/channel/season/forward/{channel_id_or_id_text}`,
  `GET /item/channel/shuffle/{channel_id_or_id_text}`
- the channel, clip, item, and live-item paths in the "already PageQueryRequired" list

`GET /account/top` and `GET /account/subscribed/top` also contain `StatsRangeQueryRequired`.
The shuffle operation contains `name: shuffleHash` and `required: true`.

These stay on `PageQueryOptional`: `GET /playlist/{playlist_id_text}/resources`,
`GET /playlist/{playlist_id_text}/resources/shuffle`,
`GET /queue/{queue_id_text}/resources/history-paginated`.

`GET /account/channel-seen`, `GET /account/channel-seen/add-by-rss`,
`GET /account/taste-profile`, `GET /account/taste-profile/hidden`, and
`GET /account/notifications` still contain `name: page` with `required: false`.

`GET /item-soundbite/channel/{channel_id_text}` and
`GET /item-soundbite/item/{item_id_text}` do not contain `name: page` or `PageQuery`.

For `/`, `/health`, `/health/ready`, `/meta`, `/docs`, and `/docs.yaml`, the operation
contains `security: []` and does not contain `apiKeyAuth`. `/health/ready` contains `"503"`.
`/docs.yaml` contains `application/yaml`. `/docs` contains `text/html`.

No comments or test names that cite a plan number. Do not add a route under
`apps/api/src/routes/`.

## Release scratchpad

```markdown
## The API spec documents health, docs, and required list pages

- Surfaces: api
- Change: The OpenAPI spec documents the public routes `GET /`, `/health`, `/health/ready`,
  `/meta`, `/docs`, and `/docs.yaml`. It documents `GET /my-profile/podcasts/az`, `/albums/az`,
  `/playlists/az`, and `/clips/recent`. `page` is required on every list whose validator
  requires it, including the public profile lists, the playlist lists, the account lists, and
  the channel episode lists that omitted it. `/api/v2/docs.yaml` and `/api/v2/docs` serve that
  file.
- Who notices: developers and agents reading the API spec
- Operator steps: none
```
