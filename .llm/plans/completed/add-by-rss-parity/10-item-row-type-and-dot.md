# 10 — Item list row type and new-content dot

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

Rows: R8, R9, R10, R13, R14, R15, R16, R17, R18, R19. Mobile only. Web item rows stay as they
are.

Parity source: the channel variant of `HomeFeedRow` (date at the top of a podcast, album, or
artist row). Item rows keep their own order (show name, title, then date).

## Answers

**R16.** Add by RSS channel-detail item rows do not show a new-content dot. `AddByRssEpisodeRow`
never sets `metadata.unseenBadge`. `HomeFeedRow` draws `UnseenIndicator` only when that badge is
set. `loadDetail` also calls `channelSeenRepository.markSeen`, which clears the channel-level
count as the screen opens.

**R17.** The dot is on channel subscription rows, in a full-height rail at the trailing edge of
the row, vertically centered (`styles.unseenRail` in `HomeFeedRow`). `HomeFeedGridCell` draws the
same dot at the bottom-right of the tile. No list row places it to the right of the title. Episode,
clip, track, queue, history, search, and Add by RSS item rows leave `unseenBadge` unset, so they
show no dot. Podcast live rows set `LIVE_ROW_METADATA.unseenBadge` to null on purpose.

R18 and R19 add the dot on channel-detail item rows, in the title line. The channel rail and the
grid tile stay where they are.

## Locked decisions

1. **Date (R8, R10, R13).** Item pub dates use `styles.showDate`: font size 14, weight 700, line
   height 20, color `tokens.text.link`. Delete `styles.date`. Both variants call
   `dateLine(styles.showDate)`. The item date stays under the title.
2. **Title-to-date gap (R9, R14).** `styles.identityText.gap` becomes `tokens.spacing.xs` (2).
   That is the gap channel rows already render through `styles.showIdentityText`. Delete
   `showIdentityText`. Show name, removed label, title, and date share that one gap.
3. **Description (R15).** `styles.description` becomes font size 14, weight `400`, line height 20,
   color `themeStyles.textSecondary.color` (the same metrics as `styles.showFooter`). It stays
   under the identity row, `numberOfLines` 2. Weight stays 400.
4. **Description seam (R14).** Wrap the identity row and the description in one column,
   `styles.textGroup`, with `gap: tokens.spacing.xs`. `styles.rowBody.gap` stays
   `tokens.spacing.md`. `styles.rowActions.marginTop` stays `tokens.spacing.sm`. The play,
   duration, and progress band keeps today's separation from the text.
5. **What "new" means (R16–R19).** An item is new when its publish instant is strictly after the
   subscription's stored last-seen timestamp, using the same rule as `countUnseenByPubDate`: a
   null timestamp means never opened and nothing is new; a missing publish instant is not new; an
   equal instant is already seen. There is no per-item seen record.
6. **The list keeps the dots for this visit.** `markSeen` still runs on open so the Home channel
   rail clears immediately. It returns the timestamp from before that write. The detail list
   passes that timestamp into the row. Returning from an item does not mark the channel again
   (the podcast effect stays keyed on `podcastId` only). The next open uses the newer timestamp,
   so those dots are gone.
7. **Dot placement (R18, R19).** On an item row, `UnseenIndicator` sits in a row with the title,
   at the trailing edge of that row (`flex: 1` on the title). The slot is the title line height
   (26) and the 10px circle is at the top of the slot (`justifyContent: 'flex-start'`). Horizontal
   gap is `tokens.spacing.sm`. The date, description, and `MediaRowActions` progress stay below
   that title row. `UNSEEN_INDICATOR_SIZE` stays 10.
8. **Who passes the timestamp.** `PodcastEpisodesSection` and `AddByRssEpisodeRow` only. Album
   tracks, clips, downloads, queue, history, search, Home, and Browse do not. They still pick up
   the type and spacing because they render `HomeFeedRow`.

## Files

| File                                                                   | What changes                                                                |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `packages/helpers/src/lib/channelSeen.ts`                              | `isUnseenPubDate`; `countUnseenByPubDate` calls it                          |
| `packages/helpers/src/lib/channelSeen.test.ts`                         | Predicate cases                                                             |
| `apps/mobile/src/screens/home/itemUnseen.ts`                           | Epoch parse and `itemRowShowsUnseenDot`                                     |
| `apps/mobile/src/screens/home/itemUnseen.test.ts`                      | New. Register it in the vitest include list                                 |
| `apps/mobile/vitest.config.ts`                                         | Include `src/screens/home/itemUnseen.test.ts` beside `HomeFeedRow.test.ts`  |
| `apps/mobile/src/data/repositories/channelSeenRepository.ts`           | `markSeen` returns the previous timestamp. Anchor: `markSeen`               |
| `apps/mobile/src/screens/home/HomeFeedRow.tsx`                         | Styles, title-line dot, `itemLastSeenAtMs`                                  |
| `apps/mobile/src/screens/podcast/sections/podcastSectionPane.ts`       | Optional `visitLastSeenAtMs` on `PodcastSectionPaneProps`                   |
| `apps/mobile/src/screens/podcast/PodcastDetailScreen.tsx`              | Anchor: the `markSeen` effect, and `<SectionPane`                           |
| `apps/mobile/src/screens/podcast/sections/PodcastEpisodesSection.tsx`  | Pass the timestamp into `PodcastEpisodeRow` / `HomeFeedRow`                 |
| `apps/mobile/src/screens/home/AddByRssHomeDetailScreen.tsx`            | Anchor: `loadDetail` and `AddByRssEpisodeRow`                               |
| `.cursor/rules/mobile-screen-layout.mdc`                               | Gap, date, description, item-row dot                                        |
| `.cursor/skills/mobile-reusable-components/SKILL.md`                   | Same list-row sentences                                                     |

