**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 50 — Detail section chips and sort

Replace the section tabs on detail pages with a chip row, and replace each sort dropdown (and its range dropdown) with one `ListSortChip` in that row's trailing slot. Section sets, section order, and which sections can sort stay as each page has them today. Add by RSS detail pages follow their directory counterpart for layout, and keep the sort options they already have.

## Rows

R27

## Runs after

11, 21

Plan 21 creates `ChipRow`, `ListSortChip`, and `SortChip`, and turns the gear into a chip. Plan 11 edits `packages/ui/PACKAGES-UI.md`, which this plan also edits. Do not run beside plan 10: both edit the consumer catalog originals.

## Decisions

- **About, Podroll, and People stay off the chip row from 1200px up** on the pages that already hide those tabs (`hideDesktop: true`). The side column on podcast, album, and artist (and the Add by RSS podcast, album, and artist pages) already shows that content. Narrower widths keep the chips, which is where the side column is gone. Episode, track, and livestream, and their Add by RSS item pages, keep every chip at every width, as they do today. `ChipRow` gains an optional `hideDesktop` so this survives the restyle.
- **Settings stays a section chip** on the channel pages that already have it (signed-in directory podcast, album, and artist; always on the Add by RSS channel pages). It does not move onto the channel header.
- **No sort chip is added** to a page that has no sort dropdown today (directory artist, track, livestream, and the Add by RSS episode, track, and livestream pages).
- **One sort chip, per plans 20 and 21.** Detail pages do not keep a separate range dropdown, and they do not copy the two chips mobile detail still uses. Choosing Top opens the range list in the same chip. The face shows the range while Top is selected. `onChange` returns the range the user picked. Do not force `range: 'week'`.

## What this plan does not change

- `ListHeader` and its callers: History, Queues, Playlists (area C), Settings, Profile, and My Profile. They keep `Tabs` or `ButtonTabs`.
- Directory `*PageClient.tsx` files, page `page.tsx` parsers, and the fetch effects in the page contexts. Sort and range still persist per channel or item through `useSortPref`. Section chips stay visit-local: do not pass `tab` into `buildDetailSortPrefPatch`, and do not write the section into the URL on directory pages.
- Add by RSS tab handlers that already write `type` into the URL (`handleTabSelect`). The chip calls the same handler.
- Which sections exist. Do not add Clips, Official Clips, Podroll, or People to an Add by RSS page that does not have them. Do not add an autoscroll button to an Add by RSS transcript.
- The gear. These section rows have no `ViewSelector`. Do not add one.
- Livestream row order on an Add by RSS podcast page. The sort chip reorders episodes only. The livestream block stays in channel order.
- App-bar titles. These pages keep their own header and an empty bar title (plan 12). Do not add a `MainHeader` or another level-1 heading.

## 1. `ChipRow` — `hideDesktop`

`packages/ui/src/components/navigation/Chip/ChipRow.tsx`. Extend `ChipRowItem`:

```ts
export type ChipRowItem<T extends string> = {
  key: T;
  label: string;
  /** Hidden from 1200px up. The side column shows this section there. */
  hideDesktop?: boolean;
};
```

On that chip, set `data-hide-desktop="true"` when `hideDesktop` is true. `packages/ui/src/components/navigation/Chip/ChipRow.module.scss`: same breakpoint as `Tab.module.scss` (`@use '../../../styles/breakpoints';`, `min-width: breakpoints.$breakpoint-xl-min`):

```scss
.chipRow [data-hide-desktop='true'] {
  @media (min-width: breakpoints.$breakpoint-xl-min) {
    display: none;
  }
}
```

A hidden chip stays in the DOM, including when it is the selected one. Callers that omit `hideDesktop` are unchanged (`MediaListChips`).

`SortChip.tsx`: when `value` is the range sort and `range.value` is null, the face is that sort option's label (for example "Top"). A detail URL can arrive as `?sort=top` with no range. Do not fill in a range.

`packages/ui/PACKAGES-UI.md`, in the `## Navigation — Chips` section plan 20 adds: one sentence that a `ChipRow` item may set `hideDesktop`, which hides that chip from 1200px up, and that channel detail pages use it for About, Podroll, and People.

## 2. `ListSortChip` — menu side

`apps/web/src/components/ListSortChip/ListSortChip.tsx`. Add optional `position?: 'left' | 'right'` and pass it to `SortChip`. Omit it when the caller does not pass it, so the default stays left. The sort menu renders in a portal anchored to the chip (plan 20), and `position` picks which chip edge it lines up with. Detail trailing chips pass `position="right"`: the menu's right edge sits on the chip's right edge, so it opens toward the start of the row, and the viewport clamp keeps it on screen when the row has scrolled.

