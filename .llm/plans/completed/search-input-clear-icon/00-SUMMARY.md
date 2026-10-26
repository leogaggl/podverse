# Summary — clear X in search and filter inputs

Request: [00-REQUEST.md](00-REQUEST.md). Prompts and models: [COPY-PASTA.md](COPY-PASTA.md).
Order and file ownership: [00-EXECUTION-ORDER.md](00-EXECUTION-ORDER.md).

## Requirement ledger

The request's words are quoted. Rows R3, R12, and R13 quote the operator answers, and R14 quotes
the Orientation note in `00-REQUEST.md`.

- **R1** (area A) "for the search ... inputs on the web" (the shared `SearchInput` on web: Search page header, item transcript) — Plan: 10
- **R2** (area A) "for the ... filter inputs on the web" (web list filters such as `PodcastsFilterInput`) — Plan: 10
- **R3** (area A) "web, mobile, and management-web (management-web shares `SearchInput` and the table filter from `@podverse/ui`)" — Plan: 10
- **R4** (area B) "for the search ... inputs on the ... mobile app" (`SearchField` and its callers) — Plan: 20
- **R5** (area B) "for the ... filter inputs on the ... mobile app" (`ListFilterField` and its callers) — Plan: 20
- **R6** (area A) "when you start to type content" — the web and management-web X appears only while the input has text — Plan: 10
- **R7** (area B) "when you start to type content" — the mobile X appears only while the input has text — Plan: 20
- **R8** (area A) "in the far right of the input should be an X icon" — web and management-web, icon-only, inside the input's right edge — Plan: 10
- **R9** (area B) "in the far right of the input should be an X icon" — mobile, icon-only, inside the painted pill's right edge — Plan: 20
- **R10** (area A) "that you can press to clear the contents of the input" — web and management-web, including the debounced `SearchInput` and the table filter state — Plan: 10
- **R11** (area B) "that you can press to clear the contents of the input" — mobile search and list filter — Plan: 20
- **R12** (area A) "replace them. Every search and filter input gets the X icon inside the input, and the separate text "Clear" buttons go away." — web and management-web (`TextInput` `button` used for `filter.clear`) — Plan: 10
- **R13** (area B) "replace them. Every search and filter input gets the X icon inside the input, and the separate text "Clear" buttons go away." — mobile (`ListFilterField` clear `Button`, testID `${testID}-clear`) — Plan: 20
- **R14** (area B) "`.cursor/rules/mobile-screen-layout.mdc` § Search field and chips says "filter adds a clear `Button`". That guidance changes with this set." — also `.cursor/skills/mobile-reusable-components/SKILL.md`, which says the same — Plan: 20

Rows R15–R22 come from the review of the first planning pass (`00-REQUEST.md` § Review of the
first planning pass) and quote the operator's answers.

- **R15** (area A, step 04) "Add Clear Search and Clear Filter labels." — web and management-web X labels use the new shared keys (see § Clear labels below); do not reuse the existing Clear labels — Plan: 10
- **R16** (area A, step 04) "Clear the management filter immediately." — add the new function on `useTableFilterState`; the table filter X skips the 400 ms delay — Plan: 10
- **R17** (area A, step 04) "Leave Find Feed without an X." — confirms plan 10 as written — Plan: 10
- **R18** (area A, step 04) "Keep the keyboard up on mobile and on web." — web: the X keeps the field focused, which plan 10 already does — Plan: 10
- **R19** (area B, step 05) "Add Clear Search and Clear Filter labels." — mobile X labels use the same new shared keys; do not reuse the existing Clear labels — Plan: 20
- **R20** (area B, step 05) "18pt icon, 44pt touch area, pill stays the same height." — confirms plan 20 as written — Plan: 20
- **R21** (area B, step 05) "Keep the keyboard up on mobile and on web." — mobile: pressing the X refocuses the field so the keyboard stays up; plan 20 changes — Plan: 20
- **R22** (area B, step 05) "Cancel the search in progress." — confirms plan 20's in-flight search guard — Plan: 20

