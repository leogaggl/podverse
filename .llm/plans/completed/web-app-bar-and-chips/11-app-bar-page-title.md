**Cursor model:** Opus 5.5 · **Reasoning:** high

# 11 — One app bar with the page title

On large screens (≥ 768px, where the sidebar shows) the web app has one bar at the top: the page
title on the left, then search, the notification bell, and the account menu on the right. The
second bar that `MainHeader` draws today goes away. On small screens (≤ 767px) the bar keeps the
logo and icons, and the page title is its own row under the bar.

Pages keep owning their title through `MainHeader`. Its props do not change, so the ~43 call
sites, including the list headers areas C and D rewrite later, compile and behave without edits.

## Rows

R2, R3, R16, R17, R18, R19, R20, R25, R31, R35

## Runs after

10

## Contract (other plans build on this)

- **A page sets its title by rendering `MainHeader title=…`** as today, above `MainWrapper`.
  `MainHeader` publishes the title to an app-bar title context; the web NavBar reads it and shows
  it in the bar on large screens. A page that renders no `MainHeader` gets an empty bar title.
- **`buttonsNode` is for page actions and never enters the bar (R19).** On large screens it
  renders as a right-aligned row at the top of the page, on the content background, with no bar
  styling. On small screens it renders under the title in the title row. Areas C and D replace
  their dropdowns with chip rows and may stop passing `buttonsNode`; nothing in this plan requires
  them to.
- **One level-1 heading per width.** The bar title and the small-screen title row are both `h1`.
  Each is `display: none` at the other width, so the accessibility tree holds exactly one. Both
  components switch at the same breakpoint: the `mobile` mixin default (`sm-max`, 767px) from
  `packages/ui/src/styles/mixins/_media-queries.scss`, which is what NavBar already uses.
- **`MainHeader` root stays a `<header>`.** Specs scope controls with `page.locator('header')`
  (`media-list-chips.spec.ts`, `web-session-ended-notice.spec.ts`).
- **Server rendering.** The small-screen title row is in the server HTML. The large-screen bar
  title appears when the page hydrates on a full load; on client navigation it updates before
  paint (layout effect). This is the accepted cost of keeping titles in the pages instead of a
  central pathname-to-title table.
- Detail pages render no `MainHeader`, so the bar title is empty there (R30, plan 12).

## Answers from the code

- **R17** Desktop search lives in the sidebar (`SideBar.tsx` `stickyTop`), and the NavBar search
  icon shows only on small screens (`.searchLink` in `NavBar.module.scss`). "Stay on the right"
  means no change to the right cluster.
- **R18** `SideBarBrand` stays in the sidebar; the web NavBar keeps `brand.visibility: 'mobileOnly'`.
  The bar's left padding (`--spacing-2xl`) already matches `MainSidebarLayout`'s inset, so the
  title lines up with the content column, to the right of the sidebar brand.
- **R31** Membership, Terms, FAQ, About, Contact, Donate, Checkout, Checkout Success, Sign Up,
  Forgot/Reset/Set Password, Verify Email, Email Change pages all render `MainHeader`, so they get
  the bar title on large screens and the row on small screens with no per-page edit. Pages that
  put their title in an in-content `h1` instead are plan 12.
- **R35** No spec asserts the second bar's height or position. Heading assertions such as
  `getByRole('heading', { level: 1, name: 'Notifications' })` keep passing because exactly one
  level-1 heading is exposed at each width; leave them alone. `navbar-chrome.spec.ts` gets the new
  coverage below.

## Changes

### New: `packages/ui/src/components/layout/AppBarTitle/AppBarTitle.tsx`

`'use client'`. A small context, framework-agnostic (no Next imports):

- `AppBarTitleProvider({ children })` holds the current entry `{ id: number; title: string } | null`
  in state and a counter ref.
- `useAppBarTitle(): string | null` returns the current title.
- `usePublishAppBarTitle(title: string): void` runs a `useLayoutEffect` keyed on `title` that
  calls the provider's `publish(title)`, which assigns a new id, sets the entry, and returns a
  cleanup that clears the entry only when its id is still the current one. That keeps an
  unmounting page from clearing the title the next page already published, whatever order React
  runs the effects in.
- The default context value (no provider) is `{ title: null, publish: () => () => {} }`, so
  `MainHeader` works in tests and in apps that do not mount the provider (management-web).
- Export the three names (and the props type) from `packages/ui/src/index.ts`, next to
  `MainHeader`.

### `packages/ui/src/components/layout/MainHeader/MainHeader.tsx`

