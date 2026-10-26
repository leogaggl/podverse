**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 10 — Media list chips select on click, the list area shows a spinner, and the row stays still

## Rows

R1, R2, R3, R11, R12

## Runs after

none

## Files

apps/web/src/components/MediaListChips/MediaListChips.tsx
apps/web/src/components/MediaListChips/MediaListLoadingSpinner.tsx
apps/web/src/styles/components/MediaListChips/MediaListChips.module.scss
packages/ui/src/components/navigation/Chip/ChipRow.tsx
packages/ui/src/components/navigation/Chip/ChipRow.module.scss
packages/ui/src/components/navigation/Chip/ChipRow.test.tsx
apps/web/src/app/recommendations/RecommendationsPageClient.tsx
apps/web/src/components/AddByRSS/List/AddByRSSListClient.tsx
apps/web/src/components/AddByRSS/List/AddByRSSEpisodesPageClient.tsx
apps/web/src/components/AddByRSS/List/AddByRSSArtistsPageClient.tsx
apps/web/src/components/AddByRSS/List/AddByRSSTracksPageClient.tsx
apps/web/src/components/AddByRSS/List/AddByRSSLivestreamsPageClient.tsx
apps/web/e2e/media-list-chips.spec.ts

## Tests

- Unit (Vitest, `packages/ui`): three tests in `ChipRow.test.tsx` (§ Unit tests below) for the
  remembered scroll offset, focus after a remount, and `trailingHidden`.
- Playwright: two new tests in `apps/web/e2e/media-list-chips.spec.ts` (§ E2E below). They hold
  the server response for a chip, then check four things while it is held: the clicked chip is
  pressed, the old rows are hidden, the spinner shows in the list area, and the chip row has not
  moved. Then they release it and check the new list and the row position again.
- No unit test for `MediaListChips` itself. A mocked `useRouter` finishes the transition
  synchronously, so a unit test cannot hold the pending state this change is about, and jsdom does
  not apply the CSS that hides the old list.

## Release scratchpad

```markdown
## Media list chips respond on click and the list shows a spinner while it loads

- Surfaces: web (shared `ChipRow` in `@podverse/ui` gains two opt-in props)
- Change: On Browse, Subscribed (Home), Add by RSS, and Recommendations, a media chip (Podcasts,
  Episodes, Tracks, …) shows as selected the moment it is clicked. The old list disappears at once
  and a spinner takes its place in the list area until the new list arrives. The chip row does not
  move: it keeps its horizontal scroll position and keyboard focus when the new list arrives, and
  the page keeps its vertical scroll position. While the new list loads, the old list's Category,
  Sort, and gear controls are hidden but keep their space. Clicking another chip while one is
  loading goes to the chip clicked last, including going back to the chip the page started on.
  Add by RSS and Recommendations show the same in-list spinner while their own lists load, instead
  of a spinner centered on the screen (Add by RSS) or a "Loading…" line (Recommendations).
  Before, the chip stayed unselected and the old list stayed on screen until the server finished
  rendering the new list, which could take seconds on a slow API response, and the chip row could
  jump sideways when the new list arrived.
- Who notices: every web user who switches media chips, most on slow connections, slow lists, or
  narrow screens where the chip row scrolls sideways
- Operator steps: none
```

## Why the chip is slow (answers R1 and R2)

`MediaListChips` gets `selected` from the server page (`apps/web/src/app/browse/page.tsx`,
`resolveMediaListChip`). `onSelect` writes the cookie and calls `router.replace(path)`, but
renders nothing new itself. The page server render awaits the list request
(`loadTracksListProps` → `reqItemGetMany`, 60 rows) before Next.js commits anything. Browse has
no `loading.tsx`, so the old page, chip included, stays exactly as it was until that response
arrives. The chip's delay is the whole server round trip.

Remote images are not what holds the chip. List artwork goes through the shared `Image`
(`packages/ui/src/components/image/Image/Image.tsx`), which renders `next/image`. In Next.js
16.4, that defaults to `loading="lazy"` and `decoding="async"` when `priority` is not set, and no
list row sets `priority`. Off-screen artwork is not fetched, and decoding runs off the main
thread. Plan 11 makes that contract explicit and tests it. Large GIFs on the incoming list cost
bandwidth and memory, but they start loading only after the chip and list have committed, so they
cannot delay the click.

