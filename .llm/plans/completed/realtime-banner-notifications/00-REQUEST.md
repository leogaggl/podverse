# Realtime and banner notifications

## Request

What happens today if a user receives a notification but the app is already open? In that case, then they won't receive a push notification because the client is already in focus. But there are certain notifications that would be nice that while you have the app open, something pops up that you can see that indicates to you what notification happened. It could probably just be a toast. And it would correspond with an indicator icon that appears over the notifications bell, which maybe I'm not sure if we have added yet, but there should be a notifications bell prominently on the page somewhere. Mobile has that in the features section on the more screen already. Mobile should also have a concept like this because you can't receive a push notification while the app is open. So, a banner that is similar to an experience as a toast should descend down from the top and briefly summarize the notification. And if the user taps it, it should take them to whatever page that notification corresponds with. If a user taps the toast or the banner that comes down in the mobile app, then you can count that as if they saw or interacted with the notification, so they should no longer receive the indicator if that was the only notification in the notifications page. We don't want to make them go to that notifications page again to dismiss it since they already interacted with the notification. So, therefore, we can assume they've already interacted with it. If there is not already a component that can support this in the mobile app, you can write a toast component. It will be a bit different than on web because web has a toast, more traditional style, that appears and disappears, whereas mobile, it will appear from the top and descend. We can also, on mobile, have it trigger haptic feedback if possible, gently to indicate to the user that a notification has appeared. Some useful notifications include a new episode is available or a live stream is currently going live. You should use your best judgment as to what notifications will be useful for this. I think these can also be configurable in the settings similar to how a push notification can be enabled or disabled. And in general, we want to default these types of banner notifications to on. And I think for user-facing terminology, we can call it a banner notification. You do not need to create a full plan set right now as we are currently working on a lot of code changes. So, you do not have to assume everything will be in the same place when it is time to finally implement this, but do a one-time high-level passover to start organizing the plan files that will be needed. And the result of this plan will be a plan that generates more plans. So they can be high level for now. They just need to be prompts that can be run to generate a more detailed plan set. And ask questions as much as you need to for clarity.

I think that since the app must be open for this case, we can reliably have a real-time channel. Do you think that is possible for both mobile and web? I know that real-time is not possible on mobile because apps can be suspended while they're in the background, but as long as the app is in the foreground, can't we have a reliable connection? I'm not sure if it should be SSE or WebSocket, but it should be whatever the best option is for that. A minute delay is too long for this type of notification, and we want the notifications themselves, not just these toasts, to pop up an indicator in as close to real-time as possible. So, with that information, I want you to provide your own recommendations and ask your questions again.

## Operator answers

- **Transport:** SSE, with `Last-Event-ID` replay on reconnect. The mobile stream opens while the app is in the foreground and closes in the background. Push still covers background delivery.
- **Events:** the stream carries new-notification events and read-state events. Reading on one device clears the indicator on every other open device and tab in real time.
- **Read model:** per-notification read state, keeping `notifications_last_read_at` as the Mark All as Read cutoff. A notification is unread when it is newer than the cutoff and has not been read individually. Tapping a mobile banner or an OS push (web or mobile) marks only that notification read.
- **Mobile banner settings:** stored on the device only, with one switch per kind. On by default: New Episodes (`new-item`) and Livestream Started. Off by default: Livestream Scheduled and admin categories (product update, maintenance, terms, general).
- **Web:** web push stays the popup, with no in-page toast. The stream updates the bell badge, the inbox list, and read state live. When the focused tab is on the Notifications page, the new row appears live and that tab skips the push popup.
- **Mobile on the inbox screen:** no banner; the new row appears at the top live.
- **Fallback:** on reconnect or return to foreground, refetch the unread count once. The 60-second poll runs only while the stream is down.
- **Terminology:** the mobile surface is called "banner notification" in the UI.

## Glossary

- **Banner notification:** the mobile in-app banner that slides down from the top.
- **Indicator:** the unread count badge on the bell (web NavBar) and on the mobile Notifications tab and More row.
- **Toast:** the web-style transient message. This set does not use it on web.

## Orientation

Checked while writing this file; re-verify, since other work is landing in the tree.

