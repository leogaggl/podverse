**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 11 — Embed list row: Live badge before the date

## Rows

R1, R2, R3, R4, R7, R8, R10, R12, R16

## Runs after

none

## Files

apps/web/src/components/embed/EmbedListRow.tsx
apps/web/src/styles/components/embed/EmbedListRow.module.scss
apps/web/src/components/embed/__tests__/EmbedListRow.test.tsx
release-notes/scratchpad.md

## Goal

The embed list row (`/embed/podcast/…`, `/embed/album/…`, playlists) is an item row: each row is an
episode, track, clip, or chapter, and a channel embed puts its currently live items at the top of
page 1 (`filterEmbedCurrentlyLiveChannelItems` in `apps/web/src/lib/embed/fetchEmbedListData.ts`).
Its Live badge sits on the title line, before the title. Move it off the title line so it sits to
the right of Play and before the date, the same order as plan 10: Play, then the badge, then the
date. A live item row shows no duration.

## What the code does today

`EmbedListRow` renders `[play button cell] [content button]`. The content button holds:

- `titleRow`: `{isCurrentlyLive ? <EmbedLiveItemStatus /> : null}` then the title.
- `meta` (`data-testid="embed-list-row-meta"`): `EmbedListRowMeta`, which renders
  `date • duration` for an item row, `date • start` for a chapter, `date • start–end` for a clip.

`isCurrentlyLive` is `isEmbedItemCurrentlyLive` (`resolveEmbedLiveItemStatusId === LiveItemStatusEnum.Live`).
Only the Live status reaches the embed: the list keeps currently live items and drops Scheduled and
Ended ones, so a Scheduled or Ended badge is not part of this row. Play stays in `playButtonCell`
for every row; do not gate it.

`ReadableDate` returns a string (`formatDateAbbrev`, pattern `MMM d yyyy`), not an element.

## Target layout

```text
Not live: [Play] Title
               date • duration            (unchanged)
Live item: [Play] Title
               [Live] date                (no duration)
Live chapter: [Play] Title
               [Live] date • start
Live clip: [Play] Title
               [Live] date • start–end
```

- The title line holds only the title.
- On a live row the meta line starts with the badge, then the date text. The badge is to the
  right of the play cell because the whole content column is.
- For an item row the badge takes the duration's place: do not render `ReadableDuration` or its
  `' • '` on a live item row (R16). Do not add a livestream start–end clock; this row has a
  publish date, not the web livestream row's start–end time.
- Chapter and clip rows keep their existing date and time-range text, with the badge before that
  text. The range stays after the date.
- No `' • '` before the badge; a flex `gap` separates the badge from the date text.
- The badge is 1.25rem tall (`EmbedLiveItemStatus.module.scss`), equal to
  `$embed-meta-line-min-height`, so the row height (`$embed-list-row-height`) does not change.
  Do not edit `_embedLayoutTokens.scss` or `embedLayoutTokens.ts`.

## Changes

### `EmbedListRow.tsx`

1. Give `EmbedListRowMeta` a second prop, `isCurrentlyLive: boolean`. In its final (item) branch,
   when `isCurrentlyLive` is true, return only the date:

```tsx
if (isCurrentlyLive) {
  return hasPublishDate ? <ReadableDate date={publishDate} /> : null;
}
```

   Put this check after the chapter and clip branches, before `durationRaw` is computed. The
   chapter and clip branches stay as they are, including their `' • '` between the date and the
   range.

1. In `EmbedListRow`, remove `{isCurrentlyLive ? <EmbedLiveItemStatus /> : null}` from
   `titleRow`. The badge is the first thing inside the live meta line, and the date text follows
   it:

```tsx
<span
  className={isCurrentlyLive ? styles.metaLive : styles.meta}
  data-testid="embed-list-row-meta"
>
  {isCurrentlyLive ? (
    <>
      <EmbedLiveItemStatus />
      <span className={styles.metaText}>
        <EmbedListRowMeta row={row} isCurrentlyLive />
      </span>
    </>
  ) : (
    <EmbedListRowMeta row={row} isCurrentlyLive={false} />
  )}
</span>
```

   Leave `titleRow` as a wrapper around the title so its styles still apply. Leave
   `playButtonCell` and `PlayButtonRow` as they are.

### `EmbedListRow.module.scss`

Add, after the `.meta` rule:

```scss
.metaLive {
  align-items: center;
  display: flex;
  font-size: var(--font-size-xs);
  gap: var(--spacing-xs);
  max-width: 100%;
  min-height: var(--embed-meta-line-min-height);
  min-width: 0;
}

.metaText {
  @include ellipsisSingleLineChild;

  display: block;
  flex: 0 1 auto;
  min-width: 0;
}
```

Add `.rowActive .metaLive` to the existing `.rowActive .title, .rowActive .meta` selector list so
the active row's live meta text gets the highlighted color too. Leave `.meta` and `.titleRow`
unchanged.

### Out of scope

- `EmbedPlayerInfo.tsx` also shows `EmbedLiveItemStatus`; it is the player header, not a row.
- `EmbedLiveItemStatus.tsx` and its stylesheet do not change. Its `data-testid` stays
  `embed-live-item-status`.
- Database and Add by RSS livestream rows are plan 10.

## Accessibility

The row's content button reads title, then "Live", then the date. The badge keeps its visible text
as its name. No new interactive element is added.

## Tests

Unit (Vitest, jsdom): create `apps/web/src/components/embed/__tests__/EmbedListRow.test.tsx`.

- Mock `next-intl`: `useTranslations: () => (key: string) => key` and `useLocale: () => 'en-US'`.
- Mock `../../MediaPlayer/Buttons/PlayButtonRow` with a stub `PlayButtonRow` that renders
  `<button type="button" data-testid="play-button-row-stub" />` (the real one reads player
  contexts). The import path is relative to the test file.
- Build rows with a small factory that returns an `EmbedListRow` (`rowKey`, `playIdText`,
  `listLabel`, `mediaType: 'audio'`, `channel`, `item`, `clip: null`, `itemChapter: null`,
  `itemSoundbite: null`). Follow `apps/web/src/lib/embed/__tests__/resolveEmbedLiveItemStatus.test.ts`
  for the `DTOItem` shape, including its single `as DTOItem` / `as DTOChannel` on the fixture.
  Give the item `pub_date: '2026-06-05T00:00:00.000Z'` and
  `item_about: { duration: 3600 }` so the duration branch would render if reached.
- Call `cleanup()` in `afterEach`.

Cases:

1. A live item row (`live_item.live_item_status: { id: LiveItemStatusEnum.Live }`):
   `embed-live-item-status` is inside `embed-list-row-meta` and is that meta line's first element.
   The element after the badge contains the publish-date text and does not contain `time.hr`
   (the mocked `t` returns keys, so a rendered duration would show `time.hr`). Do not assert a
   hardcoded calendar string; `formatDateAbbrev` uses the machine timezone. The title text's
   parent span does not contain `embed-live-item-status`.
1. A non-live item row (no `live_item`): no `embed-live-item-status` in the row, and the meta
   contains `time.hr` (the duration renders as before).

Playwright: none added. No seeded embed fixture has a currently live item, and the existing
`apps/web/e2e/embed-routes.spec.ts` list steps cover non-live rows and the meta line through
`expectEmbedListRowMetadata`.

## Release scratchpad

```markdown
## Embed list rows show Live before the date

- Surfaces: web (embed player)
- Change: In list embeds (podcast, album, playlist), a currently live row moves the Live badge
  off the title line onto the date line, to the right of Play and before the date, in place of
  the duration. The title line shows only the title. Row height is unchanged.
- Who notices: sites that embed a Podverse list whose channel is live
- Operator steps: none
```
