**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 20 — API key route access: route table, wrapper pass-through, never-allowed routes

Plan 12 makes keys default-deny: a route accepts a key only when its auth options carry
`apiKeyAccess: { resource, action }`, and the middleware returns 403 `api_key_not_allowed` when
the option is missing and 403 `api_key_permission_denied` when the key lacks the bit. Session
requests ignore `apiKeyAccess` completely, so labeling a route never changes what a cookie or a
mobile token can do.

This plan fixes the **route-to-permission table** that plans 21, 22, and 23 apply to the
controllers and that step 06 (OpenAPI accuracy) documents as `x-api-key-permission` on each
operation. It also lets the shared rate-limit wrapper carry a requirement, proves every
never-allowed route answers 403 to a full-access key (R30, R31), adds a shared test helper, and
adds a guidance rule so future routes are labeled or left closed on purpose.

It labels no controller itself; 21–23 do that.

`POST /stats/listen` and `POST /stats/open` are never-accept routes (R67). A source scan (R79)
checks that every `apiKeyAccess` label names a cell in `API_KEY_SUPPORTED_ACTIONS` and that every
cell in that list guards at least one route.

## Rows

R19, R20, R30, R31, R67, R79

## Runs after

13

## Files

apps/api/src/lib/rateLimiter.ts
apps/api/src/test/helpers/apiKeyTestAccounts.ts
apps/api/src/test/api-key-routes-denied.integration.test.ts
apps/api/src/test/api-key-access-supported-cells.test.ts
packages/helpers/src/lib/apiKey.ts
.cursor/rules/api-key-route-access.mdc
.cursor/rules/rule-index.mdc

## How a key meets a route

| Route kind | What a key gets |
| --- | --- |
| No session auth at all (public lists, `GET /item/{idOrIdText}`, login, set-password by email token, webhooks) | The key is never read. The route answers as for an anonymous caller. `getActiveSessionAccountId` (used by `ItemController.getByIdOrIdText`) treats a key as signed out. |
| `ensureAuthenticated` with `apiKeyAccess` | 200 path when the key holds the bit; 403 `api_key_permission_denied` with `required_permission` otherwise. |
| `optionalEnsureAuthenticated` with `apiKeyAccess` | Same as above. A key lacking the bit is not downgraded to anonymous (plan 12 decision 8). |
| Either, without `apiKeyAccess` | 403 `api_key_not_allowed`, whatever the key's permissions. |
| Route behind a wrapper that authenticates first (`rateLimitAuthEndpoint`, billing's `requireAccount`, `metaboostMintConsumeRateLimitMiddleware`) | The wrapper's options decide first; the wrapper and the handler carry the same requirement. |

Membership is checked for every key request (plan 12), so none of this applies to an expired
account: its keys get `membership_expired` on every labeled route.

## Mapping rules

Every row in the table below follows these rules. Plans 21–23 transcribe rows; they do not
re-derive them.

1. The **resource** is the account data the route reads or changes, from `API_KEY_RESOURCES`
   (plan 10). A route under one URL prefix can belong to another resource: followed-playlist
   lists under `/playlist/private/followed/*` are `subscriptions`; subscribed lists under
   `/channel`, `/item`, `/live-item`, `/clip`, and `/account` are `subscriptions`.
2. The **action** follows the HTTP intent on the thing the path names:
   - `GET` → `read`. A `POST` that only reads (a body carrying a list of ids) → `read`.
   - A `POST` that adds a row → `create`. Following is `create`; adding an item to a playlist or
     the queue (any zone, including the history zone) is `create`; enqueueing a feed parse is
     `create`.
   - `PATCH`, `PUT`, and a `POST` that changes existing state (mark read, mark seen, toggle,
     reorder, promote, replay, bulk enable or disable, hide or unhide) → `update`.
   - `DELETE`, and a `POST` that removes rows (unfollow) → `delete`.
3. **Settings writes are all `update`.** The settings row always exists, so adding or removing a
   notification type under `/account-settings` is a settings change, not a create or delete.
4. **One requirement per route.** Where one rate-limit wrapper instance guards several routes,
   those routes share the wrapper's requirement (this is why every parse-enqueue route, including
   the refresh-all and on-demand refresh routes, needs `add_by_rss` `create`).

## Route-to-permission table

Paths are relative to the API base (`<prefix><version>`, as in `apps/api/openapi.yml`) and use
OpenAPI `{param}` form; the Express routes in `apps/api/src/routes/` use `:param`. A path segment
written `{a|b|c}` stands for one route per listed literal, each with the same requirement and
handler file. "Wrapper" names a `rateLimitAuthEndpoint` instance that authenticates before the
handler and must carry the same requirement. Handler paths are under
`apps/api/src/controllers/`.

### account

