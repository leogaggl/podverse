# Summary — livestream status badge in the duration slot

Model and reasoning per prompt: see `COPY-PASTA.md`. Phases and file ownership: see
`00-EXECUTION-ORDER.md`.

Livestream **item** rows on web and mobile, database and Add by RSS, move their status badge
(Live, Scheduled, Ended) out of the lines around the title and into the duration slot to the
right of the play button. The item's date stays where a normal item row shows its date. Channel
rows and grid cells do not change.

## Requirement ledger

- **R1** (areas A, B) "in the item rows for live streams, the live badge should not appear directly under the item title." — Plan: 10, 11, 20
- **R2** (areas A, B) "It should appear to the right of the play button where the duration normally sits, as that is more appropriate for it because we don't necessarily know the duration of a live stream." — Plan: 10, 11, 20
- **R3** (areas A, B) "we want to keep the date for the live stream if it is available, so it should load like normal below the item title." — Plan: 10, 11, 20, 21
- **R4** (area A) "Look for all rows, web, … that may need an update in this respect." — Plan: 10, 11
- **R5** (area B) "Look for all rows, … mobile, … that may need an update in this respect." — Plan: 20
- **R6** (areas A, B) "Look for all rows, … and add by RSS that may need an update in this respect." — Plan: 10, 20
- **R7** (areas A, B) Operator answer: "Live, Scheduled, and Ended badges all sit in the duration slot to the right of the play button." — Plan: 10, 11, 20
- **R8** (areas A, B) Operator answer: "Channel rows and grid cells: leave them alone. Home channel (show) rows keep the Live badge centered on the artwork, and grid cells keep it at the top right. This set changes item rows only." — Plan: 10, 11, 20
- **R9** (area B) Orientation: "`.cursor/rules/mobile-screen-layout.mdc` § List rows says a livestream row's status starts the date line inside a channel, and Scheduled leads the context line outside one. That guidance changes with this set." — Plan: 20
- **R10** (area A, step 04) Review D1: "Play, then the badge, then the date and start–end time. Scheduled and Ended have no Play button, so the badge leads their line." — Plan: 10, 11
- **R11** (area A, step 04) Review D2: "Keep the start–end time after the date." — Plan: 10
- **R12** (area A, step 04) Review D3: "Include embed list rows. The Live badge leaves the title line and sits right of Play, before the date, same order as D1." — Plan: 11
- **R13** (area B, step 05) Review D4: "Item rows show Live only in the play band. Show rows and grid tiles keep the Live badge on the artwork." — Plan: 20
- **R14** (area B, step 05) Review D5: "On mobile rows with no Play button, the badge starts the band and More sits at the far end. That band appears even on rows that had none before, such as the Add by RSS library and feed pages." — Plan: 20
- **R15** (area B, step 05) Review D6: "album livestreams use the podcast livestream row (play band, badge in the band, date under the title). Ordinary tracks stay compact. No player change in this set." — Plan: 23
- **R16** (areas A, B, steps 04, 05) Review D7: "The badge replaces the duration. A Live, Scheduled, or Ended row never shows a duration. Web livestream rows keep the date and start–end time and have no separate duration." — Plan: 10, 11, 20
- **R17** (areas A, B, steps 04, 05) Review D8: "no Play on Scheduled or Ended. The row opens the livestream page. Only Live can be started from the list. This includes podcast episode lists and album livestreams. Web already hides Play unless the status is Live." — Plan: 10, 20, 22, 23
- **R18** (area B, step 05) Review D9: "Show the start date when there is no publish date, including podcast episode-list livestream rows, Ended Add by RSS rows, and album livestreams." — Plan: 21, 23
- **R19** (area B, step 05) Review D10: "No new-content dot on podcast or album livestream rows. A future start date must not light the dot on every visit." — Plan: 21, 23
- **R20** (area B) Review E1 and E2: "Share only on every livestream row. No queue, playlist, or mark as played. Playing still writes history." — Plan: 20, 23
- **R21** (parser) Review E3: "A liveItem without pending, live, or ended is not saved and not returned. Rows already saved stay." — Plan: 30

