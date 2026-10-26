## Mobile Home Clips no longer offers an A-Z sort

- Surfaces: mobile
- Change: Home's Clips chip sorts by Recent or Popularity only, and opens on Recent. A-Z is gone
  from its sort menu. A Clips A-Z choice saved by an earlier build reads as Recent. Clips now show
  in the server's order instead of being re-sorted by title on the device. Podcasts, Episodes,
  Artists, Albums, and Tracks keep A-Z as their default.
- Who notices: signed-in users who had Home Clips set to A-Z (it opens on Recent), and anyone who
  opens the Clips sort menu
- Operator steps: none

## Mobile Home Clips reloads when its sort changes

- Surfaces: mobile
- Change: switching Home's Clips chip between Recent and Popularity, or picking a different
  Popularity window, fetches the first page in the new order right away and saves it on the
  device in place of the old list. Before, the list kept the old order until the next background
  sync. The old rows clear on the tap and a spinner shows until the new page arrives; a failed
  fetch shows the list error with Retry. Background sync still starts the saved list over from
  page 1. Offline Mode and signed-out Home Clips are unchanged.
- Who notices: signed-in users who change the Home Clips sort
- Operator steps: none

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

## Livestream lists: newest live first, soonest scheduled first, long-past scheduled hidden

- Surfaces: api, web, mobile
- Change: `GET /live-item/global/upcoming` and `GET /live-item/subscribed/upcoming` list live
  items latest start first, then scheduled items soonest start first. Before, both groups came
  back oldest start first. Scheduled items whose start time is more than a day in the past are
  left out of these lists, of the per-status live-item lists with `liveItemType=pending`, and of
  `GET /live-item/channel/:id`. Channel livestream lists also show scheduled items soonest start
  first. Detail pages still open long-past scheduled items. Web and mobile use the same order
  through the shared `compareUpcomingLiveItems`.
- Who notices: everyone on Browse and Home Livestreams; API consumers of the live-item list routes
- Operator steps: none

## Web: long-past scheduled Add by RSS livestreams are hidden

- Surfaces: web
- Change: Home Subscribed Livestreams, the Add by RSS library Livestreams tab, and Add by RSS
  podcast, album, and artist pages leave out scheduled livestreams whose start time is more than a
  day in the past, matching the server lists. Add by RSS channel pages list scheduled livestreams
  soonest start first.
- Who notices: web listeners with Add by RSS feeds that carry livestreams
- Operator steps: none

## Mobile: livestream rows follow the new order and hide long-past scheduled streams

- Surfaces: mobile
- Change: Browse, Home, and the Add by RSS library Livestreams lists show live streams latest
  start first, then scheduled streams soonest start first. Scheduled streams whose start time is
  more than a day in the past are hidden, including ones already sitting in the cached Home list
  and Add by RSS feeds parsed on the device. Add by RSS podcast pages list scheduled streams
  soonest start first.
- Who notices: mobile listeners who open Livestreams on Browse, Home, or the Add by RSS library
- Operator steps: none

## Mobile Browse loads more rows as you scroll

- Surfaces: mobile
- Change: every Browse chip (Podcasts, Episodes, Clips, Livestreams, Artists, Albums, Tracks,
  Playlists, Users) used to stop at the first 60 rows. Scrolling near the bottom now loads the next
  page and appends it, with a loading row while it reads and a Retry row if that page fails. Rows
  already shown stay. Pull to refresh and chip, range, or category changes start again from page 1.
  Livestream pages keep the server order (live first, then scheduled soonest first).
- Who notices: anyone browsing past the first screenful on the mobile app
- Operator steps: none

## Mobile podcast Episodes, Clips, and Official Clips load more as you scroll

- Surfaces: mobile
- Change: on a podcast's screen, the Episodes, Clips, and Official Clips sections now load their next page when you scroll near the bottom, with a loading row while it reads. The Show more button is gone, except while a title filter is typed: then the section keeps the button so a narrow filter does not pull the whole feed. A failed next page shows Retry under the rows and retries that page instead of reloading the section.
- Who notices: anyone scrolling a long podcast on the mobile app
- Operator steps: none

## Mobile episode and full player Clips load more as you scroll

- Surfaces: mobile
- Change: the Clips tab on an episode's screen and on the full player now loads the next page of clips when you scroll near the bottom, replacing the Show more button. A failed page shows Retry under the clips already loaded, and Retry now reloads that page (before, retry after a failed Show more did nothing). Changing the clip sort while a page is loading no longer mixes in clips from the old sort.
- Who notices: anyone reading clips on a well-clipped episode in the mobile app
- Operator steps: none

