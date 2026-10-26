**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 10 — Web livestream rows: status badge before the date

## Rows

R1, R2, R3, R4, R6, R7, R8, R10, R11, R16, R17

## Runs after

none

## Files

apps/web/src/components/List/LiveItem/ListLiveItemRow.tsx
apps/web/src/components/AddByRSS/Livestream/AddByRSSLivestreamRow.tsx
apps/web/src/styles/components/Common/List/LiveItem/ListLiveItemRow.module.scss
apps/web/e2e/media-list-chips.spec.ts

## Goal

Web livestream item rows keep this time line: Play (Live only), then the status badge, then the
date and start–end time. Scheduled and Ended have no Play, so the badge leads their line. The
start–end time stays after the date. The row shows no separate duration.

That order is what both row components already render. Do not move the badge to the end of the
line. This plan adds a measurable status slot and a Playwright check that the badge is on the
date's line and to its left.

## What the code does today

`ListLiveItemRow` (database rows) and `AddByRSSLivestreamRow` (Add by RSS rows) share
`ListLiveItemRow.module.scss`. Both render the bottom line inside
`<div className={styles.bottomSectionStart}>` in this order:

```text
[Play, Live only] [Badge] [date • start–end clock range]
```

`ListLiveItemRow` (`bottomSectionStart`): `PlayButtonRow` only when
`live_item.live_item_status.id === LiveItemStatusEnum.Live`, then `LiveItemStatus` when
`showLiveItemStatus` is set, then `timeSection` (`ReadableDate` of `live_item.start_time`,
`' • '`, `ReadableTime` of start and `end_time`).

`AddByRSSLivestreamRow` (`bottomSectionStart`): `PlayButtonRow` only when
`liveStatusId === LiveItemStatusEnum.Live`, then `LiveItemStatus` always, then `timeSection`
only when `startTimeIso !== null`.

There is no `ReadableDuration` on either row. The clock range is the start–end time, not a
duration (R11, R16).

The parity reference, `ListEpisodeRow`
(`apps/web/src/components/List/Podcasts/Episodes/ListEpisodeRow.tsx`, the `bottomSectionStart`
block), renders `[Play] [date • duration]`. On a livestream row the badge takes the place a
duration would have had, and it sits before the date, which is the settled order (R10).

## Already true — do not change (R17)

Scheduled and Ended web rows already hide Play, and the row already opens the livestream page.
Do not add a Play button, a play placeholder, or a new click target.

- `ListLiveItemRow` renders `PlayButtonRow` only when
  `live_item.live_item_status.id === LiveItemStatusEnum.Live`. `LiveItemStatusEnum.Pending`
  (badge text `media.livestream.pending`, English "Scheduled") and `LiveItemStatusEnum.Ended`
  do not render it.
- `AddByRSSLivestreamRow` uses the same Live-only condition on `liveStatusId`.
- Database navigation: `url` is `${ROUTES.PODCAST_LIVESTREAM}/${item.id_text}` when
  `getQueryParamFromQueueMediumId` is `'av'`, otherwise
  `${ROUTES.MUSIC_LIVESTREAM}/${item.id_text}` (`/podcast/livestream` and `/music/livestream`).
  `ImagesPerView` `href` and the title `Link` both use `url`. The bottom line is outside that
  link. Leave it outside.
- Add by RSS navigation: `getAddByRSSLivestreamPath(item.idText, mediumSlug)` in
  `apps/web/src/utils/addByRSS/itemPath.ts`, which returns
  `/add-by-rss/${mediumSlug}/livestream/${idText}` with `mediumSlug` `'podcast'` or `'music'`.
  Artwork `href` and the title `Link` use that `url`. Leave the bottom line outside the link.
- Podcast episode lists and album track lists already use this one row. `ListEpisodeNodes` and
  `CommonEpisodeNodes` render `ListLiveItemRow` when `item.live_item` is set. `ListTrackNodes`,
  `ListTrackRemoteItemNodes`, and `CommonTrackNodes` do the same. Ordinary episodes stay on
  `ListEpisodeRow`; ordinary tracks stay on `ListTrackRow`. No second livestream row.

## Target layout

```text
Live:      [Play] [Live] [date • start–end]
Scheduled:        [Scheduled] [date • start–end]
Ended:            [Ended] [date • start–end]
```

- Play, then the badge, then the date block. The date block stays `ReadableDate`, `' • '`,
  `ReadableTime` start–end. Do not drop the clock range. Do not add a duration.
- No `' • '` between the badge and the date block. The line's existing flex `gap` separates them.
- Scheduled and Ended keep having no play button. Do not add a placeholder for it.
- When an Add by RSS row has no start time (`startTimeIso === null`), the date block stays
  hidden and the badge follows the play button, or leads the line when there is no play button.

## Changes

### `ListLiveItemRow.module.scss`

The element order does not change. Add `min-width: 0;` to the existing `.timeSection` rule so a
long time text gives way before the badge does. Add:

```scss
.statusSlot {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
}
```

Leave every other rule as it is.

### `ListLiveItemRow.tsx`

Keep the current order. Wrap the badge so the position check can measure it. Exact JSX for
`bottomSectionStart`:

```tsx
<div className={styles.bottomSectionStart}>
  {live_item.live_item_status.id === LiveItemStatusEnum.Live && (
    <PlayButtonRow item={item} onClick={playButtonOnClick} />
  )}
  {showLiveItemStatus && (
    <div className={styles.statusSlot} data-testid="live-item-row-status">
      <LiveItemStatus live_item={live_item} />
    </div>
  )}
  <div className={styles.timeSection} data-testid="live-item-row-date">
    <ReadableDate date={live_item.start_time} />
    {' • '}
    <ReadableTime start={live_item.start_time} end={live_item.end_time || null} />
  </div>
</div>
```

