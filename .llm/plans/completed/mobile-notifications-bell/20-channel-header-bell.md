**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

## Rows

R6, R7, R12

## Runs after

none

## Files

apps/mobile/src/components/channel/ChannelHeader.tsx
apps/mobile/src/screens/podcast/PodcastDetailScreen.tsx
apps/mobile/src/screens/album/AlbumDetailScreen.tsx
apps/mobile/src/screens/artist/ArtistDetailScreen.tsx
apps/mobile/e2e/podcast-episode.yaml
apps/mobile/e2e/subscriptions-anonymous.yaml
apps/mobile/e2e/album.yaml
apps/mobile/e2e/artist.yaml

## Tests

No unit test. `useChannelNotifications` and `channelActionChrome` stay as they are, and the new prop is presentation. There is no `ChannelHeader` test file.

Maestro, existing flows only. Keep every current `id` assertion. Rewrite the comments that say the bell is in the stack title bar so they describe the channel header. Add one `assertVisible` on the album flow and one on the artist flow, beside the header-settings assert those flows already have. Do not add a flow, and do not add an `assertNotVisible` for a notifications id on episode, track, or livestream pages (those ids are not on those screens).

- `apps/mobile/e2e/podcast-episode.yaml` — comments only, around the boost step and the "Header actions and podcast settings" step. The taps on `podcast-detail-notifications-toggle` stay, including the tap while the settings pane is open.
- `apps/mobile/e2e/subscriptions-anonymous.yaml` — comments only, around the signed-out header asserts and the gate tap on `podcast-detail-notifications-toggle`.
- `apps/mobile/e2e/album.yaml` — after `assertVisible` / `id: album-detail-header-settings`, add `assertVisible` / `id: album-detail-notifications-toggle`.
- `apps/mobile/e2e/artist.yaml` — after `assertVisible` / `id: artist-detail-header-settings`, add `assertVisible` / `id: artist-detail-notifications-toggle`.

## Release scratchpad

Append this entry to `release-notes/scratchpad.md`:

```markdown
## Channel notification bell sits on the channel header

- Surfaces: mobile
- Change: On podcast, album, and artist detail, the control that turns notifications on or off for that channel leaves the stack title bar and sits at the bottom right of the channel header, to the right of Subscribe / Unsubscribe, at the same size as the settings gear. A tap still toggles the channel, or opens the login or membership gate. Share and Boost stay in the title bar. Episode, track, and livestream detail title bars have no such bell.
- Who notices: listeners on podcast, album, and artist pages
- Operator steps: none
```

## Goal

On podcast, album, and artist detail, the per-channel notification control is a small bell at the bottom right of `ChannelHeader`, to the right of Subscribe / Unsubscribe, the same kind of icon as the settings gear. Episode, track, and livestream detail do not draw that bell. This plan does that move. It does not edit `.cursor/` files.

## What is true today

The gear is the `settings` prop on `ChannelHeader`. `ChannelHeaderTitleRow` renders it with `HeaderBarAction`, `layout="inline"`, and `iconSize={CHANNEL_HEADER_SETTINGS_ICON_SIZE}` (22, in `apps/mobile/src/theme/screenLayout.ts`). It sits at the trailing end of the title row.

Subscribe / Unsubscribe is the `actions` prop. `ChannelHeaderActionRow` lays that prop in a row with `gap: tokens.spacing.md`, packed at the start. The row stretches to the text column. The text column locks to the 78pt artwork height when `actions` is set, so the row sits on the bottom edge. A subtitle plus actions forces the title to one line (`titleLines`).

The bell is not in that header. Each of these screens builds it in `headerRight` inside `HeaderBarActions`, between the optional Boost action and Share:

- `PodcastDetailScreen` — `useLayoutEffect` `headerRight`, testID `podcast-detail-notifications-toggle`, labels `features.notifications.enable_notifications_for_this_podcast` / `disable_notifications_for_this_podcast`.
- `AlbumDetailScreen` — same shape, testID `album-detail-notifications-toggle`, `enable_notifications_for_this_album` / `disable_notifications_for_this_album`.
- `ArtistDetailScreen` — same shape, testID `artist-detail-notifications-toggle`, `enable_notifications_for_this_artist` / `disable_notifications_for_this_artist`.

Icon is `notifications` when `notifications.isEnabled` is true and `notifications-off-outline` otherwise. Press calls `notifications.toggleEnabled`. The action does not pass `selected`, `disabled`, or `iconColor`. `HeaderBarAction` then uses `tokens.text.primary` and the 26pt stack-header default.