`HomeScreen.tsx` and `navigation/index.tsx` stay unread. This plan does not edit them.

No new i18n key. The row label reuses `subscriptions.row.unseen_indicator_aria`.
`UnseenIndicator` stays decorative (`accessibilityElementsHidden`).

## Implementation

### Predicate

In `channelSeen.ts`:

```typescript
export const isUnseenPubDate = (
  pubDateMs: number | null,
  lastSeenAtMs: number | null
): boolean => {
  if (lastSeenAtMs === null || pubDateMs === null) {
    return false;
  }
  return pubDateMs > lastSeenAtMs;
};
```

`countUnseenByPubDate` increments only when `isUnseenPubDate(pubDateMs, lastSeenAtMs)` is true.
`src/index.ts` already re-exports the module. No new barrel file.

`epochMsFromRowUpdatedAt` lives in `itemUnseen.ts` and is the parse `useUpdatedLabel` uses today:
empty, null, and undefined become null; a number below `1e12` is seconds; anything else is
`new Date(value)`; `NaN` becomes null. `useUpdatedLabel` calls it, then `formatDateAbbrev`.

```typescript
export const itemRowShowsUnseenDot = (
  isChannelList: boolean,
  updatedAt: string | number | null | undefined,
  lastSeenAtMs: number | null | undefined
): boolean => {
  if (isChannelList || lastSeenAtMs === undefined || lastSeenAtMs === null) {
    return false;
  }
  return isUnseenPubDate(epochMsFromRowUpdatedAt(updatedAt), lastSeenAtMs);
};
```

`itemUnseen.ts` imports `isUnseenPubDate` from `@podverse/helpers` and imports no React Native.
Mobile reads that package from its build output (`dist/`). The export is source in this change.

### `markSeen` return

Before `upsertSeen`, select `lastSeenAt` for that `subscriptionKey`. Return that number, or null
when the row is absent. Signature becomes `Promise<number | null>`. The existing "clears as the
screen opens" behavior stays. A comment on the return says callers that mark on open use this
value to decide which items were new, and null means nothing is new.

### `HomeFeedRow` styles

- `identityText.gap`: `tokens.spacing.xs`. Remove `showIdentityText` and its use.
- Item and channel dates: `dateLine(styles.showDate)`.
- `description`: font size 14, weight `'400'`, line height 20, secondary color.
- `textGroup`: `{ gap: tokens.spacing.xs }` around `identityRow` and the description `Text`.
- Title font size 19, line height 26, and channel `showTitle` weight 400 stay.
- One constant `TITLE_LINE_HEIGHT = 26` in this file feeds `styles.title.lineHeight` and the
  unseen slot height.

`styles.title` on a channel row still spreads `typography.subheading` and then `showTitle`.

### Title-line dot

New optional prop `itemLastSeenAtMs?: number | null`.

`showItemDot` is `itemRowShowsUnseenDot(isChannelList, row.updatedAt, itemLastSeenAtMs)`.

When `showItemDot` is true, the title `Text` is inside:

- `titleLine`: `flexDirection: 'row'`, `alignItems: 'flex-start'`, `gap: tokens.spacing.sm`
- title text: existing title style plus `{ flex: 1 }`
- `itemUnseenSlot`: `height: TITLE_LINE_HEIGHT`, `width: UNSEEN_INDICATOR_SIZE`,
  `justifyContent: 'flex-start'`, `pointerEvents: 'none'`
- `UnseenIndicator` with `testID={`home-feed-row-unseen-${row.id}`}`

When `showItemDot` is false, the title stays the single `Text` it is today (no empty slot).

The channel rail (`unseenBadge !== null` inside `isChannelList`) keeps
`testID={`home-feed-row-unseen-${row.id}`}`. Item rows do not render that rail.
`itemRowShowsUnseenDot` is false for channel rows, so a channel row never gets both.

Append the same `subscriptions.row.unseen_indicator_aria` string to the row
`accessibilityLabel` when `showItemDot` is true. `useMetadataAnnouncements` still covers the
channel rail.