| Method | Path | Action | Handler | Plan | Notes |
| --- | --- | --- | --- | --- | --- |
| GET | `/auth/me` | read | `account/account.ts` `getLoggedInAccount` | 12 | Already labeled by plan 12. Returns settings too. |
| PUT | `/account` | update | `account/account.ts` `update` | 22 | Display name, bio, sharable status, locale. |
| GET | `/account/{id_text}` | read | `account/account.ts` `getByIdText` | 22 | Optional auth. |
| GET | `/my-profile/podcasts/az` | read | `profileContent.ts` `getMyProfilePodcastsAZ` | 22 | |
| GET | `/my-profile/albums/az` | read | `profileContent.ts` `getMyProfileAlbumsAZ` | 22 | |
| GET | `/my-profile/playlists/az` | read | `profileContent.ts` `getMyProfilePlaylistsAZ` | 22 | |
| GET | `/my-profile/clips/recent` | read | `profileContent.ts` `getMyProfileClipsRecent` | 22 | |

### settings

| Method | Path | Action | Handler | Plan | Notes |
| --- | --- | --- | --- | --- | --- |
| PATCH | `/account-settings/locale` | update | `account/accountSettings/accountSettingsLocale.ts` `update` | 23 | |
| PATCH | `/account-settings/playback` | update | `account/accountSettings/accountSettingsPlayback.ts` `update` | 23 | |
| PATCH | `/account-settings/notification` | update | `account/accountSettings/accountSettingsNotification.ts` `update` | 23 | |
| POST | `/account-settings/notification-type` | update | `account/accountSettings/accountSettingsNotificationType.ts` `create` | 23 | Rule 3. Also needs the notifications capability. |
| DELETE | `/account-settings/notification-type` | update | `account/accountSettings/accountSettingsNotificationType.ts` `delete` | 23 | Rule 3. |
| PUT | `/account/auto-download/channels` | update | `account/accountDeviceAutoDownload.ts` `putChannels` | 23 | |

### subscriptions

| Method | Path | Action | Handler | Plan | Notes |
| --- | --- | --- | --- | --- | --- |
| GET | `/account/subscribed/{az|recent|top}` | read | `account/account.ts` `getManySubscribedAZ` / `getManySubscribedRecent` / `getManySubscribedTop` | 22 | |
| GET | `/channel/subscribed/{az|recent|top}` | read | `channel.ts` `getManySubscribedAZ` / `getManySubscribedRecent` / `getManySubscribedTop` | 22 | |
| GET | `/item/subscribed/{recent|top}` | read | `item.ts` `getManySubscribedRecent` / `getManySubscribedTop` | 22 | |
| GET | `/live-item/subscribed/{recent|top}` | read | delegates to `item.ts` `getManySubscribedRecent` / `getManySubscribedTop` | 22 | Covered by the `item.ts` label; `liveItem.ts` has no auth call for these. |
| GET | `/live-item/subscribed/upcoming` | read | `liveItem.ts` `getManySubscribedUpcoming` | 22 | |
| GET | `/clip/public/subscribed/{recent|top}` | read | `clip.ts` `getManySubscribedPublicRecent` / `getManySubscribedPublicTop` | 21 | |
| GET | `/playlist/private/followed/{top|recent|oldest|az}` | read | `playlist/playlist.ts` `getManyFollowedPrivateTop` / `…Recent` / `…Oldest` / `…AZ` | 21 | Rule 1. |
| POST | `/account/follow/channel` | create | `account/accountFollowingChannel.ts` `followChannel` | 22 | |
| POST | `/account/follow/channel/bulk` | create | `account/accountFollowingChannel.ts` `followChannelsBulk` | 22 | |
| POST | `/account/unfollow/channel` | delete | `account/accountFollowingChannel.ts` `unfollowChannel` | 22 | |
| POST | `/account/unfollow/bulk` | delete | `account/accountUnfollowBulk.ts` `unfollowBulk` | 22 | Also unfollows the Add by RSS URLs in the body (rule 4). |
| POST | `/account/follow/account` | create | `account/accountFollowingAccount.ts` `followAccount` | 22 | |
| POST | `/account/unfollow/account` | delete | `account/accountFollowingAccount.ts` `unfollowAccount` | 22 | |
| POST | `/account/follow/playlist` | create | `account/accountFollowingPlaylist.ts` `followPlaylist` | 22 | |
| POST | `/account/unfollow/playlist` | delete | `account/accountFollowingPlaylist.ts` `unfollowPlaylist` | 22 | |
| GET | `/account/channel-seen` | read | `account/accountChannelSeen.ts` `getChannelSeen` | 22 | Wrapper `channelSeenReadRateLimit`. |
| GET | `/account/channel-seen/add-by-rss` | read | `account/accountChannelSeen.ts` `getAddByRssSeen` | 22 | Wrapper `channelSeenReadRateLimit`. |
| POST | `/account/channel-seen/mark` | update | `account/accountChannelSeen.ts` `markSeen` | 22 | |
| POST | `/account/channel-seen/mark-all` | update | `account/accountChannelSeen.ts` `markAllSeen` | 22 | |
| POST | `/account/channel-seen/mark-add-by-rss` | update | `account/accountChannelSeen.ts` `markAddByRssSeen` | 22 | |
| GET | `/account/opml/export` | read | `account/accountOpmlExport.ts` `exportOpml` | 22 | Wrapper: the inline `rateLimitAuthEndpoint` in `apps/api/src/routes/account.ts`. |
| POST | `/account/opml/import` | create | `account/accountOpmlImport.ts` `enqueueImport` | 22 | Wrapper `opmlImportEnqueueRateLimit` (runs inside the handler). |
| GET | `/account/opml/import/status/{request_id}` | read | `account/accountOpmlImport.ts` `getImportStatus` | 22 | |