## Mobile notifications inbox loads more as you scroll

- Surfaces: mobile
- Change: the notifications inbox now loads older notifications when you scroll near the bottom, replacing the Show more button. A failed page shows Retry under the rows (before, it failed silently and the inbox stopped paging). A notification that arrives live while you scroll no longer shows up twice, and returning to the inbox while a page loads no longer mixes that page into the fresh list.
- Who notices: signed-in users with a long notification history on the mobile app
- Operator steps: none

## Mobile My Clips and Add to Playlist load more as you scroll

- Surfaces: mobile
- Change: My Clips in the Library and the playlist picker in the Add to Playlist sheet used to show only the first 60 entries. Both now load the next page when you scroll near the bottom, with a loading row while it reads and a Retry row if the page fails.
- Who notices: signed-in users with more than 60 clips, or more than 60 playlists for one medium
- Operator steps: none

## Mobile History loads more as you scroll

- Surfaces: mobile
- Change: History in the Library used to show only the 60 most recent plays. It now loads older plays when you scroll near the bottom, with a loading row while it reads and a Retry row if a page fails. Adding a history row back to the queue, or a listen syncing in the background, no longer resets a long scrolled list to the first 60 rows.
- Who notices: signed-in users with a long play history on the mobile app
- Operator steps: none

## Mobile album tracks load more as you scroll

- Surfaces: mobile
- Change: an album's Tracks list used to stop at the first 60 tracks. It now loads the next page when you scroll near the bottom, with a loading row while it reads and a Retry row if the page fails. Changing the sort or range starts again from the top. Offline mode still shows the stored tracks only.
- Who notices: listeners opening large albums or music channels on the mobile app
- Operator steps: none

## Mobile Home Clips and Livestreams load more as you scroll

- Surfaces: mobile
- Change: Home's Clips and Livestreams chips used to show only the first 60 rows saved by
  background sync. Scrolling near the bottom now fetches the next page, saves it on the device with
  the rest, and redraws the list, so the deeper list also stays readable offline. A loading row
  shows while it reads and a Retry row if it fails. Clips extend under Recent and Popularity. The
  next background sync starts the saved list over from page 1.
  Livestreams stay in live-first, then soonest-scheduled order across pages.
- Who notices: signed-in users following many clip-heavy podcasts or many livestreaming channels
- Operator steps: none

## Sign-out drops the saved Home clips list

- Surfaces: mobile
- Change: signing out deletes the Home Clips list saved on the phone (`home.clips.subscribed`),
  the same way it already deletes the saved Home Livestreams list. The next account on that phone
  starts with an empty saved Home Clips list. A page that was still loading when sign-out started
  is dropped.
- Who notices: someone who signs out, and the next person who signs in on the same phone
- Operator steps: none

## Embed list rows show Live before the date

- Surfaces: web (embed player)
- Change: In list embeds (podcast, album, playlist), a currently live row moves the Live badge
  off the title line onto the date line, to the right of Play and before the date, in place of
  the duration. The title line shows only the title. Row height is unchanged.
- Who notices: sites that embed a Podverse list whose channel is live
- Operator steps: none

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

## Mobile livestream rows inside a podcast show a date

- Surfaces: mobile
- Change: On a podcast's episode list and an Add by RSS feed's episode list, a livestream row with
  no publish date shows its start date under the title, as the Home and Browse livestream lists
  already do. Ended Add by RSS streams now show their start date too. Live rows in a podcast's
  episode list no longer show the new-content dot, since a scheduled start lies in the future.
- Who notices: listeners opening a podcast that has livestreams
- Operator steps: none

## Mobile scheduled and ended livestreams cannot start from a podcast's episode list

- Surfaces: mobile
- Change: On a podcast's episode list and an album's track list, a Scheduled or Ended livestream
  row no longer shows Play and cannot be started from the list. Only a Live row has Play.
  Pressing the row opens the livestream page. Home, Browse, and Add by RSS lists already worked
  this way.
- Who notices: listeners opening a podcast or album that has scheduled or ended livestreams
- Operator steps: none

## Mobile album livestreams use the livestream row

