**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 40 — Record where the two notification bells live

## Rows

R13, R14

## Runs after

11, 20

## Goal

Standing guidance names the two bells the way plans 10, 11, and 20 build them, and the way step 04
left web. Checking every notification is a Home-screen function. Turning notifications on or off
for a channel is a podcast, album, and artist function. Item screens have neither bell.

This plan edits guidance only. It does not change product code, tests, catalogs, or web.

Write each rule as what is true of the app. Do not narrate a move, and do not cite a plan, a
proposal doc, or a step number inside a rule (**comments-future-forward**).

## Settled names to use

From plans 10 and 11 (area A):

- Root route `NotificationsInbox`, linking path `notifications`, helper
  `navigateToNotificationsInboxScreen()` in `apps/mobile/src/navigation/index.tsx`.
- Presentation `ROOT_SLIDE_UP_SCREEN_OPTIONS` (same options as `ImageViewer`). Dismiss testID
  `notifications-inbox-dismiss` (`HeaderBarChrome`, `backIcon="chevron-down"`, `misc.dismiss`).
- Component `HomeNotificationsBell` in `apps/mobile/src/screens/home/HomeNotificationsBell.tsx`.
  Home `headerRight` wraps it and `HomeOverflowMenu` in `HeaderBarActions`, bell first.
- Press function `resolveNotificationsBellPress` in
  `apps/mobile/src/lib/notifications/notificationsBellPress.ts`.
- testIDs `home-notifications-bell` and `home-notifications-bell-badge`.
- `HomeScreen` is also the screen under `MoreOverflowHome`, so the bell is on that mount too. It
  is still Home. There is no inbox row on More.
- Gone as entry points: the `Notifications` tab, `NotificationsStackNavigator`,
  `MoreOverflowNotifications`, testIDs `tab-notifications`, `more-nav-notifications`,
  `more-settings-tab-bar-add-notifications`, and the More-tab unread badge.
- A `/notifications` link, a push tap, and a banner tap still open `NotificationsInbox`. Signed
  out, that link opens the inbox login fill. The Home bell, signed out, calls
  `openGate('needs_account')`. Signed in with notifications access denied, the bell calls
  `openGate` with that reason. Signed in while `isTierKnown === false`, the bell opens the inbox.

From plan 20 (area B):

- `notifications` prop on `ChannelHeader` (`apps/mobile/src/components/channel/ChannelHeader.tsx`),
  trailing edge of the action row. Subscribe stays in `actions`, packed at the leading edge. The
  bell is not a node inside `actions`.
- `HeaderBarAction`, `layout="inline"`, `iconSize={CHANNEL_HEADER_SETTINGS_ICON_SIZE}` (22).
- testIDs stay `podcast-detail-notifications-toggle`, `album-detail-notifications-toggle`,
  `artist-detail-notifications-toggle`. Hook `useChannelNotifications` and the settings-pane
  switches stay. Share and Boost stay in `headerRight`. The gear stays at the top right of the
  title row.
- Episode, track, and livestream detail have no bell. Directory livestream detail is
  `EpisodeDetailScreen`. Add by RSS channel pages have no bell.

From step 04 (area C, no plan in 30–39):

- Web inbox stays `NotificationBellButton` in the nav, signed-in only.
- Web channel toggle stays `NotificationIconButton` in `HeaderButtons`, immediately to the right
  of Subscribe, including on episode, track, livestream, clip, chapter, and official-clip pages
  that mount the parent channel header. Item headers and Add by RSS headers have no bell.
- Do not describe a web item-page removal or a web restyle of that header row.

## Files

.cursor/rules/mobile-screen-layout.mdc
.cursor/rules/mobile-tab-layout.mdc
.cursor/rules/mobile-navigate-known-state.mdc
.cursor/rules/about-summary-web-mobile-alignment.mdc

## Tests

none

Guidance has no runtime claim. Plans 10, 11, and 20 already name the unit tests and Maestro flows
that hold the bells. **mobile-test-economics**: do not add a flow for a rule edit.

## Release scratchpad

none

## Leave unchanged

These mention a bell or the word Notifications and stay as they are:

- `.cursor/rules/mobile-image-loading.mdc` and `.cursor/skills/mobile-image-loading/SKILL.md` —
  they point the channel on/off first paint at **mobile-navigate-known-state**. They do not name
  a title-bar slot.
- `.cursor/rules/mobile-section-chrome-cache.mdc` — same pointer. The gear sentence stays.
- `.cursor/rules/screen-reader-accessibility.mdc` — no bell placement. A search for "bell" hits
  `aria-labelledby` only.