## Why the chip row moves today (answers R12)

Every page picks a different list client per chip (`PodcastsPageClient`, `TracksPageClient`, …
in `browse/page.tsx` and `app/page.tsx`; `AddByRSSListClient`, `AddByRSSTracksPageClient`, … in
`add-by-rss/page.tsx`). Each client renders its own header, `MainWrapper`, `MainSidebarLayout`,
`MainColumnStack`, chip row, and list. A different component type at the root means React
replaces the whole tree when the new chip's render commits, chip row included. The new `ChipRow`
starts at `scrollLeft` 0 and its mount effect jumps the selected chip to the row's edge if it is
not visible there. On a narrow screen where the row scrolls, the clicked chip slides sideways.
The clicked button also leaves the DOM, so keyboard focus falls to `<body>`.

Recommendations renders one `RecommendationsPageClient` for every chip, so its row is never
replaced. It fetches the list on the client after the chip prop changes.

A selected pill changes only its colors (`Chip.module.scss` `.pill.selected`), never its width,
so selection itself cannot push other chips.

## Design

### The row is replaced on commit but never moves

The chip row stays inside each list client. Each client's trailing controls (Category, Sort,
gear) read that list's own context, and they must render on the server. Lifting the row into one
shared frame above the per-chip clients would need those controls portaled into the frame, and a
portal does not render on the server. The controls would then pop into the row after hydration
on every first load, and on Add by RSS the action buttons above the row would push it down. So
the row's DOM is still replaced when the new list commits, and `ChipRow` makes that replacement
invisible:

- `ChipRow` gets an opt-in `memoryKey`. Rows with the same key share one remembered horizontal
  offset in this browser tab. A row that mounts with a remembered offset resumes it before paint.
  The selected-chip reveal then runs animated, as on a selection change, and does nothing when
  the chip is already fully visible.
- A chip pressed while it had keyboard focus is remembered. If the next row with that key mounts
  with that chip selected while focus is on `<body>`, the chip gets focus back
  (`preventScroll: true`).
- `MediaListChips` passes `memoryKey={`media-list-chips-${page}`}`.

Within one visit the chip row's chips never move. When the user opens Browse again later in the
same tab, the row resumes the offset it last had, and the selected chip is still revealed if it
is clipped.

### Pending state

`MediaListChips` keeps an optimistic copy of the selected chip and runs the navigation in a React
transition (`useOptimistic` + `useTransition`). While the transition is pending:

- The pressed chip is the optimistic chip. It changes in the same frame as the click.
  `ChipRow`'s existing reveal slides it fully into view only when it is clipped at an edge. A
  fully visible chip does not move.
- `MediaListChips` renders `MediaListLoadingSpinner` right after the row and adds
  `chipRowPending` to the row's class. A CSS rule in `MediaListChips.module.scss` hides every
  later sibling in the column except that spinner. Everything after the chip row in
  `MainColumnStack` is the list area on all four pages: the rows, pagination, empty states,
  call-to-action messages, the Browse category list, and any list overlay. Add by RSS's Add Feed
  and Check for Updates row sits before the chip row and stays visible.
- The old list's trailing controls stay mounted but get `trailingHidden`: `visibility: hidden`
  plus `inert`. They keep their width, so a row scrolled to its right end does not get clamped
  and shift, and the old list's Sort cannot be used under the new chip.
- The spinner block has `min-height: 100vh`. While the user can see the chip row, the page stays
  tall enough that hiding the rows cannot clamp the vertical scroll and pull the row down.
- `router.replace(path, { scroll: false })` keeps the page's vertical scroll when the new list
  commits. Next.js's default would scroll to the top of the page segment when the header is
  off-screen, which moves the row.

When the new render commits, the new list client mounts with `selected` equal to the clicked
chip, its row resumes the remembered offset and focus, and `isPending` is false, so the spinner
and the hiding rule go away in the same commit.

The quick-click rules stay as before (last chip clicked wins, including going back to the
starting chip):

- The early return compares against `shownChip`, not `selected`. Clicking the chip that is
  already loading does nothing. Clicking the server chip while another chip loads is a real
  change of mind and goes through.
- `router.refresh()` stays only for the idle case where the clean URL is already the address.
  For example, the URL is `/browse` and the stored chip is Tracks: clicking Podcasts clears the
  cookie and re-renders the same URL. The refresh runs in the same transition, so it gets the
  same spinner.
