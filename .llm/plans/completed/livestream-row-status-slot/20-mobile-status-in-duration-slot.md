**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 20 — Mobile livestream item rows: status badge in the duration slot

## Rows

R1, R2, R3, R5, R6, R7, R8, R9, R13, R14, R16, R17, R20

## Runs after

none

## Files

apps/mobile/src/screens/home/homeFeedRowLiveStatus.ts
apps/mobile/src/screens/home/homeFeedRowLiveStatus.test.ts
apps/mobile/src/screens/home/HomeFeedRow.tsx
apps/mobile/src/components/player/MediaRowActions.tsx
apps/mobile/src/screens/home/homeFeedData.ts
.cursor/rules/mobile-screen-layout.mdc
.cursor/skills/mobile-reusable-components/SKILL.md
apps/mobile/e2e/add-by-rss-livestream.yaml
apps/mobile/e2e/browse.yaml
apps/mobile/e2e/home.yaml

## Goal

Every mobile livestream **item** row (Home Livestreams chip, Browse Livestreams chip, the Add by
RSS library Livestreams chip, a directory podcast's episode list, a directory album's track list
once plan 23 renders its livestreams as episode rows, an Add by RSS feed's episode list) shows its
status badge — Live, Scheduled, or Ended — in the play band, in the slot where an
episode row shows its duration. The badge no longer sits on the artwork, on the context line
above the title, or on the date line under the title. The date line under the title keeps the
date. Channel (show) rows and grid cells do not change.

## What the code does today

All of these rows render through `HomeFeedRow` (`apps/mobile/src/screens/home/HomeFeedRow.tsx`):

- `liveStatusWord` (from `liveStatusWordKey(row.liveStatusId)`) is Scheduled or Ended, null for Live.
- `channelLabel` joins `liveStatusWord` before the show name on the context line
  (`Scheduled • Show`) when the context line is visible (Home, Browse, Add by RSS library).
- `dateLineStatus` puts a neutral Scheduled/Ended `Badge` (`home-feed-row-live-status-${row.id}`)
  at the start of the date line when the context line is hidden (inside a channel).
- `dateLine` also puts the danger Live `Badge` (`home-feed-row-live-${row.id}`) at the start of the
  date line when there is no artwork (inside a channel).
- The artwork block draws the Live badge centered on the artwork (`liveOnArtwork`) whenever
  `liveLabel` is set — for channel rows **and** item rows.
- `useDurationLabel` returns null while live; the band (`MediaRowActions`, `appearance="icons"`)
  shows Play and no duration.
- `showScheduledLivestreamMore` renders a More-only band, right-aligned (`rowActionsEnd`), for a
  non-playable `livestreams` row that has More actions (Home, Browse: Share).
- A non-playable row with no More actions (Add by RSS library Scheduled; Add by RSS feed
  Scheduled and Ended, which use `mediaType="episodes"`) renders no band at all.
- Album track live rows (`AlbumDetailScreen`, `mediaType="tracks"`, `toChannelLiveRow`) have no
  band; More is inline in the identity row; Live / Scheduled / Ended sit on the date line. Plan 23
  moves album livestreams onto the episode row (`mediaType="episodes"`), so after this set no list
  builds a track row for a live item.

`MediaRowActions` (`apps/mobile/src/components/player/MediaRowActions.tsx`) has a
`durationLabel: string | null` slot beside Play only. Its other callers (`ItemDetailHeader.tsx`,
`TrackDetailHeader.tsx`) must render exactly as they do now; they pass none of the new props.

## Decisions (settled — transcribe, do not revisit)

The operator settled 2, 4, 5, 6, and 10 in the first review (`00-REQUEST.md` § Review of the
first planning pass, D4–D8), and 11 in the second-pass review (E1, E2).

1. **Item rows only.** A channel row (`isChannelListMediaType(mediaType)`: podcasts, albums,
   artists) keeps the Live badge centered on the artwork, and on its date line when it has no
   artwork. Grid cells (`HomeFeedGridCell.tsx`) are not touched.
2. **Live leaves the artwork on item rows.** The artwork Live badge renders only on channel rows.
   An item row's Live badge is in the band.
3. **One badge per item row.** `resolveItemRowLiveStatus` (below) picks it: Scheduled or Ended
   (neutral) when `liveStatusWordKey(row.liveStatusId)` is non-null; otherwise Live (danger) when
   `row.metadata?.isLive === true`; otherwise none. A row whose status says Ended but whose
   metadata still says live shows Ended only.
4. **The badge replaces the duration.** A row with a status badge passes `durationLabel={null}`,
   so the band never shows both, and no in-row progress track mounts (it needs a duration).
5. **Placement in the band:**
   - Row has Play: `[Play] [Badge] ………… [More]` — the badge where the duration text sits.
   - Row has no Play (Scheduled, Ended): `[Badge] ………… [More]` — the badge at the leading edge
     of the band, More (when there is any) at the trailing edge. A row with a badge and no More
     shows the band with the badge alone.
6. **Track rows carry no status.** Album livestreams render as episode rows (plan 23), and no
   other list builds a track row for a live item. The band condition still excludes
   `mediaType === 'tracks'`, so a track row never gains a band, and no badge is drawn in a track
   row's identity row. Until plan 23 lands, an album's live track rows show no badge; both plans
   ship in this set.
7. **Context line** carries only the show name. No `Scheduled •` prefix.
8. **Date line** for item rows carries only the date (`home-feed-row-updated-${row.id}`), in the
   same place and style as today.
9. **Test ids stay the same:** Live badge `home-feed-row-live-${row.id}`, Scheduled/Ended badge
   `home-feed-row-live-status-${row.id}`. Only their position changes. The duration text id
   `home-feed-row-duration-${row.id}` is not rendered on a row with a badge.
10. **Only Live has Play.** This plan does not change `row.playable`; it renders what the row
    data says. Home, Browse, and Add by RSS rows are already unplayable while Scheduled or Ended,
    and plan 22 makes podcast and album list rows match. So a Live row reads
    `[Play] [Live] ………… [More]`, and a Scheduled or Ended row reads `[Badge] ………… [More]` on every
    list. Pressing any livestream row opens its livestream page; the row press is not changed here.
11. **Share is the only More action on a livestream row.** `HomeFeedRow` already does this when
    `mediaType === 'livestreams'`: no Queue Next, Queue Last, Add to Playlist, Mark as Played, or
    download. That check also applies when `row.liveStatusId !== undefined`, so a livestream on a
    podcast episode list or an album track list is share-only even though those lists use
    `mediaType="episodes"`. Playing still writes history. The livestream page is out of scope.

Rows without `liveStatusId` and without `metadata.isLive` (queue, history, playlists, search,
ordinary episodes) are unchanged. Item and livestream **detail headers** are not rows and are out
of scope.

## Step 1 — pure status helper

Create `apps/mobile/src/screens/home/homeFeedRowLiveStatus.ts`, a sibling of
`homeFeedRowDownload.ts`:

```typescript
import type { LiveItemStatusEnum } from '@podverse/helpers/dto';

import { liveStatusWordKey } from '../../lib/rows/liveItemRows';

/** The status badge an item row shows in its duration slot. */
export type ItemRowLiveStatus = {
  labelKey: 'media.livestream.ended' | 'media.livestream.live' | 'media.livestream.pending';
  testIDPrefix: 'home-feed-row-live' | 'home-feed-row-live-status';
  tone: 'danger' | 'neutral';
};

/**
 * Which status badge an item row shows, or null for none.
 *
 * Channel rows return null: their Live badge stays on the artwork. A stated Scheduled or Ended
 * status wins over live metadata, so a row shows one badge.
 */
export const resolveItemRowLiveStatus = (
  isChannelList: boolean,
  isLive: boolean,
  liveStatusId: LiveItemStatusEnum | null | undefined
): ItemRowLiveStatus | null => {
  if (isChannelList) {
    return null;
  }
  const wordKey = liveStatusWordKey(liveStatusId);
  if (wordKey !== null) {
    return { labelKey: wordKey, testIDPrefix: 'home-feed-row-live-status', tone: 'neutral' };
  }
  if (isLive) {
    return { labelKey: 'media.livestream.live', testIDPrefix: 'home-feed-row-live', tone: 'danger' };
  }
  return null;
};

/**
 * Share is the only More action on a livestream row.
 *
 * The livestreams list already works this way. A livestream inside a podcast or album list
 * carries liveStatusId and uses the episode row, so the same rule follows that field.
 */
export const isShareOnlyLivestreamRow = (
  mediaType: string,
  liveStatusId: LiveItemStatusEnum | null | undefined
): boolean => {
  return mediaType === 'livestreams' || liveStatusId !== undefined;
};
```

## Step 2 — `MediaRowActions` status slot

In `apps/mobile/src/components/player/MediaRowActions.tsx`:

- Add `Badge` to the existing value import from `'../primitives'`, and `BadgeTone` to the existing
  type import from `'../primitives'`.
- Add to `MediaRowActionsProps`, after `durationTestID`:

  ```typescript
  /**
   * Already-localized livestream status (Live, Scheduled, Ended) for `appearance` `icons`. It takes
   * the duration slot beside Play, or the leading edge of the band when Play is hidden.
   */
  statusLabel?: string | null;
  statusTestID?: string;
  statusTone?: BadgeTone;
  ```

- Update the `durationLabel` doc to: `Already-formatted duration shown beside Play when
  `appearance` is `icons`. A set `statusLabel` takes this slot instead.`
- Update the `showPlayButton` doc to: `When false, omit Play/Pause, duration, and in-row progress.
  Without a `statusLabel` only More renders, and the container stays compact (no flex grow) so it
  can sit inline in a row and stay vertically centered. With one, the status sits at the leading
  edge and More at the trailing edge.`
- In the component, destructure `statusLabel = null`, `statusTestID`, `statusTone = 'neutral'`.
  Compute:

  ```typescript
  const hasStatus = useIcons && statusLabel !== null && statusLabel.length > 0;
  const hasDuration = !hasStatus && durationLabel !== null && durationLabel.length > 0;
  ```

  (replacing the current `hasDuration` line).
- Style factory selection becomes:
  `useIcons ? (showPlayButton || hasStatus ? createIconPlayStyles : createIconMoreOnlyStyles) : createLabelStyles`.
- Build one status element when `hasStatus`:
  `<Badge label={statusLabel} testID={statusTestID} tone={statusTone} />` (narrow `statusLabel`
  to `string` through `hasStatus`; if TypeScript cannot narrow, compute
  `const statusText = hasStatus && statusLabel !== null ? statusLabel : null` and render on
  `statusText !== null`).
- Icons with Play, `MediaRowIconsLeading` branch: add a `statusBadge: ReactNode` prop (import
  `ReactNode` as a type from `react`). Render it after the progress track in place of the duration
  `Text`: `{statusBadge ?? (hasDuration ? <Text …>{durationLabel}</Text> : null)}`. Pass
  `statusBadge={hasStatus ? badgeElement : null}`.
- Icons with Play, plain `View style={styles.leading}` branch (no `playbackMediaId`): same swap —
  the badge when `hasStatus`, otherwise the existing duration `Text` when `hasDuration`.
- No Play: when `playControl` is null and `hasStatus`, render
  `<View style={styles.leading}>{badgeElement}</View>` in its place, before `moreButton`.
  Concretely: `const leadingControl = playControl ?? (hasStatus ? <View style={styles.leading}>{badge}</View> : null);`
  and render `{leadingControl}` where `{playControl}` renders now.
- `appearance="labels"` ignores the status props.

Callers that pass none of the new props render byte-identically (same factory, same children).

## Step 3 — `HomeFeedRow`

In `apps/mobile/src/screens/home/HomeFeedRow.tsx`:

- Replace the `liveStatusWordKey` import with
  `import { resolveItemRowLiveStatus } from './homeFeedRowLiveStatus';` (keep import order:
  sibling imports sit with the other `./` imports).
- `isLive` stays `row.metadata?.isLive === true`. Move `const isChannelList = …` above the
  duration hooks if needed so it is defined before use.
- Replace the `liveStatusWord` memo, `channelLabel`, and `dateLineStatus` with:

  ```typescript
  const itemLiveStatus = useMemo(
    () => resolveItemRowLiveStatus(isChannelList, isLive, row.liveStatusId),
    [isChannelList, isLive, row.liveStatusId]
  );
  const itemLiveStatusLabel = itemLiveStatus === null ? null : t(itemLiveStatus.labelKey);
  const contextSubtitle = row.subtitle !== null && row.subtitle.length > 0 ? row.subtitle : null;
  const channelLabel = isChannelList || !contextLineVisible ? null : contextSubtitle;
  /** A channel row with no artwork states Live on its date line. */
  const dateLineLiveLabel = isChannelList && !showArtwork ? liveLabel : null;
  ```

- Duration: rename `useDurationLabel`'s second parameter from `isLive` to `hidden` (same logic:
  `if (hidden) return null;`), call it with `itemLiveStatus !== null`, and set
  `const durationLabel = itemLiveStatus !== null ? null : (clipRangeLabel ?? episodeDurationLabel);`.
  Because the hook call now needs `itemLiveStatus`, order the statements so `isChannelList`,
  `contextLineVisible`, `showArtwork`, and `itemLiveStatus` are computed before
  `episodeDurationLabel`.
