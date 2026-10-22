# 22 — Add by RSS channel detail settings: feed check and credentials

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

Rows: R6, R7. Mobile only. Runs after `21-add-by-rss-detail-chips.md`. Plan 20 already removed
the header's credentials row and left a placeholder body for the settings gear.

## Answers

**R6.** The feed username and password leave the header. The header gear (plan 20) opens a
settings pane in place of the section, as it does on podcast detail.

**R7.** The pane always shows the username and password fields, prefilled from the device store,
whether or not the feed currently needs them. Web's Add by RSS Settings tab does the same
(`AddByRSSCredentialsSettingsSection`).

## Locked decisions

1. **Pane contents**, top to bottom, inside one `ScrollView` styled like `ChannelSettingsPane`:
   - **RSS Feed** card: parse status lines, a "Check Feed for Updates" button, and a notice. The
     same card podcast detail shows, extracted so both use one component.
   - **Feed Username and Password** card (`features.add_by_rss.credentials_page_title`): the device
     note, the media note, the two fields, the notice, and a "Save and Check" button.
   - Notifications and auto-download cards are not shown: both are keyed to a server channel.
     Recorded in the screen's doc comment.
2. **Status lines.** `lastFinishedParseTime` is `detail.feed.updatedAt` (an ISO string on
   `MobileAddByRSSFeedRecord` in `prefs/addByRSSFeeds.ts`) when `detail.mappedFeed !== null`, else
   null; `lastFailedParseTime` is null. The device record stamps `updatedAt` when a parse result is
   stored.