- While a chip navigation is pending, the address is still the old URL (Next.js updates history
  after commit). Use `router.replace` even when the path equals the current URL. In the Next.js
  router action queue, a navigate action discards the in-flight navigation, while a refresh is
  queued behind it, so a refresh would let the abandoned chip win.

### After commit, on pages that load on the client

- **Recommendations** keeps one instance across chips, so after commit the same row stays and
  the client fetch starts in an effect. Today the first render after the chip prop changes still
  shows the previous chip's items, linked with the new chip's paths, for one frame, and then a
  "Loading…" line. The load state records which chip it belongs to. Any state for another chip,
  and the signed-in idle state before the first fetch, render as loading, and loading renders
  `MediaListLoadingSpinner`.
- **Add by RSS** lists load from IndexedDB after mount and show the full-screen
  `WebLoadingSpinnerOverlay` over an empty list area. When no rows are on screen, they render
  `MediaListLoadingSpinner` in the list area instead, so the spinner stays where the pending
  spinner was. When rows stay on screen during a re-sort or a page change, the existing overlay
  stays as it is.

Every caller of `MediaListChips` (Browse, Subscribed, Add by RSS, Recommendations, and the
Playlists and Users chips on Browse) gets the pending behavior with no caller change. The
standalone `/playlists` and `/profiles` pages render `ChipRow` directly and are unchanged.

## Implementation

### `packages/ui/src/components/navigation/Chip/ChipRow.tsx`

1. Add two props to `ChipRowProps<T>`, after `testId`:

   ```ts
   /**
    * Rows with the same key share one remembered horizontal offset in this tab. A row that mounts
    * with a remembered offset resumes it, and a chip pressed with keyboard focus just before the
    * row remounts gets focus back.
    */
   memoryKey?: string;
   /** Keeps the trailing controls' space but hides them and takes them out of the focus order. */
   trailingHidden?: boolean;
   ```

1. At module scope, after `DRAG_START_PX`:

   ```ts
   type ChipRowMemory = { scrollLeft: number; focusKey: string | null };

   /** Read and written only in effects and event handlers, so a server render never touches it. */
   const chipRowMemory = new Map<string, ChipRowMemory>();
   ```

1. Destructure `memoryKey` and `trailingHidden` in the component.

1. Add a scroll handler and pass it to the scroller div as `onScroll={onScroll}`:

   ```ts
   const onScroll = () => {
     const scroller = scrollerRef.current;
     if (memoryKey === undefined || scroller === null) {
       return;
     }
     chipRowMemory.set(memoryKey, {
       scrollLeft: scroller.scrollLeft,
       focusKey: chipRowMemory.get(memoryKey)?.focusKey ?? null,
     });
   };
   ```

1. Change each chip's `onClick` to record the press before calling `onSelect`:

   ```tsx
   onClick={(event) => {
     if (memoryKey !== undefined) {
       chipRowMemory.set(memoryKey, {
         scrollLeft: scrollerRef.current?.scrollLeft ?? 0,
         focusKey: document.activeElement === event.currentTarget ? item.key : null,
       });
     }
     onSelect(item.key);
   }}
   ```

1. Rewrite the start of the `useLayoutEffect` on `[selectedKey]` so the first run resumes the
   remembered offset and focus before the reveal. Keep the reveal code after it unchanged except
   that it reads `animated` from here:

   ```ts
   useLayoutEffect(() => {
     const isMount = !hasRevealedRef.current;
     hasRevealedRef.current = true;
     const scroller = scrollerRef.current;

     let resumed = false;
     if (isMount && memoryKey !== undefined && scroller !== null) {
       const remembered = chipRowMemory.get(memoryKey);
       if (remembered !== undefined) {
         scroller.scrollLeft = remembered.scrollLeft;
         resumed = true;
         chipRowMemory.set(memoryKey, { scrollLeft: remembered.scrollLeft, focusKey: null });
         const active = document.activeElement;
         if (
           selectedKey !== null &&
           remembered.focusKey === selectedKey &&
           (active === null || active === document.body)
         ) {
           chipRefs.current.get(selectedKey)?.focus({ preventScroll: true });
         }
       }
     }
     const animated = !isMount || resumed;

     if (selectedKey === null) {
       return;
     }
     // …existing reveal: chip lookup, getChipRevealOffset, scrollTo with `animated`…
   }, [selectedKey]);
   ```

   Reuse the `scroller` constant in the reveal instead of reading `scrollerRef.current` twice.

