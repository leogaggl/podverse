**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 10 — Remove the browser history arrows from the app bar

The web app bar shows Back and Forward buttons (browser history) on large screens. Remove them
everywhere, including the shared `@podverse/ui` NavBar prop that draws them. Player skip-back and
skip-forward are a different control (media player) and are not touched.

## Rows

R1, R28, R34

## Runs after

none

## Answers from the code

- **R34 (management-web uses `backForward`?)** No. `apps/management-web/src/components/ManagementNavBar/ManagementNavBar.tsx`
  passes `accountMenu` and `brand` only. Management-web keeps its own layout and needs no edit for
  this plan; removing the prop is safe.
- **R28** Player skip controls live under `apps/web/src/components/MediaPlayer/**` and do not use
  `NavArrowButton` or `backForward`. Nothing there changes.
- `NavArrowButton` is used only by the shared NavBar (`rg NavArrowButton apps packages`), so the
  component goes with the prop.
- `misc.browser_back` / `misc.browser_forward` are read only by `apps/web/src/components/NavBar/NavBar.tsx`
  (mobile does not use them), so the keys are removed from the consumer catalog.

## Changes

### `packages/ui/src/components/navigation/NavBar/NavBar.tsx`

- Delete `NavBarBackForwardProps`, the `backForward` field on `NavBarProps`, the `backForward`
  parameter, the `{backForward !== undefined ? (<div className={styles.leftCluster}>…) : null}`
  block, and the `NavArrowButton` import.

### `packages/ui/src/components/navigation/NavBar/NavBar.module.scss`

- Delete the `.leftCluster` rule and its "Absorbed from NavBarLeftButtons" comment.

### `packages/ui/src/components/navigation/NavBar/index.ts` and `packages/ui/src/index.ts`

- Remove `NavBarBackForwardProps` from both type export lists.
- In `packages/ui/src/index.ts`, remove the two `NavArrowButton` export lines.

### `packages/ui/src/components/navigation/NavArrowButton/`

- Delete the folder: `NavArrowButton.tsx`, `NavArrowButton.module.scss`,
  `NavArrowButton.test.tsx`, `index.ts`.

### `packages/ui/src/components/navigation/NavBar/NavBar.test.tsx`

- Delete the test `renders back and forward controls when backForward is set`.

### `packages/ui/PACKAGES-UI.md`

- In § Navigation — NavBar, drop `backForward` from the optional regions list and delete the two
  `Back / forward` rows from the i18n table.

### `apps/web/src/components/NavBar/NavBar.tsx`

- Delete the `backForward={{ … }}` prop, the `useRouter` import and `const router = useRouter();`
  (only the arrows used it). Keep `usePathname` (the sidebar-close effect uses it). `tMisc` stays
  (menu toggle labels use it).

### Consumer catalog originals

In each of `packages/i18n-catalog/consumer/originals/{en-US,es,fr,el-GR}.json`, delete the
`"browser_back"` and `"browser_forward"` lines under `misc` (about line 782; Grep the key, edit with
StrReplace, never rewrite the file). Keep the JSON valid (watch the trailing comma on the line
before).

Then run `npm run i18n:compile` from the repo root (agent shell:
`eval "$(direnv export zsh)"` first). Compile rebuilds the override files from the originals'
structure, which drops the two empty override slots so `i18n:validate` does not report extra
override keys. Do not hand-edit `overrides/`.

### `apps/web/e2e/navbar-chrome.spec.ts`

- First test: rename to `the home page shows the account menu and no history controls on a wide
  viewport`; keep the Account assertion; replace the two `toBeVisible()` Back/Forward lines with
  `toHaveCount(0)` for `chrome.getByRole('button', { name: 'Back' })` and
  `chrome.getByRole('button', { name: 'Forward' })`. Update the capture label to match ("The wide
  home page shows the account menu and no Back or Forward buttons.").

### `apps/web/e2e/focus-states.spec.ts`

- The comment above the Tab-focus loop (about line 104) names "Back/Forward/Account". Change it to
  name the account menu trigger only. No logic change: the account trigger is still a `button`
  inside `nav[data-appearance="web"]`.

## Files

packages/ui/src/components/navigation/NavBar/NavBar.tsx
packages/ui/src/components/navigation/NavBar/NavBar.module.scss
packages/ui/src/components/navigation/NavBar/NavBar.test.tsx
packages/ui/src/components/navigation/NavBar/index.ts
packages/ui/src/index.ts
packages/ui/src/components/navigation/NavArrowButton/NavArrowButton.tsx
packages/ui/src/components/navigation/NavArrowButton/NavArrowButton.module.scss
packages/ui/src/components/navigation/NavArrowButton/NavArrowButton.test.tsx
packages/ui/src/components/navigation/NavArrowButton/index.ts
packages/ui/PACKAGES-UI.md
apps/web/src/components/NavBar/NavBar.tsx
packages/i18n-catalog/consumer/originals/en-US.json
packages/i18n-catalog/consumer/originals/es.json
packages/i18n-catalog/consumer/originals/fr.json
packages/i18n-catalog/consumer/originals/el-GR.json
packages/i18n-catalog/consumer/overrides/es.json
packages/i18n-catalog/consumer/overrides/fr.json
packages/i18n-catalog/consumer/overrides/el-GR.json
apps/web/e2e/navbar-chrome.spec.ts
apps/web/e2e/focus-states.spec.ts
release-notes/scratchpad.md

The three `overrides/` files change only through `npm run i18n:compile`.

## Tests

- Unit (`packages/ui`, vitest): `NavBar.test.tsx` loses the back/forward test; the
  `NavArrowButton` test file is deleted with the component.
- Playwright: `apps/web/e2e/navbar-chrome.spec.ts` asserts the wide home page has no Back or
  Forward button. `apps/web/e2e/focus-states.spec.ts` comment only.
- Management-web `apps/management-web/e2e/navbar-chrome.spec.ts` needs no change (it never
  asserted history buttons).

## Release scratchpad

```markdown
## Web app bar drops the Back and Forward buttons

- Surfaces: web
- Change: the browser-history Back and Forward arrows at the top left of the web app bar are
  gone on every page. The browser's own back and forward still work. Media player skip-back and
  skip-forward buttons are unchanged. The shared `@podverse/ui` NavBar no longer accepts a
  `backForward` prop, and `NavArrowButton` is removed from the package.
- Who notices: web listeners on tablet and desktop widths
- Operator steps: none
```
