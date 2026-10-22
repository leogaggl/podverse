# Realtime and banner notifications — summary

Request and operator answers: [00-REQUEST.md](00-REQUEST.md). Prompts and models: `COPY-PASTA.md`
(written by the planning run's Close step).

## Planning notes

- The request says other work is landing and things may move before implementation. Plans anchor
  by symbol, route, and key prefix rather than line numbers, and each implementation plan starts by
  re-checking that its listed paths still exist.
- Account events are published from the ORM write methods (`AccountNotificationService.createMany`
  and `AccountService.updateNotificationsLastReadAt`) through a publisher each writing process
  registers at startup (D2, plan 11), not from `createAccountNotificationWithOptionalPush`.
- Rows quoted from the operator answers are asks too; a "Settled" note means the answers already
  decide the row and the plan transcribes that decision.

## Requirement ledger

- **R1** (area C) "What happens today if a user receives a notification but the app is already open?" (web; answer from the code) — Plan: 31
- **R2** (area D) "What happens today if a user receives a notification but the app is already open?" (mobile; answer from the code) — Plan: 40
- **R3** (area C) "something pops up that you can see that indicates to you what notification happened. It could probably just be a toast." (web) — Settled: "web push stays the popup, with no in-page toast." — Plan: 31
- **R4** (area C) "it would correspond with an indicator icon that appears over the notifications bell" (web; "The stream updates the bell badge") — Plan: 31
- **R5** (area C) "which maybe I'm not sure if we have added yet, but there should be a notifications bell prominently on the page somewhere" (answer from the code) — Plan: 31
- **R6** (area D) "an indicator icon that appears over the notifications bell … Mobile has that in the features section on the more screen already." (mobile tab badge and More row, live) — Plan: 43
- **R7** (area E) "Mobile should also have a concept like this because you can't receive a push notification while the app is open." — Plan: 53
- **R8** (area E) "a banner that is similar to an experience as a toast should descend down from the top" — Plan: 51
- **R9** (area E) "and briefly summarize the notification" — Plan: 51 (the summary text comes from 50)
- **R10** (area E) "if the user taps it, it should take them to whatever page that notification corresponds with" — Plan: 53
- **R11** (area E) "If a user taps the toast or the banner that comes down in the mobile app, then you can count that as if they saw or interacted with the notification, so they should no longer receive the indicator if that was the only notification in the notifications page." — Settled: "Tapping a mobile banner … marks only that notification read." — Plan: 53
- **R12** (area E) "If there is not already a component that can support this in the mobile app, you can write a toast component." (answer from the code) — Plan: 51
- **R13** (area E) "on mobile, have it trigger haptic feedback if possible, gently to indicate to the user that a notification has appeared" — Plan: 53
- **R14** (area E) "Some useful notifications include a new episode is available or a live stream is currently going live. You should use your best judgment as to what notifications will be useful for this." — Settled by the banner settings answer — Plan: 50
- **R15** (area E) "these can also be configurable in the settings similar to how a push notification can be enabled or disabled" — Plan: 52
- **R16** (area E) "we want to default these types of banner notifications to on" — Settled: "On by default: New Episodes (`new-item`) and Livestream Started. Off by default: Livestream Scheduled and admin categories (product update, maintenance, terms, general)." — Plan: 50
- **R17** (area E) "for user-facing terminology, we can call it a banner notification" — Plan: 52
- **R18** (area A) "we can reliably have a real-time channel. Do you think that is possible for both mobile and web?" — Plan: 12
- **R19** (area D) "as long as the app is in the foreground, can't we have a reliable connection?" — Plan: 40
- **R20** (area A) "I'm not sure if it should be SSE or WebSocket, but it should be whatever the best option is for that." — Settled: SSE — Plan: 10, 12
- **R21** (area A) "A minute delay is too long for this type of notification" — Plan: 11, 12, 13
- **R22** (area A) "we want the notifications themselves, not just these toasts, to pop up an indicator in as close to real-time as possible" (every new notification reaches the stream, whatever the banner settings) — Plan: 11, 12, 15
- **R23** (area A) "SSE, with `Last-Event-ID` replay on reconnect." — Plan: 12
- **R24** (area D) "The mobile stream opens while the app is in the foreground and closes in the background. Push still covers background delivery." — Plan: 40
- **R25** (area A) "the stream carries new-notification events and read-state events." — Plan: 10, 12
- **R26** (area C) "Reading on one device clears the indicator on every other open device and tab in real time." (web) — Plan: 30, 31
- **R27** (area D) "Reading on one device clears the indicator on every other open device and tab in real time." (mobile) — Plan: 40
- **R28** (area B) "per-notification read state, keeping `notifications_last_read_at` as the Mark All as Read cutoff." — Plan: 20, 21
- **R29** (area B) "A notification is unread when it is newer than the cutoff and has not been read individually." — Plan: 20
- **R30** (area C) "Tapping … an OS push (web …) marks only that notification read." (web) — Plan: 33
- **R31** (area D) "Tapping … an OS push (… mobile) marks only that notification read." (mobile) — Plan: 41
- **R32** (area E) "Mobile banner settings: stored on the device only, with one switch per kind." — Plan: 50
- **R33** (area C) "The stream updates … the inbox list … live." (web) — Plan: 32
- **R34** (area C) "When the focused tab is on the Notifications page, the new row appears live and that tab skips the push popup." — Plan: 32, 33
- **R35** (area E) "Mobile on the inbox screen: no banner" — Plan: 53
- **R36** (area D) "the new row appears at the top live." (mobile inbox) — Plan: 42
- **R37** (area C) "on reconnect or return to foreground, refetch the unread count once." (web) — Plan: 30, 31
- **R38** (area D) "on reconnect or return to foreground, refetch the unread count once." (mobile) — Plan: 40
- **R39** (area C) "The 60-second poll runs only while the stream is down." (web) — Plan: 30, 31
- **R40** (area D) "The 60-second poll runs only while the stream is down." (mobile) — Plan: 40
- **R41** (area A, planning step 07) "we can't just use our existing redis?" — fanout to every API pod goes through the existing Redis (Valkey) instance and secret, wired into every process that writes notification state (D1 answer) — Plan: 11, 13, 14, 15, 16
- **R42** (area A, planning step 07) "now would be a good time to plan that feature as well so that everything is designed correctly" — the stream is the account's one event stream, generic over event types, so cross-device playback can join it later (that feature is planned in the `cross-device-playback` set) — Plan: 10, 11, 12, 16
- **R43** (area E, planning step 08) D29 answer: a banner can also be dismissed by swiping it up, alongside its Dismiss control and the timer — Plan: 51, 53
- **R44** (area D, planning step 09) Second review: "Mobile keeps the stream open in the background while audio is playing", as one named run-condition input a later set can widen — Plan: 40
- **R45** (area E, planning step 09) Second review: "No banners from events that arrive in the background", and a stream kept open through the background is kept on return to the foreground — Plan: 40, 53
- **R46** (area A, planning step 09) Second review: "The `playback.*` namespace covers both state and commands", neither replayed — Plan: 10, 11, 12, 16

## Areas

### A. API realtime stream (plans 10–19)

- **Rows:** R18, R20, R21, R22, R23, R25
- **Scope:** the SSE endpoint with cookie and bearer auth, heartbeat, `Last-Event-ID` replay from
  the database, membership gating, the event contract (new-notification and read-state event
  types in `@podverse/helpers`), the publisher and its fanout to every API pod (Redis pub/sub
  versus Postgres `LISTEN`/`NOTIFY`, after checking the connection pooler and whether workers have
  Redis config), publishing from the create path and from the existing Mark All as Read, ingress
  buffering and timeout settings, OpenAPI, and integration tests.
- **Starts from:** `packages/orm/src/services/account/createAccountNotificationWithOptionalPush.ts`
  and its callers (parser `sharedNotificationHelpers`, `adminNotificationCampaignDispatch`),
  `apps/api/src/controllers/account/accountNotification.ts`, `apps/api/src/routes/account.ts`,
  `apps/api/src/lib/keyvaldb/keyvaldb.ts`, `apps/api/src/lib/accountNotificationApiSerialization.ts`,
  and the API ingress under `infra/k8s/`.
- **Depends on:** none.
- **Shared files:** with B — `accountNotification.ts` controller, `routes/account.ts`, the API
  OpenAPI spec, `apps/api/src/test/account-notifications.test.ts`,
  `packages/orm/src/services/account/accountNotification.ts`. With C and D — the event types it
  adds to `@podverse/helpers`.

### B. Read model (plans 20–29)

- **Rows:** R28, R29
- **Scope:** migration for per-notification read state alongside the existing
  `notifications_last_read_at` cutoff, the unread-count query, a mark-one-read endpoint and its
  `@podverse/helpers-requests` call, a read flag in the notification DTO and list response,
  publishing a read-state event through area A's publisher for mark-one, OpenAPI, and integration
  tests. Client callers of mark-one belong to C, D, and E.
- **Starts from:** `infra/k8s/base/ops/source/database/linear-migrations/app/0006_notifications_read_state.sql`,
  `packages/orm/src/entities/account/accountNotification.ts`,
  `packages/orm/src/services/account/accountNotification.ts`, `getUnreadCount` and `markRead` in
  `apps/api/src/controllers/account/accountNotification.ts`,
  `packages/helpers-requests/src/api/account/notification/notifications.ts`.
- **Depends on:** A (publishes read events through A's publisher and event contract; edits the same
  controller, routes, and test file).
- **Shared files:** with A — listed above. With C, D, E — the DTO read flag and the mark-one
  request helper they call. The `0004_` baseline regeneration follows the linear-migration rule.

### C. Web client (plans 30–39)

- **Rows:** R1, R3, R4, R5, R26, R30, R33, R34, R37, R39
- **Scope:** an SSE hook in the Notifications context, the live bell badge, live inbox rows,
  cross-tab and cross-device read sync, the focused tab on the Notifications page skipping the push
  popup, web push taps marking only that notification read, polling only as a fallback, refetch on
  reconnect, and Playwright coverage. Web keeps the push popup and adds no toast.
- **Starts from:** `apps/web/src/contexts/Notifications.tsx` (`handleForegroundPush`),
  `apps/web/public/webpush-sw.js`, `apps/web/src/hooks/useNotificationsUnreadCount.ts`,
  `apps/web/src/components/NavBar/NotificationBellButton.tsx`, the web Notifications page.
- **Depends on:** A (stream endpoint and event contract), B (read flag, mark-one endpoint).
- **Shared files:** none with D or E. Consumes A's event types and B's request helper without
  editing them.

### D. Mobile stream client (plans 40–49)

- **Rows:** R2, R6, R19, R24, R27, R31, R36, R38, R40
- **Scope:** a pure-JS SSE client sending the bearer token, open in foreground and close in
  background, reconnect after token refresh, reset in `clearSession`, the live tab badge and More
  row, live inbox rows at the top, cross-device read sync, OS push taps marking only that
  notification read, dedupe with foreground pushes by notification id, refetch on reconnect and
  foreground, polling only while the stream is down. It exposes the in-app event subscription that
  area E's banner listens to.
- **Starts from:** `apps/mobile/src/hooks/useNotificationsUnreadCount.ts`, `TabScaffold` in
  `apps/mobile/src/navigation/index.tsx`, `apps/mobile/src/push/notificationRouting.ts`,
  `apps/mobile/src/screens/notifications/NotificationsInboxScreen.tsx`,
  `apps/mobile/src/data/repositories/notificationsRepository.ts`, `apps/mobile/src/auth/` session
  code.
- **Depends on:** A (stream endpoint and event contract), B (read flag, mark-one endpoint).
- **Shared files:** with E — `apps/mobile/src/navigation/index.tsx`,
  `NotificationsInboxScreen.tsx`, `apps/mobile/src/push/notificationRouting.ts` and
  `notificationTarget.ts`, the app root provider tree.

### E. Mobile banner notification (plans 50–59)

- **Rows:** R7, R8, R9, R10, R11, R12, R13, R14, R15, R16, R17, R32, R35
- **Scope:** a non-blocking banner that slides down from the top with gentle haptics
  (expo-haptics), briefly summarizes the notification, opens the target path on tap and marks that
  notification read, queues several banners, is suppressed on the inbox screen, device-local
  per-kind switches in Notification settings with the answer's defaults, i18n in all locales, and
  a Maestro flow.
- **Starts from:** existing mobile banners (`apps/mobile/src/components/screen/OfflineModeBanner.tsx`,
  `apps/mobile/src/components/feedback/MembershipExpiredBanner.tsx`),
  `apps/mobile/src/push/notificationTarget.ts`,
  `apps/mobile/src/screens/more/MoreSettingsNotificationsScreen.tsx`,
  `apps/mobile/src/lib/notifications/notificationTypeRows.ts`,
  `packages/helpers/src/lib/notificationCategory.ts`.
- **Depends on:** A (event contract), B (mark-one endpoint), D (the in-app event subscription and
  read-state plumbing the banner hooks into; edits the same navigation and inbox files).
- **Shared files:** with D — listed above.

## Order

First planning pass, four waves:

- **Wave 1:** A.
- **Wave 2:** B, after A.
- **Wave 3:** C and D at once, after A and B.
- **Wave 4:** E, after A, B, and D.

Second pass, after the first review: step 07 revises area A so fanout uses the existing Redis (D1, R41). It rewrites plan 11, adjusts plans 12 and 21 where they name the Postgres signal, and adds the Redis wiring plans in block 13–19. It also makes the stream a generic account event stream (R42), renaming its endpoint and path constant in plans 10 and 12 and in every plan that names them. Step 08 then adds swipe-up dismissal to the banner (D29, R43) in plans 51 and 53; it runs after step 07 because both edit plan 53. Every other review answer was accepted as planned.

Third pass, after the second review: step 09 makes the mobile stream stay open in the background while audio plays (R44) and keeps banners from showing for events received in the background (R45), in plans 40 and 53. It also rewords the reserved `playback.*` namespace in plans 10, 12, and 16 to cover cross-device state and commands, neither replayed (R46). Close then reassembles the set from scratch.

Implementation runs in nine phases: [00-EXECUTION-ORDER.md](00-EXECUTION-ORDER.md). Close fixed
three plans by hand. Plan 20 uses migration `0022` (`0021` is taken) and moves the marker in
`infra/k8s/base/ops/kustomization.yaml` too. Plan 53 registers `banner-notification` in
`flow_needs_e2e_api` in `scripts/mobile/e2e-test.sh`. Plan 11's two mentions of `playback.*` use
the cross-device playback wording (R46). The `artist-album-attribution` set also plans an app
migration `0022`, so prompt 20 takes the next free number when it runs.

## Decisions to review

Collected from the area steps' `## Decisions` lists after the first planning pass. Number each
answer by its item (D1, D2, …).

### Step 02 — area A, API realtime stream

- **D1** (plan 11) **Answered: the existing Redis (Valkey), not Postgres; planning step 07 revises area A.** Original choice: fanout goes through Postgres `LISTEN`/`NOTIFY`, not Redis pub/sub. The management API has no Redis config, and workers load Redis only for some command types, not for parser or scheduled-job runs. All three processes that create notifications already hold a Postgres connection with no pooler in front. Redis would need new env, secrets, and startup checks on the management API and those worker types.
- **D2** (plan 11) **Answered: keep the ORM write methods, through a publisher each process registers at startup; a missing publisher is loud. Planning step 07 carries it.** Original choice: the event is published in the ORM write methods rather than in `createAccountNotificationWithOptionalPush`, because the parser skips that function. Alternative: route the parser through it.
- **D3** (plan 12) **Accepted.** The stream needs login and accepted terms but not a valid membership, matching the unread-count endpoint. Alternative: require membership, which leaves expired accounts without live read sync.
- **D4** (plan 12) **Accepted.** A stream ends at the auth token's expiry or after 30 minutes, whichever comes first. Each account gets at most 10 streams per API pod, and an eleventh gets a 429. Alternative: no lifetime cap, closing the oldest stream when over the limit. That keeps revoked access open longer, and closing the oldest makes tabs reconnect in a loop.
- **D5** (plans 10, 12) **Accepted.** The server sends `notification.state` (unread count and read cutoff) first on every connection, and clients use it as their one unread-count refetch on reconnect. Alternative: clients call the unread-count endpoint themselves.
- **D6** (plan 12) **Accepted.** Replay stops at 50 missed notifications, then sends `notification.resync` so clients refetch the inbox. Alternative: unbounded replay.
- **D7** (plan 12) **Accepted.** No ingress manifest change. Traefik streams these responses as they are, and the requirements go in `APPS-API.md` and the scratchpad. Alternative: add Traefik annotations that nothing needs today.

### Step 03 — area B, read model

- **D8** (plan 20) **Accepted.** Read state is a `read_at` column on the notification row. Each row already belongs to one account, and the purge job removes the state with the row. Alternative: a separate read-state table.
- **D9** (plan 20) **Accepted.** The DTO keeps its shape: `is_unread` keeps its name, and no `read_at` field goes to clients. Alternative: expose `read_at` in the DTO.
- **D10** (plan 21) **Accepted.** Push taps are matched on the server: the new endpoint finds the row by the push data's `itemIdText` plus `type`. `type` is required because one item can produce both a scheduled and a started livestream notification. Alternatives: clients fetch the inbox to find the id, which web and mobile would each build separately and which races with the list loading; or the parser sends per-account pushes carrying notification ids, which undoes its batching by device group.
- **D11** (plan 21) **Accepted.** Mark-one returns `{ marked_ids, unread_count }` on success, so the caller can set its badge without waiting for the stream. An already-read row returns 200 with empty `marked_ids` and sends no event. Another account's id returns 404. The endpoint needs login but not a valid membership, the same as Mark All as Read. Alternative: a bare 204, with the badge left to the stream.

### Step 04 — area C, web client

- **D12** (plan 30) **Accepted.** One stream per browser profile, shared across tabs. Alternative: one stream per tab, which is simpler but can hit the 10-stream limit and block a tab's ordinary API requests over HTTP/1.1.
- **D13** (plan 32) **Accepted.** The web inbox shows which rows were unread when it opened. The page loads the list before running Mark All as Read, and a row stays in the section it arrived in for the rest of the visit; read events do not move rows. Alternative: the current order, where the Unread section is always empty.
- **D14** (plan 32) **Accepted.** A new row on a visible web inbox is marked read on its own; in a hidden tab it waits until the tab becomes visible. Alternative: leave it unread until the next visit, which leaves the bell showing a count while the user looks at the row.
- **D15** (plan 32) **Accepted.** New rows go only onto page 1. Alternative: insert them on whatever page is open.
- **D16** (plan 33) **Accepted.** The service worker marks a clicked push read itself. It learns the API address from a parameter on its own script URL (`/webpush-sw.js?api_base=…`). Existing registrations update on the next visit with notifications allowed and keep their push subscription. Alternative: message the page after navigation, but that message can be lost when the click opens a new window.
- **D17** (plan 30) **Accepted.** After an HTTP error the web stream keeps retrying with backoff while polling covers the badge. `EventSource` does not expose the status code, so a 401, 403, or 429 all lead to the same retry. Alternative: give up until the page reloads.

### Step 05 — area D, mobile stream client

- **D18** (plan 40) **Accepted.** The mobile stream runs over `expo/fetch`, which is already installed, needs no native rebuild, and has no read timeout. Alternative: add an SSE or EventSource package.
- **D19** (plan 40) **Accepted.** Each foreground session opens fresh: the first connection after a cold start, sign-in, or return to the foreground sends no `Last-Event-ID`, and replay is used only for reconnects within one session. Notifications from the background period already arrived as OS pushes, so replaying them would show them again as banners. Alternative: always send `Last-Event-ID` and filter replayed rows by time.
- **D20** (plan 40) **Accepted.** The stream is the only in-app source of new-notification events. Pushes that arrive in the foreground stay unshown, so nothing needs deduplicating between pushes and stream events. Alternative: show foreground pushes while the stream is down.
- **D21** (plan 40) **Accepted.** The mobile stream closes on `background` only, not on `inactive`. A token refresh never restarts the stream.
- **D22** (plan 40) **Accepted.** Mobile failures: 401 is final. 403, 404, and 429 stop reconnecting for the rest of the foreground session while the poll runs. Anything else retries with backoff of 1, 2, 5, 10, and 30 seconds.
- **D23** (plan 40) **Accepted.** Maestro checks only that the stream opens and reopens, through a marker, because nothing in E2E can create a notification. Alternative: an E2E-only API route or seeded unread rows.
- **D24** (plan 42) **Accepted.** Live rows on the mobile inbox are marked read at once, matching "opening the inbox marks everything read." Alternative: leave them unread until the next visit.
- **D25** (plan 43) **Accepted.** When Notifications is not a visible tab, the More tab badge shows the count as well as the More row. Alternative: the More row only.

### Step 06 — area E, mobile banner notification

- **D26** (plans 50, 51) **Accepted.** The banner card shows the title and one line of body. Alternative: a category label plus the title.
- **D27** (plan 51) **Accepted.** One card is visible and three wait; a further arrival discards the oldest waiting card. A card stays up for 5 seconds. Alternatives: show only the newest, or stack every card.
- **D28** (plan 53) **Accepted.** Dismiss and the timer leave the unread badge. Only a tap on the card marks that notification read and opens its page.
- **D29** (plan 51) **Changed: a swipe up also dismisses, alongside the Dismiss control and the timer. Planning step 08 carries it (R43).** Original choice: a card leaves by its Dismiss control or the timer. Alternative: a swipe.
- **D30** (plans 51, 53) **Accepted.** Reduce Motion skips the slide and the haptic.
- **D31** (plan 50) **Accepted.** Every new-content notification follows the New Item switch. A livestream whose payload type is neither started nor scheduled shows no banner.
- **D32** (plan 53) **Accepted.** A read event for the card's notification removes the card, and Mark All as Read clears the queue, without opening a page.

### Step 09 — third pass, background stream while audio plays

Choices step 09 made while carrying out the second review. No review step followed it, so Close
kept them as planned; the operator can change them before the implementation run.

- **D33** (plan 53) **Accepted.** Banners need the app to be `active`, not just out of the background: an event that arrives while the app is `inactive` (Control Center open, an incoming-call sheet) shows no banner. Alternative: block banners only in `background`.
- **D34** (plan 53) **Accepted.** Waiting banner cards are cleared when the app goes to the background and stay unread, like a dismiss. Alternative: keep them queued for the return, where on Android their auto-hide timer cannot run in the background.
- **D35** (plan 40) **Accepted.** A connection kept through the background skips the one unread-count refetch on return (R38), because it already delivered every count change and a late HTTP count could show an older number. Alternative: refetch once anyway.
- **D36** (plan 40) **Accepted.** Accepted edge case: a kept connection that went silent for under 60 seconds can turn out to be dead; its reconnect sends `Last-Event-ID` and may replay a notification the OS already showed by push. Alternative: make that reconnect a fresh open with no `Last-Event-ID`, which shows no duplicate banner but skips replay of a notification created during the gap.