1. On the trailing div, set `inert={trailingHidden === true}` and
   `className={classNames(styles.trailing, trailingHidden === true && styles.trailingHidden)}`.

1. Extend the component doc comment with one sentence: with a `memoryKey`, a remounted row
   resumes its remembered offset and focus, and the reveal on that mount is animated. Follow
   **comments-future-forward**.

### `packages/ui/src/components/navigation/Chip/ChipRow.module.scss`

Add after the `.items, .trailing` block:

```scss
.trailingHidden {
  visibility: hidden;
}
```

### `apps/web/src/components/MediaListChips/MediaListLoadingSpinner.tsx` (new)

```tsx
'use client';

import classNames from 'classnames';
import { useTranslations } from 'next-intl';

import { LoadingSpinner } from '@podverse/ui';

import styles from '../../styles/components/MediaListChips/MediaListChips.module.scss';

type MediaListLoadingSpinnerProps = { className?: string };

/** The list area's loading state on the media chip pages: a spinner where the rows go. */
export function MediaListLoadingSpinner({ className }: MediaListLoadingSpinnerProps) {
  const t = useTranslations('misc');
  return (
    <div
      className={classNames(styles.listLoading, className)}
      data-testid="media-list-loading"
      role="status"
    >
      <LoadingSpinner ariaLabel={t('loading')} size="large" />
    </div>
  );
}
```

`misc.loading` already exists in the shared catalog. No new strings.

### `apps/web/src/styles/components/MediaListChips/MediaListChips.module.scss`

Replace the file with:

```scss
.chipRow {
  margin-bottom: var(--spacing-2xl);
}

// Everything after the chip row in its column is the list area. While a chip's list loads, the
// pending spinner is the only part of it that shows.
.chipRowPending ~ :not(.pendingLoading) {
  display: none;
}

// The page stays at least a screen taller than the row, so hiding the rows cannot clamp the
// vertical scroll while the row is on screen.
.listLoading,
.pendingLoading {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  min-height: 100vh;
  padding-top: var(--spacing-4xl);
}
```

`.pendingLoading` carries the same declarations as `.listLoading` so Sass keeps the rule. It must
be defined in this module so `:not(.pendingLoading)` and the class `MediaListChips` passes compile
to the same hashed name.

`.pendingLoading` is separate from `.listLoading` on purpose. A list that is already showing its
own `MediaListLoadingSpinner` (Add by RSS, Recommendations) when another chip is clicked is
hidden like any other list content, so only one spinner shows.

### `apps/web/src/components/MediaListChips/MediaListChips.tsx`

1. Imports: `classNames` from `classnames`; `useEffect`, `useOptimistic`, `useTransition` from
   `react`; `MediaListLoadingSpinner` from `./MediaListLoadingSpinner`.
1. In the component body:

   ```tsx
   const [isPending, startTransition] = useTransition();
   const [shownChip, setShownChip] = useOptimistic(selected);
   ```

1. Replace `onSelect` with:

   ```tsx
   const onSelect = (chip: MediaListChip) => {
     if (chip === shownChip) {
       return;
     }
     writeMediaListChip(page, chip);
     const path = buildMediaListChipPath(page, chip);
     const current = `${window.location.pathname}${window.location.search}`;
     startTransition(() => {
       setShownChip(chip);
       if (path === current && !isPending) {
         router.refresh();
         return;
       }
       router.replace(path, { scroll: false });
     });
   };
   ```

1. Render:

   ```tsx
   return (
     <>
       <ChipRow
         className={classNames(styles.chipRow, isPending && styles.chipRowPending)}
         items={chips.map((chip) => ({ key: chip, label: t(MEDIA_LIST_CHIP_LABEL_KEYS[chip]) }))}
         memoryKey={`media-list-chips-${page}`}
         onSelect={onSelect}
         selectedKey={shownChip}
         testId="media-list-chips"
         trailing={trailing}
         trailingHidden={isPending}
       />
       {isPending ? <MediaListLoadingSpinner className={styles.pendingLoading} /> : null}
     </>
   );
   ```

   The `ChipRow` root must stay a direct child of the caller's column, with the list after it as
   siblings. Every caller already renders it that way. Do not wrap the row in another element.

