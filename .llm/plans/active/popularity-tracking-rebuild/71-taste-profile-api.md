**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 71 — Taste Profile API: list, Hidden From Taste Profile, hide, and unhide

The listener's own Taste Profile endpoints, which area I's web Settings and mobile Popularity
Tracking settings build on (R54):

- List the Taste Profile.
- List Hidden From Taste Profile.
- Hide a show. This deletes its taste data and puts it on the hidden list (R60).
- Unhide a show, with one of two choices. "Add it back" creates a fresh row that later listens
  build up (R61). "Only take it off the list" lets a later listen add the show again.

Listens to a hidden show still count toward public totals (area C). Hiding touches only taste
rows.

Every decision below is fixed; transcribe it.

## Rows

R54, R60, R61

## Runs after

10, 11, 70

## Files

- `packages/orm/src/services/stats/listenerIdentity/tasteProfileAccount.ts` (new)
- `packages/orm/src/index.ts`
- `packages/helpers/src/dtos/account/accountTasteProfile.ts` (new)
- `packages/helpers/src/dtos/index.ts`
- `apps/api/src/controllers/account/accountTasteProfile.ts` (new)
- `apps/api/src/routes/account.ts`
- `apps/api/openapi.yml`
- `packages/helpers-requests/src/api/account/tasteProfile.ts` (new)
- `packages/helpers-requests/src/api/_request.ts`
- `docs/features/POPULARITY-TRACKING.md`
- `apps/api/src/test/account-taste-profile.integration.test.ts` (new)

## Decisions this plan fixes

- **Access tier: account.** All four routes use
  `ensureAuthenticated(req, res, handler, { skipMembershipStatus: true })`, the same options as
  `PATCH /account-settings/listen-stats`. No `requiredCapability` and no consent check. A paused
  listener (lapsed membership, or a new explanation version waiting) can still see their data and
  hide shows (**mobile-anonymous-vs-account-features**: expired is degraded, never frozen). An
  opted-out account has no listener row, so its lists come back empty.
- **No listener id leaves the zone.** Responses carry channel data and counts only.
- **Order:** the Taste Profile sorts by `last_listened_at DESC, channel_id DESC`; the hidden list
  by `hidden_at DESC, channel_id DESC`. Scores are not returned: they decay and only make sense
  faded to "now", which recommendation work will do later.
- **Paging:** `page` (integer ≥ 1, default 1) and `limit` (integer 1–50, default 20), as in
  `AccountNotificationController.getNotifications`.
- **Hide** acts only on a show that is in the Taste Profile or already hidden. Otherwise it
  answers 404. It never creates a listener id.
- **Unhide** acts only on a show that is on the hidden list. For any other show it answers 200 and
  changes nothing. `add_to_taste_profile` is required, so the client always sends the listener's
  choice.
- **An added-back row** has `listen_count = 0`, `completion_count = 0`, both scores 0, and
  `first_listened_at`, `last_listened_at`, and `scores_updated_at` set to the add-back time (the
  columns are `NOT NULL`). The API reports `first_listened_at` and `last_listened_at` as `null`
  while `listen_count` is 0.

## DTOs — `packages/helpers/src/dtos/account/accountTasteProfile.ts`

```typescript
/** Show fields a Taste Profile row needs to render and link; `channel_images` feeds `primaryChannelListArtworkUrl`. */
export type DTOAccountTasteProfileChannel = {
  id_text: string;
  slug: string | null;
  title: string | null;
  medium_id: number;
  channel_images: Array<{ url: string; image_width_size: number | null; is_resized: boolean }>;
};

/** One show in the signed-in listener's Taste Profile. Listen times are null while `listen_count` is 0 (a show added back). */
export type DTOAccountTasteProfileRow = {
  channel: DTOAccountTasteProfileChannel;
  listen_count: number;
  completion_count: number;
  first_listened_at: string | null;
  last_listened_at: string | null;
};

/** One show on the signed-in listener's Hidden From Taste Profile list. */
export type DTOAccountTasteProfileHiddenRow = {
  channel: DTOAccountTasteProfileChannel;
  hidden_at: string;
};

export type DTOAccountTasteProfilePagination = {
  page: number;
  total_count: number;
  total_pages: number;
};

export type DTOAccountTasteProfileList = {
  items: DTOAccountTasteProfileRow[];
  pagination: DTOAccountTasteProfilePagination;
};

export type DTOAccountTasteProfileHiddenList = {
  items: DTOAccountTasteProfileHiddenRow[];
  pagination: DTOAccountTasteProfilePagination;
};

/** A show's state after hide or unhide. */
export type DTOAccountTasteProfileShowState = {
  channel_id_text: string;
  hidden: boolean;
  in_taste_profile: boolean;
};
```

