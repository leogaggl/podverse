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

## Recommendations uses the same list and grid as Subscriptions and Browse

- Surfaces: web, mobile
- Change: Recommendations shows podcast, album, and artist artwork in the same list or grid as
  Subscriptions and Browse. A layout control switches between them and is remembered per chip on
  that device. There is no sort control. On web the empty column to the right of the list is gone,
  so the list uses the full content width. The 1–5 strength number is no longer drawn on each row.
- Who notices: anyone opening Recommendations, signed in or not
- Operator steps: none

## Player More menu, circled add, and a shorter narrow bar

- Surfaces: web, mobile
- Change: The player settings gear on web is a horizontal More menu on the now-playing bar and
  the full player. Share is a row in that menu. Share icons that stay on the page use the same
  connected-nodes glyph as the mobile player. Add to Playlist, Create Playlist, and Add Feed use
  a circled plus, and mobile Add by RSS and Create Playlist do too. On a narrow web window the
  now-playing bar keeps play, jump back, jump forward, and device switch when more than one
  device is connected. Add, More, track skip, and the other controls are on the full player.
- Who notices: anyone using the web player, and mobile users adding a feed or creating a playlist
- Operator steps: none

## Narrow web player progress sits on the top edge

- Surfaces: web
- Change: On a narrow window, the now-playing bar draws playback progress as a thin line along
  its top edge, including while a chapter or clip strip is showing above the bar. The progress
  row that sat under the title and buttons is gone, and the bar is shorter by that row. Wider
  windows keep the progress line and times under the transport buttons. Seeking still works from
  the top line.
- Who notices: anyone playing audio or video in a narrow browser window
- Operator steps: none

## Notifications inbox is a bordered row with one line of text

- Surfaces: web, mobile, parser, i18n
- Change: Each inbox notification is a bordered row with no fill, a left image (item artwork, then
  channel artwork, then the placeholder), and one line such as
  "New episode: Channel – Item" or "System update: …". Livestreams say started or scheduled.
  "New content" is only used when the medium is unknown. Web keeps the list at the same max width
  as other forms, with the usual page inset. New notifications store the image URL and titles on
  the payload; older rows still format from their existing title and body. The inbox has no intro
  sentence and no Unread or Earlier headings. A blue dot on the left marks rows that were unread
  when the list opened. The relative time sits on a smaller line under the title, and the artwork
  is centered on that text stack. The mobile arrival banner uses that same title and time stack.
- Who notices: anyone opening Notifications on web or mobile
- Operator steps: none

## Local user-content seed starts the parser

- Surfaces: workers
- Change: `workers:seed_local_user_content` now starts the same parser stack as the other dev
  parse commands, including the Podcast Index client. Without that, the command could write the
  dummy system notifications but could not fetch or parse feeds.
- Who notices: operators seeding a local database
- Operator steps: run `npm run workers:seed_local_user_content` again after workers rebuild

## Local user-content seed includes inbox notifications

- Surfaces: workers
- Change: `workers:seed_local_user_content` parses a small Podcast Index set when the local
  database is missing podcasts, music, a publisher-music feed, or a video feed, then writes one
  inbox notification of every type for each local login (`local-trial`, `local-premium`, and
  `dummy01`–`dummy06`). Content rows use the parsed show, episode, track, album, livestream, or
  Podcast Index id. Product update, maintenance, terms of service, and general are dummy copy.
  General is marked read. Re-running the command does not duplicate those rows.
- Who notices: operators seeding a local database for manual testing
- Operator steps: from the repo root, `npm run workers:seed_local_user_content` after local
  accounts exist and Podcast Index keys are in the workers env

## Add by RSS empty state waits for login

- Surfaces: web, i18n
- Change: Add by RSS no longer shows an empty-library banner while signed out (podcasts,
  episodes, artists, albums, and tracks). After login, an empty podcast or episode list says
  "No personal RSS feeds added yet."
- Who notices: signed-out visitors on Add by RSS, and signed-in listeners with no personal RSS feeds
- Operator steps: none

## Queues and History use the full content width

