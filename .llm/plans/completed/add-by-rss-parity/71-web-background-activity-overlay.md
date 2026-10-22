# 71 — Web background activity overlay

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

Rows: R31, R32, R33, R34, R35, R36, R37, R39. Web only. Runs after plan 70
(`backgroundActivityStore.ts`, `backgroundActivityDisplay.ts`, `useBackgroundActivity.ts`).

Parity source: the mobile `GlobalActivityBar` (`apps/mobile/src/components/feedback/`): a translated
label, a `{completed} of {total}` count, and a spinner while work runs, gone when it stops, with a
screen-reader announcement of the label (not the count) when it changes. Web shows the same content
in a corner control instead of a bar.

## Answers

**R34 — what sits above the web mini player today.** Nothing. `MediaPlayerDesktop` and
`MediaPlayerMobile` render one row each, and the current clip or chapter appears in the player's own
title line (`getMediaPlayerInfoResolution`). The theme still reserves a strip above the player,
`--media-player-height-top-section` (28px), which the floating video uses in its `.hasMarquee`
position. The overlay sits above the player height **plus** that strip, at one fixed position, so it
never moves when the player opens or closes and does not collide with a strip if one returns.

**Other corner chrome.** Toasts are top-right (`ToastImpl.tsx`, `position="top-right"`). The cookie
banner is a full-width fixed strip at the bottom (`z-index: 200`). The floating video is fixed
bottom-right above the player (`z-index: 1000`). Modals are `z-index: 10000`.

## Locked decisions

1. **Where it mounts.** `AppChrome.tsx`, right after `<LazyLoadedComponents />` inside
   `WindowWrapper`. `AppChrome` already returns early for embed routes and the terms and popularity
   gates, so the overlay is absent there.
1. **When it shows (R39, R37).** Only while `selectVisibleBackgroundActivity(entries, {
   addByRSSFollowCount })` is non-empty, where `addByRSSFollowCount =
   loggedInAccount?.account_following_add_by_rss_channels?.length ?? 0`. Signed out, or signed in
   with no Add by RSS follows, it never renders.
1. **Position (R32, R34).** `position: fixed`, `right: var(--spacing-lg)`, and `bottom` equal to
   player height + `--media-player-height-top-section` + `--spacing-lg` + the bottom safe-area
   inset: `--media-player-height-mobile` below the `lg` breakpoint, `--media-player-height` from
   `lg` up, the same breakpoint the player itself switches on. The position does not depend on
   whether the player is showing.
1. **Stacking.** `z-index: 150`: above page content, the navbar (100), and the mobile sidebar
   (100); under the cookie banner (200), so consent stays reachable; under the floating video
   (1000), which the user opened on purpose; under modals.
1. **Collapsed (R36).** A 2.5rem round button showing only the spinner. Collapsed is the default.
1. **Expanded (R33).** The same button grows to the left (it is anchored on the right), showing each
   visible entry's message and, when that entry has counted steps, its count, then the spinner on
   the right. Width `min-width: 15rem`, `max-width: min(22.5rem, calc(100vw - 2 * var(--spacing-lg)))`;
   a long message truncates with an ellipsis. Clicking the expanded control collapses it.
1. **Remembered (R35).** A new optional `local-settings` cookie field `bae` (background activity
   expanded), read at SSR like `sba`. Missing means collapsed. Device-local; never synced.
1. **Accessibility.** The control is a real `<button>` with `aria-label` "Background Activity" and
   `aria-expanded`. When expanded, `aria-describedby` points at the message. A visually hidden
   `role="status"` region, rendered whether or not the button shows, carries the joined labels
   (no counts) so a screen reader hears the message even while collapsed, and does not hear a
   number change every few seconds. The spinner is decorative.
1. **No animation.** The width changes without a transition.

## Files