Export the file from `packages/helpers/src/dtos/index.ts` on the line after
`export * from './account/accountContentLog.js';`.

## Zone service — `packages/orm/src/services/stats/listenerIdentity/tasteProfileAccount.ts`

Export `TasteProfileAccountService` from `packages/orm/src/index.ts`, beside the
`ListeningDataDeletionService` export plan 70 added. The file opens with a one-sentence doc
comment: account-facing Taste Profile reads and edits; every method takes an `account_id` and
never returns a listener id.

Use `AppDataSourceReadWrite` for every method. The mapping is read-write only, and reading the
lists through the same source returns a hide or unhide right after it is made. Use
`StatsListenerService` (same directory) for the mapping. Take the listener lock with the helper
plan 70 created or found (search `popularity_listen:` in this directory; do not add a second
helper).

```typescript
type TasteProfilePageParams = { limit: number; offset: number };

export type TasteProfileHideResult =
  | { status: 'hidden' }
  | { status: 'channel_not_found' }
  | { status: 'not_in_taste_profile' };

export type TasteProfileUnhideResult =
  | { status: 'ok'; hidden: boolean; in_taste_profile: boolean }
  | { status: 'channel_not_found' };

export class TasteProfileAccountService {
  async listForAccount(account_id: number, params: TasteProfilePageParams): Promise<{ rows: DTOAccountTasteProfileRow[]; total_count: number }>;
  async listHiddenForAccount(account_id: number, params: TasteProfilePageParams): Promise<{ rows: DTOAccountTasteProfileHiddenRow[]; total_count: number }>;
  async hideForAccount(account_id: number, channel_id_text: string): Promise<TasteProfileHideResult>;
  async unhideForAccount(account_id: number, channel_id_text: string, add_to_taste_profile: boolean): Promise<TasteProfileUnhideResult>;
}
```

### `listForAccount` / `listHiddenForAccount`

1. `findListenerId(account_id)`. When null, return `{ rows: [], total_count: 0 }`.
1. `manager.getRepository(StatsTasteProfile).findAndCount({ where: { listener_id }, relations: { channel: { channel_images: true } }, order: { last_listened_at: 'DESC', channel_id: 'DESC' }, skip: offset, take: limit })`.
   For the hidden list, use `StatsTasteProfileHidden` ordered by `hidden_at: 'DESC', channel_id: 'DESC'`.
1. Map each entity to the DTO with a module-level function per row type. Build every field
   explicitly: no spread of the entity, no `as`. Dates go through `.toISOString()`. For taste rows,
   `first_listened_at` and `last_listened_at` are `null` when `listen_count === 0`. The channel
   mapper takes `id_text`, `slug`, `title`, `medium_id`, and `channel_images` mapped to
   `{ url, image_width_size, is_resized }`.

### `hideForAccount`

1. Find the channel: `getRepository(Channel).findOne({ where: { id_text: channel_id_text }, select: { id: true } })`.
   When missing, return `{ status: 'channel_not_found' }`.
1. In `AppDataSourceReadWrite.transaction`:
   1. `findListenerId(account_id, manager)`. When null, return `{ status: 'not_in_taste_profile' }`.
   1. Take the listener lock.
   1. Delete the taste row: `manager.getRepository(StatsTasteProfile).delete({ listener_id, channel_id })`.
   1. When `affected` is 0, check for a hidden row for this listener and channel. If one exists,
      return `{ status: 'hidden' }` (idempotent). If not, return
      `{ status: 'not_in_taste_profile' }`.
   1. Insert the hidden row:
      `manager.createQueryBuilder().insert().into(StatsTasteProfileHidden).values({ listener_id, channel_id }).orIgnore().execute()`.
   1. Return `{ status: 'hidden' }`.

Daily and range totals are not touched (R62 belongs to area C; this only confirms hiding never
subtracts).

### `unhideForAccount`

