**Cursor model:** Opus 5.5 · **Reasoning:** high

# 95 — Mobile: Taste Profile and Hidden From Taste Profile in Popularity Tracking settings

Mobile parity with plan 93 (the web panel is the parity source). The More › Settings › Popularity
Tracking screen gets the same two sections under its switch (R63, R64):

- **Taste Profile**: shows the listener's listening has added, newest listen first, each with a
  Remove control (R55). Remove hides the show, which deletes its taste data and moves it to the
  hidden list (R56).
- **Hidden From Taste Profile**: removed shows, newest first, each with an Unhide control (R58).
  Unhide asks whether to add the show back now or only take it off the hidden list (R59).

Opus because the list hook has overlapping requests (paging, refetch after each action, reloads
on account or consent change, token refresh) where a stale response must never win.

## Rows

R55, R56, R58, R59, R63, R64

## Runs after

71, 90, 91, 94

## Files

- `apps/mobile/src/hooks/useTasteProfileLists.ts` (new)
- `apps/mobile/src/screens/more/TasteProfileSections.tsx` (new)
- `apps/mobile/src/components/feedback/ConfirmDialog.tsx`
- `apps/mobile/src/screens/more/MoreSettingsPopularityTrackingScreen.tsx`
- `apps/mobile/e2e/taste-profile.yaml` (new)
- `scripts/mobile/e2e-test.sh`
- `apps/mobile/e2e/HOW-TO-RUN.md`
- `docs/testing/FULL-REPO-VERIFICATION-COMMANDS.md`

## Reuse

- Requests: plan 71's `ApiRequestService` methods `reqAccountTasteProfile`,
  `reqAccountTasteProfileHidden`, `reqAccountTasteProfileHide`, `reqAccountTasteProfileUnhide`,
  called through `requestWithMobileAuthRefresh(auth, (api) => api.reqAccountTasteProfile({ page, limit }))`
  as `MoreRemovedContentScreen` and `MoreSettingsPopularityTrackingScreen` do
  (**mobile-react-native**: account-only lists call the API directly, not SQLite).
- Paging: plan 90's `fetchTasteProfilePages`, `appendTasteProfilePage`, `TasteProfileRows` and
  `TASTE_PROFILE_PAGE_LIMIT` from `@podverse/helpers`.
- Rows: `ListRow` + `CoverImage` with the top-hairline row wrapper from
  `apps/mobile/src/screens/podcast/sections/PodcastPodrollSection.tsx`. Its
  `createContentListRowStyles` (hairline `borderTop` through `useThemedStyles`) and its square
  cover style are file-local there, as they are in `ArtistDetailScreen` and `AlbumDetailScreen`;
  copy both into `TasteProfileSections.tsx` the same way. Artwork URL from `primaryChannelListArtworkUrl(channel.channel_images)`
  (`@podverse/helpers`); `CoverImage` takes `uri: string | null | undefined`, so pass it as is.
  Pass `decodeEdge={LIST_ROW_ARTWORK_SIZE}` (**mobile-image-loading**), as `ArtistDetailScreen` does.
- Section heading: `SectionHeading` (`apps/mobile/src/components/section/SectionHeading.tsx`).
- States: `LoadingSection`, `RetryableError` (`errorKey` + `onRetry`), `Button`.
- Dialog: `ConfirmDialog`, extended below.
- Copy: plan 90's `taste_profile.*` keys, `misc.cancel`, `misc.untitled`.
- Dates: `formatDateAbbrev(value, i18n.language)` from `@podverse/helpers`, as
  `MoreMembershipScreen` does.

## Hook — `apps/mobile/src/hooks/useTasteProfileLists.ts`

The same contract as plan 93's web hook, so the two clients behave the same:

```typescript
export type TasteProfileListState<Row> =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: TasteProfileRows<Row>; loadingMore: boolean; loadMoreFailed: boolean };

export type UseTasteProfileListsResult = {
  profile: TasteProfileListState<DTOAccountTasteProfileRow>;
  hidden: TasteProfileListState<DTOAccountTasteProfileHiddenRow>;
  pendingChannelIds: ReadonlySet<string>;
  actionFailed: boolean;
  retry: () => void;
  loadMoreProfile: () => void;
  loadMoreHidden: () => void;
  hideShow: (channelIdText: string) => Promise<void>;
  unhideShow: (channelIdText: string, addToTasteProfile: boolean) => Promise<void>;
};

export function useTasteProfileLists(): UseTasteProfileListsResult;
```