| File                                                                         | Change               |
| ---------------------------------------------------------------------------- | -------------------- |
| `apps/web/src/components/BackgroundActivity/BackgroundActivityOverlay.tsx`   | New                  |
| `apps/web/src/styles/components/BackgroundActivity/BackgroundActivityOverlay.module.scss` | New     |
| `apps/web/src/components/App/AppChrome.tsx`                                  | Mount the overlay    |
| `apps/web/src/utils/localSettings/localSettings.ts`                          | `bae` field          |
| `apps/web/src/utils/localSettings/localSettings.bae.test.ts`                 | New, Vitest          |
| `apps/web/src/contexts/LocalSettings.tsx`                                    | `bae` state + setter |
| `packages/i18n-catalog/consumer/originals/{en-US,es,fr,el-GR}.json`          | `background_activity` |
| `apps/web/e2e/background-activity-overlay.spec.ts`                           | New                  |
| `makefiles/local/e2e-spec-order-web.txt`                                     | Add the spec         |
| `release-notes/scratchpad.md`                                                | Entry                |

## Implementation

### `localSettings.ts`

- Legend comment: add `  - bae = backgroundActivityExpanded (bottom-right activity overlay open;
  collapsed when unset)` after the `sp` line.
- `LocalSettingsState`: add `bae?: boolean; // backgroundActivityExpanded` after `sp`.
- `getDefaultLocalSettings()`: add `bae: false` after `sp: []`.
- `isValidLocalSettings`: add `&& (s.bae === undefined || typeof s.bae === 'boolean')` after the
  `pmt` clause.

### `LocalSettings.tsx`

- Context type: after `setPreferredMediaType`, add

  ```typescript
  /** Background activity overlay open; collapsed by default (`bae` in the cookie). */
  backgroundActivityExpanded: boolean;
  setBackgroundActivityExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  ```

- State: `const [backgroundActivityExpanded, setBackgroundActivityExpanded] =
  useState<boolean>(ssrLocalSettings.bae ?? false);`
- The `useLayoutEffect` write: add `bae: backgroundActivityExpanded,` after `sp:` and add
  `backgroundActivityExpanded` to its dependency list.
- Provider value: add both names after `setPreferredMediaType`.

### i18n (`consumer` layer)

In each of the four `packages/i18n-catalog/consumer/originals/*.json`, insert a new top-level block
immediately before `"media_player": {` (line 414 in each file today; find it with Grep). Same
position in all four, so key order matches.

| Key                                       | en-US                     | es                            | fr                            | el-GR                          |
| ----------------------------------------- | ------------------------- | ----------------------------- | ----------------------------- | ------------------------------ |
| `background_activity.title`               | Background Activity       | Actividad en segundo plano    | Activité en arrière-plan      | Δραστηριότητα στο παρασκήνιο   |
| `background_activity.add_by_rss_refresh`  | Updating Your RSS Feeds   | Actualizando tus fuentes RSS  | Mise à jour de vos flux RSS   | Ενημέρωση των ροών RSS σας     |
| `background_activity.progress`            | {completed} of {total}    | {completed} de {total}        | {completed} sur {total}       | {completed} από {total}        |

The English and translated messages match mobile's `sync.job.rss_feeds` and `sync.progress`
(mobile layer). The new path does not exist in the `mobile` layer, so `i18n:validate` sees no
duplicate. Do not edit `overrides/`.

### `BackgroundActivityOverlay.tsx`

`'use client'`. Imports: `classNames`, `useTranslations` (next-intl), `useId`, `useMemo`,
`LoadingSpinner` from `@podverse/ui`, `useAccount`, `useLocalSettings`, `useBackgroundActivity`,
`BACKGROUND_ACTIVITY_LABEL_KEYS` and `selectVisibleBackgroundActivity`; the styles import last.

```tsx
/**
 * Bottom-right control that shows running background work, such as Add by RSS feed refreshes.
 * It appears only while that work runs for this account and remembers whether it was left open.
 */
export function BackgroundActivityOverlay() { … }
```

Body:

- `t = useTranslations('background_activity')`; `entries = useBackgroundActivity()`;
  `addByRSSFollowCount` as in decision 2; `visible = useMemo(() =>
  selectVisibleBackgroundActivity(entries, { addByRSSFollowCount }), [entries,
  addByRSSFollowCount])`.