`PodcastEpisodeRow` and `AddByRssEpisodeRow` pass `itemLastSeenAtMs` through to `HomeFeedRow`.

### Podcast detail

In the existing `markSeen` effect, await the call and store the returned `number | null` in
`visitLastSeenAtMs`. Ignore the result when the effect cleaned up. Initial state is `undefined`
(not yet read). The dependency array stays `[podcastId]`.

Add optional `visitLastSeenAtMs?: number | null` to `PodcastSectionPaneProps`. Pass it on
`<SectionPane`. `PodcastEpisodesSection` passes it to every episode `HomeFeedRow`, including live
rows. Leave `LIVE_ROW_METADATA` as it is. Other sections accept the prop and do not read it.

`undefined` and `null` both show no item dots. A number shows dots for items published after it.

### Add by RSS detail

In `loadDetail`, `const previous = await channelSeenRepository.markSeen(feed.feedUrl, 'add-by-rss')`
before `setDetail`. Hold `previous` in state and pass it to `AddByRssEpisodeRow`. Stamp from that
value on the first paint of the list. `sortAddByRssHomeEpisodes` does not need to know about the
prop; the row component receives it.

`buildAddByRssHomeDetailData` already stores epoch milliseconds on `updatedAt`. The seconds rule
in `epochMsFromRowUpdatedAt` leaves values at or above `1e12` alone.

## Guidance

`mobile-screen-layout` and `mobile-reusable-components` say channel identity gap is `spacing.sm`
and item identity gap is `spacing.base`. The stylesheet renders channel rows at `spacing.xs`.
Update both documents to `spacing.xs` for every `HomeFeedRow` identity stack. Leave the channel
row code on `xs`.

Also update those documents so item pub dates match the channel date (14 / 700 / 20 /
`tokens.text.link`), item description is 14 / 400 / 20 in secondary color, and a channel-detail
item row places `UnseenIndicator` at the trailing top of the title line. The channel list rail
and the grid tile sentences stay.

`ListRow` gap stays `spacing.sm`. Episode detail headers, notification times, and
`typography.caption` stay on caption. This plan does not edit `ListRow.tsx`,
`EpisodePlayChrome.tsx`, or `typography.ts`.

## Tests

Helpers (`channelSeen.test.ts`, already included by `src/**/*.test.ts`):

- Publish instant after last seen is unseen.
- Equal instant is seen.
- `lastSeenAtMs` null is not unseen.
- `pubDateMs` null is not unseen.
- Existing `countUnseenByPubDate` cases still pass once the loop calls `isUnseenPubDate`.

Mobile (`itemUnseen.test.ts`). Add the path to the `include` array in
`apps/mobile/vitest.config.ts`. The file imports no React Native.

- ISO string after the threshold shows the dot.
- ISO string equal to the threshold does not.
- A number below `1e12` is read as seconds.
- A number at or above `1e12` is read as milliseconds.
- `null` updatedAt, `null` last seen, and `undefined` last seen do not show the dot.
- `isChannelList: true` does not show the dot even when the date is after the threshold.

No Maestro flow. Font size and this predicate are not device claims. Leave
`apps/mobile/e2e/subscriptions-anonymous.yaml` as it is: Home channel rows still expose
`home-feed-row-unseen-*`. No Playwright spec. No API test. No DTO or SQLite migration.
`itemLastSeenAtMs` is a view prop.

## Leave unchanged

- Channel rail, grid dot, `UNSEEN_INDICATOR_SIZE`, and `HomeRowMetadata.unseenBadge`.
- Item order: show name, title, date. Channel order: date, title, footer.
- `MediaRowActions`, duration, and the in-row progress track.
- Row vertical padding, artwork size, and artwork gap.
- Web list rows and the web unseen count badge.
- Swipe, grid long-press, more-menu actions, and item tap behavior.

## Later prompts

`HomeFeedRow.tsx` is shared with C (duration and more) and D (channel rows). Keep this plan's
date style, description style, `identityText` gap, `textGroup`, and title-line dot.

`AddByRssHomeDetailScreen.tsx` is shared with B and C. Keep the `markSeen` return value flowing
into `AddByRssEpisodeRow` as `itemLastSeenAtMs`. Rebuilding the episode row without that prop
drops the dots.

`HomeFeedRowData` gains no unseen field. C and D do not need to copy one onto row objects.

## Release scratchpad

Append when the implementation lands:

```markdown
## Mobile item rows use a larger date and a title-line new-content dot

- Surfaces: mobile
- Change: Episode, clip, and track list rows, including Add by RSS, use the channel-row date
  (14pt, bold, link color), a 2pt gap between title and date, and a 14pt regular description.
  On a podcast or Add by RSS channel, episodes published after the previous open show the
  new-content dot at the top right of the title. Channel rows keep the dot in the side rail.
- Who notices: people scrolling episode lists on the phone
- Operator steps: none
```
