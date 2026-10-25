**Cursor model:** Opus 5.5 · **Reasoning:** high

# A signed-in viewer can read another account's non-private playlist

`GET /playlist/:playlist_id_text` answers 404 to a signed-in caller who opens another account's
public or unlisted playlist. A signed-out caller gets the same playlist with 200. This plan makes
the signed-in read match the signed-out one for every non-private playlist. The owner still reads
their own playlist, private included. A private playlist the caller does not own stays 404.

This changes who can read a playlist, so the implementer keeps every private-playlist path closed
and proves it in tests.

## Rows

R34

## Runs after

none

## Files

apps/api/src/controllers/playlist/playlist.ts
apps/api/src/test/playlist.test.ts
apps/api/src/test/api-key-routes-playlists-queue-clips.integration.test.ts
apps/api/openapi.yml
release-notes/scratchpad.md

## What happens today

`PlaylistController.getPlaylistById` in `apps/api/src/controllers/playlist/playlist.ts` runs, in
order:

1. `validateParamsObject(Joi.object(playlistIdTextParamSchema), …)`.
1. `optionalEnsureAuthenticated(…, { skipMembershipStatus: true, apiKeyAccess: { resource:
   'playlists', action: 'read' } })`. It sets `req.user` for a session, a bearer token, or an API
   key that has playlists read. A key without playlists read gets 403.
1. `verifyPrivatePlaylistOwnershipIfNeeded()`, exported from the same file. It loads the playlist
   with `playlistService.getByIdText(id, { relations: { account: true, sharable_status: true } })`,
   answers 404 when it is missing, and answers 404 when `resolveSharableStatusId(playlist)` is
   `SharableStatusEnum.Private` and the caller is not the owner. Otherwise it calls `next()`.
1. The handler: when `req.user` is set it calls `playlistService.getOnePrivate(account.id_text,
   id)`, otherwise `playlistService.getOnePublic(id)`.

`getOnePrivate` in `packages/orm/src/services/playlist/playlist.ts` filters on
`account: { id_text: account_id_text }`, so it returns `null` for a playlist the caller does not
own, and the handler answers 404. The middleware had already allowed that playlist through.
`getOnePublic` filters on `sharable_status_id: Not(SharableStatusEnum.Private)`, so it returns
public (`1`) and unlisted (`2`) playlists to anyone. Both load the same relations
(`account.account_profile`), so their responses have the same shape.

The handler also declares `let playlist: any | null` behind an `eslint-disable` for
`no-explicit-any`. This plan removes both.

## Behavior after this plan

| Caller | Playlist | Today | After |
| --- | --- | --- | --- |
| Signed out | public or unlisted | 200 | 200 |
| Signed out | private | 404 (middleware) | 404 (middleware) |
| Owner (session, bearer, or key with playlists read) | any status | 200 | 200 |
| Another account (session, bearer, or key with playlists read) | public or unlisted | **404** | **200**, same body a signed-out caller gets |
| Another account | private | 404 (middleware) | 404 (middleware) |
| Anyone | id that matches nothing | 404 | 404 |
| Key without playlists read | any | 403 | 403 |

The response body for the new 200 row is the same as the signed-out body. It goes through
`omitAccountNumericId` and `preparePlaylistForJson`, so it carries `account.id_text` and the
profile, and never the numeric `account.id`.

Two layers keep a private playlist closed to a non-owner. The middleware answers 404 before the
handler runs. If the middleware ever let one through, `getOnePublic` still excludes private at the
query. Do not drop either layer.

## Implementation

### 1. `apps/api/src/controllers/playlist/playlist.ts` — `PlaylistController.getPlaylistById`

Leave the validation, `optionalEnsureAuthenticated` options, and the
`verifyPrivatePlaylistOwnershipIfNeeded()` call exactly as they are. Do not edit
`verifyPrivatePlaylistOwnershipIfNeeded`, `verifyPlaylistOwnership`,
`loadOwnerPlaylistForResponse`, or `PlaylistService`.

Replace the body of the `try` block inside `verifyPrivatePlaylistOwnershipIfNeeded()(req, res,
async () => { … })` with:

```typescript
              const playlist_id_text = getParamRequired(req, 'playlist_id_text');
              const account = req.user;

              const ownedPlaylist =
                account !== undefined
                  ? await playlistService.getOnePrivate(account.id_text, playlist_id_text)
                  : null;
              const playlist =
                ownedPlaylist ?? (await playlistService.getOnePublic(playlist_id_text));

              if (playlist === null) {
                res.status(404).json({ message: 'Playlist not found' });
                return;
              }

              res.status(200).json(preparePlaylistForJson(omitAccountNumericId(playlist)));
```

Keep the existing `catch (err) { handleGenericErrorResponse(res, err); }`.

- Delete the `// eslint-disable-next-line @typescript-eslint/no-explicit-any` line and the
  `let playlist: any | null = null;` declaration. `playlist` is `Playlist | null` from the service
  return types; no annotation and no `as` is needed.
