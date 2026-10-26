# Request — livestream status badge in the duration slot

This set is one of three split from a single operator message. The notifications bell ask is set
`mobile-notifications-bell`. The clear-X ask is set `search-input-clear-icon`.

## Request

Also, in the item rows for live streams, the live badge should not appear directly under the item
title. It should appear to the right of the play button where the duration normally sits, as that
is more appropriate for it because we don't necessarily know the duration of a live stream.

Also, we want to keep the date for the live stream if it is available, so it should load like
normal below the item title.

Look for all rows, web, mobile, and add by RSS that may need an update in this respect.

## Operator answers

- **Scheduled and Ended:** Live, Scheduled, and Ended badges all sit in the duration slot to the
  right of the play button.
- **Channel rows and grid cells:** leave them alone. Home channel (show) rows keep the Live badge
  centered on the artwork, and grid cells keep it at the top right. This set changes item rows
  only.

### Review of the first planning pass

The D numbers refer to "## Decisions to review" in `00-SUMMARY.md`.

- **D1 — Web badge order.** Not at the end of the time line. The operator asked: "can they be to
  the right of the play button, before where duration would normally go? like we want to do on
  mobile?" Then chose: Play, then the badge, then the date and start–end time. Scheduled and
  Ended have no Play button, so the badge leads their line.
- **D2 — Start–end time.** Keep the start–end time after the date.
- **D3 — Embed list rows.** Included. The Live badge leaves the title line and sits right of
  Play, before the date, in the same order as D1.
- **D4 — Artwork badge.** Item rows show Live only in the play band. Show rows and grid tiles
  keep the Live badge on the artwork.
- **D5 — Mobile rows with no Play button.** The badge starts the band and More sits at the far
  end. That band appears even on rows that had none before, such as the Add by RSS library and
  feed pages.
- **D6 — Album livestreams.** They do not use the compact track row. The operator said: "if
  there is a livestream in an album, it should render with the same component as a podcast does.
  livestreams are a distinct type of entity that we want to be consistent. they are not the same
  as a album or music track. livestreams basically ignore medium type in their presentation and
  player qualities as they are unique enough to be their own thing." Decision: album livestreams
  use the podcast livestream row (play band, badge in the band, date under the title). Ordinary
  tracks stay compact. No player change in this set. Web already uses one livestream row for
  both mediums.
- **D7 — Duration.** The badge replaces the duration. A Live, Scheduled, or Ended row never shows
  a duration. Web livestream rows keep the date and start–end time and have no separate duration.
- **D8 — Play on Scheduled and Ended.** The operator said: "scheduled and ended should not
  display a play button." Then chose: no Play on Scheduled or Ended, and the list cannot start
  them. The row opens the livestream page. Only Live can be started from the list. This includes
  podcast episode lists and album livestreams. Web already hides Play unless the status is Live.
  With D5, Scheduled and Ended rows lead with the badge and More sits at the far end.
- **D9 — Start date fallback.** Show the start date when there is no publish date, including
  podcast episode-list livestream rows, Ended Add by RSS rows, and album livestreams.
- **D10 — New-content dot.** No new-content dot on podcast or album livestream rows. A future
  start date must not light the dot on every visit. Add by RSS live rows already have no dot.

### Review of the second-pass choices

E1–E3 were the choices in `00-SUMMARY.md` § Second-pass choices. They are settled.

- **E1 and E2 — More menu.** Share only on every livestream row. No Queue Next, Queue Last, Add
  to Playlist, or Mark as Played. Playing a livestream still writes history. The operator said:
  "livestreams should never have queue add because it doesn't make sense to queue them, they are
  play on demand only in current app." Then: "livestreams are not queue or playlist items they
  should not be able to be added to queues or playlists (although they can be added to history)."
  Then: "mark as played should not be for livestreams either." Home, Browse, and the Add by RSS
  library already build that menu by treating `mediaType === 'livestreams'` as share-only. A
  livestream inside a podcast or album list uses the episode row, so that same rule has to follow
  `liveStatusId`, not only the list's media type. The livestream page itself is out of this set.
- **E3 — A live item with no status.** A `podcast:liveItem` tag is what makes an item a
  livestream, and the item is invalid without a status of pending, live, or ended. The operator
  said: "a liveItem should not be valid if it does not have a status. we would treat that as an
  invalid row that does not get saved or returned by parser." This set adds that parser check.
  Rows already saved stay as they are: a later parse does not archive them only because this
  parse skipped them. A row the database already has with no status stays playable, like an
  ordinary episode. This set does not delete those rows.

## Glossary

- **add by RSS:** Add by RSS, the feeds a member adds by URL. Their rows have their own components
  on web and mobile.

## Orientation

- `apps/mobile/src/screens/home/HomeFeedRow.tsx`: `liveBadge` style (~148), `liveLabel` (~285),
  `useDurationLabel` with an `isLive` branch (~310), Badges at ~550 and ~604, and the play /
  duration band that receives `durationLabel` (~718).
- `apps/mobile/src/screens/home/HomeFeedGridCell.tsx`: grid cell, out of scope.
- `apps/mobile/src/screens/rss/AddByRssRootScreen.tsx`: Add by RSS library, which lists
  livestreams.
- `apps/web/src/components/List/LiveItem/ListLiveItemRow.tsx`: Live badge when status is Live
  (~110), `LiveItemStatus` (~113), `ReadableDate` of `start_time` (~115).
- `apps/web/src/components/Common/Livestream/CommonLivestreamRow.tsx`: another web livestream row.
- `apps/web/src/components/AddByRSS/Livestream/AddByRSSLivestreamRow.tsx`: Add by RSS web row,
  same pattern (~107–115).
- `apps/web/src/components/LiveItem/LiveItemStatus.tsx` and
  `apps/web/src/styles/components/Common/List/LiveItem/ListLiveItemRow.module.scss`.
- `.cursor/rules/mobile-screen-layout.mdc` § List rows says a livestream row's status starts the
  date line inside a channel, and Scheduled leads the context line outside one. That guidance
  changes with this set.
