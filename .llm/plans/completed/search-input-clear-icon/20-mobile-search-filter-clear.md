**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 20 — X inside mobile search and list filter fields

## Rows

R4, R5, R7, R9, R11, R13, R14, R19, R20, R21, R22

## Runs after

10

## Files

- apps/mobile/src/components/form/TextField.tsx
- apps/mobile/src/components/form/SearchField.tsx
- apps/mobile/src/components/form/ListFilterField.tsx
- apps/mobile/src/screens/search/SearchScreen.tsx
- apps/mobile/src/screens/home/HomeScreen.tsx
- apps/mobile/src/screens/podcast/PodcastDetailScreen.tsx
- apps/mobile/src/screens/home/AddByRssHomeDetailScreen.tsx
- apps/mobile/src/screens/rss/AddByRssRootScreen.tsx
- apps/mobile/e2e/home.yaml
- apps/mobile/e2e/search.yaml
- packages/i18n-catalog/consumer/originals/en-US.json
- packages/i18n-catalog/consumer/originals/es.json
- packages/i18n-catalog/consumer/originals/fr.json
- packages/i18n-catalog/consumer/originals/el-GR.json
- .cursor/rules/mobile-screen-layout.mdc
- .cursor/skills/mobile-reusable-components/SKILL.md
- release-notes/scratchpad.md

## Tests

No new unit test. Mobile has no React Native render harness, and the claim is that the X is in the accessibility tree, that a tap empties the field, and that the field stays focused so the next text does not need another tap. That belongs on Maestro.

Update `apps/mobile/e2e/home.yaml` and `apps/mobile/e2e/search.yaml` as specified below. Do not add a new flow file.

`home.yaml` covers `ListFilterField` (the X hidden, then shown, then hidden again, and the existing tap on `home-filter-clear`). The Episodes double-tap stays, with the comment updated, because the X leaves the keyboard up. `search.yaml` covers `SearchField` the same way, including the debounced result list going away, and types again without tapping the field, which is the check that focus held. One flow per component is enough. The tree is the same on both platforms, so the flows do not need a platform split inside the YAML.

Leave these flows alone. Their ids are not this control, or the existing steps still hold once the keyboard stays up:

- `apps/mobile/e2e/subscriptions-anonymous.yaml` already taps `home-filter-clear`, then runs `hideKeyboard` before the tab tap. The id stays. `hideKeyboard` is what dismisses the keyboard the X left up. Do not remove it, and do not add a second tap of the field.
- `apps/mobile/e2e/make-clip.yaml` (`make-clip-clear-end-time`) is a clip time control. Its label is mobile `misc.clear`, which this plan keeps.
- `apps/mobile/e2e/library-downloads.yaml` (`library-downloads-clear-finished`) is a downloads action.
- `apps/mobile/e2e/browse.yaml` asserts `browse-filter-input` is absent. Browse has no text filter.
- `apps/mobile/e2e/podcast-episode.yaml` and `apps/mobile/e2e/detail-sort-prefs.yaml` assert `podcast-detail-filter-input`. That input id stays.

Deleting the two consumer keys has no new test file. The set's `npm run i18n:compile` then `npm run i18n:validate` is what checks the catalogs. Do not run either command in this plan.

## Release scratchpad

Append this entry at the end of `release-notes/scratchpad.md`. Do not edit any other entry. When the implementation prompt says to put the entry in the final message instead of writing the file, follow the prompt and do not touch the file.

```markdown
## Mobile search and list filters clear from an X inside the field

- Surfaces: mobile
- Change: Search and list-filter fields show an X at the right edge of the pill while the field has text. Pressing it empties the field through the same change handler as typing and leaves the field focused so the keyboard stays up. A screen reader hears Clear Search on Search and Clear Filter on a list filter. The separate Clear button beside a list filter is gone. On Search, emptying the query also drops an in-flight Podcast Index response so results cannot paint back under an empty field.
- Who notices: anyone typing on Search, Home's subscription filter, a podcast or add-by-RSS detail filter, or the Add by RSS library filter
- Operator steps: none
```

## What this change is

Search and list-filter fields get an icon-only X inside the right edge of the painted pill. It is visible only while the field's value has length greater than zero. Pressing it sets the value to `''` through the handler the field already uses for typing, then focuses the field so the keyboard stays up (R21). The outline Clear `Button` beside `ListFilterField` goes away. Form `TextField`s do not get an X.

`TextField` owns the pill and the tap-anywhere-to-focus target, so the X is painted there. `SearchField` and `ListFilterField` are the only callers that turn it on. `SearchField` names the X with the shared key `misc.clear_search`. `ListFilterField` names it with the shared key `misc.clear_filter`. Plan 10 adds both keys to the shared layer. This plan only reads them.

