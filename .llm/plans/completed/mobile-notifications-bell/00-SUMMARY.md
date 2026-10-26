# Summary — mobile notifications bell

Request: [00-REQUEST.md](00-REQUEST.md). Prompts and models: [COPY-PASTA.md](COPY-PASTA.md). Order and file ownership: [00-EXECUTION-ORDER.md](00-EXECUTION-ORDER.md).

## Requirement ledger

- **R1** (area A) "move the notifications out of the More tab" — Plan: 10
- **R2** (area A) "it should be a bell that appears on the home screen in the title bar to the left of the More ellipsis icon" — Plan: 11
- **R3** (area A) "Pressing that bell should take you to the notifications page" — Plan: 11
- **R4** (area A) "the notifications page should slide up from the bottom" — Plan: 10
- **R5** (area A) "you can remove that notifications cell from the More screen" — Plan: 10
- **R6** (area B) "to differentiate that notification bell on the channels where you can subscribe for notifications, we should put a smaller notifications bell in the bottom right of the channel headers to the right of subscribe, unsubscribe" — Plan: 20
- **R7** (area B) "it'll be an icon similar to the gear icon, but it's occupying the bottom right of that header" — Plan: 20
- **R8** (area A) "remove it as a tab option entirely. Users can no longer pin Notifications to the tab bar or find it in More overflow. The Home bell is the only way in." — Plan: 10
- **R9** (area A) "the Home bell shows the unread count badge" — Plan: 11
- **R10** (area A) "The More tab no longer carries that badge." — Plan: 10
- **R11** (area A) "the Home bell stays visible and opens the login or membership gate on press" — Plan: 11
- **R12** (area B) "there should not be a bell on item detail pages, only channel detail pages (in the channel header) and on the home screen (in the title header)" / "Remove the bell from episode, track, and livestream detail title bars." — Plan: 20
- **R13** (area D) "checking all notifications is a root home screen only function" — Plan: 40 (guidance; built by 10 and 11)
- **R14** (area D) "subscribing and unsubscribing is a channel level only function (not item level)" — Plan: 40 (guidance; built by 20)
- **R15** (area C) "yes mobile only unless you identify alignment issues worth fixing in web" / "Report any web misalignment found, for example a bell on web item pages." — Plan: none — no web change (step 04 audit); plan 40 records the web wording in guidance

R13 and R14 are durable product rules. Area A implements R13 through R2, R8, and R11, and area B
implements R14 through R6 and R12; area D records both in guidance.

## Areas

### Area A — Notifications entry: Home bell, slide-up inbox, tab removal

- **Rows:** R1, R2, R3, R4, R5, R8, R9, R10, R11
- **Starts from:** `apps/mobile/src/navigation/index.tsx` (`NotificationsStackNavigator`,
  `MoreOverflowNotifications`, the overflow tab press switch, the More tab badge, the
  `Notifications` tab registration, `notificationsTabLinkScreens`, root stack slide-up routes);
  `apps/mobile/src/navigation/slideUpScreen.ts` (`ROOT_SLIDE_UP_SCREEN_OPTIONS`);
  `apps/mobile/src/prefs/tabLayout.ts` and `tabLayout.test.ts`; `apps/mobile/src/navigation/tabBarIcon.tsx`;
  `apps/mobile/src/navigation/deepLinking.ts`, `notificationStack.ts`,
  `apps/mobile/src/push/notificationRouting.ts` (deep links and push need a new target);
  `apps/mobile/src/screens/home/HomeScreen.tsx` (`headerRight` ~900) and `HomeOverflowMenu.tsx`;
  `apps/mobile/src/hooks/useNotificationsUnreadCount.ts`;
  `apps/mobile/src/screens/notifications/NotificationsInboxScreen.tsx`; the gate path in
  `apps/mobile/src/hooks/useChannelNotifications.ts` (`evaluateFeature('notifications')`) as the
  pattern for R11; Maestro flows `notifications-inbox.yaml`, `push.yaml`,
  `banner-notification.yaml`, and any flow that taps `tab-notifications`.
- **Depends on:** no other area.
- **Shares with other areas:** possibly the mobile i18n catalog
  (`packages/i18n-catalog/mobile/originals/*.json`) if it adds an accessibility name for the Home
  bell. Prefer an existing key.
- **Plan number block:** 10–19

### Area B — Channel header bell and item detail