`useChannelNotifications` is already called on each screen with `channelId`, `channelIdText`, and `previewNotificationsEnabled`. That hook, plus `getChannelActionChrome` / `resolveChannelNotificationsEnabled`, is what keeps the first painted on/off state from flashing. Leave the hook, its arguments, and `apps/mobile/src/lib/channelActionChrome.ts` unchanged.

The same hook value is passed into `ChannelSettingsPane` (`notifications={notifications}`). Podcast also passes it into the section pane. Those switches stay. The pane is the place that renders `errorKey`. The title-bar bell does not.

`ChannelDetailShell` renders `channelHeader` in `pinnedChrome` only when `isSectionHydrated` is true. Podcast sets that after `readPodcastDetailPrefs`. Album sets it after `readAlbumDetailPrefs`. Artist passes `true`. Subscribe and the gear already wait for that. The title-bar bell does not, because `headerRight` is set in `useLayoutEffect`. After this change the bell waits with Subscribe and the gear. Do not leave a title-bar bell up during that gap.

While the settings pane is open, `channelHeader` stays mounted (`sectionBody` swaps; the shell does not). `podcast-episode.yaml` taps `podcast-detail-notifications-toggle` in that state. The bell has to stay tappable then.

Signed out, `useChannelNotifications` reports `isEnabled: false` and `toggleEnabled` calls `openGate('needs_account')`. The bell stays on screen. `subscriptions-anonymous.yaml` depends on that. Do not hide it for signed-out or lapsed members.

## Placement

The bell is a `notifications` prop on `ChannelHeader`, parallel to `settings`. It is not a node inside `actions`.

`actions` stays packed at the leading edge (Subscribe, and any sibling a caller puts beside it, with `gap: tokens.spacing.md`). The bell is the trailing edge of that same row, so it lines up with the gear above it. A `space-between` row does that. Putting the bell in `actions` would sit it immediately beside Subscribe and leave empty space to its right. That is the rejected layout.

Visual contract, matching the gear:

- `HeaderBarAction`
- `layout="inline"`
- `iconSize={CHANNEL_HEADER_SETTINGS_ICON_SIZE}` (reuse the constant; do not add another; do not pass 26)
- icon `notifications` when `enabled` is true, otherwise `notifications-off-outline`
- no `selected`, no `disabled`, no `iconColor`
- `flexShrink: 0` on the bell's wrapper, same idea as the gear wrapper

The accessible name is the caller's already-localized string. `ChannelHeader` does not call `t()`.

## ChannelHeader

In `apps/mobile/src/components/channel/ChannelHeader.tsx`:

Add a type next to `ChannelHeaderSettings` (do not export it; `ChannelHeaderSettings` is not exported):

```tsx
type ChannelHeaderNotifications = {
  accessibilityLabel: string;
  enabled: boolean;
  onPress: () => void;
  testID: string;
};
```

Add `notifications?: ChannelHeaderNotifications` to `ChannelHeaderProps`.

`ChannelHeaderActionRow` takes `actions: ReactNode` and `notifications?: ChannelHeaderNotifications` instead of `children`.

- No `notifications`: one row, today's styles (`alignItems: 'center'`, `flexDirection: 'row'`, `flexShrink: 0`, `gap: tokens.spacing.md`), rendering `actions` only. Add-by-RSS and track headers pass no `notifications`, so they keep this row.
- `notifications` set and `actions` non-null: same row plus `justifyContent: 'space-between'`. Leading cluster is a `View` (`flexDirection: 'row'`, `alignItems: 'center'`, `gap: tokens.spacing.md`, `flexShrink: 1`, `minWidth: 0`) around `actions`. Trailing cluster is the bell, `flexShrink: 0`.
- `notifications` set and `actions` null or undefined: the row is only the bell, `justifyContent: 'flex-end'`. Do not pack a lone bell at the start.

The bell element:

```tsx
<HeaderBarAction
  accessibilityLabel={notifications.accessibilityLabel}
  icon={notifications.enabled ? 'notifications' : 'notifications-off-outline'}
  iconSize={CHANNEL_HEADER_SETTINGS_ICON_SIZE}
  layout="inline"
  onPress={notifications.onPress}
  testID={notifications.testID}
/>
```