1. Rewrite the component's doc comment to say what it guarantees: the pressed chip follows the
   click at once; everything after the row in its column is the list area, hidden behind one
   spinner until the new chip's render commits; the old trailing controls keep their space but
   are hidden; the row keeps its horizontal offset and focus across the new render; the last chip
   clicked wins. Follow **comments-future-forward**.

Leave the mount `useEffect` that remembers `urlChip` as it is.

### `apps/web/src/app/recommendations/RecommendationsPageClient.tsx`

1. Record the chip on every non-idle state:

   ```ts
   type LoadState =
     | { status: 'idle' }
     | { status: 'loading'; chip: RecommendationChip }
     | { status: 'error'; chip: RecommendationChip }
     | { status: 'ready'; chip: RecommendationChip; items: DTOAccountRecommendation[] };
   ```

   In the effect, set `{ status: 'loading', chip }`, `{ status: 'ready', chip, items }`, and
   `{ status: 'error', chip }`. The signed-out branch keeps `{ status: 'idle' }`.

1. After the effect, derive what renders:

   ```ts
   const shown: LoadState =
     signedIn && (state.status === 'idle' || state.chip !== chip) ? { status: 'loading', chip } : state;
   ```

   Replace every read of `state` in `items` and in the JSX with `shown`.

1. Replace the loading paragraph
   (`{signedIn && state.status === 'loading' ? <p className={styles.status}>{tMisc('loading')}</p> : null}`)
   with `{signedIn && shown.status === 'loading' ? <MediaListLoadingSpinner /> : null}`. Import
   `MediaListLoadingSpinner` from `../../components/MediaListChips/MediaListLoadingSpinner`.
   `tMisc` is still used for `misc.untitled`.

### Add by RSS list clients

In each file, import `MediaListLoadingSpinner` from `../../MediaListChips/MediaListLoadingSpinner`
(the `AddByRSS/List` folder is two levels below `components/`; match the relative style the file
already uses for `MediaListChipsConfig`).

- **`AddByRSSListClient.tsx`**: in the `isLoading && !isUpdating ? … : …` ternary, replace
  `<WebLoadingSpinnerOverlay isLoading />` with `<MediaListLoadingSpinner />`. Remove the
  `WebLoadingSpinnerOverlay` import if nothing else uses it.
- **`AddByRSSLivestreamsPageClient.tsx`**: replace
  `<WebLoadingSpinnerOverlay isLoading={!!loggedInAccount && !isReady} />` with
  `{loggedInAccount && !isReady ? <MediaListLoadingSpinner /> : null}`, and remove the overlay
  import. Rows render only when `isReady`, so no rows are on screen while this shows.
- **`AddByRSSEpisodesPageClient.tsx`** and **`AddByRSSTracksPageClient.tsx`**: rows can stay on
  screen while `isLoading` (sort and page changes). Replace
  `<WebLoadingSpinnerOverlay isLoading={isLoading} />` with:

  ```tsx
  {isLoading && items.length === 0 ? <MediaListLoadingSpinner /> : null}
  <WebLoadingSpinnerOverlay isLoading={isLoading && items.length > 0} />
  ```

- **`AddByRSSArtistsPageClient.tsx`**: the same as the previous item, with `pagedFeeds.length`
  in place of `items.length`.

The `isLoading ? null : <NoResults … />` branches stay as they are.

## Unit tests

In `packages/ui/src/components/navigation/Chip/ChipRow.test.tsx`. The memory map is module state
that persists between tests in the file, so each test uses its own `memoryKey` string.

1. **`'resumes the remembered offset when a row with the same memoryKey mounts again'`**:
   `stubRowLayout()`. Spy on `Element.prototype` `scrollLeft` (`vi.spyOn(Element.prototype,
   'scrollLeft', 'get')` returning 120, and the `'set'` accessor as a mock). Render with
   `memoryKey="test-resume"` and `selectedKey="podcasts"`, `fireEvent.scroll` the scroller,
   `unmount()`. Clear the setter mock, render again with the same key. Expect the setter called
   with 120. Episodes and Podcasts are inside the stubbed viewport at that offset, so with
   `selectedKey="podcasts"` expect no `scrollTo` call on the second mount.