Rules:

1. **Auth.** Read `accessToken`, `account`, `clearSession`, `refreshToken`, `setTokens` from
   `useAuth()`. Keep the four auth values in an `authRef` updated every render, and build the
   `requestWithMobileAuthRefresh` argument from it. A token refresh changes those values and must
   not reload the lists.
2. **Reload key.** `` `${account?.id_text}|${account?.account_settings?.listen_stats_accepted}|${account?.account_settings?.listen_stats_agreement_version}` ``.
   When it changes, or `retry()` runs: set both lists to `loading`, clear `pendingChannelIds` and
   `actionFailed`, and fetch page 1 of each with `fetchTasteProfilePages(fetchPage, 1)`. With
   `account === null`, both lists stay `loading` and nothing is fetched. State lives only in this
   hook, so a sign-out or account switch cannot show the previous account's rows
   (**mobile-account-scoped-data**).
3. **Stale responses.** A `generationRef` bumped on every reload and on unmount, and a per-list
   `requestSeqRef` bumped on every request to that list. Apply a response only when both still
   match their values at request start.
4. **Load more.** Only when `ready`, `hasMore`, and not `loadingMore`. Set
   `loadingMore: true, loadMoreFailed: false`, request page `data.loadedPages + 1`, then
   `appendTasteProfilePage`; on failure keep the rows with `loadMoreFailed: true`.
5. **Hide and unhide.** Ignore an id already in `pendingChannelIds`. Add it, set `actionFailed`
   false, await the request; on rejection `console.warn('[useTasteProfileLists] action failed', error)`
   and set `actionFailed` true. In `finally`, remove the id and refetch both lists with
   `fetchTasteProfilePages(fetchPage, loadedPages)` (current `data.loadedPages`, or 1 when not
   `ready`). Current rows stay on screen until the refetch lands; a refetch failure sets that list
   to `error`.
6. Callbacks read list state through refs and are stable (`useCallback`).
7. Every request uses `limit: TASTE_PROFILE_PAGE_LIMIT`.

## Sections — `apps/mobile/src/screens/more/TasteProfileSections.tsx`

`export function TasteProfileSections()`. Calls `useTasteProfileLists()` once. Layout follows
**mobile-screen-layout**: each section is a `SectionHeading`, a description in `typography.body`
with `themeStyles.textSecondary.color`, then unboxed rows. `marginTop: settingsCardGap(tokens.spacing)`
above each section; `gap: settingsCardInnerGap(tokens.spacing)` between heading, description and
list.

```tsx
<View>
  <View style={styles.section} testID="taste-profile-section">
    <SectionHeading>{t('taste_profile.title')}</SectionHeading>
    <Text style={styles.description}>{t('taste_profile.description')}</Text>
    {/* action error, then list body for `profile` */}
  </View>
  <View style={styles.section} testID="taste-profile-hidden-section">
    <SectionHeading>{t('taste_profile.hidden_title')}</SectionHeading>
    <Text style={styles.description}>{t('taste_profile.hidden_description')}</Text>
    {/* list body for `hidden` */}
  </View>
  <ConfirmDialog … />
</View>
```

List body, per list (`<p>` prefix is `taste-profile` for the profile list and
`taste-profile-hidden` for the hidden list):

| State | Renders | testID |
| --- | --- | --- |
| `loading` | `LoadingSection` | `<p>-loading` |
| `error` | `RetryableError` with `errorKey` `taste_profile.load_error` (hidden: `taste_profile.hidden_load_error`), `onRetry={retry}` | `<p>-error` |
| `ready`, no rows | `Text` in `typography.body`, `t('taste_profile.empty')` (hidden: `hidden_empty`) | `<p>-empty` |
| `ready`, rows | the rows, then the load-more error and button below | rows below |

Under the rows: when `loadMoreFailed`, a `Text` with `t('taste_profile.load_more_error')`
(`<p>-load-more-error`); when `hasMore`, a `Button` with `label={t('taste_profile.load_more')}`,
`loading={loadingMore}`, `variant="secondary"`, `size="form"`, `fullWidth`, `onPress` the list's
load more, `testID="<p>-load-more"`.