- Add `'use client'`. Props unchanged (`title: string`, `buttonsNode?: ReactNode`).
- Call `usePublishAppBarTitle(title)`.
- Render `<header className={styles.header}>` with `<h1 className={styles.title}>{title}</h1>`
  and, when `buttonsNode` is truthy (same check as today), `<div className={styles.buttons}>`.

### `packages/ui/src/components/layout/MainHeader/MainHeader.module.scss`

Rewrite. Use `@use '../../../styles/mixins/media-queries' as *;` and the `mobile` mixin (drop the
raw `breakpoints.$breakpoint-md-max` query and `.headerContent`).

- Large screens (default rules):
  - `.header`: no fixed height, no background, no padding of its own (an action-less header has
    zero height).
  - `.title`: `display: none`.
  - `.buttons`: `display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap;
    gap: var(--spacing-lg); padding: var(--spacing-md) var(--spacing-2xl);
    background-color: var(--background-color-primary);` (the content background, so it reads as
    the top of the page, not a bar).
- `@include mobile`:
  - `.header`: `display: flex; flex-direction: column; align-items: flex-start;
    gap: var(--spacing-base); padding: var(--spacing-md) var(--spacing-lg);
    background-color: var(--background-color-secondary);`
  - `.title`: `display: block; font-size: var(--font-size-2xl);` with `@include line-clamp(1)`.
  - `.buttons`: `justify-content: flex-start; padding: 0; background-color: transparent;`

### `packages/ui/src/components/navigation/NavBar/NavBar.tsx`

- Add `title?: string` to `NavBarProps` (doc comment: page title shown at the left of the bar on
  large screens; hidden on small screens, where the page renders its own title row).
- When `title` is a non-empty string, render after the brand region:
  `<div className={styles.titleRegion}><h1 className={styles.title}>{title}</h1></div>`.

### `packages/ui/src/components/navigation/NavBar/NavBar.module.scss`

- `.titleRegion`: `display: flex; align-items: center; flex: 1 1 auto; min-width: 0;`; under
  `@include mobile`, `display: none`.
- `.title`: `margin: 0; font-size: var(--font-size-2xl); font-weight: var(--font-weight-light);
  color: var(--text-color-primary);` plus single-line ellipsis (`@include line-clamp(1)` from
  `mixins/lineClamp`, or the `_ellipsis.scss` mixin).
- `.rightCluster`: change `flex: 1` to `flex: 0 1 auto` and add `margin-left: auto`, so the
  cluster stays right-aligned with or without a title and the title takes the free space.
  Management appearance (brand always visible, no title) must look the same as before.

### `apps/web/src/components/NavBar/NavBar.tsx`

- `const appBarTitle = useAppBarTitle();` and pass `title={appBarTitle ?? undefined}` to
  `NavBarUi`.

### `apps/web/src/components/App/AppChrome.tsx`

- Wrap the `<AppWrapper>…</AppWrapper>` subtree in `<AppBarTitleProvider>` (import from
  `@podverse/ui`). Gate and embed returns are unchanged.

### `packages/ui/src/styles/_variables-root.scss`

- Delete `--header-desktop-height`, `--header-mobile-height`, `--main-wrapper-desktop-height`,
  and `--main-wrapper-mobile-height`. After this change nothing reads them (Grep the repo,
  including `apps/mobile`, before deleting; keep any that still has a reader).

### `packages/ui/src/components/layout/MainSidebarLayout/MainSidebarLayout.module.scss`

- The inset comment names `MainHeader`'s `padding-inline`; reword it to "matches the web NavBar
  title inset (`--spacing-2xl`)".

### `packages/ui/PACKAGES-UI.md`

- § Navigation — NavBar: add `title` to the optional props and an i18n table row
  (`title` — page title, already localized by the app).
- New § Layout — MainHeader and the app bar title: pages render `MainHeader` with `title` and
  optional `buttonsNode` (page actions, never in the bar); apps mount `AppBarTitleProvider` around
  the chrome and pass `useAppBarTitle()` to `NavBar title`; one `h1` per width at the `mobile`
  breakpoint.

### `.cursor/rules/navbar-sticky-chrome.mdc`

Add a `## Page title` section:

- Pages set their title with `MainHeader` from `@podverse/ui`. On large screens the NavBar shows
  it; on small screens `MainHeader` shows it as a row under the bar. Do not add a second bar under
  the NavBar.
- Page actions go in `MainHeader buttonsNode` or in the page content, never into the NavBar.
- Detail pages (podcast, episode, album, artist, track, clip, playlist, profile, Add by RSS feed)
  render no `MainHeader`; their own header holds the page's `h1`.
