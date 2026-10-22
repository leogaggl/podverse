**Cursor model:** Opus 5.5 · **Reasoning:** high

# 93 — Web: Taste Profile and Hidden From Taste Profile in Settings

Two new sections on the web Settings Account tab, right under the Popularity Tracking switch
(R63, R64):

- **Taste Profile** lists the shows the listener's listening has added, newest listen first. Each
  row has a Remove control (R55). Remove calls plan 71's hide endpoint, which deletes the show's
  taste data and puts it on the hidden list (R56).
- **Hidden From Taste Profile** lists removed shows, newest first (R58). Each row has an Unhide
  control. Unhide asks whether to add the show back now or only take it off the hidden list
  (R59).

This web panel is the parity source for mobile (plan 95). Opus because the list hook has
overlapping requests: paging, refetch after each action, and reloads when the account or its
consent changes. Stale responses must never overwrite newer ones.

## Rows

R55, R56, R58, R59, R63, R64

## Runs after

71, 90, 91, 92

## Files

- `apps/web/src/hooks/useTasteProfileLists.ts` (new)
- `apps/web/src/components/Settings/Panels/SettingsAccount/SettingsTasteProfile.tsx` (new)
- `apps/web/src/components/Settings/Panels/SettingsAccount/ModalTasteProfileUnhide.tsx` (new)
- `apps/web/src/styles/components/Settings/Panels/SettingsAccount/SettingsTasteProfile.module.scss` (new)
- `apps/web/src/styles/components/Modal/ModalTasteProfileUnhide.module.scss` (new)
- `apps/web/src/components/Settings/Panels/SettingsAccount/SettingsAccount.tsx`
- `apps/web/e2e/settings-taste-profile.spec.ts` (new)

## Reuse

- Requests: plan 71's `getApiRequestService().reqAccountTasteProfile({ page, limit })`,
  `.reqAccountTasteProfileHidden({ page, limit })`, `.reqAccountTasteProfileHide({ channel_id_text })`
  and `.reqAccountTasteProfileUnhide({ channel_id_text, add_to_taste_profile })`. DTO types
  `DTOAccountTasteProfileRow` and `DTOAccountTasteProfileHiddenRow` from `@podverse/helpers`.
- Paging: plan 90's `fetchTasteProfilePages`, `appendTasteProfilePage`, `TasteProfileRows` and
  `TASTE_PROFILE_PAGE_LIMIT` from `@podverse/helpers`.
- Section shell and states: `SettingsRemovedContent.tsx` (a `SettingsSection` with an `h3`,
  `LoadingSpinner`, a `role="alert"` error paragraph, a status paragraph for empty).
- Row look: `ContentPodrollItemRow.tsx` (`SkeletonFlashImage` with
  `buildDTOChannelImageLoadCandidates(channel.channel_images, IMAGES.PODROLL.SQUARE.SIZE_FIND_TARGET, 'greater')`,
  `IMAGES.PODROLL.SQUARE.SIZE` for width and height, a title over a secondary subtitle).
- Modal: `ModalDeleteAccount.tsx` and plan 92's `ModalPopularityTrackingOptOut.tsx`.
- Dates: `formatDateAbbrev(value, locale)` from `@podverse/helpers` with `useLocale()`.
- Copy: plan 90's `taste_profile.*` keys; `misc.cancel`, `misc.close_modal`, `misc.loading`,
  `misc.untitled`, `popularity_tracking.retry`.

## Hook — `apps/web/src/hooks/useTasteProfileLists.ts`