Above the profile list body, when `actionFailed`: a `Text` with `t('taste_profile.action_error')`,
`testID="taste-profile-action-error"` (**mobile-surface-async-errors**: async failures show in
the UI with a testID).

Row (local `TasteProfileShowRow`, wrapped in a `View` with the top-hairline style):

- `ListRow` with `title` = trimmed `channel.title`, or `t('misc.untitled')` when null or empty;
  `leading` = the `CoverImage` above, `opensViewer={false}`, square `LIST_ROW_ARTWORK_SIZE`;
  `subtitle` = `t('taste_profile.last_listened', { date: formatDateAbbrev(row.last_listened_at, i18n.language) })`,
  or `t('taste_profile.added_back')` when `last_listened_at` is null; hidden rows
  `t('taste_profile.hidden_on', { date: formatDateAbbrev(row.hidden_at, i18n.language) })`.
  No `onPress`: rows are not links, matching web.
- `trailing` = `Button` with `size="sm"`, `variant="secondary"`,
  `disabled={pendingChannelIds.has(id_text)}`:
  - Taste Profile: `label={t('taste_profile.remove')}`,
    `accessibilityLabel={t('taste_profile.remove_accessible', { title })}`,
    `testID={\`taste-profile-remove-${id_text}\`}`, `onPress` → `void hideShow(id_text)`.
  - Hidden: `label={t('taste_profile.unhide')}`,
    `accessibilityLabel={t('taste_profile.unhide_accessible', { title })}`,
    `testID={\`taste-profile-unhide-${id_text}\`}`, `onPress` opens the unhide dialog for the row.
- Row testIDs: `taste-profile-row-${id_text}` and `taste-profile-hidden-row-${id_text}` on the
  `ListRow`.
- Wrap the row in `memo` (**mobile-row-render-cost**). The one dialog lives in the section
  component, never per row.

Rows render as a mapped array inside the screen's `ScrollView`; there is no nested list. Paging
keeps the count bounded by what the listener asks for.

Unhide dialog state: `unhideTarget: { idText: string; title: string } | null` and
`unhideVisible: boolean`. Opening sets both; closing sets only `unhideVisible` false so the copy
does not blank out during the fade. Render once, unconditionally:

```tsx
<ConfirmDialog
  body={t('taste_profile.unhide_dialog_body', { title: unhideTarget?.title ?? '' })}
  cancelLabel={t('misc.cancel')}
  cancelTestID="taste-profile-unhide-dialog-cancel"
  confirmLabel={t('taste_profile.unhide_add_back')}
  confirmTestID="taste-profile-unhide-dialog-add-back"
  onCancel={closeUnhide}
  onConfirm={() => { closeUnhide(); void unhideShow(idText, true); }}
  onSecondaryConfirm={() => { closeUnhide(); void unhideShow(idText, false); }}
  secondaryConfirmLabel={t('taste_profile.unhide_remove_only')}
  secondaryConfirmTestID="taste-profile-unhide-dialog-remove-only"
  testID="taste-profile-unhide-dialog"
  title={t('taste_profile.unhide_dialog_title')}
  visible={unhideVisible}
/>
```

(`idText` read from `unhideTarget`; do nothing when it is null.)

## `ConfirmDialog.tsx` — optional second confirm action

Plan 94 added `confirmVariant`. Add three optional props after `confirmTestID`:
`secondaryConfirmLabel?: string`, `onSecondaryConfirm?: () => void`,
`secondaryConfirmTestID?: string`. Build `secondaryAction` only when all three are defined, with
`variant: 'secondary'`. Actions become `[confirm, secondary, cancel]`, dropping whichever is
undefined; the confirm-first order stays (**mobile-screen-layout** § the `ConfirmDialog`
exception). Update the component's doc comment to mention the optional second action. Existing
callers do not change.

## `MoreSettingsPopularityTrackingScreen.tsx`

Import `TasteProfileSections` from `./TasteProfileSections` and render
`{account !== null ? <TasteProfileSections /> : null}` after the `!reviewing && infoOpen`
disclosure block and before plan 94's `ConfirmDialog`. When the listener opts out, the account's
consent fields change, the hook reloads, and both sections show their empty copy.

## Tests

New `apps/mobile/e2e/taste-profile.yaml`. It changes nothing on the server: parallel iOS and
Android slots share one database, so hide and unhide coverage lives in plan 93's web spec. Login
goes through the real form with the dedicated account, as `shared/login-seeded-user-ui.yaml`
does for `e2e-user` (the quick-login row has no slot for this account):