Mobile does not import `@podverse/ui`. Do not edit `packages/ui`, `apps/web`, or `apps/management-web`.

## Locked choices

- Glyph (R20): Ionicons `close`, size 18, color `themeStyles.textSecondary.color`. Same weight and color as the magnifying glass in `SearchField`. Not `close-circle`, and not `Button`. The operator confirmed this ("18pt icon, 44pt touch area, pill stays the same height.").
- Box (R20): the same 28pt square as the leading slot (`COMPACT_INPUT_MIN_HEIGHT`). `hitSlop` of `Math.max(0, (LIST_ROW_ACTION_SIZE - COMPACT_INPUT_MIN_HEIGHT) / 2)` on every side (`LIST_ROW_ACTION_SIZE` is 44 in `apps/mobile/src/theme/screenLayout.ts`). The pill stays the compact height. A `Button` with `iconOnly` at `sm` is 44pt and would make the pill taller whenever text is present. Do not use it.
- The X is not mounted when the value is empty. Do not leave an invisible spacer. The text uses the full pill width until the user types.
- Show it when `value.length > 0`. Do not trim. A value of only spaces still shows the X and clears to `''`. That matches `ListFilterField` today (`term.length > 0`).
- Also require `editable` (default true). A non-editable field does not show the X. Search and list filters do not pass `editable={false}`.
- Press calls `onChangeText('')`, then focuses the input so the keyboard stays up (R21), on Search and on every list filter. Both go through `TextField`, so the focus call lives there. Do not call `blur()`, `Keyboard.dismiss()`, or `onSubmitEditing`. Do not submit.
- The X unmounts in the same turn the value becomes empty, and that unmount can blur the field. Call `localRef.current?.focus()` in the press handler, and call it again inside `requestAnimationFrame`, so focus lands after the X has left the tree. One focus call is not enough.
- Pressed opacity is 0.7, matching `Button` and `HeaderBarAction`.
- Accessible names (R19, `00-SUMMARY.md` § Clear labels). Do not reuse `filters.list.clear`, `subscriptions.filter.clear`, or the mobile `misc.clear` for the X.
  - `SearchField` calls `useTranslation` and passes `t('misc.clear_search')` ("Clear Search") into `TextField`. It does not take a `clearLabel` prop. `SearchScreen` does not pass a label.
  - `ListFilterField` drops `clearLabel` and calls `useTranslation` for `t('misc.clear_filter')` ("Clear Filter"). Every list filter uses that one string, so a prop every caller would have to set to the same key is not this plan. The four callers stop passing `clearLabel` (listed under Callers).
  - `TextField` still takes an already-localized `clearAccessibilityLabel`. Form fields omit it. Do not call `useTranslation` in `TextField`.
- Do not add a catalog key. Plan 10 adds `misc.clear_search` and `misc.clear_filter` on the shared layer. This plan deletes two consumer keys that have no caller once both plans land, and leaves every key that still has a caller. Do not edit `packages/i18n-catalog/shared/`, `mobile/`, or `management/`. Do not edit `overrides/`.

## TextField

File: `apps/mobile/src/components/form/TextField.tsx`. The whole file is small. Read it.

Add two optional props to `TextFieldProps`, next to the other optional props:

- `clearAccessibilityLabel?: string` — already-localized accessible name. Omit on form fields. When omitted or `''`, the X is not rendered.
- `clearTestID?: string` — Maestro id. Pass it whenever the label is passed.

`showClear` is true only when `clearAccessibilityLabel` is a non-empty string, `value.length > 0`, and `editable` is true.

Render the control as the last element inside the pill `View`, after the column that holds the `TextInput`. The focus `Pressable` (`StyleSheet.absoluteFill`, first element, `onPress={focusInput}`) stays where it is. The X sits above it:

- `accessibilityRole="button"`
- `accessibilityLabel={clearAccessibilityLabel}`
- `testID={clearTestID}`
- `hitSlop` as above
- `zIndex: 1` on its style, so the absolute-fill focus target does not take the tap
- `onPress` clears, then refocuses (R21):

```tsx
onPress={() => {
  onChangeText('');
  localRef.current?.focus();
  requestAnimationFrame(() => {
    localRef.current?.focus();
  });
}}
```

- pressed style opacity 0.7, via the `style={({ pressed }) => ...}` form `Button` uses