- Surfaces: web
- Change: Queues and History no longer reserve an empty column on the right of the list. The
  list, including the signed-out login prompt, spans the content area.
- Who notices: anyone opening Queues or History on a wide window
- Operator steps: none

## Signed-out My Clips stays on the page and asks for login

- Surfaces: web
- Change: My Clips (`/my-profile?tab=clips`) and a direct visit to My Profile no longer send a
  signed-out listener back to the home page. The page stays put, titled My Clips or My Profile,
  and says "Log in to use this feature." with a Login button that opens the login dialog.
- Who notices: signed-out visitors who open My Clips or My Profile
- Operator steps: none

## Membership page content is centered

- Surfaces: web
- Change: The membership page keeps its contact line, purchase actions, feature table, and
  trial limitations in one column, centered in the page, instead of stretching them across the
  content area.
- Who notices: anyone opening Membership on the website
- Operator steps: none

## Playlists filter includes All and remembers the last choice

- Surfaces: web, mobile
- Change: The Playlists medium filter offers All, Podcasts, and Music. All is selected until a
  listener picks Podcasts or Music. The website remembers that choice in the local-settings
  cookie (Playlists and Browse Playlists separately). The phone remembers it with the other
  playlist list filters, and the list loads with that medium next time.
- Who notices: anyone opening Playlists on the website or in the app
- Operator steps: none

## Playlist and Add by RSS actions share the chip row

- Surfaces: web
- Change: Create Playlist sits at the far right of the playlist chips when the row is wide
  enough, and above those chips, aligned to the left, when it is not. It is no longer in the
  page title row. Add Feed and Check for Updates follow the same layout on Add by RSS. The
  space above that first control matches History.
- Who notices: anyone opening Playlists or Add by RSS on the website
- Operator steps: none

## Chip-row actions line up with the chips

- Surfaces: web
- Change: Create Playlist, Add Feed, and Check for Updates sit on the same vertical center as
  the chips beside them. The space under the row stays below the whole row.
- Who notices: anyone opening Playlists or Add by RSS on a wide window
- Operator steps: none

## Add by RSS actions stay one group and match Create Playlist

- Surfaces: web
- Change: Add Feed and Check for Updates stay on one line and move together when that line
  wraps above the chips. They use the same compact outline button as Create Playlist.
- Who notices: anyone opening Add by RSS on the website
- Operator steps: none

## Public Developer page

- Surfaces: web, api
- Change: The website footer links to a public Developer page. The page explains API keys
  (create one in Settings after sign-in, shown once, membership required, what a key cannot do).
  API Reference and OpenAPI Spec are the same described-link cards used in Settings. The body is
  served from `GET /managed-copy/developer`, so the wording can change
  without an app release.
- Who notices: anyone opening Developer from the website footer, signed in or not
- Operator steps: none

## Notification thumbnails sit just above the text

- Surfaces: web, mobile
- Change: Inbox artwork is a little taller than the title line plus the time line, instead of
  the media-list cover size. An empty artwork mark fills that same slot. Inbox rows are
  separated by a straight hairline, with the same space above the line as below it. The in-app banner
  uses the same thumbnail size.
- Who notices: anyone opening Notifications on the website or in the app, and anyone who sees
  an in-app banner
- Operator steps: none

## Channel notifications name the publisher feed

- Surfaces: web, mobile, workers
- Change: A new podcast, new video channel, new album, or Podcast Index preview names the new
  show or album, then an em dash, then the publisher feed title. Inbox titles wrap to two lines,
  and the artwork grows to cover that stack. The in-app banner stays one line. The local seed
  follows Middle Season, writes New album from an album that publisher lists, and writes the
  Podcast Index preview from another album it lists without parsing that album. New content uses
  a different episode than New episode. New podcast and New video channel are left out until
  Podcast Index has a publisher feed of that medium. Re-running the seed replaces the seeded
  notification rows.
- Who notices: anyone opening Notifications, and operators seeding a local database
- Operator steps: from the repo root, after workers rebuild, `npm run workers:seed_local_user_content`

