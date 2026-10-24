**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 12 — Page titles that bypass MainHeader, and detail-page titles

Plan 11 moves every `MainHeader` title into the app bar. A few chrome pages put their title in an
in-content `h1` instead, so they would show an empty bar and a stray heading. Move those onto
`MainHeader`. Detail pages keep their own header and show nothing in the bar.

## Rows

R25, R29, R30, R31

## Runs after

11

## Decisions this plan carries

- **R30 Detail pages show no app-bar title.** Podcast, episode, album, artist, track, livestream,
  clip, chapter, playlist, profile, my-profile, and Add by RSS feed pages already render the entity
  name as their `h1` in a large header (`CorePodcastHeaderViewDesktop.tsx`,
  `CoreArtistHeaderViewDesktop.tsx`, `AddByRSSPodcastHeader.tsx`, `PlaylistPageHeader.tsx`,
  `ProfileHeaderViewDesktop.tsx`, …). Repeating the name in the bar right above it would be a
  second `h1` with the same text. Those pages render no `MainHeader`, so plan 11 already leaves
  their bar title empty; the only detail page that renders `MainHeader` today is the Add by RSS
  feed detail below.
- **Pages kept off the contract:** `/account-access` (an interstitial panel that also renders
  without chrome while terms acceptance is pending) and the dev harnesses `/test-error-boundaries`
  and `/e2e/media-player-foundation`. They keep their in-content `h1`.

## Changes

### `apps/web/src/app/recommendations/RecommendationsPageClient.tsx`

- Delete `<h1>{t('title')}</h1>` from `MainColumnStack`.
- Return a fragment: `<MainHeader title={t('title')} />` above `<MainWrapper>` (import
  `MainHeader` from `@podverse/ui`), matching `SettingsClient.tsx`.
- Leave the `MediaListChips` row and everything else as is; area C changes the chip row later in
  this file.

### `apps/web/src/app/embed/page.tsx`

- Delete `<h1>{t('embed_demo_page_title')}</h1>` from the `introStack` div (keep the div, its
  `id={EMBED_DEMO_TOP_ANCHOR_ID}`, the intro, and the table of contents).
- Return a fragment with `<MainHeader title={t('embed_demo_page_title')} />` above `<MainWrapper>`.

### `apps/web/src/app/membership/renew/page.tsx`

Today the page returns a bare `<div className="container">` with an `h1`, outside the
`MainWrapper` scroll container. Give it the same scaffold as `apps/web/src/app/membership/page.tsx`:

```tsx
<>
  <MainHeader title={t(tier === 'premium' ? 'extend_my_membership' : 'buy_membership')} />
  <MainWrapper>
    <MainSidebarLayout>
      <SideContent />
      <MainColumnStack>
        <FormStack>{/* the existing paragraphs, unchanged */}</FormStack>
      </MainColumnStack>
    </MainSidebarLayout>
  </MainWrapper>
</>
```

`FormStack` gives the stacked `p` elements their gap (**even-content-spacing**). Import
`FormStack`, `MainColumnStack`, `MainHeader`, `MainSidebarLayout`, `SideContent` from
`@podverse/ui` and `MainWrapper` from `../../../components/Main/MainWrapper`. Keep the data
loading, links, and `generateMetadata` as they are.

### `apps/web/src/components/AddByRSS/Detail/AddByRSSDetailClient.tsx`

Rendered by `/add-by-rss/[resource]/[id_text]`, `/add-by-rss/podcast/[id]`, and
`/add-by-rss/album/[id]`; podcasts and albums hand off to their own page clients, which render no
`MainHeader`.

- Not-found branch (`source === null || feed === null`): keep `MainHeader title={tFeatures('add_by_rss.label')}`.
  There is no entity header there.
- Loaded branch (artists, tracks, and the generic fallback): delete
  `<MainHeader title={`${tFeatures('add_by_rss.label')} · ${feedTitle}`} />`. Artists and tracks
  keep their own header `h1` (`AddByRSSArtistHeader`, `AddByRSSTrackHeader`). In the generic
  `feedHeader` section, change `<h2 className={styles.feedTitle}>` to `<h1 className={styles.feedTitle}>`
  so the page keeps one level-1 heading. `.feedTitle` in `AddByRSSDetail.module.scss` already sets
  `font-size: 1.4rem` and `margin: 0`, so the size does not change; no SCSS edit.

### R29 — sidebar Recommendations label

`apps/web/src/components/SideBar/SideBar.tsx` calls `tFeatures('recommendations.title')`. In this
branch `features.recommendations.title` exists in all four consumer originals
(`packages/i18n-catalog/consumer/originals/*.json`, under `features.recommendations`) and the
override slots are empty, so the key resolves. The raw key the operator saw came from a checkout
whose compiled messages lacked it. Confirm the key is still present with Grep; when it is, make no
edit. Only if it is missing in this worktree, add `"title"` beside its siblings under
`features.recommendations` in all four originals (en-US "Recommendations", es "Recomendaciones",
fr "Recommandations", el-GR "Προτάσεις") and run `npm run i18n:compile`.
`apps/web/e2e/recommendations.spec.ts` already reads the sidebar link text "Recommendations",
which fails on a raw key.

## Files

apps/web/src/app/recommendations/RecommendationsPageClient.tsx
apps/web/src/app/embed/page.tsx
apps/web/src/app/membership/renew/page.tsx
apps/web/src/components/AddByRSS/Detail/AddByRSSDetailClient.tsx
apps/web/e2e/recommendations.spec.ts
apps/web/e2e/embed-demo-index.spec.ts
apps/web/e2e/membership-page-trial-limitations.spec.ts
apps/web/e2e/add-by-rss-artist-albums.spec.ts
release-notes/scratchpad.md

## Tests

Playwright (existing specs; default 1280×720 viewport; `chrome` is
`page.locator('[data-appearance="web"]')`; pass the verified element to the capture helper):

- `recommendations.spec.ts`, first test: after `page.goto('/recommendations')`, assert
  `chrome.getByRole('heading', { level: 1, name: 'Recommendations' })` is visible before the login
  prompt check.
- `embed-demo-index.spec.ts`: the three `getByRole('heading', { name: 'Embed Player' })` lines
  scope to `chrome` and add `level: 1`.
- `membership-page-trial-limitations.spec.ts`, test `the renew page shows Buy Membership…`:
  scope the `Buy Membership` level-1 heading to `chrome` in both the assertion and the capture.
- `add-by-rss-artist-albums.spec.ts`: in the step `Adding the artist feed opens the Add by RSS
  artist page` (the `/add-by-rss/artist/[id]` page, `AddByRSSArtistPageClient`), after the
  `ARTIST_TITLE` level-1 heading assertion, also assert `chrome.getByRole('heading')` has count 0.
  This covers R30 on an Add by RSS detail page. No spec opens the generic
  `/add-by-rss/[resource]/[id_text]` artists or tracks branch of `AddByRSSDetailClient`; do not add
  one.

No unit tests: these are page-structure edits with no new logic.

## Release scratchpad

```markdown
## Recommendations, Embed Player, renew, and Add by RSS feed titles follow the top bar

- Surfaces: web
- Change: Recommendations, the Embed Player demo page, and the membership renew page show their
  title in the top bar like other pages (a row under the bar on phones). The renew page also gets
  the normal page layout with the side column and footer. Add by RSS feed detail pages no longer
  show "Add by RSS · feed name" above the feed; the feed's own header carries the name, matching
  podcast and album pages.
- Who notices: web listeners on those pages
- Operator steps: none
```
