## Search and filter fields clear with an X inside the field

- Surfaces: web, management-web, packages/ui, i18n catalog (shared, management)
- Change: Once a search or filter field has text, an X appears at its right edge. Pressing it
  empties the field and keeps focus in it. On web this covers the Search page field, the episode
  transcript search, and the subscribed podcasts title filter. The filter's separate "Clear" text
  button is gone. On management-web it covers every table search field (Users, Admins, Storage,
  Stats, Product Memberships, Feed Flag Status directory, Database table browser, Workers). The
  browser's own search-field X no longer appears beside it. Clearing applies at once, without
  the typing delay: the Search page and transcript search rerun for the empty term, and a
  management table drops its `search` URL parameter (or table cookie term) and reloads straight
  away. Screen readers name the X "Clear Search" on search fields and "Clear Filter" on filter
  fields, from new shared catalog keys `misc.clear_search` and `misc.clear_filter`, translated
  into Spanish, French, and Greek. The unused management key `tableShared.searchClearLabel` is
  removed. The transcript search field now has an accessible name. `useTableFilterState` in
  `@podverse/ui` gains `clearSearch`, and `TableFilterBar` requires `clearFilterAriaLabel` and
  `onSearchClear`.
- Who notices: everyone who searches or filters lists on web, operators filtering management
  tables, and screen reader users
- Operator steps: none

## Mobile search and list filters clear from an X inside the field

- Surfaces: mobile
- Change: Search and list-filter fields show an X at the right edge of the pill while the field
  has text. Pressing it empties the field through the same change handler as typing and leaves
  the field focused so the keyboard stays up. A screen reader hears Clear Search on Search and
  Clear Filter on a list filter. The separate Clear button beside a list filter is gone. On
  Search, emptying the query also drops an in-flight Podcast Index response so results cannot
  paint back under an empty field.
- Who notices: anyone typing on Search, Home's subscription filter, a podcast or add-by-RSS
  detail filter, or the Add by RSS library filter
- Operator steps: none
