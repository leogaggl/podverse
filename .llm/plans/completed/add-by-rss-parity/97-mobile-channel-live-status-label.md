# 97 — Scheduled and Ended on mobile livestream rows inside a channel

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

## Rows

- **R73**: mobile livestream rows inside a channel (the podcast page, the album page, and the Add
  by RSS feed page from plan 95) show "Scheduled" or "Ended" on a line that stays visible inside a
  channel, as web's channel pages do with `showLiveItemStatus`.

**Runs after:** 10 (`HomeFeedRow` date style and `dateLine`), 85 (`liveStatusId`, the context-line
Scheduled prefix, `lib/rows/liveItemRows.ts` and its test), 86, 95 (Add by RSS feed page live
rows), 87 (creates `e2e/add-by-rss-livestream.yaml`), and 96. **Runs before:** 52, which also
edits `e2e/add-by-rss-livestream.yaml` and closes the set. Never in one phase with 52 or 87, or
with any plan that edits `HomeFeedRow.tsx`, `PodcastEpisodesSection.tsx`, or `liveItemRows.ts`.

## Answer: why only the Live badge shows today

- **Podcast page.** `liveDisplayRows` in `screens/podcast/sections/PodcastEpisodesSection.tsx`
  writes `"<Scheduled|Ended> • <channel>"` into `row.subtitle` through `LIVE_STATUS_KEYS`.
  `PodcastEpisodeRow` passes `showChannelContext={false}`, so `HomeFeedRow` never draws the
  context line (`channelLabel` is null when `contextLineVisible` is false). The word is built and
  never shown.
- **Album page.** `toTrackRows` in `screens/album/AlbumDetailScreen.tsx` sets
  `metadata: item.live_item ? LIVE_ROW_METADATA : undefined`. Every live item from
  `GET /live-item/channel/:id` gets the Live badge, including scheduled and ended ones, and no
  row states either word.
- **Add by RSS feed page (plan 95).** Rows carry `liveStatusId` and render with
  `showChannelContext={false}`; plan 95 decision 7 adds no word.

## Placement (resolved)

Web's channel rows (`ListLiveItemRow` with `showLiveItemStatus`) put a status pill
(`LiveItem/LiveItemStatus.tsx`) in the row's bottom band: play (live only), then the status pill
(Live glow, Scheduled, or Ended), then the start date and time range.

Mobile puts the word **at the start of the date line, as a neutral `Badge`**:

1. Inside a channel `HomeFeedRow` hides artwork, and it already draws the Live badge at the start
   of the date line (`dateRow` inside `dateLine`). Scheduled and Ended take that same slot, so all
   three statuses sit in one place, before the date, in web's order (status, then date).
2. The date line is the line that stays visible inside a channel. The mobile item row order is
   show name, title, date (**mobile-screen-layout**), and inside a channel the show name is the
   hidden line.
3. Web's bottom band has no mobile counterpart for these rows. Scheduled and ended rows on plan
   95's page are `playable: false`, so they render no action band, and album rows are track rows
   with no play band at all. A badge in the band would need a band these rows do not have.
4. No new line, so row height does not change where a pub date already shows. A track row with
   no date gets a one-badge line under its title, as a live track row does today.

Tone: `neutral` for both words (an outline that sits quietly beside content, per `Badge`'s
doc). Live keeps `danger`. Mobile `Badge` has no warning tone, and this plan adds none.

Outside a channel (Browse, Home, and the Add by RSS library Livestreams chips) the context line
is visible and plan 85's prefix carries the word ("Scheduled • channel"). The badge shows only
when the context line is hidden, so a row never states the word twice or not at all. Ended rows
never reach those chips (plans 85 and 86 drop them), but the prefix reads the same word source so
the two slots cannot disagree.

## Files

All mobile paths are under `apps/mobile/`.

| Path                                                       | Change                             |
| ---------------------------------------------------------- | ---------------------------------- |
| `src/lib/rows/liveItemRows.ts`                             | `liveStatusWordKey`, channel row   |
| `src/lib/rows/liveItemRows.test.ts`                        | Cases                              |
| `src/screens/home/HomeFeedRow.tsx`                         | Status badge on the date line      |
| `src/screens/podcast/sections/PodcastEpisodesSection.tsx`  | Drop the subtitle prefix           |
| `src/screens/album/AlbumDetailScreen.tsx`                  | Live badge only while live         |
| `e2e/add-by-rss-livestream.yaml`                           | Assert the Scheduled badge         |
| `.cursor/rules/mobile-screen-layout.mdc` (repo root)       | One sentence on row live markers   |
| `.cursor/skills/mobile-reusable-components/SKILL.md`       | Same sentence                      |
| `release-notes/scratchpad.md` (repo root)                  | Entry                              |

