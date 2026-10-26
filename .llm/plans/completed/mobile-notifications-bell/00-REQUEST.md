# Request — mobile notifications bell

This set is one of three split from a single operator message. The clear-X ask is set
`search-input-clear-icon`. The livestream row badge ask is set `livestream-row-status-slot`.

## Request

Also, we want to move the notifications out of the More tab and instead it should be a bell that
appears on the home screen in the title bar to the left of the More ellipsis icon. Pressing that
bell should take you to the notifications page. And the notifications page should slide up from
the bottom. And you can remove that notifications cell from the More screen.

And to differentiate that notification bell on the channels where you can subscribe for
notifications, we should put a smaller notifications bell in the bottom right of the channel
headers to the right of subscribe, unsubscribe. So it'll be an icon similar to the gear icon, but
it's occupying the bottom right of that header.

## Operator answers

- **Notifications as a tab:** remove it as a tab option entirely. Users can no longer pin
  Notifications to the tab bar or find it in More overflow. The Home bell is the only way in.
- **Unread state:** the Home bell shows the unread count badge. The More tab no longer carries
  that badge.
- **Signed out or no membership:** the Home bell stays visible and opens the login or membership
  gate on press.
- **Item detail screens:** "there should not be a bell on item detail pages, only channel detail
  pages (in the channel header) and on the home screen (in the title header). checking all
  notifications is a root home screen only function. subscribing and unsubscribing is a channel
  level only function (not item level)". Remove the bell from episode, track, and livestream
  detail title bars.
- **Web:** "yes mobile only unless you identify alignment issues worth fixing in web". Web already
  has a nav-bar bell and a bell in the channel header buttons. Report any web misalignment found,
  for example a bell on web item pages.

### Review of the first planning pass

Answers to the planner decisions D1–D6 in `00-SUMMARY.md` § Decisions to review. Only D4 changes a
plan (plan 11). No new ledger rows.

- **D1, stored tab bars that pinned Notifications (plan 10, kept):** "Drop the Notifications id
  when a stored tab bar is read. Do not add a migration or any memory that Notifications was once
  a tab. Testers delete the app before the next install." Plan 10 stays as written.
- **D2, inbox links while signed out (plan 10, kept):** "A signed-out link, push, or banner whose
  destination is the inbox opens the inbox and shows its existing login prompt. Do not use the
  Home bell gate for that path." A new-episode or livestream notification already opens that
  content page; that path stays as it is.
- **D3, signed in with account details still loading (plan 11, kept):** "While signed in and
  account details are still loading, the Home bell opens the inbox. Do not show a gate on that
  early reading." Plan 11 already says this.
- **D4, Home bell look (plan 11, reversed):** "The Home bell is a filled icon, Ionicons
  notifications, at the standard header icon size. The unread badge stops at 99+." Plan 11 is
  revised for the glyph and the cap. Plans 10, 20, and 40 name neither.
- **D5, channel bell position (plan 20, kept):** "The channel bell stays at the trailing edge of
  the action row, in line with the gear, with Subscribe packed at the leading edge." This is an
  intentional difference from web, where the channel toggle sits immediately beside Subscribe.
- **D6, channel bell size (plan 20, kept):** "The channel bell stays at
  CHANNEL_HEADER_SETTINGS_ICON_SIZE, 22, with layout inline."

## Glossary

- **More ellipsis icon:** the Home title bar's overflow control (`HeaderBarAction` in
  `headerRight`), which opens `MoreMenu`.
- **Gear icon:** the channel settings gear at the top right of `ChannelHeader`'s title row.
- **Channel headers:** `ChannelHeader` on podcast, album, and artist detail.

## Orientation

- `apps/mobile/src/navigation/index.tsx`: `NotificationsStackNavigator` (~1475), the
  `MoreOverflowNotifications` route (~255, ~1543), the overflow tab press switch (~1834), the More
  tab badge count from `useNotificationsUnreadCount` (~2027), the Notifications tab registration
  (~2199), and the deep-link screens `notificationsTabLinkScreens` (~419–483). The comment there
  says `/notifications` targets the Notifications tab, so deep links and push routing need a new
  target.
- `apps/mobile/src/prefs/tabLayout.ts` and `tabLayout.test.ts`: `'Notifications'` is a tab id with
  a label key. Tests put it in the default overflow.
- `apps/mobile/src/navigation/tabBarIcon.tsx`: the notifications tab icon.
- `apps/mobile/src/navigation/notificationStack.ts` and `apps/mobile/src/push/notificationRouting.ts`:
  deep-link and push routing that resolve to the notifications screen.
- `apps/mobile/src/screens/notifications/NotificationsInboxScreen.tsx`: the inbox.
- `apps/mobile/src/hooks/useNotificationsUnreadCount.ts`: unread count source.
- `apps/mobile/src/components/channel/ChannelHeader.tsx`: `settings` prop draws the gear at the top
  right of the title row (`CHANNEL_HEADER_SETTINGS_ICON_SIZE`); `actions` is the bottom row where
  Subscribe sits.
- `apps/mobile/src/screens/podcast/PodcastDetailScreen.tsx`: the channel bell is a `headerRight`
  action today (~438–498, `useChannelNotifications`, testID
  `podcast-detail-notifications-toggle`). Album and artist detail screens also reference
  notifications.
- `apps/mobile/src/hooks/useChannelNotifications.ts`: per-channel toggle.
- The `ImageViewer` root screen uses `ROOT_SLIDE_UP_SCREEN_OPTIONS`, a slide-up root presentation
  with a down-chevron dismiss (per the **mobile-screen-layout** rule).
- Web: `apps/web/src/components/NavBar/NotificationBellButton.tsx` and
  `apps/web/src/components/Media/Header/NotificationIconButton.tsx` (used by `HeaderButtons.tsx`).
- Guidance that states the bell lives in the stack title bar on channel and item detail and must
  change with this set: `.cursor/rules/mobile-screen-layout.mdc`,
  `.cursor/rules/mobile-navigate-known-state.mdc`, `.cursor/rules/about-summary-web-mobile-alignment.mdc`.