Column lock: `lockTextColumn` is true when `actions` is non-null or `notifications` is set. Use it where the component currently uses `hasActions` for `textColumnLocked` and for `titleLines` (`lockTextColumn && hasSubtitle ? 1 : CHANNEL_HEADER_TITLE_MAX_LINES`). Render `ChannelHeaderActionRow` when `lockTextColumn` is true. Pass `actions` through even when it is null.

Update the comments in this file so they describe the gear at the top right of the title row and the bell at the trailing end of the action row. Do not describe a previous placement.

`apps/mobile/src/components/channel/index.ts` stays as it is.

## The three channel screens

On each screen, delete the notifications `HeaderBarAction` from `headerRight`. Leave the Boost action (still conditional on `canShowBoost && channel !== null`) and the Share action inside `HeaderBarActions`. Drop `notificationsEnabled` and `toggleNotifications` from that effect's dependency array. Keep `useChannelNotifications` and every argument. Keep passing `notifications` into `ChannelSettingsPane` and, on podcast, into the section pane.

Add a `notifications` prop on the existing `ChannelHeader`, beside `settings`.

Podcast (`PodcastDetailScreen`, the `channelHeader` element and the `headerRight` effect):

```tsx
notifications={{
  accessibilityLabel: t(
    notificationsEnabled
      ? 'features.notifications.disable_notifications_for_this_podcast'
      : 'features.notifications.enable_notifications_for_this_podcast'
  ),
  enabled: notificationsEnabled,
  onPress: () => {
    void toggleNotifications();
  },
  testID: 'podcast-detail-notifications-toggle',
}}
```

Album: the album enable/disable keys and testID `album-detail-notifications-toggle`.

Artist: the artist enable/disable keys and testID `artist-detail-notifications-toggle`.

Rewrite the podcast screen comment that says share and notifications live in the stack title bar. Share stays in the stack title bar. The bell is the trailing control on the channel header action row. The gear stays at the top right of that header. Album and artist have no matching comment.

Do not show `notifications.errorKey` on the header. Do not disable the bell while `isSaving` is true. The hook already ignores a second write.

## Item detail (R12)

These pages do not draw a notification bell. Leave them unchanged.

- `apps/mobile/src/screens/episode/EpisodeDetailScreen.tsx` — `headerRight` is one `HeaderBarAction`, testID `episode-detail-share`.
- `apps/mobile/src/screens/track/TrackDetailScreen.tsx` — `headerRight` is one `HeaderBarAction`, testID `track-detail-share`. Its `ChannelHeader` (`testID="track-detail-album-header"`) has no `settings` and no `actions`. Do not pass `notifications`.
- Directory livestream detail is `EpisodeDetailScreen`. `apps/mobile/e2e/browse.yaml` opens "E2E Live Audio Stream" and waits for `episode-detail-screen`. There is no other directory livestream detail screen.
- `apps/mobile/src/screens/home/AddByRssLivestreamDetailScreen.tsx` — no `headerRight` and no `HeaderBarAction`. The identity block is `AddByRssLivestreamHeader`, which renders `ItemDetailHeader`.
- `AddByRssEpisodeDetailScreen` and `AddByRssTrackDetailScreen` — no `headerRight` and no notifications toggle. `AddByRssTrackDetailScreen` uses `ChannelHeader` for the feed title. Do not pass `notifications`.
- Clip detail and `FullPlayerScreen` — no notifications toggle. Out of these rows. Do not edit them.

`AddByRssHomeDetailScreen` is a channel page with Subscribe / Unsubscribe and a gear, and it has no bell. Its comment says notifications need a server channel. Do not add one. R6 is the channels that can subscribe for notifications, which are the three directory screens above.

## Leave unchanged

- `apps/mobile/src/hooks/useChannelNotifications.ts`
- `apps/mobile/src/lib/channelActionChrome.ts`
- `apps/mobile/src/components/channel/ChannelSettingsPane.tsx`
- `apps/mobile/src/components/channel/ChannelDetailShell.tsx`
- `apps/mobile/src/screens/podcast/PodcastSettingsScreen.tsx` (its own toggle, testID `podcast-settings-notifications-toggle`)
- `apps/mobile/src/theme/screenLayout.ts` (import `CHANNEL_HEADER_SETTINGS_ICON_SIZE`; do not rename it)
- i18n catalogs. The six `features.notifications.enable_notifications_for_this_*` / `disable_notifications_for_this_*` keys already exist.
- Every `.cursor/` file. Area D records the new placement.