- `const { backgroundActivityExpanded: expanded, setBackgroundActivityExpanded } =
  useLocalSettings();` and `detailsId = useId()`.
- `announcement = visible.map((entry) => t(BACKGROUND_ACTIVITY_LABEL_KEYS[entry.kind])).join('. ')`.

Render:

```tsx
<>
  <div aria-live="polite" className={styles.visuallyHidden} role="status">
    {announcement}
  </div>
  {visible.length > 0 ? (
    <div className={styles.root} data-testid="background-activity-overlay">
      <button
        aria-describedby={expanded ? detailsId : undefined}
        aria-expanded={expanded}
        aria-label={t('title')}
        className={classNames(styles.toggle, expanded && styles.expanded)}
        data-testid="background-activity-toggle"
        onClick={() => setBackgroundActivityExpanded((current) => !current)}
        type="button"
      >
        {expanded ? (
          <span className={styles.details} data-testid="background-activity-details" id={detailsId}>
            {visible.map((entry) => (
              <span className={styles.line} key={entry.kind}>
                <span className={styles.label}>{t(BACKGROUND_ACTIVITY_LABEL_KEYS[entry.kind])}</span>
                {entry.total > 0 ? (
                  <span className={styles.count}>
                    {t('progress', { completed: entry.completed, total: entry.total })}
                  </span>
                ) : null}
              </span>
            ))}
          </span>
        ) : null}
        <LoadingSpinner className={styles.spinner} decorative size="small" />
      </button>
    </div>
  ) : null}
</>
```

### `BackgroundActivityOverlay.module.scss`

```scss
@use '../../mixins/focus';
@use '../../mixins/media-queries' as *;

.root {
  position: fixed;
  right: var(--spacing-lg);
  bottom: calc(
    var(--media-player-height-mobile) + var(--media-player-height-top-section) +
      var(--spacing-lg) + env(safe-area-inset-bottom, 0px)
  );
  z-index: 150;
}

@include desktop(lg-min) {
  .root {
    bottom: calc(
      var(--media-player-height) + var(--media-player-height-top-section) + var(--spacing-lg) +
        env(safe-area-inset-bottom, 0px)
    );
  }
}
```

Then `.toggle` (flex row, `align-items: center`, `justify-content: center`, `gap: var(--spacing-md)`,
`width: 2.5rem`, `height: 2.5rem`, `padding: 0`, `box-sizing: border-box`, `border: 1px solid
var(--border-color-opaque)`, `border-radius: var(--border-radius-round)`, `background-color:
var(--background-color-secondary)`, `color: var(--text-color-secondary)`, `box-shadow:
var(--shadow-modal)`, `cursor: pointer`, `font: inherit`; `&:focus-visible { @include
focus.focus-ring; }`), `.toggle.expanded` (`width: auto`, `min-width: 15rem`, `max-width` from
decision 6, `justify-content: flex-end`, `padding: 0 var(--spacing-md)`), `.details` (flex column,
`flex: 1`, `min-width: 0`, `text-align: left`, `font-size: var(--font-size-sm)`), `.line` (flex
row, `justify-content: space-between`, `gap: var(--spacing-md)`, `min-width: 0`), `.label`
(`overflow: hidden`, `text-overflow: ellipsis`, `white-space: nowrap`), `.count` and `.spinner`
(`flex-shrink: 0`), and `.visuallyHidden` (copy the declarations of `.playbackErrorAnnouncer` in
`styles/components/MediaPlayer/MediaPlayer.module.scss`).

The file is two levels under `apps/web/src/styles/`, so `../../mixins/` reaches
`styles/mixins/focus.scss` and `styles/mixins/media-queries` (the three-level
`MediaPlayerMobile.module.scss` uses `../../../mixins/`). No `var()` fallbacks
(**css-custom-properties-no-var-fallbacks**).

### `AppChrome.tsx`

Import `BackgroundActivityOverlay` from `../BackgroundActivity/BackgroundActivityOverlay` and render
`<BackgroundActivityOverlay />` on the line after `<LazyLoadedComponents />`.