## 3. `CommonDetailListHeader`

`apps/web/src/components/Common/List/CommonDetailListHeader.tsx` stops wrapping `ListHeader`. It renders `ChipRow` from `@podverse/ui`:

```tsx
export function CommonDetailListHeader<T extends string>({
  items,
  onSelect,
  selectedKey,
  testId,
  trailing,
}: {
  items: readonly ChipRowItem<T>[];
  selectedKey: T | null;
  onSelect: (key: T) => void;
  testId: string;
  trailing?: ReactNode;
}) {
  const tFilters = useTranslations('filters');
  return (
    <ChipRow
      ariaLabel={tFilters('screen.sections_heading')}
      items={items}
      onSelect={onSelect}
      selectedKey={selectedKey}
      testId={testId}
      trailing={trailing}
    />
  );
}
```

No `<header>` landmark (the entity header is already on the page). No outer margin. Drop the `tabs` and `sideButtons` props. Every caller below is updated in this plan, so nothing still passes them.

The group name is `filters.screen.sections_heading`. Add it under `filters.screen`, beside `sort_heading`, in all four consumer originals (**large-file-reading** — Grep `"sort_heading"` and insert next to it; do not rewrite the file):

| File | Value |
| --- | --- |
| `packages/i18n-catalog/consumer/originals/en-US.json` | `Sections` |
| `packages/i18n-catalog/consumer/originals/es.json` | `Secciones` |
| `packages/i18n-catalog/consumer/originals/fr.json` | `Sections` |
| `packages/i18n-catalog/consumer/originals/el-GR.json` | `Ενότητες` |

Do not edit `overrides/`. Run `npm run i18n:compile` after the keys are in.

## 4. How each header builds the row

Type the items array as `ChipRowItem<ThePageTypeUnion>`. Keep the same keys, labels, order, and conditions as today's `tabData`. Drop `onClick`, `zIndex`, and the string type-guards on the click path: `onSelect` receives the typed key. Set `hideDesktop: true` only on the keys that set `hideDesktop: true` today (About, Podroll, People on the channel pages below). Settings, Boosts, and the list sections stay visible at every width.

`selectedKey` is the current section. `onSelect` calls the existing type handler, including `page: 1` where that handler sets it today. Artist does not have a page field; leave that handler as a type-only update.

Trailing slot, mount only the control the current section can use. Unmount the others. No disabled placeholder.

| Page | test id | Sort chip | When | Options | `rangeSort` |
| --- | --- | --- | --- | --- | --- |
| Podcast | `podcast-detail-chips` | `podcast-detail-sort` | `episodes`, `clips` | Recent, Oldest, Top | `'top'` |
| Episode | `episode-detail-chips` | `episode-detail-sort` | `clips` | Recent, Oldest, Top | `'top'` |
| Episode | same | same test id | `soundbites` | Recent, Oldest | omit |
| Episode | same | none | `transcript` | autoscroll `Button`, unchanged labels | |
| Album | `album-detail-chips` | `album-detail-sort` | `tracks` | Ordered, Reverse, Top (`filters.sort.forward`, `backward`, `top`) | `'top'` |
| Artist | `artist-detail-chips` | none | | | |
| Track | `track-detail-chips` | none | `transcript` | autoscroll `Button`, unchanged | |
| Livestream | `livestream-detail-chips` | none | | | |
| Add by RSS podcast | `add-by-rss-podcast-detail-chips` | `add-by-rss-podcast-detail-sort` | `episodes` | Recent, Oldest | omit |
| Add by RSS album | `add-by-rss-album-detail-chips` | `add-by-rss-album-detail-sort` | `tracks` | Ordered, Reverse (`forward`, `backward`) | omit |
| Add by RSS artist | `add-by-rss-artist-detail-chips` | `add-by-rss-artist-detail-sort` | `albums`, `tracks` | Recent, Oldest | omit |
| Add by RSS episode | `add-by-rss-episode-detail-chips` | none | | | |
| Add by RSS track | `add-by-rss-track-detail-chips` | none | | | |
| Add by RSS livestream | `add-by-rss-livestream-detail-chips` | none | | | |

Podcast Official Clips (`soundbites`) have no sort chip. The header already hides the dropdown there, and the soundbite request does not take Top.