1. Find the channel as above. When missing, return `{ status: 'channel_not_found' }`.
1. In one transaction:
   1. `findListenerId(account_id, manager)`. When null, return
      `{ status: 'ok', hidden: false, in_taste_profile: false }`.
   1. Take the listener lock.
   1. `delete({ listener_id, channel_id })` on `StatsTasteProfileHidden`.
   1. When a hidden row was deleted and `add_to_taste_profile` is true, insert a fresh taste row
      with `listen_count: 0`, `completion_count: 0`, `recent_score: 0`, `long_term_score: 0`, and
      `first_listened_at`, `last_listened_at`, `scores_updated_at` all set to one `new Date()`. Use
      `.orIgnore()`; the lock means no row should exist.
   1. Return `{ status: 'ok', hidden: false, in_taste_profile: <a taste row exists for this listener and channel> }`.

When the show was not hidden, nothing changes, including when `add_to_taste_profile` is true. A
show reaches the Taste Profile only by listening or by adding back from the hidden list.

## API — `apps/api/src/controllers/account/accountTasteProfile.ts` and routes

`AccountTasteProfileController` with four static handlers, following `accountNotification.ts`
(Joi with `validateQueryObject` / `validateBodyObject`, `ensureAuthenticated`,
`getAuthenticatedUser`, `handleGenericErrorResponse`).

| Method and path | Handler | Input | 200 body |
| --- | --- | --- | --- |
| `GET /account/taste-profile` | `list` | query `page`, `limit` | `{ data: DTOAccountTasteProfileList }` |
| `GET /account/taste-profile/hidden` | `listHidden` | query `page`, `limit` | `{ data: DTOAccountTasteProfileHiddenList }` |
| `POST /account/taste-profile/hide` | `hide` | body `{ channel_id_text: string }` (required) | `{ data: DTOAccountTasteProfileShowState }` with `hidden: true`, `in_taste_profile: false` |
| `POST /account/taste-profile/unhide` | `unhide` | body `{ channel_id_text: string, add_to_taste_profile: boolean }` (both required) | `{ data: DTOAccountTasteProfileShowState }` from the result |

- Paging: `offset = (page - 1) * limit`; `total_pages = total_count === 0 ? 0 : Math.ceil(total_count / limit)`.
- Errors: 400 for validation; 401 without auth; `404 { message: 'Channel not found' }` for
  `channel_not_found`; `404 { message: 'Show is not in the Taste Profile' }` for
  `not_in_taste_profile`.
- Type the body with the Joi-validated shape through a small type guard or typed locals, not
  `req.body as …`. Follow how `accountNotification.ts` reads validated input.

In `apps/api/src/routes/account.ts`, import the controller with the other account controllers.
Register the four routes after the `/content-log` line and before
`router.get('/:id_text', …)`; the `/:id_text` catch-all would otherwise take
`GET /account/taste-profile`:

```typescript
router.get('/taste-profile', asyncHandler(AccountTasteProfileController.list));
router.get('/taste-profile/hidden', asyncHandler(AccountTasteProfileController.listHidden));
router.post('/taste-profile/hide', asyncHandler(AccountTasteProfileController.hide));
router.post('/taste-profile/unhide', asyncHandler(AccountTasteProfileController.unhide));
```

## OpenAPI — `apps/api/openapi.yml` (large file: search, then edit a window)

- Add the four paths beside `/account/content-log:` (search that path), tag `account`, security
  `bearerAuth` and `cookieAuth`, and responses 200, 400, 401, 404 (hide and unhide), and 500 using
  the shared error schemas the sibling uses. `operationId`s: `apiGetAccountTasteProfile`,
  `apiGetAccountTasteProfileHidden`, `apiPostAccountTasteProfileHide`,
  `apiPostAccountTasteProfileUnhide`.
- Add component schemas beside `ApiPatchAccountSettingsListenStatsRequest:`, named after the
  sibling convention:
  - `ApiGetAccountTasteProfileResponse200`, `ApiGetAccountTasteProfileHiddenResponse200`
  - `ApiPostAccountTasteProfileHideRequest`, `ApiPostAccountTasteProfileUnhideRequest`
  - `ApiPostAccountTasteProfileShowStateResponse200`

  The schemas describe the DTOs above. Each request schema gets one realistic example
  (**openapi-sync**).
- Descriptions, one sentence each:
  - Hide: "Removes the show from the Taste Profile, deletes its taste data, and adds it to Hidden
    From Taste Profile; public totals are unaffected."
  - Unhide: "Takes the show off Hidden From Taste Profile; with `add_to_taste_profile` true it
    also starts a fresh Taste Profile row."

## Requests — `packages/helpers-requests`

New `packages/helpers-requests/src/api/account/tasteProfile.ts`, in the style of
`account/contentLog.ts` (`api.apiRequest<…>`, `config: { withCredentials: true }`). Each
function returns the response's `data`:

```typescript
export const reqAccountTasteProfile = (api: ApiRequestService, params: { page?: number; limit?: number }): Promise<DTOAccountTasteProfileList>;
export const reqAccountTasteProfileHidden = (api: ApiRequestService, params: { page?: number; limit?: number }): Promise<DTOAccountTasteProfileHiddenList>;
export const reqAccountTasteProfileHide = (api: ApiRequestService, params: { channel_id_text: string }): Promise<DTOAccountTasteProfileShowState>;
export const reqAccountTasteProfileUnhide = (api: ApiRequestService, params: { channel_id_text: string; add_to_taste_profile: boolean }): Promise<DTOAccountTasteProfileShowState>;
```

Build the list query with `URLSearchParams`, adding `page` and `limit` only when they are
defined. In `packages/helpers-requests/src/api/_request.ts` (large file), import the four next to
`reqAccountContentLog` and add an `/* ACCOUNT > TASTE PROFILE */` block of instance methods right
after the `/* ACCOUNT > CONTENT LOG */` block. Mobile calls these through `ApiRequestService`
methods (**mobile-react-native**).

## Doc — `docs/features/POPULARITY-TRACKING.md`

Add a "Taste Profile and Hidden From Taste Profile" subsection under the consent lifecycle section
plan 70 filled. Cover: the four routes and the account tier; hide deletes the taste row and adds a
hidden row under the listener lock; the write path never adds taste data for a hidden show, while
its listens still count in public totals; the two unhide choices; added-back rows start at zero
with listen times reported as null until the first listen; the list order. Present tense, no plan
numbers.

## Tests

`apps/api/src/test/account-taste-profile.integration.test.ts`, DB-backed. Use the same harness
as plan 70's `popularity-tracking-opt-out.integration.test.ts`: `@podverse/orm` mock with
`CategoryService`, `startTestApp`, accounts from `AccountService.create`, `authHeaders`, and raw
SQL seeding of `stats_listener`, `stats_taste_profile`, `stats_taste_profile_hidden`, and
`stats_daily_channel`. Seed one listener account with taste rows for channels C1 to C3 (distinct
`last_listened_at`), C4 hidden, C5 in neither, and a daily row for C1. Cases:

1. Each of the four routes answers 401 without auth.
1. `GET /account/taste-profile` returns C1 to C3 newest first, with `pagination.total_count` 3.
   Each row has `channel.id_text`, `title`, `medium_id`, and a `channel_images` array. The raw
   response text does not contain the seeded `listener_id`.
1. `limit=2&page=2` returns one row, with `total_pages` 2.
1. An account with no `stats_listener` row gets `items: []` and `total_count: 0` from both lists.
1. `GET /account/taste-profile/hidden` returns C4.
1. Hide C1: 200 with `{ hidden: true, in_taste_profile: false }`. C1's taste row is gone, a hidden
   row exists, and C1's daily row is unchanged. Hiding C1 again answers 200.
1. Hide C5 answers 404. Hide an unknown `channel_id_text` answers 404.
1. Unhide C4 with `add_to_taste_profile: false`: no hidden row and no taste row, response
   `{ hidden: false, in_taste_profile: false }`.
1. Unhide C1 with `add_to_taste_profile: true`: a taste row with `listen_count` 0 and both scores
   0. `GET /account/taste-profile` shows C1 with `first_listened_at` and `last_listened_at` null.
1. Unhide C2, which is not hidden, with `add_to_taste_profile: true`: 200, and C2's counts are
   unchanged.
1. Unhide without `add_to_taste_profile` answers 400.
1. An account whose membership has expired (set `account_membership_status.membership_expires_at`
   in the past with SQL) still gets 200 from `GET /account/taste-profile` and from hide.

## Release scratchpad

```markdown
## Taste Profile endpoints

- Surfaces: api, helpers, helpers-requests
- Change: new signed-in routes `GET /account/taste-profile`, `GET /account/taste-profile/hidden`,
  `POST /account/taste-profile/hide`, and `POST /account/taste-profile/unhide`. Listeners can list
  the shows in their Taste Profile and their Hidden From Taste Profile list. Hiding a show deletes
  its taste data and stops later listens from adding it back; its listens still count in public
  totals. Unhiding either adds the show back as a fresh row or only takes it off the hidden list.
  The routes need an account, not a current membership, so a paused listener can still review
  and hide shows. Request helpers `reqAccountTasteProfile*` are on `ApiRequestService`.
- Who notices: client developers; listeners once the Settings UI ships
- Operator steps: none
```