3. **Feed check.** Gate on `evaluateFeature('add_by_rss_refresh')` (the background refresh's key).
   When not allowed, `openGate(access.reason)`. When allowed, read stored credentials with
   `addByRssCredentialStore.getForCurrentAccount(feedUrl)`, then
   `addByRssRepository.parseNow(authContext, feedUrl, credentials)`, then
   `homeFeedRefresh.notify()`. Build the failure log with `buildAddByRssParseFailureLog` and
   `jobKind: 'add-by-rss-parse'`; append it to `syncEventLogRepository` when non-null. Notice:
   `features.add_by_rss.status_parsed` on success, else `credentialNoticeKeyForParse(result)`,
   falling back to `errors.generic`. A thrown error goes to `handleGateError` first, then
   `handleRateLimitMessage`, then `errors.generic`. Always reload the detail afterward.
4. **Pull-to-refresh** on Episodes, Tracks, and Downloaded runs the same check without a gate:
   when `add_by_rss_refresh` is not allowed it only re-reads the device copy (a lapsed membership
   keeps feeds readable and stops refreshing them, as the background refresh does). It sets no
   notice on success; a failure notice shows in the section list.
5. **Save and Check** behaves as on the credentials screen (gate on `add_by_rss_add`, store on the
   device, parse, notify Home, log failures). On success the pane stays open, shows
   `features.add_by_rss.status_parsed`, keeps the typed values, and reloads the detail. The
   credentials screen keeps returning to the list on success.
6. **Credentials stay on the device** (**add-by-rss-client-held-credentials**): the pane reads and
   writes only through `addByRssCredentialStore`; nothing is logged or sent other than the parse
   request the credentials screen already sends.

## Files

Paths are under `apps/mobile/` unless they start with `.cursor/`.

| File                                                      | Change                       |
| --------------------------------------------------------- | ---------------------------- |
| `src/components/channel/ChannelFeedSettingsGroup.tsx`     | New. RSS Feed card           |
| `src/components/channel/useFeedParseStatusLines.ts`       | New. Status lines hook       |
| `src/components/channel/ChannelSettingsPane.tsx`          | Use both                     |
| `src/components/channel/index.ts`                         | Export both                  |
| `src/screens/rss/useAddByRssCredentialsForm.ts`           | New. Fields state and save   |
| `src/screens/rss/AddByRssCredentialsFields.tsx`           | New. Two fields and notice   |
| `src/screens/rss/AddByRssCredentialsScreen.tsx`           | Use the hook and fields      |
| `src/screens/home/addByRss/useAddByRssFeedCheck.ts`       | New. Check and pull refresh  |
| `src/screens/home/addByRss/AddByRssSettingsPane.tsx`      | New                          |
| `src/screens/home/addByRss/addByRssSectionPane.ts`        | `refreshNoticeKey`           |
| `src/screens/home/addByRss/AddByRssEpisodesSection.tsx`   | Show `refreshNoticeKey`      |
| `src/screens/home/addByRss/AddByRssDownloadedSection.tsx` | Show `refreshNoticeKey`      |
| `src/screens/home/AddByRssHomeDetailScreen.tsx`           | Silent reload, pane, refresh |
| `e2e/add-by-rss-credentials.yaml`                         | Settings gear steps          |
| `.cursor/skills/add-by-rss-parity-sync/SKILL.md`          | Mobile section               |

## Implementation

### Shared channel pieces

- `useFeedParseStatusLines(times: { lastFailedParseTime: string | null; lastFinishedParseTime:
  string | null } | null): string[]`. Move the `useMemo` body from `ChannelSettingsPane`
  (`buildFeedParseStatusLines`, `formatDateTimeAbbrev(iso, locale)`, the three
  `settings.feed.*` keys). Null input returns `[]`. Memo deps are the two fields, `times === null`,
  `locale`, and `t`. Match `buildFeedParseStatusLines`' input types exactly.
- `ChannelFeedSettingsGroup` props: `isChecking: boolean`, `notice: string | null` (already
  translated), `onCheck: () => void`, `statusLines: string[]`, `testIDPrefix: string`. It renders
  today's `SettingsGroup` block from `ChannelSettingsPane` (status lines, `Button fullWidth
  size="form" variant="secondary"`, notice) with the same testIDs
  (`${testIDPrefix}-settings-feed-card`, `-settings-check-feed`, `-settings-feed-notice`). Move the
  `feedInner` / `feedStatus` styles with it.
- `ChannelSettingsPane` keeps its gating, `reqMQRSSRefreshOnDemand`, and `showFeed` condition and
  renders `<ChannelFeedSettingsGroup …>`. Podcast, album, and artist settings look and behave the
  same.

### Credentials form

`useAddByRssCredentialsForm({ feed, onSaved })`, where `feed` is
`MobileAddByRSSFeedRecord | null` and `onSaved: () => void`. Returns `canSave`, `isSaving`,
`noticeKey`, `setNoticeKey`, `password`, `setPassword`, `username`, `setUsername`, and
`saveAndCheck: () => Promise<void>`.

- On `feed?.feedUrl` change: read `addByRssCredentialStore.getForCurrentAccount(feedUrl)` and fill
  the fields; set `features.add_by_rss.credentials_rejected` when `feed.lastAuthFailure ===
  'credentials_rejected'`. Cancel on unmount, as the screen does today.
- `saveAndCheck` is today's `handleSaveAndCheck` body, with `navigation.goBack()` replaced by
  `onSaved()`. Keep its busy ref, gate (`add_by_rss_add`), `toAddByRssCredentials`, account check,
  `Keyboard.dismiss()`, `ADD_BY_RSS_ADD_LOG_KIND`, and notice keys unchanged.
- `canSave` is `canSubmitAddByRssCredentials(username, password)`.

`AddByRssCredentialsFields` props: `form` (the hook result) and `testIDPrefix`. It renders the two
`TextField`s exactly as the screen does today (eyebrow, `misc.required` placeholder, autofill and
E2E `secureTextEntry` handling, keeping the E2E comment) with testIDs `${testIDPrefix}-username` /
`${testIDPrefix}-password`, then the notice `Text` with `${testIDPrefix}-notice`. No button; each
caller renders its own.

`AddByRssCredentialsScreen` keeps its feed load, title, URL, intro copy, remove action, and confirm
dialog. It calls the hook with `onSaved: () => navigation.goBack()` and renders
`<AddByRssCredentialsFields form={form} testIDPrefix="rss-credentials" />` plus its existing
`FormActions` save button (`disabled: isSaving || isRemoving || !form.canSave`). All
`rss-credentials-*` testIDs stay the same.

### Feed check hook

`useAddByRssFeedCheck({ feedUrl, onChecked })`, `feedUrl: string | null`,
`onChecked: () => Promise<void>`. Returns `isChecking`, `noticeKey`, and
`checkFeed: (mode: 'interactive' | 'pull') => Promise<void>`. Builds `authContext` from `useAuth`
the way the credentials screen does. Ignores a call while one is running (busy ref).

- `interactive`: decision 3, gate included. Sets `noticeKey`.
- `pull`: when not allowed, `await onChecked()` and return. When allowed, decision 3 without the
  gate; set `noticeKey` only on failure, clear it on success.

### Screen

- `loadDetail` gains `{ silent: boolean }`. Silent reloads do not set `isLoading`, keep the current
  `detail` on a failed read, and do not reset the section or settings state.
- `const feedCheck = useAddByRssFeedCheck({ feedUrl: detail?.feed.feedUrl ?? null, onChecked: () =>
  loadDetail({ silent: true }) })`.
- Pane `onRefresh` becomes `() => feedCheck.checkFeed('pull')`. `AddByRssSectionPaneProps` gains
  `refreshNoticeKey: string | null`, passed `feedCheck.noticeKey`. Episodes and Downloaded show
  `playbackNoticeKey ?? refreshNoticeKey` as the list `noticeKey`.
- While `settingsOpen`, render `<AddByRssSettingsPane detail={detail} feedCheck={feedCheck}
  onCredentialsSaved={() => void loadDetail({ silent: true })} />`.
- Drop `AddByRssCredentials` from the local `AddByRssDetailStackParamList`; plan 20 removed its
  only navigate call. Keep `AddByRssPodcastDetail`.

### `AddByRssSettingsPane`

Copy `ChannelSettingsPane`'s `ScrollView` styles and insets. Add `keyboardShouldPersistTaps=
"handled"` and `automaticallyAdjustKeyboardInsets` so the fields stay reachable above the keyboard.
`testID="add-by-rss-home-settings"`.

1. `<ChannelFeedSettingsGroup isChecking={feedCheck.isChecking} notice={feedCheck.noticeKey ===
   null ? null : t(feedCheck.noticeKey)} onCheck={() => void feedCheck.checkFeed('interactive')}
   statusLines={…decision 2…} testIDPrefix="add-by-rss-home" />`.
2. `SettingsGroup` with `title={t('features.add_by_rss.credentials_page_title')}` and
   `testID="add-by-rss-home-settings-credentials-card"`: `SettingsRowDescription`s for
   `credentials_page_device_note` and `credentials_mobile_media_note`, then
   `<AddByRssCredentialsFields testIDPrefix="add-by-rss-home-settings-credentials" />`, then
   `Button fullWidth size="form" variant="secondary"` labelled
   `features.add_by_rss.credentials_save_and_check`, `loading={form.isSaving}`,
   `disabled={!form.canSave || form.isSaving}`,
   `testID="add-by-rss-home-settings-credentials-save"`.
   The form's `onSaved` sets `features.add_by_rss.status_parsed` with `form.setNoticeKey` and calls
   `onCredentialsSaved`.

Use the gaps `ChannelSettingsPane` uses between the card's inner rows (**settings-option-density**,
**form-eyebrow-placeholder**). No new catalog keys.

### Guidance

In `.cursor/skills/add-by-rss-parity-sync/SKILL.md`, widen the description to cover `apps/mobile`
and add a short `## Mobile` section: the Add by RSS channel detail
(`screens/home/AddByRssHomeDetailScreen.tsx`) mirrors `PodcastDetailScreen` and uses
`ChannelDetailShell`, `ChannelHeader`, `MenuSelectChip` sort, and `PodcastSectionList`; chips are
the device-supported subset (no Clips, Official Clips, Podroll); Settings holds the feed check and
always-visible credentials; no share or bell. Keep the file's style and keep lines under 100
characters.

## Tests

Logic here is thin wiring over tested helpers (`credentialNoticeKeyForParse`,
`buildAddByRssParseFailureLog`, `toAddByRssCredentials`), so no new unit file. Maestro covers the
pane.

`apps/mobile/e2e/add-by-rss-credentials.yaml`, right after the
`assertVisible: id: add-by-rss-home-detail-screen` step and before the swipe:

```yaml
- tapOn:
    id: add-by-rss-home-header-settings
- assertVisible:
    id: add-by-rss-home-settings-check-feed
- assertVisible:
    id: add-by-rss-home-settings-credentials-username
- assertVisible:
    id: add-by-rss-home-settings-credentials-password
- takeScreenshot: add-by-rss-credentials-detail-settings
- tapOn:
    id: add-by-rss-home-header-settings
- assertVisible:
    id: add-by-rss-home-episode-list
```

The existing `rss-credentials-*` steps stay as they are and now exercise the extracted form.

## Release scratchpad

```markdown
## Mobile Add by RSS feed settings behind the gear

- Surfaces: mobile
- Change: The feed username and password moved off the Add by RSS channel header into Settings
  (the gear beside the title). Settings always shows both fields, filled from the copy stored on
  the device, with Save and Check. It also shows when the feed was last parsed and a Check Feed
  for Updates button. Pull-to-refresh on the episode list checks the feed too, for members who can
  refresh Add by RSS feeds. Podcast, album, and artist settings look the same as before.
- Who notices: members with password-protected feeds; anyone refreshing a feed added by RSS
- Operator steps: none
```