1. **`'gives focus back to the pressed chip when the row mounts again'`**: render with
   `memoryKey="test-focus"` and `selectedKey="podcasts"`. Focus the Clips button, then
   `fireEvent.click` it, then `unmount()` (focus falls to `<body>`). Render again with the same
   key and `selectedKey="clips"`. Expect `document.activeElement` to be the Clips button.
1. **`'keeps hidden trailing controls in place and out of the focus order'`**: render with
   `testId="row"`, a trailing `<button>Sort</button>`, and `trailingHidden`. Expect
   `row-trailing` to have the `inert` attribute and still contain the Sort button. Rerender
   without `trailingHidden` and expect no `inert` attribute.

Leave the existing tests unchanged; none of them passes `memoryKey`, so their mount behavior is
the same.

## E2E

In `apps/web/e2e/media-list-chips.spec.ts`, inside the top-level
`test.describe('Subscribed, Browse, and Add by RSS chips pages')`, add two tests right after
`'Browse chips keep the chosen chip in the URL and in this browser'`.

Add these helpers beside the other locator helpers near the top of the file (after `rowTop`):

```ts
/**
 * Holds the server render of one chip on one page until the returned function runs. Only the RSC
 * request is held; a full document load of the same URL passes.
 */
const holdChipRender = async (
  page: Page,
  pathname: string,
  tab: string
): Promise<() => void> => {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    (url) => url.pathname === pathname && url.searchParams.get('tab') === tab,
    async (route) => {
      if (route.request().headers()['rsc'] !== '1') {
        await route.fallback();
        return;
      }
      await gate;
      await route.continue();
    }
  );
  return release;
};

const listLoading = (page: Page) => page.getByTestId('media-list-loading');

/** Scrolls the chip row so the chip sits in the middle of it. */
const centerChipInRow = async (page: Page, chipKey: string): Promise<void> => {
  await chipRow(page).evaluate((items, key) => {
    const scroller = items.parentElement;
    const chip = items.querySelector(`[data-testid="media-list-chips-${key}"]`);
    if (scroller === null || chip === null) {
      throw new Error('The chip row or the chip is not in the layout.');
    }
    const scrollerRect = scroller.getBoundingClientRect();
    const chipRect = chip.getBoundingClientRect();
    scroller.scrollLeft +=
      chipRect.left - scrollerRect.left - (scroller.clientWidth - chipRect.width) / 2;
  }, chipKey);
};

const chipBox = async (page: Page, name: string): Promise<{ x: number; y: number }> => {
  const box = await chipButton(page, name).boundingBox();
  expect(box, `${name} chip is in the layout`).not.toBeNull();
  return { x: box?.x ?? 0, y: box?.y ?? 0 };
};

const expectChipStill = async (
  page: Page,
  name: string,
  before: { x: number; y: number }
): Promise<void> => {
  const after = await chipBox(page, name);
  expect(after.x, `${name} chip did not move sideways`).toBeCloseTo(before.x, 0);
  expect(after.y, `${name} chip did not move up or down`).toBeCloseTo(before.y, 0);
};
```

Remove the old plan's `holdBrowseChipRender` and `loadingSpinner` helpers if an earlier attempt
added them. The global navigation overlay also carries the `Loading…` name, so the test finds
the list spinner by its test id.

### Test 1

Title: `'On a narrow Browse, a clicked chip is pressed at once, a spinner replaces the old list, the chip row does not move, and the chip clicked last wins'`.

Start with `await page.setViewportSize({ width: 390, height: 844 })` so the row scrolls sideways.
Each step ends with `capturePageLoad(page, testInfo, '<sentence>', <element>)` on the element
the step verifies (**e2e-screenshot-verified-element**). Define
`const artistTitle = page.getByRole('heading', { name: E2E_DIRECTORY_ARTIST_TITLE, level: 3 })`.

1. **"Browse Artists lists the directory artist, and the Tracks chip sits in the middle of the
   row"**: `goto('/browse?tab=artists')`, `expectPressedChip(page, 'Artists')`, `artistTitle`
   visible. `await centerChipInRow(page, 'tracks')`, then
   `const tracksBefore = await chipBox(page, 'Tracks')`. Capture on the Tracks chip.
