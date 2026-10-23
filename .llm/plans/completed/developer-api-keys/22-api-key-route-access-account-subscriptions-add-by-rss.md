**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 22 — Open account, subscription, and Add by RSS routes to API keys

Apply plan 20's route-to-permission table to the account, profile, subscription, and Add by RSS
controllers and to the rate-limit wrappers in front of them (R19, R20), while leaving password,
email, account deletion, the data export, and terms acceptance closed (R30). Session behavior does
not change.

Reasoning is extra high because `account/account.ts` is large, plan 12 already edited it, and it
holds both routes to open and routes that must stay closed.

## Rows

R19, R20, R30

## Runs after

20

## Files

apps/api/src/controllers/account/account.ts
apps/api/src/controllers/profileContent.ts
apps/api/src/controllers/account/accountFollowingChannel.ts
apps/api/src/controllers/account/accountFollowingAccount.ts
apps/api/src/controllers/account/accountFollowingPlaylist.ts
apps/api/src/controllers/account/accountUnfollowBulk.ts
apps/api/src/controllers/account/accountChannelSeen.ts
apps/api/src/controllers/account/accountOpmlExport.ts
apps/api/src/controllers/account/accountOpmlImport.ts
apps/api/src/controllers/channel.ts
apps/api/src/controllers/item.ts
apps/api/src/controllers/liveItem.ts
apps/api/src/controllers/account/accountFollowingAddByRSSChannel.ts
apps/api/src/controllers/account/accountAddByRSSChaptersTranscript.ts
apps/api/src/controllers/account/accountAddByRSSParse.ts
apps/api/src/controllers/mq/mq.ts
apps/api/src/routes/account.ts
apps/api/src/test/api-key-routes-account-subscriptions-add-by-rss.integration.test.ts
release-notes/scratchpad.md

## The edit

The source of truth is plan 20 (`20-api-key-route-access-shared.md`), § Route-to-permission
table: every row whose Plan column is **22** (under the `account`, `subscriptions`, and
`add_by_rss` headings).

For each handler row, add `apiKeyAccess` as an inline literal to the options object passed to
`ensureAuthenticated` / `optionalEnsureAuthenticated`, keeping every existing option and the order
of validators and the auth call:

```ts
{ skipMembershipStatus: true, apiKeyAccess: { resource: 'subscriptions', action: 'read' } }
```

### Wrappers

`rateLimitAuthEndpoint` accepts `apiKeyAccess` after plan 20. Add it to these instances, with
the requirement of the routes they guard:

| Instance | File | `apiKeyAccess` |
| --- | --- | --- |
| `channelSeenReadRateLimit` | `account/accountChannelSeen.ts` | `{ resource: 'subscriptions', action: 'read' }` |
| inline wrapper on `GET /opml/export` | `apps/api/src/routes/account.ts` | `{ resource: 'subscriptions', action: 'read' }` |
| `opmlImportEnqueueRateLimit` | `account/accountOpmlImport.ts` | `{ resource: 'subscriptions', action: 'create' }` |
| `addByRssParseEnqueueRateLimit` | `account/accountAddByRSSParse.ts` | `{ resource: 'add_by_rss', action: 'create' }` |
| `MQController.rssOnDemandMiddleware` | `mq/mq.ts` | `{ resource: 'add_by_rss', action: 'create' }` |

In `apps/api/src/routes/account.ts`, leave `accountChangePasswordRateLimit` and the inline
wrapper on `GET /download-data` without `apiKeyAccess`.

`mq/mq.ts` `rssAddToOnDemandMQ(type)` builds its options per type; add the same
`{ resource: 'add_by_rss', action: 'create' }` for both types (plan 20, mapping rule 4).

### Stays closed

Do not add `apiKeyAccess` to these calls in `account/account.ts`: `checkIfValidAuthSession`,
`acceptTerms`, `sendEmailChangeVerificationEmail`, `changePassword`, `delete`, `downloadData`.
`getLoggedInAccount` is already labeled by plan 12; leave it as plan 12 left it.

The unrouted `getFollowedChannels`, `getFollowedAccounts`, and `getFollowedPlaylists` stay
unlabeled.

### Expected label counts