## Areas

### Area A — Web livestream item rows

- **Rows:** R1, R2, R3, R4, R6, R7, R8
- **Plan number block:** 10–19
- **Starts from:**
  - `apps/web/src/components/List/LiveItem/ListLiveItemRow.tsx` — database livestream item row.
    `CommonLivestreamListRow` and `CoreLivestreamRow` only forward to it. Callers: episode,
    track, and remote-item lists, the livestreams page, and Subscribed.
  - `apps/web/src/components/AddByRSS/Livestream/AddByRSSLivestreamRow.tsx` — Add by RSS row,
    same layout, imports the same stylesheet.
  - `apps/web/src/styles/components/Common/List/LiveItem/ListLiveItemRow.module.scss`
  - `apps/web/src/components/LiveItem/LiveItemStatus.tsx` — the badge. Also used by
    `LivestreamHeaderPlaySection.tsx` (a detail header, not a row).
  - `apps/web/src/components/embed/EmbedListRow.tsx` — embed list row. Its Live badge sits on
    the title line, before the title. The area step decides whether it is an item row this set
    covers.
  - Parity reference for "where the duration normally sits":
    `apps/web/src/components/List/Podcasts/Episodes/ListEpisodeRow.tsx` (~383–391). On web the
    date and the duration both sit to the right of the play button (`date • duration`), not
    under the title. The plan must say how R2 and R3 map onto that layout.
- **Known open points for the planner:** the play button shows only while Live, so Scheduled
  and Ended rows have no play button; the row also shows a `ReadableTime` start–end range after
  the date; `showLiveItemStatus` gates the badge on database rows but not on Add by RSS rows.
- **Depends on:** no other area.
- **Shares files with:** none. Area B is mobile only. If both areas add i18n keys, they share
  `packages/i18n-catalog/*/originals/*.json`; neither is expected to need new keys, since the
  status labels already exist.

### Area B — Mobile livestream item rows

- **Rows:** R1, R2, R3, R5, R6, R7, R8, R9
- **Plan number block:** 20–29
- **Starts from:**
  - `apps/mobile/src/screens/home/HomeFeedRow.tsx` — the one shared row for every mobile list
    (Home, channel detail, Browse, the Add by RSS library). Anchors: `liveStatusWord`,
    `channelLabel` (status joined to the context line), `dateLineStatus` and `dateLine` (Live and
    Scheduled/Ended badges at the start of the date line in a channel), `liveOnArtwork` (Live on
    artwork when artwork shows), `useDurationLabel` (returns null when live),
    `showScheduledLivestreamMore` (a Scheduled row has no play band, only More), and the
    `MediaRowActions` band that receives `durationLabel`.
  - `apps/mobile/src/components/player/MediaRowActions.tsx` (and `MediaRowActions.test.ts`) —
    the play / duration / more band. Its
    duration slot takes a string today; a badge there may need a new prop. Other callers of
    `MediaRowActions` must not change.
  - Row data builders: `apps/mobile/src/lib/rows/liveItemRows.ts`,
    `apps/mobile/src/lib/addByRss/liveRows.ts`, `apps/mobile/src/screens/home/homeRowMetadata.ts`.
  - Screens: `HomeScreen.tsx`, `apps/mobile/src/screens/podcast/sections/PodcastEpisodesSection.tsx`,
    `apps/mobile/src/screens/rss/AddByRssRootScreen.tsx`,
    `apps/mobile/src/screens/browse/BrowseScreen.tsx`.
  - Out of scope per R8: `HomeFeedGridCell.tsx` and channel (show) rows in `HomeFeedRow`.
  - Guidance to update: `.cursor/rules/mobile-screen-layout.mdc` § List rows (~176–183), and the
    `HomeFeedRow` doc comment.
  - Maestro flows that assert `home-feed-row-live-*` test ids, including
    `apps/mobile/e2e/add-by-rss-livestream.yaml`.
- **Depends on:** no other area.
- **Shares files with:** none (see area A on i18n catalogs).

## Order

