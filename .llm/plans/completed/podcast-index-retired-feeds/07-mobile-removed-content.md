# 07 — Mobile Removed Content

**Cursor model:** Opus 5.5 · **Reasoning:** high

## Summary

More, Advanced, gains Removed Content beside Error Log. A signed-in archived-410 drop does
not also write the local Error Log line. Decisions: 00-SUMMARY 12. Copy is in the mobile
catalog from 01. The seed row is from 05.

Depends on 05. Can run beside 06. Do not edit catalogs, seed, web, or the API.

## Navigation

Follow `MoreErrorLog` in `apps/mobile/src/navigation/index.tsx`.

- Route name `MoreRemovedContent`, path `more/advanced/removed-content`.
- Param list entry `undefined`.
- Stack screen `MoreRemovedContentScreen`.

`apps/mobile/src/screens/more/MoreAdvancedScreen.tsx`: a third menu row after Error Log.

- Title `t('removed_content.title')`.
- Subtitle `t('removed_content.menu_subtitle')`.
- `testID` `more-advanced-removed-content`.
- Navigates to `MORE_STACK_ROUTES.MoreRemovedContent`.

## Screen

`apps/mobile/src/screens/more/MoreRemovedContentScreen.tsx`.

Load with the `helpers-requests` function from 05, using the signed-in request context the
notification inbox uses. `FlatList` of rows. `ListEmpty` for the empty key. A loading state
and a load-error state. If the mobile catalog has no load-error sentence that fits, add
`removed_content.load_error` (`Could not load removed content.`) in all four mobile
originals. That is the only catalog edit allowed.

Row text matches 06, using the mobile keys from 01:

- reason sentence, title or `unknown_show`
- follow sentence only when `follow_outcome` is set
- clip and playlist sentences only when the count is above 0

Rows are not tappable. Each row's accessibility label is the sentences joined. `testID`
`removed-content-screen` on the screen, `removed-content-empty` on the empty state, and
`removed-content-row` on each row.

Follow **mobile-list-virtualization**, **mobile-screen-layout**, **even-content-spacing**,
and **screen-reader-accessibility**. Reset the list when the account changes.

## Signed-in Error Log skip

`apps/mobile/src/data/repositories/directoryChannelGone.ts`, in
`dropGoneDirectoryChannel`. The unsubscribe stays. Call `syncEventLogRepository.append` for
`DIRECTORY_CHANNEL_GONE_CODE` only when `params.context.accessToken === null`. A signed-in
drop is explained by the server log. A signed-out drop still gets the local line, because
that user cannot open Removed Content.

Add a unit test beside the repository if a test file already covers this function. If none
does, add a focused test that the append is skipped when `accessToken` is a non-empty
string and still called when it is null. Mock the repositories. Do not boot a simulator.

## Maestro

`apps/mobile/e2e/removed-content-log.yaml`. Copy the More, Advanced navigation from
`apps/mobile/e2e/error-log.yaml` (`tab-more`, scroll to `more-nav-advanced`,
`more-advanced-screen`). Start with `shared/login-seeded-user.yaml`, as
`settings-downloads.yaml` does. This flow calls the API.

- Add `removed-content-log` to `flow_needs_e2e_api` in `scripts/mobile/e2e-test.sh`.
- After login, open the new row `more-advanced-removed-content`.
- Assert `removed-content-screen` and the seeded channel title from
  `apps/mobile/src/lib/e2e/e2eSeedConstants.ts`.
- Screenshot `removed-content-row`.

Comment at the top of the yaml: the flow needs the E2E API and the seeded log row. Do not
cite a plan number.

## Scratchpad

```markdown
## Mobile Removed Content screen

- Surfaces: mobile
- Change: More, Advanced, Removed Content lists the signed-in account's removed shows.
  A signed-in archived-show drop no longer writes directory_channel_gone to the local
  Error Log. Signed-out drops still do.
- Who notices: signed-in mobile users who open More, Advanced
- Operator steps: none
```

## Done when

- The menu row sits after Error Log.
- Signed-in `dropGoneDirectoryChannel` does not append `directory_channel_gone`.
- Comments do not cite a plan or a step number.

## Operator verification

**Mobile** (one-shots):

```bash
npm run type-check:mobile
npm --prefix apps/mobile run test
make mobile_e2e_seed
```

**Mobile Maestro.** Mobile E2E Metro, Mobile E2E API, and Mobile E2E iOS / Mobile E2E
Android are already running. Do not paste those leave-running commands here.

```bash
npm run mobile:e2e:test -- removed-content-log
open .artifacts/mobile-e2e-reports/latest/failures.json
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
```