## Notification rows use both side insets

- Surfaces: web
- Change: The notifications list spans the content column. Each row ends at the same inset from
  the right edge as it starts from the left, instead of stopping at the form width and leaving
  the rest of the column empty.
- Who notices: anyone opening Notifications on the website
- Operator steps: none

## Item dates include the publish time

- Surfaces: web, mobile
- Change: Episode, track, clip, chapter, soundbite, and livestream dates on the website and in
  the app now include the local time beside the year (`Oct 26, 2026 - 11:16 PM`). The clock is the
  device timezone, with no zone abbreviation. Podcast, album, and artist dates stay as the day
  only. Membership, session, and playlist dates stay as the day only.
- Who notices: anyone looking at an item that shares its publish day with another item in the
  same feed
- Operator steps: none

## Full player chips sit lower

- Surfaces: mobile
- Change: On the full player, the section chips (Summary, Clips, Chapters, Transcript) and the
  pane under them sit one page gutter (16) lower. A sliver of the pane still shows at the bottom
  edge, in the home-indicator inset, as the color that says the pane can be swiped up. The artwork
  takes the space the chips gave up. The scrolled sheet still fills the screen under the chips.
- Who notices: anyone who opens the full player
- Operator steps: none

## Notifications stay within the settings form width

- Surfaces: web
- Change: The notifications list uses `FormMaxWidth`, the same 640px cap as settings forms
  (`--form-max-width-md`). Rows no longer stretch across the content column. Text ends the same
  distance inside the row hairline as the artwork starts, so a long title does not run into the
  divider.
- Who notices: anyone opening Notifications on a wide window
- Operator steps: none

## Readable transcripts on mobile; web list fills to the footer

- Surfaces: mobile, web
- Change: The full player, episode detail, track detail, and Add by RSS transcript panes parse
  transcript files into speaker rows and show them in a virtualized list instead of dumping the
  raw file into one text block (which left the player sheet looking empty while loading or when
  empty). On the website, the transcript list keeps a 400px floor and grows down to the page
  footer when the episode column has room; a gap separates the search field from the list.
- Who notices: anyone opening a Transcript tab with a linked transcript on mobile or web
- Operator steps: none

## Transcripts have no row hairlines

- Surfaces: mobile
- Change: Transcript cues on the full player, episode detail, track detail, and Add by RSS item
  panes no longer draw a hairline between rows. The vertical padding between cues stays. Web
  transcript rows already had that padding and no line.
- Who notices: anyone reading a transcript on mobile
- Operator steps: none

## Video full screen and picture-in-picture

- Surfaces: mobile
- Change: While a video is playing in the full player, tapping the picture no longer opens the
  artwork viewer. The tap fades in a Full Screen button at the bottom right of the video. That
  button fills the screen, turns the phone sideways, and then lets the phone rotate between
  sideways and upright until you leave. Leaving the app from that full-screen video puts the
  video in the system picture-in-picture window on iPhone and Android. Closing that window keeps
  the audio going. Tapping it to come back returns to full screen.
- Who notices: anyone playing a video episode
- Operator steps: rebuild the iOS and Android dev clients so the native player and orientation
  changes are included

## Full player section chips open the pane

- Surfaces: mobile
- Change: Tapping Summary, Clips, Chapters, Official Clips, Transcript, People, or Funding on
  the full player scrolls the screen so that pane fills the space under the chips. Tapping the
  chip that is already selected does the same. Reduce Motion jumps to the pane. Changing the
  playing item still returns to the player.
- Who notices: anyone using the section chips on the full player
- Operator steps: none

## Switch device stays on the full player

- Surfaces: mobile
- Change: The switch-device control shows only when two or more of the member's devices are
  connected, and only on the full-screen player. The mini player does not show it.
- Who notices: anyone playing on a phone while another signed-in device is connected
- Operator steps: none

## Notification settings sections and first-subscribe push prompt