| File | New labels |
| --- | --- |
| `account/account.ts` | 5: `update` (account update), `getByIdText` (account read), `getManySubscribedAZ` / `…Recent` / `…Top` (subscriptions read). Six calls stay closed; `getLoggedInAccount` keeps plan 12's label. |
| `profileContent.ts` | 4, account read (the `getMyProfile*` handlers) |
| `account/accountFollowingChannel.ts` | 3: follow create, follow bulk create, unfollow delete |
| `account/accountFollowingAccount.ts` | 2: follow create, unfollow delete |
| `account/accountFollowingPlaylist.ts` | 2: follow create, unfollow delete |
| `account/accountUnfollowBulk.ts` | 1: delete |
| `account/accountChannelSeen.ts` | 5 handlers + the wrapper |
| `account/accountOpmlExport.ts` | 1: read |
| `account/accountOpmlImport.ts` | 2 handlers (import create, status read) + the wrapper |
| `channel.ts` | 3: subscribed lists read |
| `item.ts` | 2: subscribed lists read (these also serve `/live-item/subscribed/{recent|top}`) |
| `liveItem.ts` | 1: `getManySubscribedUpcoming` read |
| `account/accountFollowingAddByRSSChannel.ts` | 3: get read, add create, remove delete |
| `account/accountAddByRSSChaptersTranscript.ts` | 1: read |
| `account/accountAddByRSSParse.ts` | 3 handlers (parse create, parse all create, status read) + the wrapper |
| `mq/mq.ts` | 1 handler factory + the wrapper |
| `apps/api/src/routes/account.ts` | 1: the `/opml/export` wrapper |

If a file's auth calls do not match its row, stop and report rather than guessing.

## Tests

`apps/api/src/test/api-key-routes-account-subscriptions-add-by-rss.integration.test.ts` (new, API
integration). `startTestApp({ accountSessions: 'real' })`, the `vi.mock('@podverse/orm')`
`MockCategoryService` stub from `account-session-list.integration.test.ts`, the helpers in
`apps/api/src/test/helpers/apiKeyTestAccounts.ts`, email prefix `api-key-routes-asa-`.

**Label table.** One `it.each` over every route this plan labels, with `{a|b|c}` rows expanded,
including `/live-item/subscribed/{recent|top}` (42 cases: 6 account, 27 subscriptions, 9
add_by_rss). Each case uses a key made with `permissionsWithout(requirement)` (create each distinct
key once in `beforeAll`) and expects 403 `api_key_permission_denied` with `required_permission`
equal to the row's requirement. For wrapped routes this is answered by the wrapper, which is the
point: the wrapper and handler must agree. Send query or body input that passes any validator
that runs before the auth call (read each handler; `getChannelSeen`, the live-item lists, and the
parse routes validate first). Path ids are id-shaped placeholders.

**Keys change data (R20).**

- A key with `account` read and update: `PUT /account` with a valid body (`display_name`, `bio`,
  `sharable_status`, `locale`) returns 200, and `GET /auth/me` with the same key shows the new
  `display_name`.
- A second account B. A key on account A with `subscriptions` create, read, and delete:
  `POST /account/follow/account` with `{ following_account_id_text: B.id_text }` returns 201;
  `GET /account/subscribed/az` lists B; `POST /account/unfollow/account` succeeds; the list no
  longer has B. Read `AccountFollowingAccountService.followAccount` first; if it refuses a target
  whose profile is not public, make B public with `AccountService.update` before the follow.
- A key with only `subscriptions` read gets 200 from `GET /account/channel-seen` and from
  `GET /account/opml/export` (both pass through a wrapper and then the handler).
- A key with only `add_by_rss` read gets 200 from
  `GET /account/follow/add-by-rss-channel/{A.id_text}`.

**Stays closed (R30).** A key with `apiKeyPermissionsForPreset('full_access')` still gets 403
`api_key_not_allowed` from `POST /account/change-password` and `DELETE /account/delete` after
this plan's edits. (Plan 20's test covers the whole closed list; these two guard against an
accidental label in this file.)

## Release scratchpad

Running in a phase with other prompts: put this entry in the final message under "Release notes
entry" instead of writing the scratchpad (**release-notes-scratchpad**).

```markdown
## API keys reach the account profile, subscriptions, and Add by RSS

- Surfaces: api
- Change: these routes accept an API key holding the matching permission. Account: edit the
  profile (update), read a public profile and the account's own profile lists (read).
  Subscriptions: subscribed podcast, episode, livestream, clip, and account lists, seen state,
  and OPML export (read); follow podcasts, accounts, and playlists and import OPML (create); mark
  seen (update); unfollow, including bulk unfollow of database and Add by RSS feeds (delete). Add
  by RSS: followed feeds and their chapters and transcripts (read); follow a feed and every
  parse request, including parse-all and on-demand add and refresh (create); unfollow (delete).
  Password change, email change, account deletion, the data export, and terms acceptance still
  refuse every key with 403 `api_key_not_allowed`.
- Who notices: developers and agents calling the API with a key
- Operator steps: none
```