- `.cursor/rules/mobile-anonymous-vs-account-features.mdc` — the membership tier for the inbox
  and the gate-on-press Do stay. Placement is **mobile-screen-layout**.
- `.cursor/skills/add-by-rss-parity-sync/SKILL.md` — "There is no share action and no bell" on
  Add by RSS channel detail stays true.
- `.cursor/skills/mobile-reusable-components/SKILL.md` and
  `.cursor/rules/mobile-settings-option-density.mdc` — "Notifications" there is the Settings
  group, not a tab.
- `docs/proposals/mobile/_master-plan_/phase-2/details/726-podcast-settings-and-header-bell.md`
  and `761-channel-detail-shell-and-prefs.md` — done step records, not loaded as agent memory.
  Do not rewrite them.
- `apps/mobile/AGENTS.md` — do not copy this rule into the app guide.

## mobile-screen-layout.mdc

Globs: add `apps/mobile/src/components/channel/ChannelHeader.tsx` so this rule loads when that
file is edited. Leave the other globs.

### Top chrome

In the `headerRight` bullet, replace the span that starts at `**Share and the notification
(bell)**` and ends at `mobile does.` (the sentence that forbids the bell in `ChannelHeader`).

Keep the **Channel settings** gear sentences that sit inside that span (top-aligned gear,
`CHANNEL_HEADER_SETTINGS_ICON_SIZE`, two-line title, pane toggle, gear visible when signed out).
Adjust only the action-row sentence so Subscribe packs at the leading edge and the channel bell
is the trailing edge of that same row, in line with the gear, and is not a node inside `actions`.

The replacement states, in this order:

1. **Share**, and **Boost** on screens that offer it, on podcast, album, artist, episode, and
   track detail, belong in the stack title-bar slot (`HeaderBarAction` in `headerRight`, wrapped
   in `HeaderBarActions` when there is more than one).
2. **Checking all notifications** is Home only. `HomeNotificationsBell` is the first control in
   Home's `headerRight` (`HeaderBarActions`), to the left of `HomeOverflowMenu`. testIDs
   `home-notifications-bell` and `home-notifications-bell-badge`. The same `HomeScreen` mounts
   under `MoreOverflowHome`, so the bell is there too. No other screen gets this bell. It stays
   visible signed out and without notifications access. Press goes through
   `resolveNotificationsBellPress`, then `navigateToNotificationsInboxScreen()` or `openGate`.
   While `isTierKnown === false`, press opens the inbox.
3. The inbox is root route `NotificationsInbox` with `ROOT_SLIDE_UP_SCREEN_OPTIONS`. Dismiss
   testID `notifications-inbox-dismiss`. Link path `notifications` (a link, push tap, or banner
   tap opens this route). The unread count is this bell's badge. The More tab does not show it.
4. **Turning notifications on or off for a channel** is podcast, album, and artist detail only.
   Prop `notifications` on `ChannelHeader`, trailing on the action row, `layout="inline"`,
   `CHANNEL_HEADER_SETTINGS_ICON_SIZE`. The three `*-detail-notifications-toggle` testIDs. The
   bell stays visible when signed out. `useChannelNotifications` and the settings-pane switches
   stay. Do not put this bell in the stack title bar. Do not put it on episode, track,
   livestream, clip, or any other item screen. Add by RSS channel pages have no bell.
5. Do not place share in `ChannelHeader`. Do not add the Home inbox bell anywhere but Home. Web
   keeps its header row; see **about-summary-web-mobile-alignment**. Do not restyle that row,
   and do not remove `NotificationIconButton` from a page that mounts the parent channel header.

`ChannelHeader` `actions` remains the leading cluster of that bottom row. RSS and website stay
on About. The sentences after that (header icon color, 26pt stack actions, 28pt back glyph, gear
is the smaller glyph, `MoreMenu`) stay.

### Cover art slide-up

In the standalone cover-art paragraph (the `ImageViewer` / `ROOT_SLIDE_UP_SCREEN_OPTIONS`
sentence), add one sentence after the down-chevron dismiss: `NotificationsInbox` is the other
root screen on `ROOT_SLIDE_UP_SCREEN_OPTIONS`, with the same down-chevron dismiss
(`notifications-inbox-dismiss`). Leave the artwork URI rules as they are.

### Podcast detail pinned chrome

Replace "Share and the notification bell stay in the stack `headerRight`." Share and Boost stay
in the stack `headerRight`. The channel notification bell is the trailing control on
`ChannelHeader`'s action row. The gear sentence that follows stays.