- `apps/web/public/webpush-sw.js` sends a push to a focused tab with `postMessage`. With no focused tab, it calls `showNotification`.
- `apps/web/src/contexts/Notifications.tsx`: `handleForegroundPush` shows `new Notification(...)`.
- `apps/web/src/hooks/useNotificationsUnreadCount.ts` and `apps/mobile/src/hooks/useNotificationsUnreadCount.ts` poll every 60 seconds, and both also listen for a read event.
- `apps/web/src/components/NavBar/NotificationBellButton.tsx` renders the bell with a `CountBadge`.
- Mobile tab badge: `TabScaffold` in `apps/mobile/src/navigation/index.tsx`.
- `apps/mobile/src/push/notificationRouting.ts` has only a response listener and no `setNotificationHandler`, so a push that arrives in the foreground is not shown. `apps/mobile/src/push/notificationTarget.ts` turns a payload into a navigation path.
- Mobile screens: `apps/mobile/src/screens/notifications/NotificationsInboxScreen.tsx` and `apps/mobile/src/screens/more/MoreSettingsNotificationsScreen.tsx`. `apps/mobile/src/lib/notifications/notificationTypeRows.ts` lists the per-channel types.
- `packages/helpers/src/lib/notificationCategory.ts` defines the categories and the `in_app_enabled` / `push_enabled` defaults.
- API: `getUnreadCount` and `markRead` in `apps/api/src/controllers/account/accountNotification.ts`, routed at `/account/notifications/unread-count` and `/account/notifications/mark-read`.
- Every notification is created through `packages/orm/src/services/account/createAccountNotificationWithOptionalPush.ts`. Its callers are parser `sharedNotificationHelpers` and `adminNotificationCampaignDispatch`. This is where the realtime event should be published.
- The API already has a Redis client, `apps/api/src/lib/keyvaldb/keyvaldb.ts` (ioredis). The planning run picks Redis pub/sub or Postgres `LISTEN`/`NOTIFY` for fanout to API pods, after checking the connection pooler and whether workers have Redis config.

## Likely areas

Non-binding; the Split step decides the areas, waves, and plan files.

- **A. API SSE stream:** endpoint with cookie and bearer auth, heartbeat, `Last-Event-ID` replay from the database, membership gating, fanout from the create path, ingress buffering and timeout settings, OpenAPI, and integration tests.
- **B. Read model:** migration for per-notification read state, the unread-count query, a mark-one-read endpoint, a read flag in the DTO, publishing a read event, and push taps marking read on web and mobile.
- **C. Web client:** an SSE hook in the Notifications context, a live bell badge, live inbox rows, cross-tab read sync, skipping the popup on the inbox page, polling only as a fallback, and Playwright coverage.
- **D. Mobile stream client:** a pure-JS SSE client sending the bearer token, foreground and background lifecycle, reconnect after token refresh, reset in `clearSession`, live tab badge and inbox, read sync, and dedupe with foreground pushes by notification id.
- **E. Mobile banner:** a non-blocking component that slides down from the top with gentle haptics (expo-haptics), opens the target path on tap and marks that notification read, queues multiple banners, is suppressed on the inbox screen, gets device-local per-kind switches in Notification settings with i18n in all locales, and is covered by a Maestro flow.

### Review of the first planning pass

The operator is answering the `## Decisions to review` items in `00-SUMMARY.md` one at a time. Answers recorded so far:

- **D1 — fanout transport: the existing Redis (Valkey), not Postgres `LISTEN`/`NOTIFY`.** The operator chose Redis for scale ("you are making me think redis may be better for our ambitions"), and asked to reuse the deployed instance rather than add new infrastructure ("we can't just use our existing redis?"). Use the existing `podverse-keyvaldb` instance and the existing `podverse-keyvaldb-opaque` secret; wire more processes to them, with no new Redis instance and no new secret values. Planning step 07 revises area A for this.

Orientation for D1, checked:

- The API already connects: `apps/api/src/lib/keyvaldb/keyvaldb.ts` (ioredis, `enableOfflineQueue: false`, `maxRetriesPerRequest: 1`, 60-second reconnect), `KEYVALDB_HOST` / `KEYVALDB_PORT` in `infra/k8s/base/api/source/api.env`, and `podverse-keyvaldb-opaque` mounted in `infra/k8s/base/api/deployment.yaml`.
- Workers have a client in `apps/workers/src/lib/keyvaldb/keyvaldb.ts`, and `KEYVALDB_HOST` / `KEYVALDB_PORT` are in the shared `infra/k8s/base/workers/source/workers.env`. Config validation is per command through `CATEGORY_KEYVALDB` in `apps/workers/src/lib/startup/categoriesForCommand.ts`, which today covers only `mqAddByRSSRunParser` and `mqOpmlImportRun`. The secret is mounted only in `parser-opml-import`, `parser-add-by-rss-ondemand`, and `parser-add-by-rss-ondemand-background` deployments, not in `parser-normal`, `parser-live`, `parser-ondemand`, `listener-live`, or the `infra/k8s/base/cron/worker-scheduled-jobs.cronjob.yaml` runner.
- `apps/management-api` has no Redis client, config, env, or secret mount (`infra/k8s/base/management-api/deployment.yaml`).
- No package under `packages/` has a Redis client today.