### Directory sort `onChange`

For podcast episodes, podcast clips, episode clips, and album tracks:

```tsx
onChange={(nextSort, nextRange) => {
  setFilterParams({ ...filterParams, page: 1, range: nextRange, sort: nextSort });
}}
range={sort === 'top' ? range : null}
rangeSort="top"
value={sort}
```

`nextRange` is null when the chosen sort is not Top. That replaces the `range: 'week'` branch in `handleSortChange`.

Episode Official Clips: no `rangeSort`. `value` is `'oldest'` when `sort === 'oldest'`, otherwise `'recent'` (the list already ignores Top). `onChange` writes `sort` and `page: 1` only. Leave `range` in state so a return to Clips still has it.

Labels come from `tFilters('sort.recent' | 'sort.oldest' | 'sort.top' | 'sort.forward' | 'sort.backward')`. Pass `position="right"`.

After the header no longer calls `getPodcastPageDropdownConfig`, `getEpisodePageDropdownConfig`, or `getAlbumPageDropdownConfig`, delete those three functions and the `getRangeDropdownItems` import they alone use in those files. Keep `getPodcastPageFilterParams`, `getEpisodePageFilterParams`, and `getAlbumPageFilterParams`. Do not delete `getRangeDropdownItems` from `dropdownMenuItems.ts`. Other pages still call it.

### Add by RSS sort `onChange`

Keep the existing `setSort` / `handleSortChange` and the page reset. Do not write `sort` into the URL. The podcast and artist clients already read an incoming `sort` query and write `type` on section change; leave both.

Add by RSS album: the menu values stay `forward` and `backward`, and `handleSortChange` still goes through `toSortOption`. Do not retarget that helper.

The sort node moves out of `sideButtons`. `AddByRSSPodcastPageListHeader`, `AddByRSSAlbumPageListHeader`, and `AddByRSSArtistPageListHeader` drop the `sideButtons` prop. The client renders `ListSortChip` as `trailing` on the header. Delete the `Dropdown` and `sortMenuItems` once nothing references them.

Add by RSS episode, track, and livestream build `tabData` inline and pass `tabs` to `CommonDetailListHeader`. Switch those to `items` / `onSelect` / `selectedKey` / `testId`. Anchors in the large clients: `tabData`, `CommonDetailListHeader`, and `sideButtons` (**large-file-reading** does not list these files; still edit with a search, not a full rewrite).

## Accessibility

- Section chips are buttons with `aria-pressed` inside a group named Sections.
- The sort chip's accessible name is `Sort: <face>` (`Sort: Recent`, `Sort: Week` while Top and Week are selected). Its menu items are `menuitemradio`.
- The autoscroll control stays a `Button` with its current visible label, in the trailing slot, only on the transcript section.
- Hidden desktop chips use `display: none`, so they leave the accessibility tree at that width.

## Files

packages/ui/src/components/navigation/Chip/ChipRow.tsx
packages/ui/src/components/navigation/Chip/ChipRow.module.scss
packages/ui/src/components/navigation/Chip/ChipRow.test.tsx
packages/ui/src/components/navigation/Chip/SortChip.tsx
packages/ui/src/components/navigation/Chip/SortChip.test.tsx
packages/ui/PACKAGES-UI.md
apps/web/src/components/ListSortChip/ListSortChip.tsx
apps/web/src/components/Common/List/CommonDetailListHeader.tsx
apps/web/src/app/podcast/[channel_id]/PodcastPageListHeader.tsx
apps/web/src/app/podcast/[channel_id]/PodcastPageDropdownConfig.ts
apps/web/src/app/episode/[item_id]/EpisodePageListHeader.tsx
apps/web/src/app/episode/[item_id]/EpisodePageDropdownConfig.tsx
apps/web/src/app/album/[channel_id]/AlbumPageListHeader.tsx
apps/web/src/app/album/[channel_id]/AlbumPageDropdownConfig.ts
apps/web/src/app/artist/[channel_id]/ArtistPageListHeader.tsx
apps/web/src/app/track/[item_id]/TrackPageListHeader.tsx
apps/web/src/app/podcast/livestream/[item_id]/LivestreamPageListHeader.tsx
apps/web/src/app/add-by-rss/podcast/AddByRSSPodcastPageListHeader.tsx
apps/web/src/app/add-by-rss/podcast/AddByRSSPodcastPageDetailClient.tsx
apps/web/src/app/add-by-rss/album/AddByRSSAlbumPageListHeader.tsx
apps/web/src/app/add-by-rss/album/AddByRSSAlbumPageClient.tsx
apps/web/src/app/add-by-rss/artist/AddByRSSArtistPageListHeader.tsx
apps/web/src/app/add-by-rss/artist/AddByRSSArtistPageClient.tsx
apps/web/src/app/add-by-rss/episode/AddByRSSEpisodePageClient.tsx
apps/web/src/app/add-by-rss/track/AddByRSSTrackItemPageClient.tsx
apps/web/src/app/add-by-rss/livestream/AddByRSSLivestreamItemPageClient.tsx
packages/i18n-catalog/consumer/originals/en-US.json
packages/i18n-catalog/consumer/originals/es.json
packages/i18n-catalog/consumer/originals/fr.json
packages/i18n-catalog/consumer/originals/el-GR.json
apps/web/e2e/detail-sort-persistence.spec.ts
apps/web/e2e/detail-section-chips.spec.ts
apps/web/e2e/media-list-chips.spec.ts
makefiles/local/e2e-spec-order-web.txt
release-notes/scratchpad.md

