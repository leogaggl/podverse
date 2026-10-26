# Clear X in search and filter inputs — execution order

Request and settled review answers (D1–D6): [00-REQUEST.md](00-REQUEST.md). Ledger and areas:
[00-SUMMARY.md](00-SUMMARY.md). Prompts and models: [COPY-PASTA.md](COPY-PASTA.md).

Phases run in order. Run every prompt in this worktree
(`../podverse_feature_search_input_clear_icon`).

## Why two phases

Plan 20 reads the shared catalog keys `misc.clear_search` and `misc.clear_filter`, which plan 10
adds, and it removes the consumer keys `subscriptions.filter.clear` and `filters.list.clear` once
plan 10 has dropped their last web caller. So plan 20's `## Runs after` is 10. Both plans also
append to `release-notes/scratchpad.md`. Each phase holds one prompt, and each prompt writes its
own scratchpad entry.

The catalog files do not overlap: plan 10 edits the shared and management originals, plan 20
edits the consumer originals. Neither edits `overrides/` or runs `npm run i18n:compile`; the
set's verification runs compile before validate.

## Phase 1

- **10 — In-field clear X for web and management-web search and filter inputs** (Cursor Grok 4.7
  · extra high). Owns:
  - `packages/ui`: `TextInput` (component, SCSS, test), `SearchInput` (component, new test),
    `useTableFilterState` and its test, `TableFilterBar`, `TableWithFilter` and its test,
    `ResourceTableWithFilter.test.tsx`, `src/index.ts`, `PACKAGES-UI.md`
  - web: `PodcastsFilterInput.tsx`, `SearchPageListHeader.tsx`, `ItemTranscript.tsx`
  - management-web: `managementTableChrome.tsx`, `WorkersPageClient.tsx`
  - the shared and management catalog originals (all four locales)
  - `apps/web/e2e/podcasts-subscribed-filter.spec.ts`, `apps/web/e2e/search-page.spec.ts`,
    `apps/management-web/e2e/workers-page.spec.ts`
  - `release-notes/scratchpad.md` (its own entry)

Extra high because `TableFilterBar` gains required props every management table uses, and
`useTableFilterState.clearSearch` must cancel a pending delayed apply without blocking the next
term.

## Phase 2

- **20 — X inside mobile search and list filter fields; then close the set** (Cursor Grok 4.7 ·
  high). Owns:
  - `apps/mobile/src/components/form/`: `TextField.tsx`, `SearchField.tsx`, `ListFilterField.tsx`
  - the screens `SearchScreen`, `HomeScreen`, `PodcastDetailScreen`, `AddByRssHomeDetailScreen`,
    `AddByRssRootScreen`
  - `apps/mobile/e2e/home.yaml`, `apps/mobile/e2e/search.yaml`
  - the consumer catalog originals (all four locales; removes two keys only)
  - `.cursor/rules/mobile-screen-layout.mdc`, `.cursor/skills/mobile-reusable-components/SKILL.md`
  - `release-notes/scratchpad.md` (its own entry)

It also archives the set and ends with the cumulative verification.

## Release notes

Each phase holds one prompt, so 10 and 20 each append their own plan's `## Release scratchpad`
entry to `release-notes/scratchpad.md`, 10 first.