- **D2 — publish point: keep publishing from the ORM write methods** (`AccountNotificationService.createMany` and `AccountService.updateNotificationsLastReadAt`), not by routing the parser through `createAccountNotificationWithOptionalPush`. Both create paths already end in `createMany`; the wrapper adds a membership and preference lookup per account that the parser does not need, since it sends pushes per device group. Because `@podverse/orm` cannot import an app's Redis client, each process that writes notifications (API, management API, workers) registers a publisher at startup and the write methods call it. A missing publisher must be loud, not silent: a startup warning in every such process and a test that fails when a write runs with none registered. Planning step 07 carries this.
- **D3 — stream access: accepted as planned.** Login and accepted terms, no valid membership, matching the unread-count endpoint.
- **D4 — stream lifetime and limit: accepted as planned.** A stream ends at the auth token's expiry or after 30 minutes, whichever is first; 10 streams per account per API pod; an eleventh gets a 429. Web session JWTs last a year, so the 30-minute cap is what bounds how long a stream outlives a logout. The separate `auth-sessions` set adds server-side sessions and remote logout later, and will close open streams on revocation; the cap stays either way, since it also picks up membership and terms changes.
- **Generic account event stream (operator direction, not a D item).** The operator plans live playback progress across devices later ("they may be able to see the progress indicator moving because playback is proceeding on one device but not the other … now would be a good time to plan that feature as well so that everything is designed correctly"). Decision: do not plan that feature here (placeholder: `.llm/plans/active/live-playback-progress-deferred/00-SUMMARY.md`), but design this stream as the account's one event stream so playback can join it without a rename:
  - The endpoint and its path constant name an account event stream (for example `/account/events`), not a notifications stream.
  - Event types stay namespaced: `notification.*` here, `playback.*` reserved. Clients keep ignoring unknown types (plan 10's parser already does).
  - Replay is per event type: only events that carry an SSE `id:` replay (notifications); latest-value events never do.
  - The Redis fanout carries any account event type, keyed by account, not only notification signals.
  - One stream per client carries every type, so D4's limit and D12's shared web stream hold unchanged.
  Planning step 07 carries this.
- **D12 — web streams: accepted as planned.** One stream per browser profile, shared across tabs.
- **D29 — banner dismissal: changed.** A banner leaves by a swipe up, its Dismiss control, or the timer. The Dismiss control stays for screen readers. A swipe is a dismiss: it leaves the notification unread (D28). With Reduce Motion on, the swipe still dismisses but the card leaves without the slide animation (D30). Planning step 08 carries this.
- **Accepted as planned, after review:** D5, D6, D7, D8, D9, D10, D11, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, D30, D31, D32. Notes the operator saw with them:
  - D7: plan 12's 25-second heartbeat is under common proxy and Cloudflare idle limits.
  - D10: admin campaigns send no push today, so only parser item pushes need matching.
  - D23: the banner card and tap are covered by plan 53's E2E button flow; only the server-to-banner path stays untested on device.

Every review answer above is settled. No D item remains open.

### Review of the second planning pass

This review comes from planning the `cross-device-playback` set (`.llm/plans/active/cross-device-playback/00-REQUEST.md`), which replaces the `live-playback-progress-deferred` placeholder named above. That set lets a user see and control playback on another signed-in device: pause, play, seek, speed, and moving audio between devices. It sends and receives those controls through this set's account event stream. The operator asked to revise this set before its implementation runs, rather than have the later set undo it: "I think we will need to revise it, but I think maybe we should wait until the real-time banner notifications plans as-is are completed". The first pass is now complete, so the revision goes here.

- **Mobile keeps the stream open in the background while audio is playing (changes D21, R24's lifecycle).** A phone playing a podcast with the screen locked is the normal case, and another device must be able to pause it. iOS keeps the app running while it plays (`UIBackgroundModes` in `apps/mobile/app.config.ts` includes `audio`). The run condition becomes: the app is active, **or** local audio is playing. The stream still closes in the background once audio is not playing. Keep "audio is playing in the background" as one named input to the run condition, so the cross-device set can widen it later (for example a short grace period after a remote pause) without rewriting the controller.
- **No banners from events that arrive in the background.** While the app is in the background, OS push is still how a notification is shown. A `notification.created` event received in the background updates the store, badge, and inbox as usual, but never presents a banner and is not queued to present one on return. Foreground OS pushes stay unpresented (D20 unchanged).
- **Return to the foreground (adjusts D19).** When the stream stayed open through the background, returning to the foreground keeps that connection; there is no fresh reopen and no replay. When it closed, the existing fresh-open rule applies unchanged.
- **The `playback.*` namespace covers both state and commands.** The contract text in plans 10, 12, and 16 should stop describing the reserved namespace as "live playback progress" only. It is reserved for cross-device playback: state that is latest-value (never carries an SSE `id:`, never replayed) and one-shot control commands that also never carry an `id:` and are never replayed, because a stale "pause" delivered after a reconnect would stop playback for no reason. Nothing in this set sends `playback.*`; only the wording and the "unknown types are ignored" guarantee matter here.

Nothing else changes. D1–D32, R41, R42, and R43 stay settled.