- Keep exactly one level-1 heading per width; NavBar and `MainHeader` switch at the same `mobile`
  breakpoint.

## Files

packages/ui/src/components/layout/AppBarTitle/AppBarTitle.tsx
packages/ui/src/components/layout/AppBarTitle/AppBarTitle.test.tsx
packages/ui/src/components/layout/MainHeader/MainHeader.tsx
packages/ui/src/components/layout/MainHeader/MainHeader.module.scss
packages/ui/src/components/layout/MainHeader/MainHeader.test.tsx
packages/ui/src/components/layout/MainSidebarLayout/MainSidebarLayout.module.scss
packages/ui/src/components/navigation/NavBar/NavBar.tsx
packages/ui/src/components/navigation/NavBar/NavBar.module.scss
packages/ui/src/components/navigation/NavBar/NavBar.test.tsx
packages/ui/src/styles/_variables-root.scss
packages/ui/src/index.ts
packages/ui/PACKAGES-UI.md
apps/web/src/components/NavBar/NavBar.tsx
apps/web/src/components/App/AppChrome.tsx
.cursor/rules/navbar-sticky-chrome.mdc
apps/web/e2e/navbar-chrome.spec.ts
release-notes/scratchpad.md

## Tests

Unit (`packages/ui`, vitest, Testing Library):

- `AppBarTitle.test.tsx`: a probe component that renders `useAppBarTitle()` inside
  `AppBarTitleProvider`. Mounting `MainHeader title="Settings"` shows "Settings" in the probe;
  changing the prop updates it; unmounting clears it to null. Mount a second `MainHeader` with
  another title, then unmount the first: the probe still shows the second title.
- `MainHeader.test.tsx`: keep the two existing tests (they need no provider); add one that renders
  without a provider and does not throw.
- `NavBar.test.tsx`: `title="Settings"` renders `getByRole('heading', { level: 1, name: 'Settings' })`;
  without `title` there is no heading.

Playwright, `apps/web/e2e/navbar-chrome.spec.ts` (existing spec, already in
`makefiles/local/e2e-spec-order-web.txt`; follow **e2e-readability** and pass the verified element
to `actionAndCapture` / `capturePageLoad`). `chrome` is `page.locator('[data-appearance="web"]')`.

- Wide (1280×720) `/settings`: `chrome.getByRole('heading', { level: 1, name: 'Settings' })` is
  visible, and `page.getByRole('heading', { level: 1 })` has count 1.
- Narrow (390×844) `/settings`: `page.getByRole('heading', { level: 1, name: 'Settings' })` is
  visible, `chrome.getByRole('heading')` has count 0, and the heading's bounding box top is at or
  below the bottom of `chrome`'s bounding box.
- Wide client navigation: from `/settings`, click `#sidebar a[href="/browse"]`; the chrome heading
  reads "Browse". Then `page.goto` the seeded podcast page
  (`/podcast/${E2E_PODCAST_CHANNEL_ID_TEXT}` from `./helpers/seedConstants`): `chrome.getByRole('heading')`
  has count 0 and `page.getByRole('heading', { level: 1, name: E2E_PODCAST_CHANNEL_TITLE })` is
  visible (the podcast header keeps the page's heading).
- Wide pages with a header and no list (R31), one `test.step` each: `/terms` → "Terms",
  `/membership` → "Membership", `/sign-up` → "Sign Up" show their title as the chrome heading.
  Read the exact strings from `packages/i18n-catalog/consumer/originals/en-US.json`
  (`terms.terms`, `membership.membership`, `authentication.sign_up`).

## Release scratchpad

```markdown
## Web pages use one top bar with the page title

- Surfaces: web, packages/ui (management-web unaffected)
- Change: on tablet and desktop widths the page title (Settings, Subscribed, Browse, Membership,
  and every other page with a title) sits at the left of the top bar, to the right of the sidebar
  logo, with search, notifications, and the account menu on the right. The second title bar under
  it is gone; page buttons such as Add Feed or Create Playlist sit at the top of the page content.
  On phone widths the bar keeps the logo and icons and the title is its own row under it. Podcast,
  episode, album, artist, track, and other detail pages show no title in the bar; their own header
  carries the name. `@podverse/ui` adds `AppBarTitleProvider`, `useAppBarTitle`,
  `usePublishAppBarTitle`, and a `title` prop on `NavBar`; the `--header-desktop-height` and
  `--header-mobile-height` tokens are removed.
- Who notices: every web listener
- Operator steps: none
```