## Areas

### Area A — Web shared input (packages/ui, web, management-web)

- **Rows:** R1, R2, R3, R6, R8, R10, R12
- **Plan number block:** 10–19
- **Starts from:** `packages/ui/src/components/form/TextInput/TextInput.tsx` (its `button?: TextInputButton` prop and `TextInput.module.scss`). Every web and management-web search or filter field renders through it:
  - `packages/ui/src/components/form/SearchInput/SearchInput.tsx` (debounced, leading magnifying glass)
  - `packages/ui/src/components/table/TableFilterBar/TableFilterBar.tsx` (the table filter, used by `TableWithFilter`, `ResourceTableWithFilter`, and management-web `WorkersPageClient`)
  - `apps/web/src/app/_media-lists/podcasts/PodcastsFilterInput.tsx` (text Clear via `button`)
- **Callers to check:** `apps/web/src/app/search/SearchPageListHeader.tsx`,
  `apps/web/src/components/ItemTranscript/ItemTranscript.tsx`,
  `apps/web/src/app/_media-lists/podcasts/PodcastsPageList.tsx`, management-web
  `StoragePageClient.tsx`, `WorkersPageClient.tsx`, `src/components/Table/managementTableChrome.tsx`,
  and `packages/ui/src/hooks/useTableFilterState.ts` (with its test).
- **Depends on:** no other area.
- **Shared files with other areas:** `packages/i18n-catalog/*/originals/*.json` (see catalog
  ownership below), and `release-notes/scratchpad.md` (Assemble handles it).

### Area B — Mobile search and list filter fields

- **Rows:** R4, R5, R7, R9, R11, R13, R14
- **Plan number block:** 20–29
- **Starts from:** `apps/mobile/src/components/form/TextField.tsx`. It owns the painted pill and
  the area you tap to focus. Then `SearchField.tsx`, which already has a leading glass, and
  `ListFilterField.tsx`, which has a text clear `Button` and a `clearLabel` prop.
- **Callers to check:** `PodcastDetailScreen`, `HomeScreen`, `SearchScreen`, `AddByRssRootScreen`,
  `AddByRssHomeDetailScreen`, `apps/mobile/src/theme/screenLayout.ts`. Also the Maestro flows that tap
  `${testID}-clear` or "Clear" (`apps/mobile/e2e/home.yaml`, `subscriptions-anonymous.yaml`,
  `library-downloads.yaml`, `make-clip.yaml`; confirm which of these actually do).
- **Guidance:** `.cursor/rules/mobile-screen-layout.mdc` § Search field and chips, and
  `.cursor/skills/mobile-reusable-components/SKILL.md`.
- **Depends on:** no other area. Mobile does not import `@podverse/ui`, so it shares no code with
  area A.
- **Shared files with other areas:** `packages/i18n-catalog/*/originals/*.json` (see catalog
  ownership below), and `release-notes/scratchpad.md` (Assemble handles it).

### Catalog ownership

Both areas need an accessible name for the X. The existing consumer keys
`subscriptions.filter.clear` and `filters.list.clear` ("Clear") already serve web and mobile.
A plan may reuse them. A plan may also add a key:

- Only area A adds keys to `packages/i18n-catalog/consumer/` or `shared/`.
- Area B either reuses an existing consumer or shared key, or adds its new keys to
  `packages/i18n-catalog/mobile/` only.
- A key either area stops using (for example `subscriptions.filter.clear`, when another caller
  still uses it) is left in place. Only the plan whose surface was its last caller removes it, and
  it must say so in `## Files`.

### Clear labels (settled after the first review)