First planning pass: one wave. Areas A and B touch disjoint files (web versus mobile), and
neither uses a route or component the other creates.

- **Wave 1:** area A (step 02), area B (step 03).

Second pass after the first review: the operator settled D1–D10 (answers in `00-REQUEST.md`
§ Review of the first planning pass), adding rows R10–R19. Step 04 revises the web plans (10, 11)
and step 05 revises the mobile plans (20, 21), adding plans in 22–29 for album livestream rows
and for removing Play from Scheduled and Ended rows if they are separate changes. The two steps
edit disjoint plans and run at once.

## Second-pass choices

Settled in `00-REQUEST.md` § Review of the second-pass choices. Plans 20, 22, 23, and 30 implement
those answers.

- **E1 and E2** — Share only on every livestream row. No queue, playlist, or mark as played.
  Playing still writes history. Plan 20 applies that inside `HomeFeedRow` whenever
  `liveStatusId` is set, including a livestream on a podcast or album list. Plan 23 passes Share
  on the album livestream row and does not pass queue.
- **E3** — Plan 30: the parser does not save or return a liveItem whose status is not pending,
  live, or ended. Rows already saved are not archived only because a later parse skipped them.
  Plan 22 leaves a row with no status playable.

## Decisions to review

Planner choices from the first planning pass that the request did not settle. Each item names
the choice made, the main alternative, its step, and its plan. All ten are settled by the first
review; the answers in `00-REQUEST.md` override the choices below where they differ (D1, D3's
position, D6, D8, and the album additions to D9 and D10).

### Web (step 02)

- **D1** (step 02, plan 10) **Where the badge goes on web.** It goes at the end of the time line,
  after the date and start–end time, because that is where web episode rows show the duration:
  `[Play] date • start–end [Badge]`. Alternative: leave web alone, since on Live rows the badge
  is already right of the play button and only Scheduled and Ended rows start the line with it.
- **D2** (step 02, plan 10) **Keep the start–end time on web.** The start–end time stays as part
  of the date; it is the most useful detail on a Scheduled row. Alternative: drop it and let the
  badge stand in for it.
- **D3** (step 02, plan 11) **Embed list row is in scope.** Each embed row is an item, and a
  channel embed lists its live items first, so the Live badge moves off the title line onto the
  meta line after the date, replacing the duration. Alternative: leave the embed out as a
  separate surface.

### Mobile (step 03)

- **D4** (step 03, plan 20) **Live badge on item-row artwork.** Item rows lose it and show Live
  in the play band instead; show rows and grid tiles keep it. Alternative: keep it on the artwork
  as well.
- **D5** (step 03, plan 20) **Scheduled and Ended rows with no Play button.** The badge starts the
  play band and More sits at the far end. The band now appears even on rows that had none, such
  as the Add by RSS library and feed pages. Alternative: keep an empty spot where Play would be.
  Web (D1) puts the badge at the end of the date line instead, so the two surfaces differ for
  rows without Play.
- **D6** (step 03, plan 20) **Album track rows.** They have no play band, so the badge sits in the
  top row just before More. Alternatives: add a band to live track rows, or leave the badge on
  the date line.
- **D7** (step 03, plan 20) **The badge replaces the duration.** A row with a status never shows a
  duration, even when Scheduled or Ended.
- **D8** (step 03, plan 20) **Playability is unchanged.** Scheduled and Ended rows on a podcast's
  episode list stay playable, so they show Play and then the badge; Home, Browse, and Add by RSS
  rows show no Play for those states. Alternative: make them unplayable for consistency, which
  goes beyond badge placement.
- **D9** (step 03, plan 21) **Start-time date fallback.** Podcast episode-list livestream rows
  with no publish date show the start date, and Ended Add by RSS rows do too (Home, Browse, and
  the Add by RSS library already do this). Alternative: leave those rows without a date.
- **D10** (step 03, plan 21) **No new-content dot on podcast livestream rows.** A scheduled start
  is in the future, so with a start-time date the dot would show on every visit until the stream
  starts. Alternative: keep the dot and accept that.