- `req.user` is `User | undefined` (`apps/api/src/@types/express.d.ts`), so compare with
  `!== undefined`, not truthiness.
- Keep `getOnePrivate` called with exactly two arguments, `(account.id_text, playlist_id_text)`.
  The existing owner test asserts that call.
- The owner always resolves on `getOnePrivate`, so a signed-in owner's request makes no
  `getOnePublic` call. A signed-in non-owner makes both calls. A signed-out caller makes only the
  `getOnePublic` call.
- Add no comment. The two-layer reasoning above belongs in this plan, not the source.

### 2. `apps/api/openapi.yml` — `apiGetPlaylistPlaylistIdText`

Find `operationId: apiGetPlaylistPlaylistIdText` under `/playlist/{playlist_id_text}:` (search it;
the file is large). Replace only its `description` block with:

```yaml
      description: >
        Returns a playlist. Every caller, signed in or not, gets a public or unlisted playlist.
        Only the owner, signed in or using a key with playlists read, gets a private playlist;
        every other caller gets 404. A key that lacks playlists read is refused rather than
        treated as anonymous.
```

Leave `security`, `x-api-key-permission`, parameters, and responses unchanged. The response
shape and status codes do not change.

### 3. `apps/api/src/test/playlist.test.ts` — `describe('GET /:playlist_id_text')`

This file mocks `@podverse/orm`. The describe's `beforeEach` resets `playlistGetByIdTextMock`,
`playlistGetOnePrivateMock`, and `playlistGetOnePublicMock`, so every test below sets every mock
its path calls. A reset mock resolves `undefined`, which the handler would not treat as missing.
`authHeaders(TEST_USER_ID)` signs in as `TEST_USER_ID` / `TEST_USER_ACCOUNT_ID_TEXT`.

Follow the file's existing patterns: sharable status as numeric literals (`1` public, `2`
unlisted, `3` private), and `as never` on `mockResolvedValue` where the mock's inferred type does
not fit (`null`, or a row with extra fields).

Edit the two existing tests:

- `returns 200 for private playlist when owner is authenticated`: add
  `expect(playlistGetOnePublicMock).not.toHaveBeenCalled();`.
- `returns 404 for private playlist when not the owner`: add
  `expect(playlistGetOnePrivateMock).not.toHaveBeenCalled();` and
  `expect(playlistGetOnePublicMock).not.toHaveBeenCalled();`, which shows the middleware answered.

Add these tests to the same describe:

1. `returns 200 for another account's public playlist when signed in`
   - `playlistGetByIdTextMock.mockResolvedValue({ id: 1, playlist_id_text: PLAYLIST_ID_TEXT,
     account: { id: OTHER_USER_ID }, sharable_status: { id: 1 } } as never)`.
   - `playlistGetOnePrivateMock.mockResolvedValue(null as never)`.
   - `playlistGetOnePublicMock.mockResolvedValue({ id: 1, id_text: PLAYLIST_ID_TEXT, title:
     'Theirs', sharable_status: { id: 1 }, account: { id: OTHER_USER_ID, id_text:
     'other-account' } } as never)`.
   - GET with `authHeaders(TEST_USER_ID)`.
   - Expect status 200, `res.body.title` `'Theirs'`, `res.body.sharable_status_id` `1`,
     `res.body.sharable_status` undefined, `res.body.account.id_text` `'other-account'`,
     `res.body.account.id` undefined.
   - Expect `playlistGetOnePrivateMock` called with `(TEST_USER_ACCOUNT_ID_TEXT, PLAYLIST_ID_TEXT)`
     and `playlistGetOnePublicMock` called with `(PLAYLIST_ID_TEXT)`.
1. `returns 200 for another account's unlisted playlist when signed in` — the same setup with
   sharable status `2` in both the `getByIdText` row and the `getOnePublic` row. Expect 200 and
   `res.body.sharable_status_id` `2`.
1. `returns 404 when signed in and the playlist does not exist` —
   `playlistGetByIdTextMock.mockResolvedValue(null as never)`; GET with
   `authHeaders(TEST_USER_ID)`; expect 404 and neither `getOnePrivate` nor `getOnePublic` called.

Leave `returns 200 for public playlist without auth` and `returns 404 for private playlist when
anonymous` as they are.

### 4. `apps/api/src/test/api-key-routes-playlists-queue-clips.integration.test.ts`

This file runs against a real database (`startTestApp({ accountSessions: 'real' })`), so it proves
the ORM queries, which the mocked file cannot. Add one test after `'a playlists key can create,
update, list, and delete a playlist'`:

`it("a playlists read key can read another account's public and unlisted playlists but not a private one", …)`

- `const otherAccount = await createApiKeyTestAccount('api-key-routes-pqc-other-');`
- `const otherToken = await createTestApiKey(otherAccount.id, permissionsWithOnly([playlistsCreate,
  playlistsRead, playlistsDelete]));`