- `dateLine`: condition `updatedLabel !== null || dateLineLiveLabel !== null`; inside the
  `dateRow` View render the Live `Badge` (`testID={`home-feed-row-live-${row.id}`}`,
  `tone="danger"`) when `dateLineLiveLabel !== null`, then the updated `Text` as today. Remove the
  `dateLineStatus` Badge.
- Artwork: render the `liveOnArtwork` overlay only when `isChannelList && liveLabel !== null`.
  `styles.liveBadge` stays; the artwork overlay still uses it.
- Track rows get no badge in the identity row and no band (Decision 6).
- Band: add `const showLiveStatusBand = itemLiveStatus !== null && mediaType !== 'tracks';`. The
  band renders when `showPlayBand || showScheduledLivestreamMore || showLiveStatusBand`. The
  wrapper style is `[styles.rowActions, showPlayBand || showLiveStatusBand ? null : styles.rowActionsEnd]`.
  Pass to the band's `MediaRowActions`:

  ```tsx
  statusLabel={showLiveStatusBand ? itemLiveStatusLabel : null}
  statusTestID={itemLiveStatus === null ? undefined : `${itemLiveStatus.testIDPrefix}-${row.id}`}
  statusTone={itemLiveStatus?.tone}
  ```

  The inline track `MediaRowActions` (`showInlineTrackMore`) gets none of these props.