- Surfaces: mobile, web
- Change: Notification settings are grouped into When I Subscribe, Notification Types, Media
  Notifications, and System Notifications. On the phone, each category has In-App, Push, and
  Banner; Banner for Livestream moves Scheduled and Started together. Push shows on only when the
  account preference and this device can deliver. The first signed-in Subscribe on a podcast,
  album, or artist asks Enable Push or In-App Only before the follow; either answer turns on
  in-app alerts for that channel, and later Subscribes on that device for that account do not ask
  again.
- Who notices: anyone opening notification settings or subscribing while signed in
- Operator steps: none

## Category notification switch reveals Push and Banner

- Surfaces: mobile, web
- Change: Each media and system notification category is one base switch. Turning it on means
  inbox delivery for that category. Push (web and mobile) and Banner (mobile only) appear only
  while the category is on. Push shows a permission asterisk only when this device cannot deliver
  yet. Product Updates defaults off for new accounts; Maintenance, Terms of Service, and General
  stay locked on. Banner prefs stay on the phone.
- Who notices: anyone opening notification settings
- Operator steps: none

## Transcript follow, highlight, and filter

- Surfaces: web, mobile, helpers, ui
- Change: The cue that contains the playhead is orange on web and mobile whether Autoscroll is
  on or off. Autoscroll (default on for the visit) scrolls that cue into view only when it is
  off screen. A filter and the Autoscroll On/Off control sit on one pinned row at the top of the
  transcript pane on episode, track/lyrics, Add by RSS, and the full player. Catalog web pages
  move the toggle out of the section-chip header into that row; Add by RSS web gets the same
  controls.
- Who notices: anyone opening a transcript or lyrics tab while something is playing
- Operator steps: none

## First-subscribe push prompt loads

- Surfaces: mobile
- Change: The first-subscribe push dialog hook is a `.tsx` module, so Metro can parse its
  JSX. Podcast, album, artist, and the full player no longer stop on launch with
  `Unexpected token` in `useFirstSubscribePushPrompt`.
- Who notices: anyone opening the app after that prompt was added
- Operator steps: reload the dev client

## Signed-out notification settings stay off

- Surfaces: mobile
- Change: More → Settings → Notifications shows every category switch off until the
  person is logged in. Push and Banner stay hidden until a category is on. Tapping a
  switch still asks them to log in. The login dialog's button reads OK (`misc.ok`).
  Logged-in accounts keep their saved switches. Delivery still requires a membership
  that has not expired.
- Who notices: anyone opening notification settings while signed out
- Operator steps: none

## In-app banner reads the account notification

- Surfaces: mobile
- Change: The banner's relative time, artwork, and title come from the account notification on
  the queue item. The queue wrapper only carries the id and a short copy pair.
- Who notices: anyone who sees an in-app notification banner
- Operator steps: none

## For Me replaces the Search tab

- Surfaces: mobile
- Change: The bottom bar is Home, Browse, For Me, My Library, and More. For Me opens
  Recommendations (the screen title stays Recommendations). Search is no longer a tab and is
  not in Tab Bar settings. A magnifying glass in the top left of Home opens Search. A saved tab
  order that still has Search shows Recommendations in that slot. An older default order that
  included Search is replaced with the new default.
- Who notices: anyone using the bottom bar or opening Search
- Operator steps: none

## Search and notifications rise from the bottom

- Surfaces: mobile
- Change: The Home search icon and the Home notifications bell each raise a screen from the
  bottom. A down caret in the upper left dismisses it.
- Who notices: anyone opening Search or notifications from Home
- Operator steps: none
  I want to leave you running with a job unattended, and I am hoping you can give your best effort to get it done safely and correctly. But if at any point you think you are in real danger of doing something wrong, you should stop immediately. And when I say do something wrong, I mean do something wrong. You're seriously a problem anyway. I want you to take whatever steps are needed to sync develop to staging so we have a new version, and I also want you to update kpodcastdj.com so Alpha wants. The new version is verifiably published as an image. Then I want you to update and push to the KPodcastDJ repo and also run any Kubernetes related commands you need to to verify that the deployment happened to alpha and was successful. If you have any questions before proceeding, ask me. Otherwise, tell me if you are ready to go.