### add_by_rss

| Method | Path | Action | Handler | Plan | Notes |
| --- | --- | --- | --- | --- | --- |
| GET | `/account/follow/add-by-rss-channel/{account_id_text}` | read | `account/accountFollowingAddByRSSChannel.ts` `getFollowedAddByRSSChannels` | 22 | |
| POST | `/account/follow/add-by-rss-channel` | create | `account/accountFollowingAddByRSSChannel.ts` `addOrUpdateRSSChannel` | 22 | |
| POST | `/account/unfollow/add-by-rss-channel` | delete | `account/accountFollowingAddByRSSChannel.ts` `removeRSSChannel` | 22 | |
| POST | `/account/add-by-rss/chapters-transcript` | read | `account/accountAddByRSSChaptersTranscript.ts` `getChaptersAndTranscript` | 22 | Reads by body. |
| POST | `/account/add-by-rss/parse` | create | `account/accountAddByRSSParse.ts` `enqueueParse` | 22 | Wrapper `addByRssParseEnqueueRateLimit` (inside the handler). |
| POST | `/account/add-by-rss/parse/all` | create | `account/accountAddByRSSParse.ts` `enqueueParseAll` | 22 | Same wrapper (rule 4). |
| GET | `/account/add-by-rss/parse/status/{request_id}` | read | `account/accountAddByRSSParse.ts` `getParseStatus` | 22 | |
| POST | `/mq/rss/add/on-demand` | create | `mq/mq.ts` `rssAddToOnDemandMQ('add')` | 22 | Wrapper `MQController.rssOnDemandMiddleware` (inside the handler). |
| POST | `/mq/rss/refresh/on-demand` | create | `mq/mq.ts` `rssAddToOnDemandMQ('refresh')` | 22 | Same handler factory and wrapper (rule 4). |

### playlists

| Method | Path | Action | Handler | Plan | Notes |
| --- | --- | --- | --- | --- | --- |
| GET | `/playlist/private/likes` | read | `playlist/playlist.ts` `getAllLikesPrivate` | 21 | |
| POST | `/playlist/private/likes/membership` | read | `playlist/playlist.ts` `getLikesMembership` | 21 | Reads by body. |
| POST | `/playlist/private/likes/toggle` | update | `playlist/playlist.ts` `toggleLike` | 21 | Adds or removes, so `update`. |
| GET | `/playlist/private/{top|recent|oldest|az}` | read | `playlist/playlist.ts` `getManyPrivateTop` / `…Recent` / `…Oldest` / `…AZ` | 21 | |
| POST | `/playlist` | create | `playlist/playlist.ts` `createPlaylist` | 21 | |
| GET | `/playlist/{playlist_id_text}` | read | `playlist/playlist.ts` `getPlaylistById` | 21 | Optional auth. |
| PATCH | `/playlist/{playlist_id_text}` | update | `playlist/playlist.ts` `updatePlaylist` | 21 | |
| DELETE | `/playlist/{playlist_id_text}` | delete | `playlist/playlist.ts` `deletePlaylist` | 21 | |
| GET | `/playlist/{playlist_id_text}/resources/private-all` | read | `playlist/playlistResource.ts` `getAllByPlaylistIdTextPrivate` | 21 | |
| GET | `/playlist/{playlist_id_text}/resources/queue-by-list-position` | read | `playlist/playlistResource.ts` `getManyForQueueByListPosition` | 21 | Optional auth. |
| GET | `/playlist/{playlist_id_text}/resources/shuffle` | read | `playlist/playlistResource.ts` `getManyByPlaylistShuffle` | 21 | Optional auth. |
| GET | `/playlist/{playlist_id_text}/resources` | read | `playlist/playlistResource.ts` `getManyByPlaylistIdText` | 21 | Optional auth. |
| POST | `/playlist/{playlist_id_text}/clip/{clip_id_text}/{first|between|last}` | create | `playlist/playlistResourceClip.ts` `addClipToPlaylistFirst` / `…Between` / `…Last` | 21 | |
| DELETE | `/playlist/{playlist_id_text}/clip/{clip_id_text}` | delete | `playlist/playlistResourceClip.ts` `removeClipFromPlaylist` | 21 | |
| POST | `/playlist/{playlist_id_text}/item/{item_id_text}/{first|between|last}` | create | `playlist/playlistResourceItem.ts` `addItemToPlaylistFirst` / `…Between` / `…Last` | 21 | |
| DELETE | `/playlist/{playlist_id_text}/item/{item_id_text}` | delete | `playlist/playlistResourceItem.ts` `removeItemFromPlaylist` | 21 | |
| POST | `/playlist/{playlist_id_text}/item-add-by-rss/{first|between|last}` | create | `playlist/playlistResourceItemAddByRSS.ts` `addItemAddByRSSToPlaylistFirst` / `…Between` / `…Last` | 21 | |
| DELETE | `/playlist/{playlist_id_text}/item-add-by-rss/{add_by_rss_hash_id}` | delete | `playlist/playlistResourceItemAddByRSS.ts` `removeItemAddByRSSFromPlaylist` | 21 | |
| POST | `/playlist/{playlist_id_text}/item-soundbite/{soundbite_id_text}/{first|between|last}` | create | `playlist/playlistResourceItemSoundbite.ts` `addItemSoundbiteToPlaylistFirst` / `…Between` / `…Last` | 21 | |
| DELETE | `/playlist/{playlist_id_text}/item-soundbite/{soundbite_id_text}` | delete | `playlist/playlistResourceItemSoundbite.ts` `removeItemSoundbiteFromPlaylist` | 21 | |

