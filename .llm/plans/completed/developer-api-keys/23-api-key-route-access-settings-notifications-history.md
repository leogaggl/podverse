**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 23 — Open settings, notification, and history routes to API keys

Apply plan 20's route-to-permission table to the settings, notification, push device, event
stream, and history controllers (R19, R20, R67). Listen and open reports (`POST /stats/listen`,
`POST /stats/open`) stay closed: this plan does not edit `stats/statsListen.ts`,
`stats/statsOpen.ts`, or `stats/statsTrackRateLimit.ts`. The listen-stats consent
(`PATCH /account-settings/listen-stats`) and its agreement text
(`GET /legal/popularity-tracking`) stay closed; this plan does not touch their files. Session
behavior does not change.

## Rows

R19, R20, R67

## Runs after

20

## Files

apps/api/src/controllers/account/accountSettings/accountSettingsLocale.ts
apps/api/src/controllers/account/accountSettings/accountSettingsPlayback.ts
apps/api/src/controllers/account/accountSettings/accountSettingsNotification.ts
apps/api/src/controllers/account/accountSettings/accountSettingsNotificationType.ts
apps/api/src/controllers/account/accountDeviceAutoDownload.ts
apps/api/src/controllers/account/accountNotification.ts
apps/api/src/controllers/account/accountNotificationChannel.ts
apps/api/src/controllers/account/accountNotificationChannelType.ts
apps/api/src/controllers/account/accountFCMDevice.ts
apps/api/src/controllers/account/accountWebPushDevice.ts
apps/api/src/controllers/account/accountUPDevice.ts
apps/api/src/controllers/account/accountEventStream.ts
apps/api/src/controllers/account/accountContentLog.ts
apps/api/src/controllers/account/accountTasteProfile.ts
apps/api/src/test/api-key-routes-settings-notifications-history.integration.test.ts
release-notes/scratchpad.md

## The edit

The source of truth is plan 20 (`20-api-key-route-access-shared.md`), § Route-to-permission
table: every row whose Plan column is **23** (under the `settings`, `notifications`, and `history`
headings).

For each handler row, add `apiKeyAccess` as an inline literal to the options object passed to
`ensureAuthenticated`, keeping every existing option and the order of validators and the auth
call:

```ts
{ skipMembershipStatus: true, apiKeyAccess: { resource: 'notifications', action: 'read' } }
```

Every settings write is `update`, including `AccountSettingsNotificationTypeController.create`
and `.delete` (plan 20, mapping rule 3).

### Two option objects that need care

- `account/accountTasteProfile.ts` shares one `tasteProfileAuthOptions` between two reads and two
  writes. Replace it with two module constants typed `AuthenticatedRequestOptions` (exported by
  `apps/api/src/lib/auth/index.ts` after plan 12; `import type` on its own line):
  `tasteProfileReadAuthOptions` (`skipMembershipStatus: true`, history read) for `list` and
  `listHidden`, and `tasteProfileUpdateAuthOptions` (`skipMembershipStatus: true`, history update)
  for `hide` and `unhide`.
- `account/accountNotification.ts` `updatePreferences` builds its options from
  `requiresNotificationsCapability`. Add `apiKeyAccess: { resource: 'notifications', action:
  'update' }` to that object literal; the requirement does not depend on the capability.

### Expected label counts

| File | New labels |
| --- | --- |
| `accountSettings/accountSettingsLocale.ts`, `…Playback.ts`, `…Notification.ts` | 1 each, settings update |
| `accountSettings/accountSettingsNotificationType.ts` | 2, settings update |
| `account/accountDeviceAutoDownload.ts` | 1, settings update |
| `account/accountNotification.ts` | 7: notifications list, unread count, preferences (read); mark read, mark one read, mark read by item, update preferences (update) |
| `account/accountNotificationChannel.ts` | 6: get one, get all (read); create; delete; bulk enable, bulk disable (update) |
| `account/accountNotificationChannelType.ts` | 3: create; delete; bulk set type (update) |
| `account/accountFCMDevice.ts`, `account/accountWebPushDevice.ts` | 5 each: create; update and update locale (update); delete; get all (read) |
| `account/accountUPDevice.ts` | 6: create; update and update locale (update); delete and delete all (delete); get for account (read) |
| `account/accountEventStream.ts` | 1, notifications read |
| `account/accountContentLog.ts` | 1, history read |
| `account/accountTasteProfile.ts` | 4 through the two constants |

Every `ensureAuthenticated(` call in these files ends up labeled. If a file's auth calls do not
match its row, stop and report rather than guessing.

## Tests

`apps/api/src/test/api-key-routes-settings-notifications-history.integration.test.ts` (new, API
integration). `startTestApp({ accountSessions: 'real' })`, the `vi.mock('@podverse/orm')`
`MockCategoryService` stub from `account-session-list.integration.test.ts`, the helpers in
`apps/api/src/test/helpers/apiKeyTestAccounts.ts`, email prefix `api-key-routes-snh-`.

**Label table.** One `it.each` over every route this plan labels (44 cases: 6 settings, 33
notifications, 5 history). Each case uses a key made with `permissionsWithout(requirement)`
(create each distinct key once in `beforeAll`) and expects 403 `api_key_permission_denied` with
`required_permission` equal to the row's requirement. Send input that passes any
validator running before the auth call (the settings handlers, `getNotifications`,
`markReadOne`, `markReadByItem`, and `updatePreferences` validate first; read each handler).
`GET /account/events` answers the 403 as JSON before any stream bytes.

**Keys change data (R20).**

- A key with only `settings` update: `PATCH /account-settings/locale` with a locale that
  `localeBodySchema` accepts and that differs from the account's current one returns 200 with
  that locale in `data`.
- A key with only `notifications` read: `GET /account/notifications` and
  `GET /account/notification-preferences` return 200.
- A key with `notifications` read and update: `PUT /account/notification-preferences` with one
  preference whose `push_enabled` is false (no notifications capability needed) returns 200, and
  the returned preferences show it.
- A key with only `history` read: `GET /account/content-log` and `GET /account/taste-profile`
  return 200.

**Stays closed.** A full-access key still gets 403 `api_key_not_allowed` from
`PATCH /account-settings/listen-stats` (body `{ accepted: true }`).

## Release scratchpad

Running in a phase with other prompts: put this entry in the final message under "Release notes
entry" instead of writing the scratchpad (**release-notes-scratchpad**).

```markdown
## API keys reach settings, notifications, and history

- Surfaces: api
- Change: these routes accept an API key holding the matching permission. Settings: locale,
  playback, notification settings and types, device auto-download (all need settings update;
  settings are read through `GET /auth/me`). Notifications: the inbox, unread count, event
  stream, preferences, notification channels, and FCM, web push, and UnifiedPush devices, with
  read, create, update, and delete mapped to the HTTP intent. History: content log and taste
  profile (read), hiding and unhiding taste-profile entries (update). Listen and open reports
  (`POST /stats/listen`, `POST /stats/open`), the listen-stats consent, and its agreement text
  refuse every key with 403 `api_key_not_allowed`.
- Who notices: developers and agents calling the API with a key
- Operator steps: none
```