Wrap the `Ionicons` in a `View` with `accessibilityElementsHidden`, `importantForAccessibility="no-hide-descendants"`, and `pointerEvents="none"`. The `Pressable` is the only accessible node. Import `Ionicons` from `@expo/vector-icons`. Import `LIST_ROW_ACTION_SIZE` from `../../theme/screenLayout`.

Add a `trailing` style in the existing `StyleSheet.create` (do not switch this file to `useThemedStyles`). Mirror `styles.leading`: `alignItems: 'center'`, `alignSelf: 'center'`, height and width `COMPACT_INPUT_MIN_HEIGHT`, `justifyContent: 'center'`, `marginLeft: tokens.spacing.md`, plus `zIndex: 1`. Leading keeps `marginRight`. Do not add vertical margin.

Update the file comment and the `leading` prop comment so they stay true: the leading icon is still decoration and still focuses the field; the X, when the clear props are set and the value is non-empty, clears the value and leaves the field focused. Do not mention a plan, a removed button, or what the file used to do.

Form callers (`LoginScreen`, `SignUpScreen`, `ForgotPasswordScreen`, playlist, add-by-RSS URL, credentials, profile, clip, boost, settings) do not pass the new props. Do not edit them.

## SearchField

File: `apps/mobile/src/components/form/SearchField.tsx`.

Call `useTranslation` from `react-i18next`. Pass `clearAccessibilityLabel={t('misc.clear_search')}` and `clearTestID={testID !== undefined ? `${testID}-clear` : undefined}` to `TextField`. Do not add a `clearLabel` prop. Keep `testID` on `TextField` so the `TextInput` id stays `search-input`. Keep the leading glass. Do not debounce here.

Update the file comment: compact pill, leading glass, search return key, and an X at the right edge while `value` is non-empty. The X is named with the shared Clear Search string. Pressing it clears the value and leaves the field focused.

## ListFilterField

File: `apps/mobile/src/components/form/ListFilterField.tsx`. `ListFilterHeader` stays in this file. Do not change `ListFilterHeader` or its props.

Remove the outer row `View`, the `Button`, the `Button` import, the `clearLabel` prop, and the `useMemo` / `StyleSheet` / `useTheme` block. Those existed to put the outline Clear button beside the pill. After this change `ListFilterField` is a `TextField`. Call `useTranslation` from `react-i18next`.