### queue

The history zone of the queue (`history-paginated`, the `…/history` add routes) is `queue`, not
`history`: those rows are queue resources, and a now-playing call moves the previous item into
that zone in the same request.

| Method | Path | Action | Handler | Plan | Notes |
| --- | --- | --- | --- | --- | --- |
| GET | `/queue/all-for-account/private` | read | `queue/queue.ts` `getAllPrivate` | 21 | |
| POST | `/queue/{queue_id_text}/update-is-active` | update | `queue/queue.ts` `updateIsActiveQueue` | 21 | |
| GET | `/queue/resources/all-by-account-abridged` | read | `queue/queueResource.ts` `getAllByAccountAbridged` | 21 | |
| GET | `/queue/{queue_id_text}/resources/now-playing` | read | `queue/queueResource.ts` `getNowPlayingByQueueIdText` | 21 | |
| GET | `/queue/{queue_id_text}/resources/upcoming-all` | read | `queue/queueResource.ts` `getAllUpcomingByQueueIdText` | 21 | |
| GET | `/queue/{queue_id_text}/resources/history-paginated` | read | `queue/queueResource.ts` `getHistoryResourcesByQueueIdText` | 21 | |
| POST | `/queue/{queue_id_text}/resources/promote-upcoming` | update | `queue/queueResource.ts` `promoteFirstUpcomingToNowPlaying` | 21 | |
| POST | `/queue/{queue_id_text}/playback-events/replay` | update | `queue/queueResource.ts` `replayPlaybackEvents` | 21 | |
| POST | `/queue/{queue_id_text}/clip/{clip_id_text}/{now-playing|next|last|between|history}` | create | `queue/queueResourceClip.ts` `addClipToNowPlaying` / `addClipToQueueNext` / `addClipToQueueLast` / `addClipToQueueBetween` / `addClipToHistory` | 21 | |
| DELETE | `/queue/{queue_id_text}/clip/{clip_id_text}` | delete | `queue/queueResourceClip.ts` `removeClipFromQueue` | 21 | |
| POST | `/queue/{queue_id_text}/item/{item_id_text}/{now-playing|next|last|between|history}` | create | `queue/queueResourceItem.ts` `addItemToNowPlaying` / `addItemToQueueNext` / `addItemToQueueLast` / `addItemToQueueBetween` / `addItemToHistory` | 21 | |
| DELETE | `/queue/{queue_id_text}/item/{item_id_text}` | delete | `queue/queueResourceItem.ts` `removeItemFromQueue` | 21 | |
| POST | `/queue/{queue_id_text}/item-add-by-rss/{now-playing|next|last|between|history}` | create | `queue/queueResourceItemAddByRSS.ts` `addItemAddByRSSToNowPlaying` / `…ToQueueNext` / `…ToQueueLast` / `…ToQueueBetween` / `…ToHistory` | 21 | |
| DELETE | `/queue/{queue_id_text}/item-add-by-rss/{add_by_rss_hash_id}` | delete | `queue/queueResourceItemAddByRSS.ts` `removeItemAddByRSSFromQueue` | 21 | |
| POST | `/queue/{queue_id_text}/item-soundbite/{item_soundbite_id_text}/{now-playing|next|last|between|history}` | create | `queue/queueResourceItemSoundbite.ts` `addItemSoundbiteToNowPlaying` / `…ToQueueNext` / `…ToQueueLast` / `…ToQueueBetween` / `…ToHistory` | 21 | |
| DELETE | `/queue/{queue_id_text}/item-soundbite/{item_soundbite_id_text}` | delete | `queue/queueResourceItemSoundbite.ts` `removeItemSoundbiteFromQueue` | 21 | |

### history

Listen and open reports are not in this table. They are in § Never accept a key, so `history`
create guards no route.

| Method | Path | Action | Handler | Plan | Notes |
| --- | --- | --- | --- | --- | --- |
| GET | `/account/content-log` | read | `account/accountContentLog.ts` `list` | 23 | |
| GET | `/account/taste-profile` | read | `account/accountTasteProfile.ts` `list` | 23 | |
| GET | `/account/taste-profile/hidden` | read | `account/accountTasteProfile.ts` `listHidden` | 23 | |
| POST | `/account/taste-profile/hide` | update | `account/accountTasteProfile.ts` `hide` | 23 | |
| POST | `/account/taste-profile/unhide` | update | `account/accountTasteProfile.ts` `unhide` | 23 | |

### clips