```yaml
appId: com.podverse.app.next
name: Taste Profile
---
# Seeded e2e-taste-profile account: two Taste Profile shows (the podcast is newest) and one
# hidden artist. Read-only on the server, because parallel slots share one database.

- runFlow: shared/launch-and-connect.yaml

- tapOn:
    id: tab-more
- assertVisible:
    id: more-screen
- tapOn:
    id: anonymous-login-cta
- assertVisible:
    id: login-screen
- tapOn:
    id: login-email
- inputText: e2e-taste-profile@example.com
- tapOn:
    id: login-password
- inputText: "Test!1Aa"
- runFlow:
    when:
      platform: Android
    commands:
      - hideKeyboard
- tapOn:
    id: login-submit
- extendedWaitUntil:
    visible:
      id: tab-home
    timeout: ${TIMEOUT_SLOW}

- tapOn:
    id: tab-more
- tapOn:
    id: more-settings
- tapOn:
    id: more-settings-popularity-tracking
- assertVisible:
    id: more-settings-popularity-tracking-screen
- scrollUntilVisible:
    element:
      id: taste-profile-row-e2ePodChnl001
    direction: DOWN
    timeout: ${TIMEOUT_SLOW}
- assertVisible:
    id: taste-profile-row-e2eVideoChnl01
- takeScreenshot: taste-profile-list

- scrollUntilVisible:
    element:
      id: taste-profile-hidden-row-e2eArtPub01
    direction: DOWN
    timeout: ${TIMEOUT_SLOW}
- takeScreenshot: taste-profile-hidden-list

- tapOn:
    id: taste-profile-unhide-e2eArtPub01
- extendedWaitUntil:
    visible:
      id: taste-profile-unhide-dialog
    timeout: ${TIMEOUT_FAST}
- assertVisible:
    id: taste-profile-unhide-dialog-add-back
- assertVisible:
    id: taste-profile-unhide-dialog-remove-only
- takeScreenshot: taste-profile-unhide-dialog
- tapOn:
    id: taste-profile-unhide-dialog-cancel
- assertNotVisible:
    id: taste-profile-unhide-dialog
- assertVisible:
    id: taste-profile-hidden-row-e2eArtPub01
```

The seed ids are plan 91's: `E2E_PODCAST_CHANNEL_ID_TEXT` (`e2ePodChnl001`),
`E2E_VIDEO_CHANNEL_ID_TEXT` (`e2eVideoChnl01`), `E2E_DIRECTORY_ARTIST_ID_TEXT` (`e2eArtPub01`).

Register the flow:

- `scripts/mobile/e2e-test.sh`, `flow_needs_e2e_api`: add `taste-profile` to the case list
  after `tablet` (on the `subscriptions-anonymous | tab-switch-playback | tablet | …` line).
- `apps/mobile/e2e/HOW-TO-RUN.md`: add `npm run mobile:e2e:test -- --platform ios taste-profile`
  after the iOS `tab-switch-playback` line, the matching Android line after the Android
  `tab-switch-playback` line, and `npm run mobile:e2e:test -- taste-profile` after
  `npm run mobile:e2e:test -- subscriptions-anonymous` in the both-platforms list.
- `docs/testing/FULL-REPO-VERIFICATION-COMMANDS.md`: add `npm run mobile:e2e:test -- taste-profile`
  after `npm run mobile:e2e:test -- tab-switch-playback`.

No unit test: the paging rules are plan 90's helper tests, and the hook is request wiring
(**mobile-test-economics**).

## Release scratchpad

```markdown
## Mobile Popularity Tracking settings show the Taste Profile and Hidden From Taste Profile

- Surfaces: mobile
- Change: More > Settings > Popularity Tracking has two new sections under the switch, matching
  web Settings. Taste Profile lists the shows the listener's listening has added, newest listen
  first, with the last-listened date and a Remove button. Remove deletes that show's listening
  data from the Taste Profile and moves it to Hidden From Taste Profile, where later listens no
  longer add it. Each hidden show has an Unhide button that asks whether to add it back now or
  only take it off the hidden list. Both lists page with Load More and are empty after
  Popularity Tracking is turned off.
- Who notices: signed-in mobile listeners who use Popularity Tracking
- Operator steps: none
```