### Do not

Add two bullets:

- Do not add a Notifications tab, a More row that opens the inbox, or an inbox bell on any
  screen but Home.
- Do not put the channel on/off bell in a stack title bar, on an item screen, or inside
  `ChannelHeader` `actions`.

## mobile-tab-layout.mdc

- Delete the sentence "Notifications overflows to More until the user adds it."
- After the factory-order sentence, add: Notifications is not a content tab. It is not in
  `CONTENT_TAB_IDS`, not a More overflow row, and not a row on Settings > Tab Bar. The Home
  bell is the in-app control that opens the inbox. A link or push whose path is `notifications`
  opens root route `NotificationsInbox`. The unread count is that bell's badge, not a tab badge.
- In the overflow-route list, delete `MoreOverflowNotifications`. The list is
  `MoreOverflowHome`, `MoreOverflowSearch`, `MoreOverflowLibrary`, `MoreOverflowBrowse`,
  `MoreOverflowRecommendations`.
- In the Do not line that names `navigate('Notifications')`, keep the rule (do not unmount a tab
  to hide it) and use a live example: `navigate('Search')`.

Hidden content tabs that are still in `CONTENT_TAB_IDS` stay registered. That sentence stays.
Recommendations is the overflow example the factory bar uses; do not put Notifications back into
that sentence.

## mobile-navigate-known-state.mdc

The first-paint cache is unchanged. Name which bell it is.

After the sentence that lists Subscribe vs Unsubscribe, the notification bell, and download vs
delete, add: that bell is the channel on/off control, the `notifications` prop on `ChannelHeader`
for podcast, album, and artist detail. `HomeNotificationsBell` shows the unread count on Home and
does not read this cache.

In the Do bullet that starts "Resolve the notification bell by `channelIdText`", say "that
channel bell" so it cannot be read as the Home badge. Leave the cache, the preview params, and
the Don't list otherwise as they are.

## about-summary-web-mobile-alignment.mdc

Globs: add these three, so an edit to a web bell loads this rule:

- `apps/web/src/components/NavBar/NotificationBellButton.tsx`
- `apps/web/src/components/Media/Header/NotificationIconButton.tsx`
- `apps/web/src/components/Media/Header/HeaderButtons.tsx`

In **Placement divergence (intentional)**, after the sentence that episode, track, and
full-player screens have no channel-header gear, add that those screens also have no channel
notification bell, and that on podcast, album, and artist the bell is the trailing control on
the channel header action row.

Replace the table row "Share, subscribe, notifications, boost" with four rows. Keep the other
rows. Re-pad the table so the column separators line up with the rest of the file.

| Field | Web | Mobile |
| --- | --- | --- |
| Share, boost | Header actions | Stack title bar (`headerRight`). Not About body |
| Subscribe | Header actions, leading | `ChannelHeader` action row, leading. Not About body |
| Channel notifications on/off | `NotificationIconButton` in `HeaderButtons`, immediately to the right of Subscribe, including where episode, track, livestream, clip, chapter, and official-clip pages mount the parent channel header. Item headers and Add by RSS headers have no bell | `ChannelHeader` `notifications`, trailing edge of the action row, on podcast, album, and artist detail only. Not on an item screen. Not on Add by RSS. Not About body |
| Inbox | `NotificationBellButton` in the nav bar, signed-in only | Home title bar only (`HomeNotificationsBell`), to the left of the ellipsis, signed out or signed in. Not a tab. Not About body |

After the paragraph that says not to copy web RSS and website icons onto mobile, add the bell
divergence:

- Do not remove `NotificationIconButton` from a web page that mounts the parent channel header.
- Do not restyle the web header row so the toggle sits at the trailing edge.
- Do not add a mobile inbox bell off Home, or a mobile channel bell on an item screen, to match
  web.

The RSS, website, and funding sentences in that paragraph stay.

## Self-check

After the edits, search `.cursor/` for these and confirm each is gone:

- `Share and the notification (bell)`
- `place share or the bell`
- `notification bell stay in`
- `Notifications overflows`
- `MoreOverflowNotifications`
- `navigate('Notifications')`

Search `.cursor/` and confirm each is present:

- `HomeNotificationsBell`
- `home-notifications-bell`
- `NotificationsInbox`
- `notifications-inbox-dismiss`
- `podcast-detail-notifications-toggle`
- `NotificationBellButton`
- `NotificationIconButton`

Confirm the four files above are the only files this plan changed.