No i18n change: `media.livestream.pending` ("Scheduled") and `media.livestream.ended` ("Ended")
exist in the consumer catalog. No `vitest.config.ts` change: plan 85 already includes
`src/lib/rows/liveItemRows.test.ts`. No DTO, SQLite, or API change: `DTOLiveItem` carries
`live_item_status_id`, and the entity serializes that column.

## Implementation

### `lib/rows/liveItemRows.ts`

Add beside plan 85's helpers, reusing its `LiveItemStatusEnum` import and `LIVE_ROW_METADATA`:

```typescript
/** Catalog key for a status a row states in words. Live has none: the Live badge says it. */
export const liveStatusWordKey = (
  statusId: LiveItemStatusEnum | null | undefined
): 'media.livestream.ended' | 'media.livestream.pending' | null => {
  if (statusId === LiveItemStatusEnum.Pending) {
    return 'media.livestream.pending';
  }
  if (statusId === LiveItemStatusEnum.Ended) {
    return 'media.livestream.ended';
  }
  return null;
};

/** A live row inside a channel: the Live badge only while on the air; the row keeps the status. */
export const toChannelLiveRow = (
  row: HomeFeedRowData,
  statusId: LiveItemStatusEnum | null | undefined
): HomeFeedRowData & { liveStatusId: LiveItemStatusEnum | null } => ({
  ...row,
  liveStatusId: statusId ?? null,
  metadata: statusId === LiveItemStatusEnum.Live ? LIVE_ROW_METADATA : row.metadata,
});
```

### `HomeFeedRow.tsx`

Keep plan 10's styles, `dateLine(styles.showDate)` calls, and title-line dot; plan 85's optional
`onQueuePress`; and every other earlier edit. Import `liveStatusWordKey` from
`../../lib/rows/liveItemRows` (`homeFeedData.ts` already imports from that module, and
`liveItemRows.ts` imports only types back from `screens/home`).

1. **One word source.** After `contextLineVisible`:

   ```typescript
   const liveStatusWord = useMemo(() => {
     const key = liveStatusWordKey(row.liveStatusId);
     return key === null ? null : t(key);
   }, [row.liveStatusId, t]);
   ```