Shared with other areas: `PACKAGES-UI.md` (plans 11 and 20), `ChipRow` and `SortChip` (plan 20), `ListSortChip.tsx` (plan 21; areas C and D import it and do not need the new prop), the four catalog originals (plan 10), `media-list-chips.spec.ts` (plans 21, C, and D), `release-notes/scratchpad.md` (every area). This plan's edit in `media-list-chips.spec.ts` is only the two clicks in the step `Choosing Oldest leaves the livestream rows in the same vertical order`. List-page dropdowns elsewhere in that file belong to C and D.

`ListHeader.tsx` is not in this list. Do not edit it.

## Tests

`packages/ui` Vitest, beside the components:

- `ChipRow.test.tsx`: an item with `hideDesktop` renders `data-hide-desktop="true"` on that chip; an item without it does not.
- `SortChip.test.tsx`: `value` equal to the range sort and `range.value` null shows the sort label on the face (for example Top), and the accessible name is `Sort: Top`.

Playwright, default viewport 1280×720 (that width hides `hideDesktop` chips). Follow the sentence style already in each spec. Pass the verified element into the capture helper.

- `detail-sort-persistence.spec.ts`: the sort control is `getByRole('button', { name: /^Sort: (Recent|Oldest)$/ })`. `toHaveText` stays `Recent` or `Oldest` (the face). The option click is `page.getByRole('menuitemradio', { name: label, exact: true })`, from `page`, since the menu renders in a portal on `body` and not inside the chip row. The assertions that the URL stays clean, that another podcast keeps Recent, that a scriptless reload still shows Oldest, and that `?sort=recent` wins, stay as they are.
- `detail-section-chips.spec.ts` (new), one podcast test on `/podcast/${E2E_PODCAST_CHANNEL_ID_TEXT}` from `e2e/helpers/seedConstants`:
  - `getByTestId('podcast-detail-chips-episodes')` is visible and pressed (`aria-pressed="true"`).
  - `getByRole('button', { name: 'About', exact: true })` has count 0.
  - The sort button's accessible name is `Sort: Recent`.
  - `page.setViewportSize({ width: 800, height: 720 })`, then About is visible and not pressed.
  - In `makefiles/local/e2e-spec-order-web.txt`, add `apps/web/e2e/detail-section-chips.spec.ts` on the line after `apps/web/e2e/playlists-profiles-chips.spec.ts` (plan 31 adds that line; if it is missing, use the line after `apps/web/e2e/media-list-chips.spec.ts`).
- `media-list-chips.spec.ts`, only the step named above: click `page.getByRole('button', { name: 'Sort: Recent', exact: true })`, then `page.getByRole('menuitemradio', { name: 'Oldest', exact: true })`. Leave the livestream order assertions as they are.

No API integration tests. No new seed ids.

## Release scratchpad

```markdown
## Detail pages use section chips and a sort chip

- Surfaces: web
- Change: Podcast, episode, album, artist, track, and livestream pages, and the Add by RSS
  pages for those, show their sections as round chips. Where a page had a sort dropdown, and a
  second dropdown for the time range when the sort was Top, that is now one Sort chip at the end
  of the row. Choosing Top opens the range list in that chip, and the chip then reads the range.
  About, Podroll, and People stay in the side column on wide screens and remain chips on narrower
  screens. A transcript's autoscroll button stays put.
- Who notices: web listeners on those pages
- Operator steps: none
```
