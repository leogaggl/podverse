**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 52 — Banner notification settings

A Banner Notifications group on the mobile Notification settings screen. One switch per kind,
stored on the device with plan 50's prefs. The strings for the card and the E2E button live here
too, so plan 53 only calls `t()`.

Before editing, confirm `MoreSettingsNotificationsScreen` still renders
`testID="more-settings-notifications-card"` inside `styles.cardStack`, and that
`packages/i18n-catalog/mobile/originals/en-US.json` still has `settings.notifications.permission_required`
and `e2e.play_video`. Plan 40 adds steps to `apps/mobile/e2e/notifications-inbox.yaml` and leaves
the rest of that flow in place. Append after that. Do not rewrite the flow.

## Rows

R15, R17

## Runs after

40, 50

## Files

apps/mobile/src/screens/more/MoreSettingsNotificationsScreen.tsx
packages/i18n-catalog/mobile/originals/en-US.json
packages/i18n-catalog/mobile/originals/es.json
packages/i18n-catalog/mobile/originals/fr.json
packages/i18n-catalog/mobile/originals/el-GR.json
apps/mobile/e2e/notifications-inbox.yaml
release-notes/scratchpad.md

## Reuses

- `SettingsSwitchRow` and `Card`. Binary prefs stay switches (`mobile-settings-option-density`).
- `BANNER_NOTIFICATION_KINDS` and `BANNER_NOTIFICATION_KIND_LABEL_KEY` from plan 50. Do not
  re-list the kinds in the screen.
- `useSyncExternalStore(subscribeBannerNotificationPrefs, getBannerNotificationEnabled)` plus
  `hydrateBannerNotificationPrefs` and `setBannerNotificationEnabled`.
- The screen's existing `styles.cardStack`, `styles.cardIntro`, `styles.sectionHeading`, and
  `styles.sectionDescription`.

These switches are not inherited by each podcast. Do not show `ConfirmDialog`. Do not call the
account preference or type-default handlers. A signed-out user can flip them. No login alert on
these rows.

## Screen

After the card whose `testID` is `more-settings-notifications-card`, still inside
`styles.cardStack`, add a third `Card` with `padded={false}` and
`testID="more-settings-banner-notifications-card"`.

- Intro block uses `styles.cardIntro`. Heading `t('settings.notifications.banner_section')`.
  Description `t('settings.notifications.banner_section_help')` with `styles.sectionDescription`.
- On mount, `void hydrateBannerNotificationPrefs()`. The hook's snapshot is the defaults until
  hydrate finishes, which is the right first paint for an install that has never saved a value.
- One `SettingsSwitchRow` per `BANNER_NOTIFICATION_KINDS`, in that order.
  - `title` is `t(BANNER_NOTIFICATION_KIND_LABEL_KEY[kind])`.
  - `value` is the snapshot for that kind.
  - `onValueChange` calls `void setBannerNotificationEnabled(kind, next)`.
  - `showDivider={index > 0}`.
  - `testID={`more-settings-banner-notification-${kind}`}`.
  - `switchTestID={`more-settings-banner-notification-${kind}-switch`}`.

Do not edit the account cards above this one.

## Catalog

Mobile overlay only (`packages/i18n-catalog/mobile/originals/`). Do not add these keys under
`consumer/` or `shared/`. Do not edit `overrides/`. Insert with a targeted edit. Do not rewrite
a catalog file.

Inside the existing `settings.notifications` object, after `permission_required`:

| Key | en-US | es | fr | el-GR |
| --- | --- | --- | --- | --- |
| `banner_section` | Banner Notifications | Notificaciones de banner | Notifications de bannière | Ειδοποιήσεις banner |
| `banner_section_help` | While the app is open, a banner slides down from the top for each kind you turn on. | Con la aplicación abierta, un banner baja desde arriba por cada tipo que actives. | Quand l'application est ouverte, une bannière descend depuis le haut pour chaque type que vous activez. | Όταν η εφαρμογή είναι ανοιχτή, ένα banner κατεβαίνει από την κορυφή για κάθε είδος που ενεργοποιείτε. |
| `banner_dismiss` | Dismiss | Descartar | Fermer | Απόρριψη |
| `banner_open_hint` | Opens this notification. | Abre esta notificación. | Ouvre cette notification. | Ανοίγει αυτή την ειδοποίηση. |

English `banner_section` and `banner_dismiss` are title case. `banner_section_help` and
`banner_open_hint` are sentences. The other locales use the sentences above, not English title
case.

Inside the existing `e2e` object, after `play_video`:

| Key | en-US | es | fr | el-GR |
| --- | --- | --- | --- | --- |
| `show_banner_notification` | Show Banner Notification | Mostrar notificación de banner | Afficher la notification de bannière | Εμφάνιση ειδοποίησης banner |

Plan 53 is the only caller of `banner_dismiss`, `banner_open_hint`, and
`show_banner_notification`. Add them here anyway.

From the repo root, run `npm run i18n:compile`. Do not hand-edit `apps/mobile/i18n/compiled/` or
catalog `compiled/`.

## Maestro

Append to `apps/mobile/e2e/notifications-inbox.yaml`, after the flow is already on
`more-settings-notifications-screen`. The account toggles above can open an apply dialog. These
steps must not.

```yaml
- scrollUntilVisible:
    element:
      id: more-settings-banner-notification-livestream-scheduled-switch
    direction: DOWN
    timeout: ${TIMEOUT_SLOW}
- assertVisible:
    id: more-settings-banner-notifications-card
- assertVisible:
    id: more-settings-banner-notification-new-item-switch
- assertVisible:
    id: more-settings-banner-notification-livestream-started-switch
- tapOn:
    id: more-settings-banner-notification-livestream-scheduled-switch
- tapOn:
    id: more-settings-banner-notification-livestream-scheduled-switch
- assertNotVisible:
    id: more-settings-notifications-apply-dialog
- scrollUntilVisible:
    element:
      id: more-settings-banner-notification-general
    direction: DOWN
    timeout: ${TIMEOUT_SLOW}
- takeScreenshot: more-settings-banner-notifications
```

The double tap puts Livestream Scheduled back to off so a later launch in the same process is
unchanged. `launch-and-connect` already clears app state, which clears these prefs.

No new unit test. Kind defaults and storage are covered by plan 50.

## Release scratchpad

```markdown
## Mobile banner notification settings

- Surfaces: mobile
- Change: Notification settings gain a Banner Notifications group, stored on this device only,
  with one switch per kind. New Item and Livestream Started start on. Livestream Scheduled,
  Product Updates, Maintenance, Terms of Service, and General start off.
- Who notices: mobile users who open Settings, then Notifications
- Operator steps: none
```