- **Rows:** R6, R7, R12
- **Starts from:** `apps/mobile/src/components/channel/ChannelHeader.tsx` (`settings` gear,
  `CHANNEL_HEADER_SETTINGS_ICON_SIZE`, `actions` bottom row); the `headerRight` bell in
  `apps/mobile/src/screens/podcast/PodcastDetailScreen.tsx` (~438–498),
  `apps/mobile/src/screens/album/AlbumDetailScreen.tsx` (~708–757), and
  `apps/mobile/src/screens/artist/ArtistDetailScreen.tsx` (~698–747), each with a
  `*-detail-notifications-toggle` testID; `apps/mobile/src/hooks/useChannelNotifications.ts` and
  `apps/mobile/src/lib/channelActionChrome.ts` (first-paint bell state must keep working);
  `apps/mobile/src/screens/episode/EpisodeDetailScreen.tsx`,
  `apps/mobile/src/screens/track/TrackDetailScreen.tsx`, and the livestream detail path for R12
  (a first grep found no bell there; confirm and say so in the plan); Maestro flows
  `podcast-episode.yaml` and `subscriptions-anonymous.yaml`.
- **Depends on:** no other area.
- **Shares with other areas:** none expected. Reuse the existing
  `features.notifications.enable_notifications_for_this_*` keys.
- **Plan number block:** 20–29

### Area C — Web alignment audit

- **Rows:** R15
- **Starts from:** `apps/web/src/components/NavBar/NotificationBellButton.tsx`,
  `apps/web/src/components/Media/Header/NotificationIconButton.tsx`, `HeaderButtons.tsx`, and its
  callers (`Core/Podcast`, `Core/Artist`, `Core/Artist/Album`, `Media/Profile`, `AddByRSS/*`
  headers). Check whether any web item page (episode, track, livestream) renders a channel
  notifications bell, and whether the web channel bell placement disagrees with R6 in a way worth
  fixing. A plan is written only for a misalignment worth fixing; otherwise the area reports
  "no web change" with what it checked.
- **Depends on:** no other area.
- **Shares with other areas:** none.
- **Plan number block:** 30–39

### Area D — Guidance for the new bell placement

- **Rows:** R13, R14
- **Starts from:** `.cursor/rules/mobile-screen-layout.mdc` (Top chrome: share and the bell in the
  stack title bar on podcast, album, artist, episode, and track detail; "Do not place share or the
  bell in `ChannelHeader`"), `.cursor/rules/mobile-navigate-known-state.mdc`,
  `.cursor/rules/about-summary-web-mobile-alignment.mdc`, `.cursor/rules/mobile-tab-layout.mdc`,
  and other `.cursor/` files that mention the Notifications tab or the title-bar bell
  (`.cursor/skills/mobile-image-loading/SKILL.md`, `.cursor/rules/mobile-image-loading.mdc`,
  `.cursor/rules/mobile-section-chrome-cache.mdc`, `.cursor/rules/screen-reader-accessibility.mdc`).
- **Depends on:** areas A, B, and C, so the guidance names the components, routes, testIDs, and
  web decision those plans settle.
- **Shares with other areas:** none. Areas A, B, and C do not edit `.cursor/` files; area D owns
  every guidance edit in this set.
- **Plan number block:** 40–49

## Waves

- **Wave 1:** areas A, B, C (steps 02, 03, 04). They edit disjoint files.
- **Wave 2:** area D (step 05). It describes what areas A, B, and C plan.

## Decisions to review

Steps 04 (area C, web audit) and 05 (area D, guidance) reported none.

- **D1** (step 02, plan 10) Stored tab bars that pinned Notifications: the id is dropped when the bar is read and the other tabs keep their order; a stored bar that held only Notifications falls back to the default bar. Alternative: fill the empty slot with the next default tab.
- **D2** (step 02, plan 10) A `/notifications` link opened while signed out still opens the inbox, which shows its existing login prompt. Alternative: show the login or membership gate, as the Home bell does.
- **D3** (step 02, plan 11) Signed in but account details still loading: the Home bell opens the inbox rather than the gate, because in that window the access check reads the user as signed out. Alternative: gate on that early answer.
- **D4** (step 02, plan 11) Home bell look: outline bell (`notifications-outline`) at the standard header icon size; the unread badge sits top-right and grows with the number instead of stopping at "99+". Alternative: a filled bell like web's, with a capped count.
- **D5** (step 03, plan 20) Channel header bell position: pinned to the trailing edge of the channel-header action row, in line with the gear, with Subscribe packed at the leading edge. Alternative: place it in `actions` immediately beside Subscribe (where web's channel toggle sits).
- **D6** (step 03, plan 20) Channel header bell size: reuses `CHANNEL_HEADER_SETTINGS_ICON_SIZE` (22) with `HeaderBarAction` `layout="inline"`. Alternative: the 26pt stack-title default, or a new size.

## Order

First planning pass: split into four areas across two waves.

Second pass after the first review: the operator kept D1, D2, D3, D5, and D6 and reversed D4
(00-REQUEST.md § Review of the first planning pass). Step 06 revises plan 11 only, for the filled
Home bell glyph and the 99+ badge cap. No new ledger rows.

Close assembled three phases: plans 10 and 20 at once, then 11, then 40, which closes the set.
D5 is a recorded, intentional difference from web: web's channel toggle sits right beside
Subscribe, while mobile's sits at the trailing edge of the channel header's action row.