2. **Context line (plan 85's prefix).** Replace plan 85's `row.liveStatusId ===
   LiveItemStatusEnum.Pending` test and its `t('media.livestream.pending')` with
   `liveStatusWord !== null` and `liveStatusWord`. Guards stay as plan 85 wrote them (item rows
   with the context line visible). Target shape:

   ```typescript
   const contextSubtitle = row.subtitle !== null && row.subtitle.length > 0 ? row.subtitle : null;
   const channelLabel =
     isChannelList || !contextLineVisible
       ? null
       : liveStatusWord === null
         ? contextSubtitle
         : contextSubtitle === null
           ? liveStatusWord
           : `${liveStatusWord} • ${contextSubtitle}`;
   ```

   Drop the `LiveItemStatusEnum` import if nothing else in the file uses it.

3. **Date line.** Below `channelLabel`:

   ```typescript
   /** Inside a channel the context line is hidden, so the date line states the status instead. */
   const dateLineStatus = !isChannelList && !contextLineVisible ? liveStatusWord : null;
   ```

   `dateLine` renders when `updatedLabel`, the in-channel Live badge (`!showArtwork &&
   liveLabel !== null`), or `dateLineStatus` is non-null. Inside `styles.dateRow`, in this
   order: the Live badge (unchanged), then

   ```tsx
   {dateLineStatus !== null ? (
     <Badge
       label={dateLineStatus}
       testID={`home-feed-row-live-status-${row.id}`}
       tone="neutral"
     />
   ) : null}
   ```

   then the date `Text` (unchanged). The Live badge and the status badge never both show:
   `liveStatusWordKey` is null for Live.

4. **Screen readers.** `Badge` is hidden from assistive tech, so add `dateLineStatus` to the
   row's `accessibilityLabel` parts right after `liveLabel`. When the context line carries the
   word it is already inside `channelLabel`, and `dateLineStatus` is null, so it is read once.

5. Doc comment on `HomeFeedRow`: add one sentence. A livestream row states Scheduled or Ended in
   its context line, or at the start of its date line when that line is hidden, where the Live
   badge sits inside a channel.

### `PodcastEpisodesSection.tsx`

- Delete `LIVE_STATUS_KEYS` and its doc comment.
- `toLiveRows`: `items.map((item) => toChannelLiveRow(mapItemToHomeFeedRow(item),
  item.live_item?.live_item_status_id)).filter((row) => row.id.length > 0)`. Its return type
  stays `PodcastLiveRow[]` (the helper's return type is that shape).
- `liveDisplayRows`: keep only the stored-id filter (`liveRows.filter((liveRow) =>
  !storedIds.has(liveRow.id))`); no `map`, no subtitle edit. Dependencies become `[episodeRows,
  liveRows]`. Its doc comment: a live episode already written to the device would appear twice,
  so stored ids are subtracted; only a stream on the air gets the Live badge, and a scheduled or
  ended one states its status on its row.
- Remove `useTranslation` and `const { t }` if `liveDisplayRows` was their only reader (it is
  today), and the `LIVE_ROW_METADATA` import if `toChannelLiveRow` replaced its last use.
  `LiveItemStatusEnum` stays only if still used (`PodcastLiveRow` uses it as a type: switch to
  `import type` if no value use remains).
- Keep plan 10's `visitLastSeenAtMs` pass-through and plan 44's edits.

### `AlbumDetailScreen.tsx`

- Delete the local `LIVE_ROW_METADATA` and the `HomeRowMetadata` type import if unused after.
- `toTrackRows`: build `base = { ...compact, channelId: …, channelKind: …, subtitle: albumTitle }`
  as today, without `metadata`, then return `item.live_item ? toChannelLiveRow(base,
  item.live_item.live_item_status_id) : base`. Import `toChannelLiveRow` from
  `../../lib/rows/liveItemRows`.

Nothing else on the album page changes: live rows still render through `AlbumTrackRow`
(`mediaType="tracks"`, `showChannelContext={false}`), and the row tap is unchanged.

### `e2e/add-by-rss-livestream.yaml`

In plan 87's step 7 (feed page live rows), after the `assertVisible` of
`"add-by-rss-home-live-.*live-guid/scheduled"` below the live row, add:

```yaml
# Inside a channel the scheduled row states its status on the date line.
- assertVisible:
    id: "home-feed-row-live-status-.*live-guid/scheduled"
    text: Scheduled
- assertNotVisible:
    id: "home-feed-row-live-status-.*live-guid/now"
```

Confirm the row id still ends with the live guid (plan 95's `toAddByRssLiveBaseRow`). The
existing `add-by-rss-feed-live-rows` screenshot then shows the badge; add no new screenshot.
Leave plan 52's later player step alone.

### Guidance

`mobile-screen-layout.mdc`, after "Home subscription markers stay on those shared row/cell
components: list live is centered on the artwork, …" sentence, and the **List (`HomeFeedRow`)**
bullet in `mobile-reusable-components`, add the same fact: inside a channel (no artwork) a
livestream row's status starts the date line, the Live badge while on the air and a neutral
Scheduled or Ended badge otherwise. Outside a channel Scheduled leads the context line.

## Reuse

`HomeFeedRow`'s date line and `Badge`, plan 85's `LIVE_ROW_METADATA` and `liveStatusId`, the
consumer catalog's status words (the same keys web's `LiveItemStatus` and plan 89's page use),
and one helper (`toChannelLiveRow`) for the podcast and album pages.

## Tests

**Unit**, `src/lib/rows/liveItemRows.test.ts`:

- `liveStatusWordKey`: Pending → `'media.livestream.pending'`; Ended →
  `'media.livestream.ended'`; Live, `null`, and `undefined` → `null`.
- `toChannelLiveRow`: Live → `metadata` is `LIVE_ROW_METADATA` and `liveStatusId` is Live;
  Pending and Ended → `liveStatusId` set and `metadata` left as the input's (undefined for a
  plain row); a missing status → `liveStatusId` null and no Live metadata.

**Maestro**: the two assertions above in `add-by-rss-livestream.yaml`, the cheapest flow that
already opens a channel with a scheduled row (**mobile-test-economics**). The podcast and album
pages share the `HomeFeedRow` slot and differ only in the helper the unit test covers; no seeded
podcast or album page has a scheduled or ended live item in an existing flow, so they get no
device step.

## Leave unchanged

- Plan 85's Browse, Home, and library rows: artwork, the Live badge on artwork, and the
  context-line prefix.
- Row taps, play, `playable`, and More on every channel page. Scheduled and ended rows on the
  podcast and album pages keep today's play behavior; this plan only adds the word.
- Which date the date line shows (`updatedAt`), live ordering, and plan 95's filter and index
  rules.
- Web rows: they already show the pill.

## Release scratchpad

```markdown
## Mobile channel pages say Scheduled or Ended on livestream rows

- Surfaces: mobile
- Change: inside a podcast page, an album page, and an Add by RSS feed page, a scheduled
  livestream row shows a "Scheduled" badge and a recently ended one an "Ended" badge at the start
  of its date line, where the Live badge sits for a stream on the air. The album page no longer
  marks scheduled and ended livestreams as Live. Screen readers hear the status with the row.
- Who notices: mobile listeners on channels that publish podcast:liveItem entries
- Operator steps: none
```