```typescript
export type TasteProfileListState<Row> =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: TasteProfileRows<Row>; loadingMore: boolean; loadMoreFailed: boolean };

export type UseTasteProfileListsResult = {
  profile: TasteProfileListState<DTOAccountTasteProfileRow>;
  hidden: TasteProfileListState<DTOAccountTasteProfileHiddenRow>;
  /** `channel.id_text` values with a hide or unhide in flight. */
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

1. **Reload key.** Read `loggedInAccount` from `useAccount()`. The key is
   `` `${id_text}|${account_settings?.listen_stats_accepted}|${account_settings?.listen_stats_agreement_version}` ``.
   When the key changes (sign-in, account switch, opt-out, a new Yes) or `retry()` runs: set both
   lists to `loading`, clear `pendingChannelIds` and `actionFailed`, and fetch page 1 of each with
   `fetchTasteProfilePages(fetchPage, 1)`. With no account, both lists stay `loading` and nothing
   is fetched. After an opt-out the server returns empty lists, so the sections show their empty
   copy.
2. **Stale responses.** Keep a `generationRef` that every reload increments, and a per-list
   `requestSeqRef` that every request to that list increments (reload, load more, refetch). A
   response updates state only when both values still match what they were when it started.
   Unmount bumps the generation so nothing sets state afterwards.
3. **Load more.** Only when the list is `ready`, `hasMore` is true and `loadingMore` is false. Set
   `loadingMore: true, loadMoreFailed: false`; request page `data.loadedPages + 1`; on success
   `appendTasteProfilePage(data, page, pageNumber)` with `loadingMore: false`; on failure keep the
   rows and set `loadingMore: false, loadMoreFailed: true`.
4. **Hide and unhide.** Ignore a call whose id is already in `pendingChannelIds`. Otherwise add
   the id, set `actionFailed` false, and await the request. On a rejection, log with
   `console.error('[useTasteProfileLists] action failed', error)` and set `actionFailed` true. In
   `finally`, remove the id and refetch **both** lists, each with
   `fetchTasteProfilePages(fetchPage, loadedPages)` where `loadedPages` is the list's current
   `data.loadedPages` (1 when not `ready`). A refetch keeps the current rows on screen until it
   lands; a refetch failure sets that list to `error`. Refetching after a failure too keeps the
   screen right when the failure was a 404 because another device already changed the show.
5. Read the current list state through refs inside the callbacks, so the callbacks stay stable
   (`useCallback` with ref reads) and never act on a stale closure.
6. Every request uses `limit: TASTE_PROFILE_PAGE_LIMIT`.

## Section component — `SettingsTasteProfile.tsx`

`export function SettingsTasteProfile()`. `t = useTranslations('taste_profile')`,
`tMisc = useTranslations('misc')`, `tPopularity = useTranslations('popularity_tracking')`,
`locale = useLocale()`. Calls `useTasteProfileLists()` once and renders:

```tsx
<>
  <SettingsSection>
    <section aria-labelledby="settings-taste-profile-heading">
      <h3 className={styles.heading} id="settings-taste-profile-heading">{t('title')}</h3>
      <p className={styles.description}>{t('description')}</p>
      {/* list body for `profile` */}
    </section>
  </SettingsSection>
  <Divider withSpacing />
  <SettingsSection>
    <section aria-labelledby="settings-taste-profile-hidden-heading">
      <h3 className={styles.heading} id="settings-taste-profile-hidden-heading">{t('hidden_title')}</h3>
      <p className={styles.description}>{t('hidden_description')}</p>
      {/* list body for `hidden` */}
    </section>
  </SettingsSection>
  <ModalTasteProfileUnhide … />