| Method | Path | Action | Handler | Plan | Notes |
| --- | --- | --- | --- | --- | --- |
| GET | `/clip/private` | read | `clip.ts` `getClipsPrivate` | 21 | |
| POST | `/clip` | create | `clip.ts` `createClip` | 21 | |
| GET | `/clip/{clip_id_text}` | read | `clip.ts` `getClipByIdText` | 21 | Optional auth. |
| PATCH | `/clip/{clip_id_text}` | update | `clip.ts` `updateClip` | 21 | |
| DELETE | `/clip/{clip_id_text}` | delete | `clip.ts` `deleteClip` | 21 | |

### notifications

| Method | Path | Action | Handler | Plan | Notes |
| --- | --- | --- | --- | --- | --- |
| GET | `/account/notifications` | read | `account/accountNotification.ts` `getNotifications` | 23 | |
| GET | `/account/notifications/unread-count` | read | `account/accountNotification.ts` `getUnreadCount` | 23 | |
| POST | `/account/notifications/mark-read` | update | `account/accountNotification.ts` `markRead` | 23 | |
| POST | `/account/notifications/mark-read-by-item` | update | `account/accountNotification.ts` `markReadByItem` | 23 | |
| POST | `/account/notifications/{notification_id}/mark-read` | update | `account/accountNotification.ts` `markReadOne` | 23 | |
| GET | `/account/notification-preferences` | read | `account/accountNotification.ts` `getPreferences` | 23 | |
| PUT | `/account/notification-preferences` | update | `account/accountNotification.ts` `updatePreferences` | 23 | |
| GET | `/account/events` | read | `account/accountEventStream.ts` `stream` | 23 | Server-sent notification events. A stream stays open until its lifetime cap even if the key is revoked meanwhile, as for an ended session; each reconnect re-checks the key. |
| GET | `/account/notification/channel/{channel_id_text}` | read | `account/accountNotificationChannel.ts` `getByAccountAndChannel` | 23 | |
| GET | `/account/notification/channels` | read | `account/accountNotificationChannel.ts` `getAllByAccount` | 23 | |
| POST | `/account/notification/channel` | create | `account/accountNotificationChannel.ts` `create` | 23 | |
| DELETE | `/account/notification/channel/{channel_id_text}` | delete | `account/accountNotificationChannel.ts` `delete` | 23 | |
| POST | `/account/notification/channels/bulk-enable` | update | `account/accountNotificationChannel.ts` `bulkEnable` | 23 | |
| POST | `/account/notification/channels/bulk-disable` | update | `account/accountNotificationChannel.ts` `bulkDisable` | 23 | |
| POST | `/account/notification/channel/type` | create | `account/accountNotificationChannelType.ts` `create` | 23 | |
| POST | `/account/notification/channels/bulk-type` | update | `account/accountNotificationChannelType.ts` `bulkSetType` | 23 | |
| DELETE | `/account/notification/channel/{channel_id_text}/type/{type}` | delete | `account/accountNotificationChannelType.ts` `delete` | 23 | |
| POST | `/account/fcm-device/create` | create | `account/accountFCMDevice.ts` `create` | 23 | |
| PUT | `/account/fcm-device/update` | update | `account/accountFCMDevice.ts` `update` | 23 | |
| DELETE | `/account/fcm-device/delete` | delete | `account/accountFCMDevice.ts` `delete` | 23 | |
| GET | `/account/fcm-device/all-for-account` | read | `account/accountFCMDevice.ts` `getAllForAccount` | 23 | |
| PUT | `/account/fcm-device/update-locale` | update | `account/accountFCMDevice.ts` `updateLocaleForAccount` | 23 | |
| POST | `/account/webpush-device/create` | create | `account/accountWebPushDevice.ts` `create` | 23 | |
| PUT | `/account/webpush-device/update` | update | `account/accountWebPushDevice.ts` `update` | 23 | |
| DELETE | `/account/webpush-device/delete` | delete | `account/accountWebPushDevice.ts` `delete` | 23 | |
| GET | `/account/webpush-device/all-for-account` | read | `account/accountWebPushDevice.ts` `getAllForAccount` | 23 | |
| PUT | `/account/webpush-device/update-locale` | update | `account/accountWebPushDevice.ts` `updateLocaleForAccount` | 23 | |
| POST | `/account/up-device/create` | create | `account/accountUPDevice.ts` `create` | 23 | |
| PUT | `/account/up-device/update` | update | `account/accountUPDevice.ts` `update` | 23 | |
| DELETE | `/account/up-device/delete` | delete | `account/accountUPDevice.ts` `delete` | 23 | |
| GET | `/account/up-device/for-account` | read | `account/accountUPDevice.ts` `getForAccount` | 23 | |
| PUT | `/account/up-device/update-locale` | update | `account/accountUPDevice.ts` `updateLocaleForAccount` | 23 | |
| DELETE | `/account/up-device/delete-all` | delete | `account/accountUPDevice.ts` `deleteAllForAccount` | 23 | |

### Expanded operation counts

Expand each `{a|b|c}` segment into one operation per literal. Plan 51 copies these counts.

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