- With `otherToken`, `POST ${apiBase}/playlist` three times with `CREATE_PLAYLIST_BODY` spread and
  overridden: `sharable_status_id: SharableStatusEnum.Public`, `SharableStatusEnum.Unlisted`,
  and `SharableStatusEnum.Private`, each with its own title (`'Other public playlist'`, `'Other
  unlisted playlist'`, `'Other private playlist'`). Expect each 201 and read each id with
  `playlistIdText`.
- With `playlistsReadToken` (the first account, not the owner): GET the public id, expect 200
  and `playlistTitle` `'Other public playlist'`; GET the unlisted id, expect 200 and its title;
  GET the private id, expect 404.
- With `otherToken` (the owner): GET the private id, expect 200 and its title.
- With `otherToken`, DELETE all three, expect 204 each.

Put the three titles beside `CREATED_TITLE` as module constants. Do not change
`LABELED_ROUTES`, `deniedTokens`, or the counts in `'labels every playlist, queue, and clip
route'`; this test adds no route.

### 5. `release-notes/scratchpad.md`

Append the entry under § Release scratchpad.

## Clients of `GET /playlist/:id`

Every caller goes through `reqPlaylistGet` in
`packages/helpers-requests/src/api/playlist/playlist.ts` (`withCredentials: true`). None needs a
code change. The DTO shape is unchanged, so nothing stored on a device changes shape.

| Client | Where | Effect |
| --- | --- | --- |
| Web playlist page and its metadata | `getPlaylistForSeoPage` in `apps/web/src/lib/seo/fetchers.ts`, used by `apps/web/src/app/playlist/[playlist_id]/page.tsx` | A signed-in non-owner sees the playlist instead of Not Found. `SubscribeButton` compares `loggedInAccount.id_text` with `playlist.account.id_text`, so the viewer gets Follow and only the owner gets Edit |
| Web embed playlist | `fetchEmbedPlaylistListData` in `apps/web/src/lib/embed/fetchEmbedListData.ts` | A signed-in viewer of another account's playlist embed gets the list instead of the embed not-found shell |
| Web embed builder intro | `fetchEmbedBuilderSourceIntro.ts` | The intro shows another account's playlist title for a signed-in builder |
| Web playlist edit page | `apps/web/src/app/playlist/edit/[playlist_id]/page.tsx` (plan 40 moves it to `getPlaylistForSeoPage`) | See the note below |
| Mobile playlist detail | `fetchRemotePlaylistByIdText` in `apps/mobile/src/data/repositories/playlistRepository.ts` | Opening or refreshing another account's followed playlist succeeds instead of 404 |
| Mobile follow | `playlistRepository.follow`, same file | The read after `reqAccountFollowPlaylist` succeeds. Today the follow is written on the server and then the call throws on the 404 |

The resources routes (`/playlist/:id/resources`, `/resources/shuffle`) already return another
account's non-private playlist to a signed-in caller. They use the caller only to hide private
clips (`filterPrivateClips`), so they need no change.

### Note on the edit page

`PlaylistEditPageClient` has no ownership check. A signed-out visitor who opens
`/playlist/edit/<public id>` already gets the edit form today, and the API refuses their save and
delete. After this plan a signed-in non-owner gets the same form, where they got Not Found before.
Their writes are still refused: `PATCH` and `DELETE` run `verifyPlaylistOwnership` (403), and the
Items tab calls `/resources/private-all`, which is owner-only. No one can change another account's
playlist. This plan does not change web pages, so the edit page keeps that behavior. An owner check
on the edit page is separate web work.

## Tests

- API integration (mocked ORM): `apps/api/src/test/playlist.test.ts` — signed-in non-owner gets
  public and unlisted playlists with 200 and the signed-out body shape; a missing id stays 404
  with no read; the owner's private read makes no `getOnePublic` call; a non-owner's private read
  is refused by the middleware before either read.
- API integration (real database):
  `apps/api/src/test/api-key-routes-playlists-queue-clips.integration.test.ts` — another account's
  public and unlisted playlists answer 200 to a playlists read key, its private playlist answers
  404, and its owner still reads it.
- OpenAPI: the `apiGetPlaylistPlaylistIdText` description changes; `openapi:check` must still pass.
- No Playwright spec. This plan changes no web page, and the playlist page specs already cover the
  owner and signed-out paths.

## Release scratchpad

```markdown
## Signed-in listeners can open other accounts' public playlists

- Surfaces: api, web, mobile
- Change: `GET /playlist/:playlist_id_text` returns a public or unlisted playlist to every
  caller, including a signed-in account or API key that does not own it. Before, a signed-in
  non-owner got 404 while a signed-out visitor got the playlist. A private playlist still answers
  404 to everyone except its owner, and writes stay owner-only.
- Who notices: signed-in web users opening another account's playlist link or embed see the
  playlist and a Follow button instead of Not Found; mobile users following another account's
  playlist no longer get an error after the follow, and its detail screen loads; API key users
  can read other accounts' public playlists
- Operator steps: none
```