- `accessibilityLabel={label}`
- `autoCapitalize="none"`
- `autoCorrect={false}`
- `clearAccessibilityLabel={t('misc.clear_filter')}`
- `clearTestID={`${testID}-clear`}`
- `onChangeText={onChangeTerm}`
- `placeholder={placeholder ?? label}`
- `style={style}` (the caller's `style` moves onto the pill; no caller passes `style` today)
- `testID={`${testID}-input`}`
- `value={term}`

`apps/mobile/src/components/form/index.ts` re-exports `ListFilterFieldProps`. Do not edit the barrel. The type loses `clearLabel` because the props type in this file loses it.

Keep the `testID` comment: input is `${testID}-input`, clear control is `${testID}-clear`.

Update the component comment: compact pill matching `SearchField`, no debounce, the X is inside the pill and mounted only while `term.length > 0`. Its accessible name is the shared Clear Filter string. Pressing it clears the term and leaves the field focused. There is no visible word.

Do not change `listFilterContentGap`, `listFilterFieldBottomMargin`, or `apps/mobile/src/theme/screenLayout.ts`. The seam is still the pill's bottom edge. The old button was shorter than the pill and vertically centered, so the row's bottom edge was already the pill.

## Callers

`SearchField` has one caller, `apps/mobile/src/screens/search/SearchScreen.tsx`, the `SearchField` with `testID="search-input"`. Do not add a label prop. The label choice does not touch this file.

In that file, the effect that watches `query` and sets `debouncedQuery` stays as it is (`SEARCH_DEBOUNCE_MS` is 450). In the later effect, the branch `if (debouncedQuery.length === 0)` must advance the in-flight guard before it clears state (R22; the operator confirmed "Cancel the search in progress."):

```typescript
searchRequestIdRef.current += 1;
setFeeds([]);
setErrorKey(null);
setIsLoading(false);
return;
```

A response whose `requestId` no longer equals `searchRequestIdRef.current` already returns without painting. Advancing the guard in the empty branch makes that true for a query that was just cleared, including the initial empty value (the increment on mount only moves the counter; feeds are already empty). Do not add a second timer. Do not set `debouncedQuery` from the X. Do not change `handleRetrySearch`, `handleSubmitSearch`, or the auto-focus effect.

`ListFilterField` dropping `clearLabel` touches these four callers. Delete that prop only. Leave `label`, `placeholder`, `onChangeTerm`, `testID`, and `term` as they are. The X uses the same `onChangeTerm('')` path the button used.

- `apps/mobile/src/screens/home/HomeScreen.tsx` is on the large-file list. Do not open it. Grep `clearLabel={t('subscriptions.filter.clear')}` on the `ListFilterField` with `testID="home-filter"` and delete that prop. `onChangeTerm={handleFilterTermChange}` stays. `handleFilterTermChange` writes the term.
- `apps/mobile/src/screens/podcast/PodcastDetailScreen.tsx` — `testID="podcast-detail-filter"`. Delete `clearLabel={t('filters.list.clear')}`. `onChangeTerm={setFilterTerm}` stays. `label` stays `t('filters.list.title_label')`.
- `apps/mobile/src/screens/home/AddByRssHomeDetailScreen.tsx` — `testID="add-by-rss-home-filter"`. Delete `clearLabel={t('filters.list.clear')}`. `onChangeTerm={setFilterTerm}` stays.
- `apps/mobile/src/screens/rss/AddByRssRootScreen.tsx` — `testID="rss-filter"`. Delete `clearLabel={t('subscriptions.filter.clear')}`. `onChangeTerm={setFilterTerm}` stays. `label` stays `t('subscriptions.filter.placeholder')`.

Those are the only `ListFilterField` callers. There is no other `TextInput` in `apps/mobile/src`. Album, artist, Browse, Queue, and History do not have a text filter.

## Catalog keys

Plan 10 adds `misc.clear_search` and `misc.clear_filter` on the shared layer. This plan does not write those files.

Plan 10's only consumer key it stops using is `subscriptions.filter.clear`. Its web caller, `PodcastsFilterInput.tsx`, drops it. Plan 10 does not remove the key. `filters.list.clear` has no web caller before or after plan 10. `tableShared.searchClearLabel` is removed by plan 10 from the management originals. Do not edit management catalogs in this plan.

Grep of `apps/web` and `apps/mobile` for the three keys, after the callers above move to the shared keys:

| Key | Layer | After plans 10 and 20 | Action |
| --- | --- | --- | --- |
| `subscriptions.filter.clear` | consumer | No caller. Web drops it in plan 10. Mobile drops it here (`HomeScreen`, `AddByRssRootScreen`). | Delete from all four consumer originals. |
| `filters.list.clear` | consumer | No caller. No web caller. Mobile drops it here (`PodcastDetailScreen`, `AddByRssHomeDetailScreen`). `SearchScreen` does not start using it. | Delete from all four consumer originals. |
| `misc.clear` | mobile | Still called. | Keep. |

`misc.clear` stays because `apps/mobile/src/components/clip/ClipTimeCard.tsx` passes `label={t('misc.clear')}` on the end-time button (`testID="make-clip-clear-end-time"`). That is not the X. Do not edit `packages/i18n-catalog/mobile/`. Do not edit `ClipTimeCard.tsx`.

`error_log.clear` is a different key. `MoreErrorLogScreen.tsx` still calls it. Do not delete it.

Sibling keys that stay, because they still have callers:

- `filters.list.title_label`, `filters.list.placeholder` — `PodcastDetailScreen`, `AddByRssHomeDetailScreen`.
- `filters.list.no_matches` — `PodcastSectionList.tsx`.
- `subscriptions.filter.placeholder` — `HomeScreen`, `AddByRssRootScreen`.
- `subscriptions.filter.label`, `subscriptions.filter.by_title` — web `PodcastsFilterInput.tsx` (plan 10 keeps these).
- `subscriptions.filter.results_count` — web `PodcastsPageList.tsx`.
- `subscriptions.filter.no_matches` — `AddByRssRootScreen.tsx` (`messageKey`).

In each of the four consumer originals, delete only the `"clear"` property inside `filters.list` (it sits between `placeholder` and `no_matches`) and the `"clear"` property inside `subscriptions.filter` (it sits between `by_title` and `results_count`). Delete the line, including its trailing comma. Match the key, not the English word, so `es`, `fr`, and `el-GR` lose the same two properties. Leave both parent objects in place.

Do not edit `packages/i18n-catalog/consumer/overrides/`. `npm run i18n:compile` drops the empty override slots for keys the originals no longer have. This plan does not run compile.

## Guidance

R14. Edit with a targeted replacement. Do not rewrite either file.

`.cursor/rules/mobile-screen-layout.mdc`, section "Search field and chips". Replace the sentence that says search adds the leading magnifying-glass and a search return key, and that filter adds a clear `Button`, with this meaning:

`SearchField` and `ListFilterField` omit `eyebrow` and stay compact. Search adds the leading magnifying glass and a search return key. Both paint an X at the right edge of the pill while the value is non-empty. The X is icon-only. `SearchField` names it with the shared Clear Search string. `ListFilterField` names it with the shared Clear Filter string. Neither field takes a label prop for the X. Pressing it sets the value to an empty string through the same change handler as typing, then focuses the field so the keyboard stays up. It does not submit. Form `TextField`s omit it.

In the next paragraph, the pill stays the hit target. A tap on the padding, the empty space, or the leading glass focuses the input. A tap on the X clears the value and leaves the field focused. `TextField` implements both. Do not rebuild that per screen. Leave the rest of that paragraph (no padding on the `TextInput`, submit on the return key, blur on leaving the screen).

`.cursor/skills/mobile-reusable-components/SKILL.md`, the "Text fields" paragraph. Replace "Search adds the leading glass; filter adds a clear `Button`." with the same contract: both search and list filters add the in-pill X while the value is non-empty; each field reads its own shared accessible name; pressing the X clears the value and keeps the keyboard up; form fields omit it; `TextField` owns the focus target and the X.

On the checklist item that starts "Boxed fields use `TextField`", add that search and list filters omit `eyebrow` and show that X only while the value is non-empty. Do not restate the whole layout rule there.

## Maestro

`apps/mobile/e2e/home.yaml`, in the block commented "The Filter input sits above the list". `launch-and-connect.yaml` cold-starts with `clearState: true`, so the Home term starts empty.

- After `assertVisible` of `home-filter-input`, and before `tapOn` of that id, add `assertNotVisible` of `home-filter-clear`.
- Immediately after `inputText: "seed"`, add `assertVisible` of `home-filter-clear`.
- Immediately after the existing `tapOn` of `home-filter-clear`, add `assertNotVisible` of `home-filter-clear`.

Keep both taps of `home-media-type-episodes`. Replace the comment above them. The X leaves the keyboard up (R21), so the first chip tap dismisses it and the second selects Episodes. The old comment described either state, which was the behavior this plan replaces.

```yaml
# The X leaves the filter focused and the keyboard up. iOS consumes the first tap
# on the Episodes chip to dismiss that keyboard. The second tap selects Episodes.
# Selecting the same media type twice is idempotent.
- tapOn:
    id: home-media-type-episodes
- tapOn:
    id: home-media-type-episodes
```

`apps/mobile/e2e/search.yaml`:

- Next to the existing `assertVisible` of `search-input` on the initial screen, add `assertNotVisible` of `search-input-clear`.
- Immediately after `inputText: podcast`, add `assertVisible` of `search-input-clear`. Leave the following `assertVisible` of `search-result-row-0` and `takeScreenshot: search-screen-results`.
- After that screenshot, and before `tapOn` of `search-result-row-0`, clear and retype so the detail screenshot still has a result. Do not tap `search-input` between the clear and the second `inputText`. That tap assumed the keyboard had closed. The field is still focused (R21). The result wait is long enough for the refocus frame to land before the second `inputText`.

```yaml
- tapOn:
    id: search-input-clear
- assertNotVisible:
    id: search-input-clear
- extendedWaitUntil:
    notVisible:
      id: search-result-row-0
    timeout: ${TIMEOUT_FASTEST}
# The X leaves search-input focused, so the next text does not tap the field first.
- inputText: podcast
- assertVisible:
    id: search-input-clear
- assertVisible:
    id: search-result-row-0
```

`TIMEOUT_FASTEST` is 2000, from `apps/mobile/e2e/shared/timeouts.env`. The result row leaves after the 450ms debounce, which is under that wait. Do not invent a millisecond literal. Do not use a slower rung unless a run shows this wait is too short.

The X's `assertVisible` stays before the result wait. The X appears on the same render as the text, not when the request returns.

## Out of scope

- Web and management-web, including `packages/ui` `TextInput` / `SearchInput`.
- Adding catalog keys, and editing shared, mobile, or management originals. Plan 10 owns the two new shared keys and the removal of `tableShared.searchClearLabel`.
- `packages/i18n-catalog/*/overrides/` and compiled JSON. No `npm run i18n:compile` in this plan.
- `apps/mobile/src/theme/screenLayout.ts` spacing helpers.
- Any `TextField` that is a form (login, sign-up, password, playlist, RSS URL, credentials, profile, clip, boost, custom API).
- `ClipTimeCard` and mobile `misc.clear`.
- Bumping `SEARCH_DEBOUNCE_MS`, persisting or clearing Home's filter term by a new path, or adding a clear control to Browse.