The total is 161. `GET /auth/me` is one of them. Plan 51 marks the other 160. Six of the 161 stay
callable with no credentials and still check a key when one is sent: `GET /account/{id_text}`,
`GET /playlist/{playlist_id_text}`, `GET /playlist/{playlist_id_text}/resources`,
`GET /playlist/{playlist_id_text}/resources/queue-by-list-position`,
`GET /playlist/{playlist_id_text}/resources/shuffle`, and `GET /clip/{clip_id_text}`.

History is 5 because `POST /stats/listen` and `POST /stats/open` are in § Never accept a key.
Clips is the five operations in § clips.

The cells this table uses are exactly `API_KEY_SUPPORTED_ACTIONS` in plan 10: account read and
update; settings update; all four actions of subscriptions, playlists, queue, clips, and
notifications; add_by_rss create, read, and delete; history read and update. The eight cells with
no route are account create and delete; settings create, read, and delete; add_by_rss update;
history create and delete.

### Never accept a key

These routes keep no `apiKeyAccess`, so a key of any permission gets 403 `api_key_not_allowed`.
No plan in this set adds the option to any of them.

| Method | Path | Handler or wrapper | Why |
| --- | --- | --- | --- |
| GET | `/auth/check-session` | `account/account.ts` `checkIfValidAuthSession` | Checks a session; `/auth/me` is the key's identity check. |
| GET | `/auth/sessions` | `account/accountSession.ts` `list` | Session management. |
| POST | `/auth/sessions/revoke-others` | `account/accountSession.ts` `revokeOthers` | Session management. |
| DELETE | `/auth/sessions/{session_id_text}` | `account/accountSession.ts` `revoke` | Session management. |
| GET | `/auth/api-keys` | `account/accountApiKey.ts` (plan 13) | Key management (R29). |
| POST | `/auth/api-keys` | `account/accountApiKey.ts` (plan 13) | Key management (R29). |
| DELETE | `/auth/api-keys/{api_key_id_text}` | `account/accountApiKey.ts` (plan 13) | Key management (R29). |
| POST | `/account/change-password` | wrapper `accountChangePasswordRateLimit`, then `account/account.ts` `changePassword` | Password (R30). |
| POST | `/account/send-change-email-address-email` | `account/account.ts` `sendEmailChangeVerificationEmail` | Email (R30). Behind `requireEmailFlows`. |
| DELETE | `/account/delete` | `account/account.ts` `delete` | Account deletion (R30). |
| GET | `/account/download-data` | inline `rateLimitAuthEndpoint` in `routes/account.ts`, then `account/account.ts` `downloadData` | The export spans every resource, so no single permission covers it. |
| POST | `/account/accept-terms` | `account/account.ts` `acceptTerms` | A legal agreement the person makes. |
| PATCH | `/account-settings/listen-stats` | `account/accountSettings/accountSettingsListenStats.ts` `update` | Records consent to the popularity-tracking agreement version. |
| GET | `/legal/popularity-tracking` | `legal/popularityTracking.ts` `get` | The agreement text for that consent. |
| POST | `/stats/listen` | `statsTrackRateLimit`, then `stats/statsListen.ts` `create` | A key must not add a listen to popularity counts. |
| POST | `/stats/open` | `statsTrackRateLimit`, then `stats/statsOpen.ts` `create` | A key must not add an open to popularity counts. |
| GET | `/billing/status` | billing `requireAccountSkipTerms` | Billing (R31). |
| POST | `/billing/paypal/orders` | billing `purchaseRateLimit` | Billing (R31). |
| POST | `/billing/paypal/orders/{id}/capture` | billing `purchaseRateLimit` | Billing (R31). |
| POST | `/billing/apple/transactions` | billing `purchaseRateLimit` | Billing (R31). |
| POST | `/billing/google/purchases` | billing `purchaseRateLimit` | Billing (R31). |
| POST | `/billing/restore` | billing `purchaseRateLimit` | Billing (R31). |
| POST | `/billing/strike/checkouts` | billing `purchaseRateLimit` | Billing (R31). |
| GET | `/billing/strike/checkouts/{id}` | billing `strikeCheckoutPollRateLimit` | Billing (R31). |
| POST | `/billing/test/simulate` | billing `requireAccount` | Billing (R31). |
| POST | `/membership-claim-token/claim/{token}` | `membershipClaimToken.ts` `claim` | Membership grant (R31). |
| GET | `/metaboost/mbrss-v1/mint-app-assertion/rate-limit-status` | `metaboost/mbrssV1AppAssertion.ts` `mintRateLimitStatus` | Part of minting a credential for another service. |
| POST | `/metaboost/mbrss-v1/mint-app-assertion` | `metaboostMintConsumeRateLimitMiddleware`, then `mintAppAssertionBody` | Mints a credential for another service. |

`GET /billing/checkout-options`, the billing webhooks, `/auth/login`, `/auth/logout`, the mobile
token routes, `/account/set-password`, `/account/reset-password`, `/account/verify-email`, and
`/account/verify-email-change` do not authenticate a session, so they never read a key.

### Handlers with auth but no route

`AccountFollowingAccountController.getFollowedAccounts`,
`AccountFollowingChannelController.getFollowedChannels`, and
`AccountFollowingPlaylistController.getFollowedPlaylists` call `optionalEnsureAuthenticated` but
no router mounts them. They stay unlabeled.