</>
```

List body, per list:

- `loading`: `<LoadingSpinner ariaLabel={tMisc('loading')} size="medium" />`.
- `error`: `<p className={styles.status} role="alert">{t('load_error')}</p>` (hidden list:
  `t('hidden_load_error')`) and a `<Button type="button" variant="secondary" onClick={retry}>`
  labeled `tPopularity('retry')`.
- `ready` with no rows: `<p className={styles.status}>{t('empty')}</p>` (hidden: `t('hidden_empty')`).
- `ready` with rows: `<ul className={styles.rows}>` of rows (below), keyed by `channel.id_text`.
  Under it, when `loadMoreFailed`: `<p className={styles.status} role="alert">{t('load_more_error')}</p>`.
  When `hasMore`: `<Button type="button" variant="secondary" isLoading={loadingMore} onClick={loadMore…}>{t('load_more')}</Button>`.

Above the profile list, when `actionFailed`:
`<p className={styles.status} role="alert">{t('action_error')}</p>`. One message covers both
lists; render it only in the Taste Profile section.

Row (a local `TasteProfileShowRow` component in the same file):

- `<li className={styles.row}>` containing the artwork, a text column, and one button.
- Title: `channel.title` trimmed, or `tMisc('untitled')` when null or empty.
- Artwork: `SkeletonFlashImage` as in `ContentPodrollItemRow`, `alt={title}`.
- Subtitle: Taste Profile rows show
  `t('last_listened', { date: formatDateAbbrev(row.last_listened_at, locale) })`, or
  `t('added_back')` when `last_listened_at` is null. Hidden rows show
  `t('hidden_on', { date: formatDateAbbrev(row.hidden_at, locale) })`.
- Button: `variant="secondary"`, `disabled={pendingChannelIds.has(id_text)}`. Taste Profile rows:
  label `t('remove')`, `aria-label={t('remove_accessible', { title })}`, `onClick` →
  `void hideShow(id_text)`. Hidden rows: label `t('unhide')`,
  `aria-label={t('unhide_accessible', { title })}`, `onClick` opens the unhide modal for that row.
- Rows are not links. The listener manages the list here; mobile has no show detail screen in its
  More stack, and both clients match (Removed Content rows are text too).

Unhide modal state in `SettingsTasteProfile`:
`const [unhideTarget, setUnhideTarget] = useState<{ idText: string; title: string } | null>(null);`.
Choosing either action closes the modal first, then calls `void unhideShow(idText, true | false)`.

## Modal — `ModalTasteProfileUnhide.tsx`

```tsx
type ModalTasteProfileUnhideProps = {
  target: { idText: string; title: string } | null;
  onCancel: () => void;
  onRemoveOnly: () => void;
  onAddBack: () => void;
};
export function ModalTasteProfileUnhide(props: ModalTasteProfileUnhideProps)
```

`<Modal isOpen={target !== null} onClose={onCancel} closeButtonAriaLabel={tMisc('close_modal')}
header={t('unhide_dialog_title')} ariaLabel={t('unhide_dialog_title')}>`, then `Modal.Body` with
`<p className={styles.message}>{t('unhide_dialog_body', { title: target?.title ?? '' })}</p>`
and `Modal.Actions` with, in DOM order: Cancel (`variant="secondary"`, `tMisc('cancel')`),
`t('unhide_remove_only')` (`variant="secondary"`), `t('unhide_add_back')` (`variant="primary"`).
`ModalTasteProfileUnhide.module.scss` copies `ModalDeleteAccount.module.scss`.

## Styles — `SettingsTasteProfile.module.scss`

New folder `apps/web/src/styles/components/Settings/Panels/SettingsAccount/`. Tokens only, no
`var()` fallbacks (**css-custom-properties-no-var-fallbacks**):

- `.heading` and `.rows` and `.status`: copy from `SettingsRemovedContent.module.scss`.
- `.description`: `color: var(--text-color-secondary); margin: 0 0 var(--spacing-base);`.
- `.row`: `display: flex; align-items: center; gap: var(--spacing-lg);`.
- `.image`: `flex: 0 0 auto; width: 64px; height: 64px;` (matches `IMAGES.PODROLL.SQUARE.SIZE`).
- `.text`: `display: flex; flex: 1; flex-direction: column; gap: 0.375rem; min-width: 0;`.
- `.title`: `@include line-clamp(1); font-size: var(--font-size-md);` with
  `@use '../../../../mixins/lineClamp' as *;` at the top of the file (`apps/web/src/styles/mixins/`
  is four levels up; `ContentPodrollItemRow.module.scss` uses three from one level higher).
- `.subtitle`: `font-size: var(--font-size-sm); color: var(--text-color-secondary);`.

## `SettingsAccount.tsx`

Import `SettingsTasteProfile` next to `SettingsListenStats` and render it right after
`<SettingsListenStats />`, followed by its own divider:

```tsx
<SettingsListenStats />
<Divider withSpacing />
<SettingsTasteProfile />
<Divider withSpacing />
```

The existing `<Divider withSpacing />` after `SettingsListenStats` becomes the first of these two.

## Tests

New `apps/web/e2e/settings-taste-profile.spec.ts`, `test.describe.configure({ mode: 'serial' })`,
modeled on `popularity-tracking-consent.spec.ts` (`loginViaApi`, `capturePageLoad`,
`actionAndCapture`). Log in with `E2E_TASTE_PROFILE_EMAIL` / `E2E_TASTE_PROFILE_PASSWORD` from
`./helpers/legalConsent`; titles from `./helpers/seedConstants` (`E2E_PODCAST_CHANNEL_TITLE`,
`E2E_VIDEO_CHANNEL_TITLE`, `E2E_DIRECTORY_ARTIST_TITLE`). Each test starts with
`page.goto('/settings?tab=account')`. Locators:
`page.getByRole('region', { name: 'Taste Profile', exact: true })` and
`page.getByRole('region', { name: 'Hidden From Taste Profile', exact: true })`. Full-sentence
names (**e2e-readability**); pass the verified element to the capture helpers.

1. "When the Taste Profile request fails, the section shows an error and Try Again reloads it."
   Abort the first matching request with
   `page.route((url) => url.pathname.endsWith('/account/taste-profile'), (route) => route.abort(), { times: 1 })`
   before `goto`. Expect the alert `Could not load your Taste Profile. Please try again.`; click
   `Try Again`; expect the podcast title in the Taste Profile region.
2. "When an account has a Taste Profile, Settings lists its shows newest first and its hidden
   shows." Expect the Taste Profile region's first `listitem` to contain the podcast title and
   `Last Listened:`, its second to contain the video title, and the Hidden region to contain the
   artist title and `Hidden:`. No `Load More` button in either region.
3. "Removing a show moves it to Hidden From Taste Profile." Click
   `Remove E2E Podcast Seed Channel From Taste Profile` (build the name from the constant). Expect
   the podcast title gone from the Taste Profile region and present in the Hidden region.
4. "Unhide asks first, and Only Remove From Hidden List takes the show off both lists." Click
   `Unhide <artist title>`; expect `getByRole('dialog', { name: 'Unhide Show' })` with three
   buttons `Cancel`, `Only Remove From Hidden List`, `Add to Taste Profile`; capture it; click
   `Only Remove From Hidden List`. Expect the artist title in neither region.
5. "Add to Taste Profile puts the show back at the top with no listens yet." Click
   `Unhide <podcast title>`, then `Add to Taste Profile`. Expect the Taste Profile region's first
   `listitem` to contain the podcast title and `Added back. No listens since.`, and the Hidden
   region to show `No hidden shows.`.
6. "Turning Popularity Tracking off asks first and then empties both lists." Click the
   `Popularity Tracking` switch, then `Turn Off and Delete` in the
   `Turn Off Popularity Tracking?` dialog. Expect the Taste Profile region to show
   `No shows yet. Shows appear here after you listen with Popularity Tracking on.` and the Hidden
   region `No hidden shows.`.

The spec changes only the dedicated taste account, which the make targets reseed before each run.
`makefiles/local/e2e-spec-order-web.txt` lists a few early specs only and does not list
`popularity-tracking-consent.spec.ts`; do not add this spec there either.

## Release scratchpad

```markdown
## Web Settings shows the Taste Profile and Hidden From Taste Profile

- Surfaces: web
- Change: the Settings Account tab has two new sections under Popularity Tracking. Taste Profile
  lists the shows the listener's listening has added, newest listen first, with the last-listened
  date and a Remove button. Remove deletes that show's listening data from the Taste Profile and
  moves it to Hidden From Taste Profile, where later listens no longer add it. Each hidden show has
  an Unhide button that asks whether to add it back now or only take it off the hidden list so a
  later listen adds it again. Both lists page with Load More and are empty after Popularity
  Tracking is turned off.
- Who notices: signed-in web listeners who use Popularity Tracking
- Operator steps: none
```