### `e2e-spec-order-web.txt`

Insert `apps/web/e2e/background-activity-overlay.spec.ts` after
`apps/web/e2e/navbar-chrome.spec.ts` (app chrome specs together).

## Tests

**Unit** — `localSettings.bae.test.ts`, copying `localSettings.pmt.test.ts`:

- No cookie → `getParsedLocalSettings().bae` is `false`.
- A cookie that predates the field (the `legacy` object from the pmt test) → `bae` is `false`.
- A cookie with `bae: true` → `true`.
- A cookie with `bae: 'yes'` → the whole cookie is invalid and defaults apply (`bae` is `false`).

Plan 70's store and display tests cover the counting and the R39 rule.

**Playwright** — `apps/web/e2e/background-activity-overlay.spec.ts`, top-level describe
`'Background activity overlay'`. Reuse `loginSeedUser`, `stubAddByRSSParse`, and
`stubAddByRSSParseAll` (`helpers/addByRSSCredentials`), `E2E_ADD_BY_RSS_TEST_ASSETS_FEED_URL`
(`helpers/seedConstants`), and `capturePageLoad` (`helpers/stepScreenshots`), passing the element
each step checked. The seeded account follows the test-assets feed by RSS and a fresh browser has
never parsed it, so its first parse starts on load.

Test 1, `test.setTimeout(60_000)`, with the comment "The parse stays in flight until the last step
releases it, so the overlay stays up across reloads." Before navigating: `loginSeedUser`, create a
`statusReleased` promise and its release function as in `add-by-rss-auto-parse.spec.ts`, stub the
test-assets parse with `outcomes: [{ status: 'parsed' }]` and `statusReleased`, and stub parse-all.
Steps:

1. "The overlay appears collapsed above the player area while feeds refresh":
   `goto('/add-by-rss')`; `getByTestId('background-activity-overlay')` visible (15 s);
   the toggle has `aria-expanded="false"` and accessible name "Background Activity";
   `background-activity-details` has count 0. Read `page.viewportSize()` and the overlay's
   `boundingBox()`: its right edge is within 24px of the viewport's right edge, and its bottom is at
   most `viewport.height - 128` (100px player + 28px strip at the default 1280px width).
1. "Clicking the overlay expands it to the left with the message": click the toggle;
   `aria-expanded="true"`; details visible with text "Updating Your RSS Feeds"; the overlay's new
   bounding box is wider than before and its right edge has not moved (within 1px).
1. "A reload keeps it expanded": `page.reload()`; overlay visible (15 s) and the toggle is
   `aria-expanded="true"` before any click. (The library page first-parses the still-queued feed
   again, so work is running.)
1. "Collapsing is remembered too": click the toggle → `aria-expanded="false"`; `page.reload()`;
   overlay visible (15 s) with `aria-expanded="false"`.
1. "The overlay goes away when the refresh finishes": release the status; the overlay has count 0
   (15 s).

Test 2, "A signed-out visitor never sees the overlay": no login; `goto('/')`; wait for the
`main` landmark; `getByTestId('background-activity-overlay')` has count 0.

## Release scratchpad

Append to `release-notes/scratchpad.md`:

```markdown
## Web shows Add by RSS refreshes in a corner overlay

- Surfaces: web
- Change: while this browser refreshes Add by RSS feeds (follow sync, first parses, refresh-all, and
  single-feed parses), a small round control with a spinner appears fixed in the bottom-right
  corner, above the space the media player uses, whether or not the player is open. Clicking it
  expands it to the left to read "Updating Your RSS Feeds" with a count such as "2 of 5"; clicking
  again collapses it. The browser remembers expanded or collapsed in the local-settings cookie
  (`bae`); collapsed is the default. It never appears for signed-out visitors or for accounts that
  follow no Add by RSS feeds, and it disappears when the work finishes. Failures stay out of the
  overlay. Screen readers hear the message when it changes.
- Who notices: signed-in web users who follow feeds by RSS URL
- Operator steps: none
```