1. **"While the Tracks list is held, Tracks is pressed, the artist is hidden, a spinner shows,
   and the row has not moved"**: `const releaseTracks = await holdChipRender(page, '/browse',
   'tracks')`, click the Tracks chip. Expect Tracks `aria-pressed="true"`, Artists
   `aria-pressed="false"`, path still `/browse?tab=artists`, `artistTitle` hidden,
   `listLoading(page)` visible, `sortChip(page)` hidden, and
   `expectChipStill(page, 'Tracks', tracksBefore)`. Capture on `listLoading(page)`.
1. **"When the Tracks list arrives, the spinner is gone, Tracks keeps focus, and the row has not
   moved"**: `releaseTracks()`. Expect path `/browse?tab=tracks`, Tracks pressed,
   `listLoading(page)` count 0, `sortChip(page)` visible, the Tracks chip focused
   (`toBeFocused()`), and `expectChipStill(page, 'Tracks', tracksBefore)`. Then
   `await page.unrouteAll({ behavior: 'ignoreErrors' })`. Capture on the Tracks chip.
1. **"Clicking Albums and then Artists before Albums loads ends on Artists"**:
   `const releaseAlbums = await holdChipRender(page, '/browse', 'albums')`. Click Albums and
   expect it pressed and `listLoading(page)` visible. Click Artists. Expect path
   `/browse?tab=artists`, Artists pressed, `artistTitle` visible, and `listLoading(page)` count 0.
   Then `releaseAlbums()`, and expect the path is still `/browse?tab=artists` with Artists
   pressed. Then `await page.unrouteAll({ behavior: 'ignoreErrors' })`. Capture on `artistTitle`.
1. **"Clicking Episodes and then Artists again before Episodes loads stays on Artists"**:
   `const releaseEpisodes = await holdChipRender(page, '/browse', 'episodes')`. Click Episodes
   and expect it pressed and `artistTitle` hidden. Click Artists and expect it pressed. Call
   `releaseEpisodes()`. Expect path `/browse?tab=artists`, Artists pressed, `artistTitle`
   visible, and `listLoading(page)` count 0. Then
   `await page.unrouteAll({ behavior: 'ignoreErrors' })`. Capture on the Artists chip.

### Test 2

Title: `'On signed-out Subscribed, a clicked chip hides the getting-started message behind a spinner until its list arrives'`.

1. **"While the Episodes list is held, Episodes is pressed and a spinner replaces the
   getting-started message"**: `goto('/')`, expect `'Your subscriptions will appear here.'`
   visible and Podcasts pressed. `const podcastsBefore = await chipBox(page, 'Podcasts')`.
   `const releaseEpisodes = await holdChipRender(page, '/', 'episodes')`, click Episodes. Expect
   Episodes pressed, the getting-started text hidden, `listLoading(page)` visible, and
   `expectChipStill(page, 'Podcasts', podcastsBefore)`. Capture on `listLoading(page)`.
1. **"When the Episodes list arrives, the URL names episodes and the spinner is gone"**:
   `releaseEpisodes()`. Expect path `/?tab=episodes`, Episodes pressed, `listLoading(page)`
   count 0, and `expectChipStill(page, 'Podcasts', podcastsBefore)`. Then
   `await page.unrouteAll({ behavior: 'ignoreErrors' })`. Capture on the Episodes chip.

Add by RSS and Recommendations use the same `MediaListChips`, so these two tests cover the pending
state for them. They are not given their own held-render tests, because both need a signed-in
account and stubbed parses that would push the test past the 10-second budget.

Keep the default 10-second budget. The RSC header check matters: Next.js sends `RSC: 1` on flight
requests, and Playwright lowercases header names.

## Done when

- The pressed chip changes on click with no server response yet, on all four pages.
- While the new list loads, the old rows are hidden and one spinner shows in the list area. No
  old list stays visible under a transparent spinner, and no skeleton replaces the chip row.
- The chip row does not move sideways or up and down from the click until the new list shows,
  including on a narrow screen where the row scrolls. A chip clipped at the row's edge slides
  fully into view once, when it is clicked.
- Keyboard focus stays on the clicked chip after the new list arrives.
- Two quick clicks end on the second chip, including when the second chip is the one the page
  started on.
- Add by RSS and Recommendations show the same in-list spinner while their own lists load.
- The existing tests in `media-list-chips.spec.ts` and `ChipRow.test.tsx` are unchanged and still
  describe the behavior.
