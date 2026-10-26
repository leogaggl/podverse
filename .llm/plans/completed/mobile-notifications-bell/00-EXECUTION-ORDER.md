# Mobile notifications bell — execution order

Prompts and models: [COPY-PASTA.md](COPY-PASTA.md). Request and settled review answers:
[00-REQUEST.md](00-REQUEST.md). Ledger and decisions: [00-SUMMARY.md](00-SUMMARY.md).

Phases run one after another. Prompts inside one phase run at once and own disjoint files. In
Phase 1, neither prompt writes `release-notes/scratchpad.md`; each puts its entry in its final
message under "Release notes entry", and prompt 40 appends both. Prompt 11 runs alone and appends
its own entry. Prompt 40 has no entry of its own (guidance only).

## Where it runs

The set runs in this worktree, `podverse_feature_mobile_notifications_bell`, on branch
`feature/mobile-notifications-bell`. Final messages land in
`.artifacts/plan-runner/mobile-notifications-bell/`.

Web has no change in this set (R15, step 04 audit). Mobile is the only product surface.

## Dependency graph

From each plan's `## Runs after`:

| Plan | Runs after |
| --- | --- |
| 10 inbox becomes a root slide-up screen; the Notifications tab goes away | none |
| 20 channel bell moves into the channel header's action row | none |
| 11 Home title-bar bell with the unread badge and the gate | 10 |
| 40 guidance for where the two bells live; closes the set | 11, 20 |

## Shared files that set the order

- **`apps/mobile/src/navigation/index.tsx`:** 10 only. It adds the root `NotificationsInbox` route
  and `navigateToNotificationsInboxScreen()`; 11 imports that helper and does not edit the file.
- **`apps/mobile/vitest.config.ts`:** 11 only (two new include entries). 10 and 20 do not edit it.
- **`release-notes/scratchpad.md`:** 11 writes its own entry while running alone; 40 appends the
  entries from 10 and 20. Neither Phase 1 prompt writes it.
- **`apps/mobile/e2e/*.yaml`:** each flow has one owner. 10 owns `browse.yaml` and
  `banner-notification.yaml`; 20 owns `podcast-episode.yaml`, `subscriptions-anonymous.yaml`,
  `album.yaml`, and `artist.yaml`; 11 owns `notifications-inbox.yaml`. Between prompts 10 and 11,
  `notifications-inbox.yaml` still taps the removed `tab-notifications`; tests run only after the
  set, so that gap is expected.
- **i18n catalogs:** no prompt edits a catalog. The inbox title keeps `nav.tab.notifications`.
- **`.cursor/rules/`:** 40 only.

## Phases

### Phase 1 — inbox route and channel header bell (2 prompts at once)

- **10** owns `apps/mobile/src/navigation/index.tsx`, `apps/mobile/src/navigation/deepLinking.ts`,
  `apps/mobile/src/navigation/deepLinking.test.ts`,
  `apps/mobile/src/navigation/notificationStack.test.ts`,
  `apps/mobile/src/navigation/tabBarIcon.tsx`, `apps/mobile/src/prefs/tabLayout.ts`,
  `apps/mobile/src/prefs/tabLayout.test.ts`,
  `apps/mobile/src/screens/notifications/NotificationsInboxScreen.tsx`,
  `apps/mobile/e2e/browse.yaml`, and `apps/mobile/e2e/banner-notification.yaml`.
- **20** owns `apps/mobile/src/components/channel/ChannelHeader.tsx`,
  `apps/mobile/src/screens/podcast/PodcastDetailScreen.tsx`,
  `apps/mobile/src/screens/album/AlbumDetailScreen.tsx`,
  `apps/mobile/src/screens/artist/ArtistDetailScreen.tsx`, `apps/mobile/e2e/podcast-episode.yaml`,
  `apps/mobile/e2e/subscriptions-anonymous.yaml`, `apps/mobile/e2e/album.yaml`, and
  `apps/mobile/e2e/artist.yaml`.

### Phase 2 — Home bell

- **11**, alone. Owns `apps/mobile/src/components/primitives/countBadgeFace.ts` and its test,
  `apps/mobile/src/components/primitives/CountBadge.tsx`,
  `apps/mobile/src/lib/notifications/notificationsBellPress.ts` and its test,
  `apps/mobile/src/screens/home/HomeNotificationsBell.tsx`,
  `apps/mobile/src/screens/home/HomeScreen.tsx`, `apps/mobile/e2e/notifications-inbox.yaml`,
  `apps/mobile/vitest.config.ts`, and its own `release-notes/scratchpad.md` entry.

### Phase 3 — guidance, then close the set

- **40**, alone. Owns `.cursor/rules/mobile-screen-layout.mdc`, `.cursor/rules/mobile-tab-layout.mdc`,
  `.cursor/rules/mobile-navigate-known-state.mdc`, and
  `.cursor/rules/about-summary-web-mobile-alignment.mdc`. Appends the Phase 1 release entries,
  archives the set, and carries the cumulative verification.

## Release entries collected by prompt 40

From `.artifacts/plan-runner/mobile-notifications-bell/<NN>.md`, in this order: 10, 20. Plan 11
appends its own; plan 40 has none.

## Known test gap

`apps/mobile/src/prefs/tabLayout.test.ts` and `apps/mobile/src/navigation/notificationStack.test.ts`
are not in the mobile Vitest `include` allowlist, so `npm --prefix apps/mobile run test` does not
run them. Their modules import `@react-native-async-storage/async-storage` and
`@react-navigation/native`. Plan 10 still updates both files to match the new behavior; it does not
add them to the allowlist. Making them run is a separate change (open question at Close).