## `apps/api/src/lib/rateLimiter.ts`

`rateLimitAuthEndpoint`'s options gain:

```ts
/** The permission a key needs; omitted, a key is refused here before the handler runs. */
apiKeyAccess?: ApiKeyPermissionRequirement;
```

(`import type { ApiKeyPermissionRequirement } from '@podverse/helpers';` on its own line.) Pass
it into the `ensureAuthenticated` options object beside `skipTermsAcceptance`:
`apiKeyAccess: options.apiKeyAccess`. The base tsconfig does not set
`exactOptionalPropertyTypes`, so passing `undefined` is fine.

The limiter's key generator reads `req.user.id`, which is the account id for a key request too,
so a key and the account's sessions share one budget. No change there.

Do not touch `apps/api/src/routes/billing.ts` or
`apps/api/src/middleware/metaboostMintConsumeRateLimit.ts`; they stay closed by omission.

## `packages/helpers/src/lib/apiKey.ts`

Plan 10 puts a doc comment above `API_KEY_RESOURCES` listing what each resource covers. Make that
comment match the table above, one line per resource:

- `account`: `GET /auth/me`, profile edits, the account's public profile, and its own profile
  lists. Never password, email, deletion, terms, or the data export.
- `settings`: locale, playback, notification settings, and device auto-download (writes only;
  settings are read through `GET /auth/me`). Never the listen-stats consent.
- `subscriptions`: followed podcasts, accounts, and playlists; subscribed lists; seen state; OPML
  import and export.
- `add_by_rss`: followed Add by RSS channels, their chapters and transcripts, and parse requests
  (including on-demand add and refresh).
- `playlists`: the account's playlists, their items, and likes.
- `queue`: the queue, now playing, and the queue's history zone.
- `history`: the content log and the taste profile. Never listen or open reports (`/stats/listen`, `/stats/open`).
- `clips`: the account's clips.
- `notifications`: the inbox, its event stream, preferences, notification channels, and push
  devices.

Comment text only; no exported name or value changes.

## `apps/api/src/test/helpers/apiKeyTestAccounts.ts` (new)

Shared by this plan's test and plans 21–23. Named exports only:

```ts
/** A verified account with the current terms accepted. Fresh accounts are valid trials. */
export async function createApiKeyTestAccount(emailPrefix: string): Promise<{ id: number; email: string; password: string }>;
/** Inserts a key through `createAccountApiKey` (no expiry) and returns the raw token. */
export async function createTestApiKey(accountId: number, permissions: ApiKeyPermissions): Promise<string>;
/** Full access with exactly one bit cleared. */
export function permissionsWithout(requirement: ApiKeyPermissionRequirement): ApiKeyPermissions;
/** No access except the listed bits. */
export function permissionsWithOnly(requirements: ApiKeyPermissionRequirement[]): ApiKeyPermissions;
export function apiKeyHeaders(token: string): { Authorization: string };
```

- `createApiKeyTestAccount` follows `createVerifiedAccount` in
  `apps/api/src/test/account-session-list.integration.test.ts`: dynamic
  `import('@podverse/orm')` inside the function (so per-file `vi.mock('@podverse/orm')` stays in
  effect), `AccountService.create` with `terms_version: config.terms.version` (from
  `@api/config/index.js`), `getByEmail`, then `verifyEmail`. The email is
  `${emailPrefix}${Date.now()}-${counter}@example.com` with a module-level counter. The password
  is the constant `'IntegrationTest1!'`, returned so tests can log in.
- `createTestApiKey` imports `createAccountApiKey` the same dynamic way, with name `'test key'`
  and `expiresAt: null`.
- `permissionsWithout` starts from `apiKeyPermissionsForPreset('full_access')` and clears one bit
  with `crudMaskWith(mask, action, false)`. `permissionsWithOnly` starts from
  `emptyApiKeyPermissions()` and sets bits with `crudMaskWith(…, true)`. Build new objects; do not
  mutate the preset's result in place if it is shared.
- No `as`.

## `apps/api/src/test/api-key-routes-denied.integration.test.ts` (new)

`startTestApp({ accountSessions: 'real' })`, `vi.mock('@podverse/orm')` with the
`MockCategoryService` stub exactly as `account-session-list.integration.test.ts` does, email
prefix `api-key-routes-denied-`. One account, one key with `apiKeyPermissionsForPreset('full_access')`.

- Table-driven over every row of "Never accept a key" above (28 routes). Each case sends the key
  as `Authorization: Bearer …` and expects 403 with body
  `{ message: 'API keys cannot be used for this endpoint.', code: 'api_key_not_allowed' }`.
  Path parameters use placeholder strings shaped like real ids (`pvtestid01`-style for
  `id_text` params, a 10-character string for tokens, `abc123` for billing ids). When a handler
  runs a validator before `ensureAuthenticated` (read each handler; `acceptTerms` and
  `accountSettingsListenStats.update` validate first), send a body that passes it.
  `POST /stats/listen` and `POST /stats/open` are two of the 28. `statsTrackRateLimit` calls
  `ensureAuthenticated` before the handler, and both handlers validate the body only after that,
  so these two cases need no body that passes the schema. Do not add `apiKeyAccess` to
  `statsTrackRateLimit` or to either handler.