- Surfaces: mobile
- Change: A livestream in an album's track list renders like a podcast's livestream: the date
  (the start date when there is no publish date) and description under the title, and a play band
  with the Live, Scheduled, or Ended badge. Pressing the row opens the livestream page instead of
  starting playback. Only a Live stream has Play. Ordinary tracks keep the compact track row. The
  livestream row's More menu is Share only: no queue, playlist, or mark as played.
- Who notices: listeners opening an album that has livestreams
- Operator steps: none

## A livestream without a status is not saved

- Surfaces: parser, workers
- Change: A podcast:liveItem whose status is missing or not pending, live, or ended is not saved
  and is not returned in a mapped feed. The parser used to store that item as Scheduled. A live
  item already in the database is left in place when a later parse skips it for this reason.
- Who notices: feeds that publish a liveItem tag without a status; those items no longer appear
  as Scheduled
- Operator steps: none

## Home title-bar notifications bell

- Surfaces: mobile
- Change: Home's title bar has a filled bell to the left of the ellipsis. It shows the unread
  notifications count, stopping at 99+, and opens the notifications inbox, which slides up from
  the bottom. Signed out, the bell opens the login prompt; signed in without notifications access
  (no membership or an expired one), it opens the membership prompt. The bell is the only in-app
  way to open the inbox; links, push taps, and banner taps still open it too.
- Who notices: everyone on mobile
- Operator steps: none

## Notifications is no longer a tab; the inbox slides up

- Surfaces: mobile
- Change: Notifications is removed as a tab option. It cannot be pinned to the tab bar, it is not
  a row on More, and Settings > Tab Bar no longer lists it. The inbox is now a full-screen card
  that slides up from the bottom over the tab bar and mini player, with a down chevron to dismiss.
  Links, push taps, and in-app banner taps that open `/notifications` land on that card. The More
  tab no longer shows the unread notifications badge.
- Who notices: everyone on mobile; users who had pinned Notifications to the tab bar see it gone
  and keep their other tabs in the same order
- Operator steps: none

## Channel notification bell sits on the channel header

- Surfaces: mobile
- Change: On podcast, album, and artist detail, the control that turns notifications on or off for that channel leaves the stack title bar and sits at the bottom right of the channel header, to the right of Subscribe / Unsubscribe, at the same size as the settings gear. A tap still toggles the channel, or opens the login or membership gate. Share and Boost stay in the title bar. Episode, track, and livestream detail title bars have no such bell.
- Who notices: listeners on podcast, album, and artist pages
- Operator steps: none

## Search and filter fields clear with an X inside the field

- Surfaces: web, management-web, packages/ui, i18n catalog (shared, management)
- Change: Once a search or filter field has text, an X appears at its right edge. Pressing it
  empties the field and keeps focus in it. On web this covers the Search page field, the episode
  transcript search, and the subscribed podcasts title filter. The filter's separate "Clear" text
  button is gone. On management-web it covers every table search field (Users, Admins, Storage,
  Stats, Product Memberships, Feed Flag Status directory, Database table browser, Workers). The
  browser's own search-field X no longer appears beside it. Clearing applies at once, without
  the typing delay: the Search page and transcript search rerun for the empty term, and a
  management table drops its `search` URL parameter (or table cookie term) and reloads straight
  away. Screen readers name the X "Clear Search" on search fields and "Clear Filter" on filter
  fields, from new shared catalog keys `misc.clear_search` and `misc.clear_filter`, translated
  into Spanish, French, and Greek. The unused management key `tableShared.searchClearLabel` is
  removed. The transcript search field now has an accessible name. `useTableFilterState` in
  `@podverse/ui` gains `clearSearch`, and `TableFilterBar` requires `clearFilterAriaLabel` and
  `onSearchClear`.
- Who notices: everyone who searches or filters lists on web, operators filtering management
  tables, and screen reader users
- Operator steps: none

## Mobile search and list filters clear from an X inside the field

- Surfaces: mobile
- Change: Search and list-filter fields show an X at the right edge of the pill while the field
  has text. Pressing it empties the field through the same change handler as typing and leaves
  the field focused so the keyboard stays up. A screen reader hears Clear Search on Search and
  Clear Filter on a list filter. The separate Clear button beside a list filter is gone. On
  Search, emptying the query also drops an in-flight Podcast Index response so results cannot
  paint back under an empty field.
- Who notices: anyone typing on Search, Home's subscription filter, a podcast or add-by-RSS
  detail filter, or the Add by RSS library filter
- Operator steps: none
