# Request — clear X in search and filter inputs

This set is one of three split from a single operator message. The notifications bell ask is set
`mobile-notifications-bell`. The livestream row badge ask is set `livestream-row-status-slot`.

## Request

Also, for the search and filter inputs on the web and mobile app, when you start to type content,
then in the far right of the input should be an X icon that you can clear, that you can press to
clear the contents of the input.

## Operator answers

- **Scope:** web, mobile, and management-web (management-web shares `SearchInput` and the table
  filter from `@podverse/ui`).
- **Existing Clear buttons:** replace them. Every search and filter input gets the X icon inside
  the input, and the separate text "Clear" buttons go away.

## Glossary

- **X icon:** an icon-only clear control inside the right edge of the input, visible only when the
  input has text.

## Orientation

- `packages/ui/src/components/form/SearchInput/SearchInput.tsx`: shared web and management-web
  search input, debounced.
- `packages/ui/src/components/table/ResourceTableWithFilter/ResourceTableWithFilter.tsx` and
  `packages/ui/src/hooks/useTableFilterState.test.tsx`: management-web table filters.
- `apps/web/src/app/_media-lists/podcasts/PodcastsFilterInput.tsx`: web filter with a text clear
  action (`filter.clear`).
- `apps/web/src/app/search/SearchPageListHeader.tsx` and
  `apps/web/src/components/ItemTranscript/ItemTranscript.tsx`: other `SearchInput` users.
- `apps/mobile/src/components/form/SearchField.tsx`: mobile search field, no clear control today.
- `apps/mobile/src/components/form/ListFilterField.tsx`: mobile list filter with a text clear
  `Button` (`clearLabel`, testID `${testID}-clear`) shown once there is a term.
- `TextField` owns the painted pill and the tap-anywhere-to-focus area on mobile.
- Mobile callers: `PodcastDetailScreen`, `HomeScreen`, `SearchScreen`, `AddByRssRootScreen`,
  `AddByRssHomeDetailScreen`.
- `.cursor/rules/mobile-screen-layout.mdc` § Search field and chips says "filter adds a clear
  `Button`". That guidance changes with this set.

## Operator reviews

### Review of the first planning pass

Answers to the decisions listed in `00-SUMMARY.md` § Decisions to review. Quotes are the
operator's choices.

- **D1 (accessible name):** "Add Clear Search and Clear Filter labels." New screen-reader labels,
  translated in all four languages. Do not reuse the existing Clear labels.
- **D2 (management table filter):** "Clear the management filter immediately." Add the new
  function on the filter hook. Do not keep the 400 ms delay.
- **D3 (Find Feed lookup):** "Leave Find Feed without an X."
- **D4 (mobile X size):** "18pt icon, 44pt touch area, pill stays the same height."
- **D5 (focus after clearing):** "Keep the keyboard up on mobile and on web." Pressing the X keeps
  the field focused on both surfaces. Plan 10 already refocuses on web; plan 20 changes so mobile
  refocuses too.
- **D6 (late mobile search results):** "Cancel the search in progress." Clearing mobile Search
  cancels a search still running, so a late response cannot fill results under an empty field.