- `POST /account/send-change-email-address-email` runs `requireEmailFlows` first. Compute
  `getAccountSignupModeCapabilities(config.premium.signupMode).canUseEmailVerificationFlows` in
  the test: when true, expect `api_key_not_allowed`; when false, expect 403 with
  `{ message: 'Email verification flows are not available in the current mode' }`. Either way the
  handler never runs.
- After the table: the same key gets 200 from `GET /auth/me` (the account still exists, so the
  delete was refused), and `POST /auth/login` with the account's email and password gets 200 (the
  password is unchanged).
- One case shows the session path is untouched: the same account logged in on web
  (`POST /auth/login`, cookie) gets 200 from `GET /auth/sessions`.

Rate-limited routes are each hit once per run, which stays under every limit.

## `apps/api/src/test/api-key-access-supported-cells.test.ts` (new)

Vitest, no `startTestApp` and no database. This file is red until plans 21, 22, and 23 have added
their labels. Do not seed stand-in labels, and do not skip the missing-cell assertion. The set is
verified once, after those plans.

Read every `.ts` file under `apps/api/src/controllers`, `apps/api/src/routes`, `apps/api/src/lib`,
and `apps/api/src/middleware`. Skip `*.test.ts`. Do not read `apps/api/src/test`: plan 12's probe
routes live only in a test file and are not routes a key can call.

A label is an `apiKeyAccess:` property (colon, so `apiKeyAccess?:` on the options type does not
count) whose value is an object literal. Parse `resource` and `action` as single-quoted string
literals, in either order, with a brace match so the object may span lines. A value that is only
an identifier or a property read (the pass-through `apiKeyAccess: options.apiKeyAccess` in
`rateLimiter.ts`) is not a label. Any other `apiKeyAccess:` value fails the test.

Import `API_KEY_RESOURCES`, `CRUD_ACTIONS`, `API_KEY_SUPPORTED_ACTIONS`, and
`apiKeyResourceSupportsAction` from `@podverse/helpers`. Narrow each string with a loop over
`API_KEY_RESOURCES` and `CRUD_ACTIONS` (`value is ApiKeyResource` / `value is CrudAction`). No
`as`.

- Every label's pair makes `apiKeyResourceSupportsAction` return true.
- Every action listed on every resource in `API_KEY_SUPPORTED_ACTIONS` appears in at least one
  label. Compare sets: the distinct labeled cells equal the supported cells. Several routes may
  share one cell.

## `.cursor/rules/api-key-route-access.mdc` (new)

Front matter: `description` ("Every authenticated API route declares the API key permission it
needs or stays closed to keys on purpose"), `globs` `apps/api/src/controllers/**`,
`apps/api/src/routes/**`, `apps/api/src/lib/rateLimiter.ts`, `apps/api/src/middleware/**`,
`alwaysApply: false`. Body, in plain future-forward prose (no plan numbers):

- Keys are default-deny. A route accepts a key only when its `ensureAuthenticated` /
  `optionalEnsureAuthenticated` options carry `apiKeyAccess: { resource, action }`; a
  `rateLimitAuthEndpoint` wrapper that authenticates first carries the same requirement.
- Choosing the resource and action: the mapping rules from this plan's § Mapping rules, restated.
- Never add `apiKeyAccess` to: API key management, sessions, password, email change, account
  deletion, the data export, terms acceptance, the listen-stats consent and its agreement text,
  listen and open reports (`POST /stats/listen`, `POST /stats/open`), billing, membership claim
  tokens, or minting MetaBoost app assertions.
- The action has to be one `apiKeyResourceSupportsAction` allows. A route for an action the list
  omits adds that action to `API_KEY_SUPPORTED_ACTIONS` in the same change.
- With a new or changed authenticated route, in the same change: set or deliberately omit
  `apiKeyAccess`; add or update the operation's `x-api-key-permission` and `apiKeyAuth` security
  entry in `apps/api/openapi.yml` (or keep both off for a closed route); add the route to the
  matching `apps/api/src/test/api-key-routes-*.integration.test.ts` table.
- Related: **openapi-sync**, **api-testing**.

Keep it under about 40 lines.

## `.cursor/rules/rule-index.mdc`

Add one bullet in the existing style:
`- Adding or changing an authenticated API route, or a rate-limit wrapper that authenticates →
 \`api-key-route-access\``.

## Tests

- `apps/api/src/test/api-key-routes-denied.integration.test.ts` (API integration): every
  never-allowed route, including `POST /stats/listen` and `POST /stats/open`, refuses a
  full-access key with 403 `api_key_not_allowed`; the account and password survive; session
  access to a closed route still works.
- `apps/api/src/test/api-key-access-supported-cells.test.ts` (Vitest, no database): every
  `apiKeyAccess` label names a cell in `API_KEY_SUPPORTED_ACTIONS`, and every cell in that list
  guards at least one route.
- `apps/api/src/test/helpers/apiKeyTestAccounts.ts`: shared helper, no tests of its own.

## Release scratchpad

none