- The X's accessible name uses two new keys in the **shared** layer, which web, management-web,
  and mobile all read: `misc.clear_search` ("Clear Search") and `misc.clear_filter`
  ("Clear Filter"), in all four locales (`en-US`, `es`, `fr`, `el-GR`). No other layer has
  either path today. Plan 10 adds them; plan 20 only reads them, so plan 20 runs after plan 10.
- **Clear Search** goes on fields that run a search for a term: the web Search page, the web
  transcript search, and the mobile Search screen. **Clear Filter** goes on fields that narrow a
  list already on screen: the web subscribed-podcasts filter, every management table filter
  (`TableFilterBar`, including the Workers page), and every mobile list filter
  (`ListFilterField`).
- No X uses `subscriptions.filter.clear`, `filters.list.clear`, the mobile `misc.clear`, or
  `tableShared.searchClearLabel`.
- Removing labels nothing uses anymore: plan 10 removes `tableShared.searchClearLabel` from the
  management layer, since nothing uses it. Plan 10 removes no consumer key. It names in its plan
  each consumer key whose last web caller it drops. Plan 20 runs after plan 10, so it removes
  each consumer or mobile key that has no web or mobile caller once both plans land, from all
  four locales, and lists those catalog files in `## Files`.

## Waves

- **Wave 1:** area A (step 02), area B (step 03). The two plans touch different code, and neither
  builds on the other.

## Order

First planning pass: step 01 split the request into areas A and B, both in wave 1.

Second pass after the first review: step 04 revises plan 10 (R15–R18), then step 05 revises plan
20 (R19–R22). Step 05 runs after step 04 because plan 20 reads the labels plan 10 adds and
removes the old keys plan 10 leaves without a caller.

Close: every row maps to plan 10 or plan 20. The implementation run has two phases, plan 10 then
plan 20, because plan 20 reads the shared keys plan 10 adds. Plan 10 owns the shared and
management catalog originals; plan 20 owns the consumer catalog originals. The two plans share
only `release-notes/scratchpad.md`.

## Decisions to review

Collected from the area steps' final messages after the first planning pass. Step 01 (split)
made no product decisions. The operator's answers are in `00-REQUEST.md` § Review of the first
planning pass, and rows R15–R22 carry them.

- **D1** (step 02, plan 10) Accessible names reuse existing keys. Web uses "Clear": `subscriptions.filter.clear` on the subscribed filter, and `filters.list.clear` on the Search page and transcript fields. Management-web uses `tableShared.searchClearLabel`, which exists in all four locales but has no caller today; its English value changes from "Clear search" to "Clear Search" (title case). Alternative: new consumer keys ("Clear Search", "Clear Filter") translated in all four locales, giving clearer web names but possibly diverging from mobile.
- **D2** (step 02, plan 10) The management table filter X clears through the existing 400 ms filter delay, the same path as backspacing to empty, so `useTableFilterState` does not change. Alternative: apply the clear immediately, which needs a new function on the hook. (The web `SearchInput` X, by contrast, cancels its 1-second delay and searches for the empty term straight away.)
- **D3** (step 02, plan 10) The Feed Flag Status "Find Feed" lookup in management-web gets no X, because it is a labeled form field with a separate Search button, not a live search or filter. Alternative: add the X there too.
- **D4** (step 03, plan 20) The mobile X is Ionicons `close` at 18pt in secondary text color, inside the existing 28pt leading-icon box, with hit slop out to 44pt so the compact pill keeps its height. Alternative: a 44pt icon-only `Button`, which makes the pill taller whenever the field has text.
- **D5** (step 03, plan 20) Pressing the mobile X clears the text and does not refocus the field, so the keyboard may dismiss, as the separate Clear button does today. Alternative: refocus so the keyboard stays up. Note that plan 10 refocuses the field on web, so the two surfaces differ here unless one changes.
- **D6** (step 03, plan 20) Clearing mobile Search also advances the in-flight request guard, so a late Podcast Index response cannot paint results back under an empty field. Alternative: leave that effect alone.
