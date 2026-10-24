**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 21 — Open playlist, queue, and clip routes to API keys

Apply plan 20's route-to-permission table to the playlist, queue, and clip controllers, so a key
with the right bits can read and change those resources (R19, R20). Session behavior does not
change: plan 12's middleware ignores `apiKeyAccess` for sessions.

## Rows

R19, R20

## Runs after

20

## Files

apps/api/src/controllers/playlist/playlist.ts
apps/api/src/controllers/playlist/playlistResource.ts
apps/api/src/controllers/playlist/playlistResourceClip.ts
apps/api/src/controllers/playlist/playlistResourceItem.ts
apps/api/src/controllers/playlist/playlistResourceItemAddByRSS.ts
apps/api/src/controllers/playlist/playlistResourceItemSoundbite.ts
apps/api/src/controllers/queue/queue.ts
apps/api/src/controllers/queue/queueResource.ts
apps/api/src/controllers/queue/queueResourceClip.ts
apps/api/src/controllers/queue/queueResourceItem.ts
apps/api/src/controllers/queue/queueResourceItemAddByRSS.ts
apps/api/src/controllers/queue/queueResourceItemSoundbite.ts
apps/api/src/controllers/clip.ts
apps/api/src/test/api-key-routes-playlists-queue-clips.integration.test.ts
release-notes/scratchpad.md

## The edit

The source of truth is plan 20 (`20-api-key-route-access-shared.md`), § Route-to-permission
table: every row whose Plan column is **21**. Those rows sit under the `playlists`, `queue`,
`clips`, and `subscriptions` headings (the `subscriptions` rows here are
`/clip/public/subscribed/*` and `/playlist/private/followed/*`).

For each row, add `apiKeyAccess` to the options object that the handler passes to
`ensureAuthenticated` or `optionalEnsureAuthenticated`, beside the existing keys:

```ts
{ skipMembershipStatus: false, apiKeyAccess: { resource: 'playlists', action: 'create' } }
```

- Write the requirement inline as an object literal. `resource` and `action` are typed by
  `ApiKeyPermissionRequirement` through `AuthenticatedRequestOptions`, so a typo fails the build;
  no import is needed for an inline literal.
- Keep every existing option (`skipMembershipStatus`, `requiredCapability`) and the order of the
  handler's validators, ownership checks, and auth call exactly as they are.
- Rows written `{a|b|c}` are one handler per literal; label each handler.
- None of these files has a route that stays closed to keys, so when you finish, every
  `ensureAuthenticated(` and `optionalEnsureAuthenticated(` call in the 13 controller files carries
  `apiKeyAccess`. Check with `rg -c` on both patterns per file before finishing.
- `verifyPlaylistOwnership`, `verifyPrivatePlaylistOwnershipIfNeeded`, `verifyQueueOwnership`,
  and `verifyPrivateClipOwnership` run after auth and do not call it; leave them alone.

Expected label counts, by file:

| File | Labels |
| --- | --- |
| `playlist/playlist.ts` | 15 (create, update, delete; 4 private lists; 4 followed lists as `subscriptions` read; likes list, likes membership, toggle; get by id) |
| `playlist/playlistResource.ts` | 4, all `playlists` read |
| `playlist/playlistResourceClip.ts`, `…Item.ts`, `…ItemAddByRSS.ts`, `…ItemSoundbite.ts` | 4 each: first, last, between `create`; remove `delete` |
| `queue/queue.ts` | 2: `getAllPrivate` read, `updateIsActiveQueue` update |
| `queue/queueResource.ts` | 6: abridged, now-playing, upcoming-all, history-paginated read; promote-upcoming, replay update |
| `queue/queueResourceClip.ts`, `…Item.ts`, `…ItemAddByRSS.ts`, `…ItemSoundbite.ts` | 6 each: now-playing, next, last, between, history `create`; remove `delete` |
| `clip.ts` | 7: create, update, delete, get by id, private list (`clips`); subscribed recent and top (`subscriptions` read) |

If a file's count of auth calls does not match its row, stop and report rather than guessing.

## Tests

`apps/api/src/test/api-key-routes-playlists-queue-clips.integration.test.ts` (new, API
integration). Use `startTestApp({ accountSessions: 'real' })`, the `vi.mock('@podverse/orm')`
`MockCategoryService` stub from `account-session-list.integration.test.ts`, and the helpers in
`apps/api/src/test/helpers/apiKeyTestAccounts.ts` (plan 20). Email prefix
`api-key-routes-pqc-`.

**Label table.** One table-driven `it.each` over every route this plan labels (expand `{a|b|c}`
rows; 74 cases, matching the label counts above). Each case holds `method`, `path`, `requirement`, and the `query` or `body` the
handler's pre-auth validators need. For each case, use a key made with
`permissionsWithout(requirement)` (full access minus exactly that bit; create each distinct key
once in `beforeAll` and reuse it) and expect 403 with `code: 'api_key_permission_denied'` and
`required_permission` equal to `requirement`. A wrong resource or action on a route fails this,
because the key holds every other bit.

- Path ids are placeholders shaped like real ids; the permission check runs before any lookup or
  ownership check. Where a validator runs before the auth call (`validateParamsObject`,
  `validateQueryObject`, `validateBodyObject` wrapping it), read the handler's schema and send
  input that passes it.

**Keys change data (R20).** One account:

- A key with `permissionsWithOnly` the four `playlists` bits: `POST /playlist` with a valid body
  (read `createPlaylist`'s schema) succeeds; `GET /playlist/{id}` returns it; `PATCH
  /playlist/{id}` changes one field its schema allows, and the change reads back; `GET /playlist/private/az` lists it; `DELETE /playlist/{id}`
  succeeds; a second `GET /playlist/{id}` is 404.
- A key with only `playlists` read gets 403 `api_key_permission_denied` with
  `required_permission: { resource: 'playlists', action: 'create' }` from `POST /playlist`.
- A key with only `queue` read gets 200 from `GET /queue/all-for-account/private`.
- A key with only `clips` read gets 200 from `GET /clip/private`.
- A key with only `subscriptions` read gets 200 from `GET /playlist/private/followed/az`.

Follow **api-testing** for layout. No mocks of `apiKeyStore.ts`.

## Release scratchpad

Running in a phase with other prompts: put this entry in the final message under "Release notes
entry" instead of writing the scratchpad (**release-notes-scratchpad**).

```markdown
## API keys reach playlists, the queue, and clips

- Surfaces: api
- Change: playlist, queue, and clip routes accept an API key holding the matching permission.
  Playlists: read lists, likes, a playlist and its items; create playlists and add items; update
  a playlist, toggle likes; delete playlists and remove items. Queue: read the queue, now playing,
  upcoming, and its history zone; add items to any zone (create); promote, replay playback
  events, set the active queue (update); remove items (delete). Clips: read, create, update,
  delete the account's clips. Followed-playlist lists and subscribed clip lists need
  subscriptions read. A key missing the permission gets 403 `api_key_permission_denied` naming
  it; this applies to the public playlist and clip reads too when a key is sent.
- Who notices: developers and agents calling the API with a key
- Operator steps: none
```