Keep the `showLiveItemStatus` prop and its gate. Every shipping caller passes it (episode, track,
remote-item, Common episode/track nodes, the livestreams page, and Subscribed). The only
component that omits it, `ListLiveItems`, has no callers. Do not remove the prop.

Do not change `playButtonOnClick`, `url`, or the title `Link`.

### `AddByRSSLivestreamRow.tsx`

Same order, same test ids, no `showLiveItemStatus` gate (Add by RSS rows always show the badge):

```tsx
<div className={styles.bottomSectionStart}>
  {liveStatusId === LiveItemStatusEnum.Live && (
    <PlayButtonRow
      item={null}
      addByRSSIdText={item.idText}
      addByRSSHashIds={addByRSSHashIds}
      onClick={playButtonOnClick}
    />
  )}
  <div className={styles.statusSlot} data-testid="live-item-row-status">
    <LiveItemStatus live_item={liveItemDto} />
  </div>
  {startTimeIso !== null && (
    <div className={styles.timeSection} data-testid="live-item-row-date">
      <ReadableDate date={startTimeIso} />
      {' • '}
      <ReadableTime start={startTimeIso} end={endTimeIso} />
    </div>
  )}
</div>
```

Do not change `liveItemDto`, `url`, or `playButtonOnClick`.

### Out of scope (R8, and non-row surfaces)

- Grid cells: `ListLiveItemGridNode.tsx`, `CommonLivestreamGridNode.tsx`,
  `AddByRSSLivestreamGridNode.tsx`.
- Detail headers: `LivestreamHeaderPlaySection.tsx`, `AddByRSSLivestreamDetailHeader.tsx`. They
  also use `LiveItemStatus`; do not change `LiveItemStatus.tsx` or its stylesheet.
- `CommonLivestreamRow.tsx` and `CoreLivestreamRow.tsx` only forward to `ListLiveItemRow`; no edit.
- The embed list row is plan 11.
- Mobile is area B (plans 20–29).

## Row inventory (R4, R6)

Every web livestream item row renders through one of these two components:

| Component | Reached from |
| --- | --- |
| `ListLiveItemRow` | `ListEpisodeNodes`, `ListTrackNodes`, `ListTrackRemoteItemNodes`, `CommonEpisodeNodes`, `CommonTrackNodes`, `ListLiveItemNodes` (via `CommonLivestreamNodes` / `CoreLivestreamNodes` on the livestreams page), `SubscribedLivestreamNodes` (server entries) |
| `AddByRSSLivestreamRow` | `AddByRSSLivestreamNodes` (Add by RSS library Livestreams tab, Add by RSS podcast, album, and artist pages), `SubscribedLivestreamNodes` (Add by RSS entries) |

The embed list row (`EmbedListRow.tsx`) is the only other web item row with a status badge; plan
11 covers it.

## Accessibility

With the badge showing, the row reads title, description, status, then date and time. The badge
keeps its visible text as its name. Leave `tabIndex={-1}` on the badge as `LiveItemStatus` sets
it. The new wrapper is not a control.

## Tests

Playwright: `apps/web/e2e/media-list-chips.spec.ts`.

Add one helper beside `liveItemRow` / `addByRssLivestreamRow` / `rowTop` near the top of the file:

```ts
const expectStatusLeftOfDate = async (row: Locator, statusLabel: string): Promise<void> => {
  const date = row.getByTestId('live-item-row-date');
  const status = row.getByTestId('live-item-row-status');
  await expect(date).toBeVisible();
  await expect(status.getByText(statusLabel, { exact: true })).toBeVisible();
  const dateBox = await date.boundingBox();
  const statusBox = await status.boundingBox();
  expect(dateBox, 'date line is in the layout').not.toBeNull();
  expect(statusBox, 'status slot is in the layout').not.toBeNull();
  if (dateBox === null || statusBox === null) {
    return;
  }
  expect(dateBox.x).toBeGreaterThanOrEqual(statusBox.x + statusBox.width - 1);
  const statusCenterY = statusBox.y + statusBox.height / 2;
  expect(statusCenterY).toBeGreaterThan(dateBox.y);
  expect(statusCenterY).toBeLessThan(dateBox.y + dateBox.height);
};
```

It checks that the date shows (R3, R11) and that the badge is on the date's line, to its left
(R10). Do not assert that the badge is to the right of the date.

Use it in two existing tests, keeping their current assertions. Do not add Play or navigation
assertions; R17 is already true and this spec's new check is only the badge position.

1. `When Browse Livestreams is opened signed out, live streams are listed before scheduled ones`
   (database rows), first step: after the existing `getByText('Live' | 'Scheduled')` checks, add
   `await expectStatusLeftOfDate(audioRow, 'Live');`,
   `await expectStatusLeftOfDate(followedLiveRow, 'Live');`, and
   `await expectStatusLeftOfDate(scheduledRow, 'Scheduled');`. Append to that step's label:
   `, and each status sits on the date line to the left of the date`.
1. `When an Add by RSS podcast page lists livestreams, live comes first, then scheduled, then one
   that ended within the day, and Oldest leaves that order in place` (Add by RSS rows), in the step
   `The podcast page lists the live item, then the scheduled item, then the item that ended within
   the day`: after the existing status text checks, add the helper call for `liveRow` / `'Live'`,
   `scheduledRow` / `'Scheduled'`, and `endedRecentRow` / `'Ended'`. Append the same phrase to the
   step label.

Follow **e2e-readability** for any new wording. No other spec asserts the badge's position; the
existing `getByText('Live', { exact: true })` checks elsewhere still pass.

## Release scratchpad

none

The visible order, the start–end time, the lack of a duration, and the lack of Play on Scheduled
and Ended already ship. This plan adds test ids and a position check.