- `accessibilityLabel` parts: item rows become
  `[channelLabel, removedLabel, row.title, updatedLabel]`, then `description`, `durationLabel`,
  then `isChannelList ? liveLabel : itemLiveStatusLabel`, then `unseenSpoken` and the unseen dot
  text as today. Remove `dateLineStatus` and the standalone `liveLabel` entry.
- Rewrite the last three sentences of the `HomeFeedRow` doc comment (from "A livestream row
  states Scheduled…") to: `A livestream item row states Live, Scheduled, or Ended in the play
  band where an episode row shows its duration: beside Play, or at the band's leading edge when
  the row has no Play. Channel rows keep Live on the artwork. A livestream row's More menu is
  Share only.`
- More menu: replace `const isLivestreamRow = mediaType === 'livestreams'` with
  `const isLivestreamRow = isShareOnlyLivestreamRow(mediaType, row.liveStatusId)`, imported from
  `./homeFeedRowLiveStatus`. Keep the comment that a livestream has no fixed length to queue
  behind or finish. `showScheduledLivestreamMore` stays `mediaType === 'livestreams'`.

## Step 4 — row data comment

`apps/mobile/src/screens/home/homeFeedData.ts`, the `liveStatusId` field doc (~line 111): replace
`Set on livestream rows. Drives the Scheduled prefix on the context line.` with `Set on livestream
rows. Picks the Scheduled or Ended badge in the row's duration slot.`

## Step 5 — guidance

`.cursor/rules/mobile-screen-layout.mdc` § List rows, the paragraph starting "Home subscription
markers stay on those shared row/cell components" (~lines 176–183). Replace from "Inside a channel
(no artwork) a livestream row's status starts the date line" through "Outside a channel Scheduled
leads the context line." with:

```markdown
A livestream item row states its status in the play band, in the slot where an episode row
shows its duration: the Live badge while on the air and a neutral Scheduled or Ended badge
otherwise. The badge replaces the duration. Only a Live row has Play, with the badge beside it.
A Scheduled or Ended row has no Play: the badge starts the band and More sits at the far end.
Pressing any livestream row opens its livestream page. The date stays on the date line under
the title, and the context line carries only the show name. A livestream inside an album uses
this same episode row, never the compact track row. Channel rows keep Live on the artwork.
```

Also change "list live is centered on the artwork" in that paragraph to "list live is centered
on a channel row's artwork".

`.cursor/skills/mobile-reusable-components/SKILL.md`, **Home subscription markers** list item
for `HomeFeedRow` (~lines 157–164): change "live `Badge` is centered on the artwork" to "a channel
row's live `Badge` is centered on the artwork", and replace the sentences from "Inside a channel
(no artwork)…" through "…Scheduled leads the context line." with the same paragraph text as the
rule (wrapped to the list indent, two spaces). Keep both files at 100-character lines.

## Step 6 — Maestro

Flows assert placement with `rightOf` / `below`; ids are regexes as in the existing flows.

`apps/mobile/e2e/add-by-rss-livestream.yaml`:

- After `assertVisible: text: "E2E Add-by-RSS Scheduled Live"` (~line 37), before the
  `assertNotVisible: id: "home-row-more-.*"`, add (Add by RSS library, Livestreams chip):

  ```yaml
  # A livestream row states its status where an episode shows its duration, and keeps its date
  # under the title.
  - assertVisible:
      id: "home-feed-row-live-.*live-guid/now"
      rightOf:
        id: "home-row-play-.*live-guid/now"
  - assertVisible:
      id: "home-feed-row-updated-.*live-guid/scheduled"
      below:
        id: "home-feed-row-title-.*live-guid/scheduled"
  # A scheduled row has no Play, so its status starts the band under the date.
  - assertVisible:
      id: "home-feed-row-live-status-.*live-guid/scheduled"
      text: Scheduled
      below:
        id: "home-feed-row-updated-.*live-guid/scheduled"
  - assertNotVisible:
      id: "home-row-play-.*live-guid/scheduled"
  - assertNotVisible:
      text: "Scheduled • .*"
  ```

- In the feed-detail section, replace the comment `# Inside a channel the scheduled row states
  its status on the date line.` with `# Inside a channel the status also sits in the play band,
  below the date.` and replace the following `assertVisible` of
  `home-feed-row-live-status-.*live-guid/scheduled` with:

  ```yaml
  - assertVisible:
      id: "home-feed-row-live-status-.*live-guid/scheduled"
      text: Scheduled
      below:
        id: "home-feed-row-updated-.*live-guid/scheduled"
  - assertVisible:
      id: "home-feed-row-live-.*live-guid/now"
      rightOf:
        id: "add-by-rss-home-play-live-.*live-guid/now"
  ```

  Keep the existing `assertNotVisible` of `home-feed-row-live-status-.*live-guid/now`.

`apps/mobile/e2e/browse.yaml`, Livestreams chip, after `assertVisible: text: "E2E Scheduled
Livestream"` (~line 103):

```yaml
- assertVisible:
    id: home-feed-row-live-e2eLiveStrm01
    rightOf:
      id: home-row-play-e2eLiveStrm01
- assertVisible:
    id: home-feed-row-live-status-e2eLiveSched01
    text: Scheduled
- assertNotVisible:
    id: home-row-play-e2eLiveSched01
- assertNotVisible:
    text: "Scheduled • .*"
```

`apps/mobile/e2e/home.yaml`, Livestreams chip, after the `extendedWaitUntil` for `E2E Livestream
Item` (~line 374):

```yaml
- assertVisible:
    id: home-feed-row-live-e2eLiveStrm01
    rightOf:
      id: home-row-play-e2eLiveStrm01
```

Keep every existing `takeScreenshot` where it is, so the reports show the new placement.

## Tests

- Unit: `apps/mobile/src/screens/home/homeFeedRowLiveStatus.test.ts` (vitest, same style as
  `HomeFeedRow.test.ts`; import `LiveItemStatusEnum` from `@podverse/helpers` as
  `liveItemRows.test.ts` does). Cases, as `it` sentences:
  - a channel row gets no status, even while live or scheduled;
  - a live item row gets the danger Live badge with the `home-feed-row-live` prefix;
  - a scheduled item row gets the neutral Scheduled badge with the `home-feed-row-live-status`
    prefix, and an ended one the neutral Ended badge;
  - an ended status wins over live metadata;
  - a row with no status and no live metadata gets none.
  - `isShareOnlyLivestreamRow` is true for media type `livestreams`, and for any other media type
    when `liveStatusId` is set, including `null`. It is false for an episode or track row whose
    `liveStatusId` is `undefined`.
- Maestro: `add-by-rss-livestream.yaml`, `browse.yaml`, `home.yaml` as in Step 6.

## Release scratchpad

```markdown
## Mobile livestream rows show their status where the duration sits

- Surfaces: mobile
- Change: Livestream item rows on Home, Browse, a podcast's episode list, and the Add by RSS
  library and feed pages show the Live, Scheduled, or Ended badge in the play band, beside Play
  where an episode shows its duration (or at the start of that band when there is no Play). The
  badge no longer sits on the artwork, before the show name, or on the date line, and it
  replaces the duration. The date stays under the title. Rows that had no play band before,
  such as Scheduled and Ended rows in the Add by RSS library and on Add by RSS feed pages, now
  show one with the badge and, where the row has any, the More button. Show rows and grid tiles
  keep Live on the artwork. On a podcast or album list, a livestream row's More menu is Share
  only: no queue, playlist, or mark as played.
- Who notices: listeners browsing livestreams on mobile
- Operator steps: none
```
