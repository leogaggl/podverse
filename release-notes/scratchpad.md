## Mobile Add by RSS feed settings behind the gear

- Surfaces: mobile
- Change: The feed username and password moved off the Add by RSS channel header into Settings
  (the gear beside the title). Settings always shows both fields, filled from the copy stored on
  the device, with Save and Check. It also shows when the feed was last parsed and a Check Feed
  for Updates button. Pull-to-refresh on the episode list checks the feed too, for members who can
  refresh Add by RSS feeds. Podcast, album, and artist settings look the same as before.
- Who notices: members with password-protected feeds; anyone refreshing a feed added by RSS
- Operator steps: none

## Mobile Add by RSS episodes play their download and respect Offline Mode

- Surfaces: mobile
- Change: Playing an Add by RSS episode from its feed page or the Add by RSS library now uses the
  downloaded file when one is finished, instead of streaming again. With Offline Mode on, Add by
  RSS episodes, including ones in the queue or a playlist, no longer stream; without a download
  they show the same "no media" notice other episodes show.
- Who notices: people who download Add by RSS episodes or use Offline Mode
- Operator steps: none

## Mobile Add by RSS episodes get their own page

- Surfaces: mobile
- Change: Add by RSS episodes now open a page with the same header as a podcast episode page:
  artwork with a download button, the feed title (tap to open the feed), the episode title and
  date, and play, duration, and More. Below it are Summary and, when the feed lists them, People.
  More offers Queue Next, Queue Last, Add to Playlist, Mark as Played, and Download. There is no
  Share, Clips, or Funding on this page.
- Who notices: anyone who adds podcasts by RSS on the phone
- Operator steps: none

## Mobile Add by RSS music feeds are listed as music

- Surfaces: mobile
- Change: A feed added by RSS on the phone now takes its type from the feed's medium after each
  parse, as on web. Music albums and artists move from the Podcasts chips to Albums and Artists
  on Home and in the Add by RSS library, their songs list on the Tracks chips, and the feed page
  shows them as tracks. Feeds already stored on the phone take that type the first time this
  build opens its database, from the medium in the stored bundle, with no network request.
  That includes a phone that is offline and a membership that cannot refresh feeds.
- Who notices: anyone who adds music feeds by RSS on the phone
- Operator steps: none

## Mobile Add by RSS tracks get their own page

- Surfaces: mobile
- Change: Add by RSS music tracks now have a page laid out like a track page: the album header
  (tap the title to open the feed), then the track's artwork with a download button, the album
  name, title, date, and play, duration, and More. Below are Summary and, when the feed lists
  them, People. More offers Queue Next, Queue Last, Add to Playlist, Mark as Played, and
  Download. There is no Share or Funding.
- Who notices: anyone who adds music feeds by RSS on the phone
- Operator steps: none

## Mobile Add by RSS rows open the episode, show duration, and have More

- Surfaces: mobile
- Change: On an Add by RSS feed page and the Add by RSS library's Episodes chip, tapping an
  episode row opens its episode page instead of playing; the play button still plays. Rows on the
  feed page now show the episode duration beside play. Every Add by RSS episode and music track
  row has a More menu with Queue Next, Queue Last, Add to Playlist, Mark as Played, and Download.
  Tracks go to music playlists and music history. A track row tap still plays, and its More menu
  also has Go to Track, which opens the track's page. Rows also get the one-tap download button
  podcast episode rows have.
- Who notices: anyone who adds feeds by RSS on the phone
- Operator steps: none

## Mobile Add by RSS episodes get Chapters and Transcript

- Surfaces: mobile
- Change: The Add by RSS episode page shows Chapters and Transcript chips when the feed item links
  a chapters file or a transcript. Choosing either loads both through the account API, using the
  feed's saved username and password only for files on the feed's own domain. Chapters list with
  artwork and time ranges, and the transcript shows as text, as on a podcast episode page. Both
  need a signed-in account, and Offline Mode shows its unavailable message until they load.
- Who notices: anyone who adds podcasts by RSS on the phone
- Operator steps: none

## Web Subscribed Episodes and Tracks include Add by RSS items

- Surfaces: web
- Change: On Subscribed (`/`), the Episodes and Tracks chips also show the 60 newest items from
  this browser's Add by RSS feeds. Under "Recent" they mix into the first page by date; under
  "Top" they follow the ranked items on the last page. Clips stays server only.
- Who notices: signed-in web users who follow Add by RSS feeds
- Operator steps: none

## Web Add by RSS library is one page with chips

- Surfaces: web
- Change: The Add by RSS lists are one page, `/add-by-rss`, with Podcasts, Episodes, Artists,
  Albums, and Tracks chips. The chip is in the URL (`?tab=`) and the last chip is remembered in
  this browser. An Add Feed button in the page header opens the add page. The old list URLs
  (`/add-by-rss/podcasts`, `/add-by-rss/episodes`, `/add-by-rss/artists`, `/add-by-rss/albums`,
  `/add-by-rss/tracks`, and the two livestream list pages) now return not found; feed and item
  pages keep their URLs.
- Who notices: web users of Add by RSS; old bookmarks to the list pages stop working
- Operator steps: none

## Web sidebar: Subscribed, Browse, and Library

- Surfaces: web, web sidecar, k8s base env
- Change: The web sidebar shows Subscribed (the home page) and Browse in place of the Podcasts,
  Music, and Add by RSS sections. Library lists Queues, History, Playlists, My Clips, and one
  Add by RSS link to the Add by RSS page. The Profiles link is removed; public profiles are on
  Browse, under Users. The `/profiles` page keeps its URL. The list pages `/podcasts`,
  `/episodes`, `/clips`, `/artists`, `/albums`, `/tracks`, `/podcasts/livestreams`, and
  `/music/livestreams` now return not found and are out of the sitemap; podcast, episode, clip,
  artist, album, track, and livestream pages keep their URLs. Category links on podcast pages
  open Browse. The `NEXT_PUBLIC_SIDEBAR_GROUP_ORDER` setting is removed.
- Who notices: every web visitor; bookmarks to the old list pages stop working
- Operator steps: remove `NEXT_PUBLIC_SIDEBAR_GROUP_ORDER` from web sidecar env in GitOps
  overlays and local `apps/web/sidecar/.env` files (a leftover value is ignored)

## Mobile Add by RSS library rows swipe to unsubscribe

- Surfaces: mobile
- Change: In My Library → Add by RSS, swiping a podcast, artist, or album row left reveals
  Unsubscribe, as on Home. It removes the feed from the device and unfollows it on the account
  when signed in; Home drops it too. The library also rereads its list when it comes back into
  view, so a follow removed elsewhere is gone.
- Who notices: anyone who follows feeds by RSS URL
- Operator steps: none

## Mobile grid tiles: hold to unsubscribe or delete

- Surfaces: mobile
- Change: In grid view, holding a tile opens a bottom sheet with the action that a list row's
  swipe reveals, plus Cancel: Unsubscribe on Home's Podcasts, Artists, and Albums and on the Add
  by RSS library, and Delete All on Home's "Downloaded only" tiles. Screen readers get the same
  action from the tile. Browse tiles are unchanged.
- Who notices: anyone who uses grid view
- Operator steps: none

## Mobile Home episode and track rows can be marked played, downloaded, and shared

- Surfaces: mobile
- Change: Every row on Home's Episodes and Tracks chips, directory and Add by RSS, offers Mark
  as Played and the same download control podcast episode rows use (the button on the row and
  the More entry). Directory rows also offer Share. Add by RSS rows do not. Podcast, artist, and
  album rows keep their downloaded count and gain no download button. Clips is unchanged. Offline
  Mode still lists downloads only.
- Who notices: anyone using Home Episodes or Tracks
- Operator steps: none

## Web shows Add by RSS refreshes in a corner overlay

- Surfaces: web
- Change: while this browser refreshes Add by RSS feeds (follow sync, first parses, refresh-all, and
  single-feed parses), a small round control with a spinner appears fixed in the bottom-right
  corner, above the space the media player uses, whether or not the player is open. Clicking it
  expands it to the left to read "Updating Your RSS Feeds" with a count such as "2 of 5"; clicking
  again collapses it. The browser remembers expanded or collapsed in the local-settings cookie
  (`bae`); collapsed is the default. It never appears for signed-out visitors or for accounts that
  follow no Add by RSS feeds, and it disappears when the work finishes. Failures stay out of the
  overlay. Screen readers hear the message when it changes.
- Who notices: signed-in web users who follow feeds by RSS URL
- Operator steps: none

## Web Add by RSS follow sync no longer fails when two syncs overlap

- Surfaces: web
- Change: When the background refresh and an Add by RSS page synced follows at the same moment
  (common on the first visit in a browser, or with two tabs open), one of them could fail on the
  browser's feed store and drop the feeds it was adding. The list then stayed empty until a
  reload. Each feed is now added only if no stored feed has its URL, so overlapping syncs both
  finish and every followed feed appears.
- Who notices: web users who follow feeds by RSS from another device or use several tabs
- Operator steps: none

## Player item title opens the channel first

- Surfaces: mobile
- Change: Tapping the item title on the full player opens that item's channel and then the
  item, so Back returns to the channel. The channel title still opens only the channel, on
  Home when this device follows the show and on Browse when it does not.
- Who notices: anyone who taps the item title in the full player
- Operator steps: none

## Add by RSS episode titles in the player open the feed first

- Surfaces: mobile
- Change: Tapping an Add by RSS episode's title on the full player opens that feed and then
  the episode, so Back returns to the feed. The channel title is unchanged.
- Who notices: anyone playing an Add by RSS episode on the phone
- Operator steps: none

## Mobile Add by RSS tracks show Lyrics and open from the player

- Surfaces: mobile
- Change: The Add by RSS track page shows a Lyrics chip when the feed item links a transcript.
  It loads through the account API, needs a signed-in account, and shows the Offline Mode message
  until it loads. On the full player, tapping an Add by RSS track's title now opens the feed and
  then the track page, so Back returns to the feed.
- Who notices: anyone who plays music added by RSS on the phone
- Operator steps: none

## Mobile Add by RSS rows show when they are playing

- Surfaces: mobile
- Change: The Add by RSS episode that is playing now shows the pause button and the progress
  bar on its row: on the feed page, the Add by RSS library's Episodes chip, Home, and the Add by
  RSS episode page. Pressing play on that row pauses it, and pressing again resumes, instead of
  loading the episode again. Playback now reports Add by RSS items by their item hash instead of the
  feed's id, so playback history written from the device matches the item on the server.
- Who notices: anyone who plays feeds added by RSS on the phone
- Operator steps: none

## Mobile full player marks Add by RSS episodes played

- Surfaces: mobile
- Change: Mark as Played and Mark as Unplayed in the full player's More menu now work for
  episodes and tracks added by RSS. They write to the account's podcast or music history as the
  item's medium decides. Before, the menu item did nothing for those items. The More menu no
  longer shows Mark as Played for items that cannot be marked, such as livestreams.
- Who notices: signed-in listeners playing feeds added by RSS on the phone
- Operator steps: none

## Mobile Add by RSS episodes show their chapters while playing

- Surfaces: mobile
- Change: When an Add by RSS episode or track links a chapters file, the player loads its
  chapters through the account API as it plays, the same way it does for other episodes. The
  current chapter names the full player's segment band and the mini player's bar, chapter images
  replace the artwork, the scrubber marks chapters, and the chapter skip buttons step through
  them. It needs a signed-in account, it does not load in Offline Mode, and signing out clears
  it. Only feeds this device has parsed are covered. Chapter images on feeds that need a username
  and password load without them and fall back to the episode artwork.
- Who notices: anyone who plays podcasts added by RSS on the phone
- Operator steps: none

## Mobile full player shows Add by RSS Summary, Chapters, and Transcript

- Surfaces: mobile
- Change: Playing an Add by RSS episode or track, the full player now has the same section chips
  as other episodes: Summary always, Chapters and Transcript when the feed item links them, and
  People when it lists people. Chapter rows seek when tapped, and a time in the Summary seeks
  too. Chapters and Transcript load through the account API, need a signed-in account (a login
  prompt shows otherwise), show Retry after a failure, and show the Offline Mode message until
  they have loaded. Livestreams still show no sections.
- Who notices: anyone who plays podcasts or music added by RSS on the phone
- Operator steps: none

## Channels remember that they may have livestreams

- Surfaces: database (app linear migration 0021), parser/workers, api, k8s base env
- Change: `channel.may_have_live_items` is set the first time a parse sees a `podcast:liveItem`
  and never cleared, so it survives the live item being archived. The migration backfills it
  from existing live items. Channel API responses include the field. The flag sits beside the
  channel's medium and never changes it: a podcast with livestreams is still a podcast.
- Who notices: nobody yet; later list filters read it
- Operator steps: the migration applies on deploy; the API readiness marker is now
  `0021_channel_may_have_live_items.sql`

## Upcoming livestreams endpoints

- Surfaces: api, helpers-requests
- Change: `GET /live-item/global/upcoming` (public) and `GET /live-item/subscribed/upcoming`
  (signed in) list live items on the air now, then scheduled ones by start time. Ended live
  items are never listed. Query: `medium` and `page`.
- Who notices: API clients; the web and mobile Livestreams chips use them
- Operator steps: none

## Add by RSS feeds remember that they may have livestreams

- Surfaces: web, mobile
- Change: each Add by RSS feed stored on the device records, from its parses, that it has
  carried a live item, and keeps that after the item leaves the feed. The flag sits beside the
  feed's podcast or music type and never changes it. Mobile SQLite migration 24 adds
  `add_by_rss_feed.may_have_livestreams` and seeds it from stored feeds.
- Who notices: nobody directly; the Livestreams chips use it to pick feeds
- Operator steps: none

## Add by RSS feeds have no livestreams type

- Surfaces: web, mobile, shared packages (helpers, parser-mapping)
- Change: an Add by RSS feed's type is its medium only (podcast, artist, or album). Whether it
  carries livestreams is a separate flag, so a feed with livestreams stays on its Podcasts or
  Artists and Albums chips, and its live items show on the Livestreams chips. A stored
  `livestreams` type now reads as podcasts. The web feed-level livestream list rows and header,
  which linked a feed id to the livestream item page, are removed, and
  `/add-by-rss/livestreams/<id>` returns not found.
- Who notices: nobody in normal use; no feed was stored with that type
- Operator steps: none

## Livestreams chip on web Subscribed and Browse

- Surfaces: web
- Change: Subscribed (`/?tab=livestreams`) and Browse (`/browse?tab=livestreams`) have a
  Livestreams chip after Tracks. It lists livestreams on the air now first, marked Live, then
  scheduled ones marked Scheduled, by start time; ended livestreams are not listed. Each row
  opens the livestream page. Podcast and music livestreams share the chip.
- Who notices: web listeners who follow channels that broadcast live
- Operator steps: none

## Add by RSS livestreams on web

- Surfaces: web
- Change: the Add by RSS page has a Livestreams chip after Tracks, listing the livestreams of
  followed Add by RSS feeds: live now first, marked Live, then scheduled. The Subscribed
  Livestreams chip lists those Add by RSS livestreams too, merged by the same order on its first
  page. Each row opens the Add by RSS livestream page. A feed with livestreams stays on its
  Podcasts or Artists and Albums chip; livestreams are a flag on the feed, not a feed type.
- Who notices: web listeners who add feeds by RSS that broadcast live
- Operator steps: none

## Livestreams chip on mobile Browse

- Surfaces: mobile
- Change: Browse has a Livestreams chip after Tracks. It lists livestreams on the air now,
  marked Live, then scheduled ones, labeled Scheduled, by start time; ended livestreams are not
  listed. Tapping a row opens the livestream; play starts a live one. No range or category
  chips. A row's More menu offers Share only: no Queue, playlist, or played actions.
- Who notices: mobile listeners browsing for live shows
- Operator steps: none

## Mobile Add by RSS livestreams get their own page

- Surfaces: mobile
- Change: an Add by RSS livestream, live or scheduled, opens a page with its artwork, title, feed,
  status and start time, Summary, and People. A live one has a play button; a scheduled or ended
  one does not. The page offers no Queue, playlist, played, download, or Share actions.
- Who notices: listeners who add a feed by RSS that announces livestreams
- Operator steps: none

## Livestreams chip on mobile Home and the Add by RSS library

- Surfaces: mobile
- Change: Home and the Add by RSS library have a Livestreams chip after Tracks. Home lists the
  livestreams of followed channels (refreshed by a background sync job) and of Add by RSS feeds;
  the library lists Add by RSS livestreams. A feed with livestreams stays on its medium's chips.
  Live now comes first and is marked Live, then scheduled ones labeled Scheduled; ended
  livestreams are not listed. Rows have no Queue, playlist, or played actions; followed
  channels' rows offer Share. An Add by RSS livestream, live or scheduled, opens its own page,
  and a live one plays from the row. In Offline Mode, Home's Livestreams chip shows the
  unavailable message.
- Who notices: mobile listeners who follow channels or Add by RSS feeds that broadcast live
- Operator steps: none

## Add by RSS feed page lists livestreams on mobile

- Surfaces: mobile, api
- Change: the mobile Add by RSS feed page lists the feed's livestreams above its Episodes or
  Tracks: live first (with the Live badge and play), then scheduled, then any that ended within
  the last day. The title filter applies to them; the sort chip orders episodes only. Tapping a
  livestream opens the Add by RSS livestream page; there is no More menu. The podcast page's
  live-item endpoint now sorts through the same shared helper, with no change to its order.
- Who notices: mobile users with Add by RSS feeds that publish podcast:liveItem entries
- Operator steps: none

## Add by RSS feed pages use the channel livestream order

- Surfaces: web
- Change: the Add by RSS podcast, album, and artist pages list livestreams the way a channel's
  live-item list does. Live comes first, then scheduled, then any that ended within the last
  day (latest end first). Older ended livestreams are hidden. The sort control still orders
  episodes, tracks, or albums only.
- Who notices: web listeners whose Add by RSS feeds include livestreams, especially ones that
  have ended
- Operator steps: none

## Mobile channel pages say Scheduled or Ended on livestream rows

- Surfaces: mobile
- Change: inside a podcast page, an album page, and an Add by RSS feed page, a scheduled
  livestream row shows a "Scheduled" badge and a recently ended one an "Ended" badge at the start
  of its date line, where the Live badge sits for a stream on the air. The album page no longer
  marks scheduled and ended livestreams as Live. Screen readers hear the status with the row.
- Who notices: mobile listeners on channels that publish podcast:liveItem entries
- Operator steps: none

## Add by RSS livestream titles in the player open the livestream page

- Surfaces: mobile
- Change: Tapping an Add by RSS livestream's title on the full player opens that feed and then
  the livestream page, so Back returns to the feed. It links when this device has the feed and
  still lists the livestream. Directory livestream titles already open the livestream's page,
  under its channel page.
- Who notices: anyone who plays a livestream from a feed added by RSS on the phone
- Operator steps: none

## Mobile item rows use a larger date and a title-line new-content dot

- Surfaces: mobile
- Change: Episode, clip, and track list rows, including Add by RSS, use the channel-row date
  (14pt, bold, link color), a 2pt gap between title and date, and a 14pt regular description.
  On a podcast or Add by RSS channel, episodes published after the previous open show the
  new-content dot at the top right of the title. Channel rows keep the dot in the side rail.
- Who notices: people scrolling episode lists on the phone
- Operator steps: none

## Mobile Add by RSS channel detail matches podcast detail

- Surfaces: mobile
- Change: The Add by RSS channel page uses the podcast page's header (artwork beside the title,
  Unsubscribe under it, settings gear), section chips, and list. Sorting moved from a row of pills
  into a Sort chip beside the section chips, with Recent and Oldest for podcasts and Forward and
  Backward for music feeds. A title filter sits above the episodes. Boost appears in the title bar
  when the feed carries value tags. The feed URL and item count left the header.
- Who notices: anyone who opens a feed they added by RSS on the phone
- Operator steps: none

## Mobile Add by RSS detail gains Downloaded, About, Funding, and People chips

- Surfaces: mobile
- Change: The Add by RSS channel page shows the same section chips as a podcast page where the
  feed supports them. Podcast feeds get Episodes, Downloaded, About, and, when the feed lists
  them, Funding and People. Music feeds get Tracks, About, Funding, and People. About shows the
  feed's description with its RSS and website links. With Offline Mode on, a podcast feed opens
  on Downloaded. Clips, Podroll, and Boosts are not offered, because they need the feed to be in
  the Podverse catalog.
- Who notices: anyone who opens a feed they added by RSS on the phone
- Operator steps: none

## Web Browse page with chips

- Surfaces: web
- Change: A new Browse page (`/browse`) lists server content behind chips, in the mobile app's
  order: Podcasts, Episodes, Clips, Artists, Albums, Tracks, Playlists, Users. Podcasts,
  Episodes, and Clips can be narrowed to a category. Playlists shows public playlists; Users shows
  public profiles. The chip is in the URL (`?tab=`) and the last chip is remembered in this
  browser. `/browse` replaces `/podcasts`, `/episodes`, `/clips`, `/artists`, `/albums`, and
  `/tracks` in the sitemap and has its own page title and description.
- Who notices: every web visitor
- Operator steps: none

## Web Home becomes Subscribed, with chips

- Surfaces: web
- Change: The home page (`/`) is now Subscribed. Chips, in the mobile app's order (Podcasts,
  Episodes, Clips, Artists, Albums, Tracks), replace the All/Podcasts/Music dropdown; there is no
  Music chip. Each chip lists what the account follows, with that list's own sort, range, and
  list/grid choice remembered in this browser. The chip is in the URL (`?tab=`) and the last chip
  is remembered. Signed-out visitors see the same getting-started message as before, now linking
  to Browse.
- Who notices: every signed-in web user
- Operator steps: none

## Web Subscribed lists include this browser's Add by RSS feeds

- Surfaces: web
- Change: On Subscribed (`/`), the Podcasts, Artists, and Albums chips list the account's
  followed podcasts, artists, and albums together with the Add by RSS feeds of that kind that
  this browser can read, in the chosen sort. An Add by RSS row opens its Add by RSS page. Feeds
  waiting for a username and password stay on the Add by RSS page. The Podcasts filter also
  finds Add by RSS feeds. Under "Top", Add by RSS feeds follow the ranked podcasts.
- Who notices: signed-in web users who follow Add by RSS feeds
- Operator steps: none

## Mobile Home lists Add by RSS podcasts, artists, and albums

- Surfaces: mobile
- Change: Home's Podcasts, Artists, and Albums chips list Add by RSS follows beside directory
  follows, sorted together. Feeds still waiting on a username and password stay in My Library →
  Add by RSS only. Tapping an Add by RSS row opens its channel page on the Home tab, and swiping
  it left unsubscribes, as for a directory follow. Grid view shows the same follows as tiles.
- Who notices: anyone who follows a feed by RSS URL; those shows now appear on Home
- Operator steps: none

## Mobile Home Episodes and Tracks include Add by RSS items

- Surfaces: mobile
- Change: Home's Episodes and Tracks chips list items from Add by RSS feeds beside directory
  items, sorted together (the newest 60 Add by RSS items join the stored directory list). An Add
  by RSS episode opens its episode page on the Home tab; a track plays, and its More menu has Go
  to Track, which opens the track's page. Play, Queue Next, Queue Last, and Add to Playlist work
  on those rows. Offline Mode still lists downloads only.
- Who notices: anyone with Add by RSS follows
- Operator steps: none

## Album livestreams in the player open the album

- Surfaces: mobile
- Change: While a livestream from an album is playing, the full player's channel line shows
  that album's title and opens the album page, on Home when this device follows the album and
  on Browse when it does not.
- Who notices: anyone who plays a livestream from an album on the phone
- Operator steps: none

## Episode page no longer crashes when About is missing

- Surfaces: mobile
- Change: Opening an episode whose About record is missing no longer hits a render error
  (`Cannot read property 'duration' of null`). Duration falls back to the stored playback
  position, or to no duration when that is missing too.
- Who notices: anyone who opens an episode or livestream item that has no About row
- Operator steps: none

## Full player title keeps the other tabs where you left them

- Surfaces: mobile
- Change: The full player's item title, channel title, and queue button return to the tab
  shell already on screen. My Library stays on Add by RSS (or whichever screen was open)
  instead of dropping back to the library menu. Home still opens the playing item.
- Who notices: anyone who opens the playing episode, track, or livestream from the full
  player while another tab is in the middle of a screen
- Operator steps: none

## Make Clip back returns to the full player

- Surfaces: mobile
- Change: Header back on Make Clip returns to the full player, including the second time Make
  Clip is opened during the same playback. On iOS, Make Clip no longer swipes closed; the back
  control closes it. The full player still swipes closed.
- Who notices: anyone who opens Make Clip from the full player and taps back without saving
- Operator steps: none

## Closed swipe actions stay out of the screen reader

- Surfaces: mobile
- Change: A list row's swipe action (Unsubscribe, Delete all) is exposed to VoiceOver and
  TalkBack only while the row is open. Closing the row covers that button. The row's own
  remove action remains the screen-reader path.
- Who notices: screen-reader users on lists that swipe to reveal an action
- Operator steps: none

## Mobile inbox shows new notifications live

- Surfaces: mobile
- Change: while the Notifications inbox is open, a new notification appears at the top of the
  list as it arrives and is marked read at once, so the badge does not light while the inbox is
  on screen. After a reconnect that may have missed rows, the inbox reloads its first page. The
  cached inbox used in Offline Mode is cleared at sign-out.
- Who notices: signed-in mobile users with the inbox open
- Operator steps: none

## Management API publishes account events to Redis

- Surfaces: management-api, k8s base env, ops
- Change: the management API opens one Redis (Valkey) connection and publishes an account event
  on `podverse:account-events` whenever it writes notifications (admin campaign sends), so open
  account event streams show them within about a second. New required env vars `KEYVALDB_HOST`,
  `KEYVALDB_PORT`, and `KEYVALDB_PASSWORD`, the same values the API uses. Redis being down does
  not stop the management API or fail a send; the event is dropped and logged.
- Who notices: operators (new env vars and a new secret mount); users see campaign notifications
  arrive live once web and mobile use the stream
- Operator steps: the base k8s configMap and deployment now set the host and port and mount
  `podverse-keyvaldb-opaque`. A deployment outside these manifests must set the three `KEYVALDB_*`
  vars on the management API, or it fails startup validation.

## Workers publish account events to Redis

- Surfaces: workers, k8s base workers and cron manifests, ops
- Change: parser workers (`mqRSSRunParser`, `parserRSSParseFeed`, the dev parse commands,
  `seedEmbedDemoShowcaseFeeds`) and the scheduled-job runner (`scheduledJobsRunDue`) now open one
  Redis (Valkey) connection and publish an account event on `podverse:account-events` after they
  write notifications, so open account event streams show parser and campaign notifications
  within about a second. These commands now validate `KEYVALDB_HOST`, `KEYVALDB_PORT`,
  `KEYVALDB_PASSWORD`, and `KEYVALDB_CACHE_EXPIRATION`. They still start and run when Redis is
  down; events are dropped and logged.
- Who notices: operators (new secret mount, one more Redis connection per parser pod and per
  scheduled-job run)
- Operator steps: the base manifests now mount `podverse-keyvaldb-opaque` on the three parser
  deployments, the scheduled-jobs cronjob, and the showcase seed cronjob. Anyone running these
  commands outside those manifests must set the `KEYVALDB_*` vars, or startup validation fails.

## Live account event stream

- Surfaces: api, workers, management-api, ops
- Change: new `GET /account/events` (SSE, cookie or bearer auth), the account's one event stream.
  Event names are namespaced: `notification.*` now; `playback.*` reserved for cross-device
  playback state and control commands, which never carry an SSE id and never replay. Clients
  ignore names they do not know. It sends a state snapshot with the unread count, then each new notification
  (`notification.created`, with the notification id as the SSE event id) and each read-state
  change (`notification.read`) for the account within about a second. Only events with an SSE id
  replay: reconnecting with `Last-Event-ID` replays up to 50 missed notifications; beyond that it
  sends `notification.resync`. A 25-second heartbeat keeps proxies open. Streams end at the auth
  token's expiry or after 30 minutes, and clients reconnect. At most 10 streams per account per
  API pod; more get 429. The API, management API, and parser and scheduled-job workers publish
  account events on the Redis (Valkey) channel `podverse:account-events` after they write
  notifications or read state, and each API pod holds one subscriber connection to it. A failed
  publish never fails the write; clients catch up on their next connection.
- Who notices: no one until web and mobile use the stream. Operators see more Redis connections:
  two per API pod, one per management API pod, and one per notification-writing worker.
- Operator steps: a proxy in front of the API must not buffer `text/event-stream` and must allow
  idle connections longer than 25 seconds. The bundled Traefik ingress needs no change. The
  management API and worker env and secret changes are in their own entries.

## Web bell badge updates live

- Surfaces: web
- Change: the NavBar notification bell's unread badge now updates within about a second of a new
  notification, and clears in every open tab and on every device when a notification is read
  anywhere, using the account event stream (`GET /account/events`). All tabs
  of one account in a browser share a single stream: one tab holds it (Web Locks) and relays to
  the others (`BroadcastChannel`); browsers without those APIs open one stream per tab. The
  60-second unread-count poll now runs only while the stream is down, and the count is refetched
  once when a tab becomes visible again. When the stream fails with an HTTP error it is retried
  after 30 seconds, backing off to 5 minutes.
- Who notices: logged-in web users; the bell no longer lags behind new notifications.
- Operator steps: none beyond deploying the API stream. A proxy in front of the API must not
  buffer `text/event-stream`.

## Per-notification read state (schema)

- Surfaces: api, ops
- Change: new app migration `0022_account_notification_read_at.sql` adds a nullable `read_at` to
  `account_notification`. A notification is now unread only when it was created after the
  account's Mark All as Read cutoff and its own `read_at` is null. The unread count, the inbox's
  `is_unread` flags, and the stream's counts all follow that rule. The inbox's `total_count` now
  comes from a plain row count. Nothing sets `read_at` yet, so counts and flags are unchanged
  until the mark-one endpoints ship.
- Who notices: no one yet.
- Operator steps: run app linear migrations before rolling the API. The API readiness marker
  `API_EXPECTED_MIGRATION_FILENAME` moves to `0022_account_notification_read_at.sql`; a GitOps
  overlay that pins it must move with it.

## Mobile live notification badge

- Surfaces: mobile
- Change: while the app is signed in and either in the foreground or playing audio, it holds the
  API's account event stream (`GET /account/events`) open with the bearer token. In the
  background it closes the stream once audio is not playing. The Notifications tab badge updates
  within about a second of a new notification or a read on any device, instead of on a 60-second
  poll. The poll runs only while the stream is down; after a failed connect the app refetches the
  unread count once, then every 60 seconds. A return to the foreground keeps a stream that stayed
  open through the background and is still sending its heartbeat. A stream that closed, or that
  went silent for a minute or more, is replaced by a fresh one. Pushes that arrive in the
  foreground stay unshown, as before. While audio plays in the background, the stream holds one
  more open connection to the API than before.
- Who notices: signed-in mobile users with the app open or playing in the background
- Operator steps: the API must serve the notification stream (see the live notification stream
  entry). No mobile env vars.

## Mark one notification read

- Surfaces: api, web, mobile (request helpers in `@podverse/helpers-requests`)
- Change: new `POST /account/notifications/:notification_id/mark-read` and
  `POST /account/notifications/mark-read-by-item` (body `item_id_text`, `type`, as sent in push
  data). Each sets `read_at` on that notification only, returns `{ marked_ids, unread_count }`, and
  sends `notification.read` with `scope: 'one'` to every open notification stream for the account.
  An already-read notification returns 200 with empty `marked_ids` and sends nothing. Another
  account's id returns 404. Mark All as Read is unchanged. New request helpers
  `reqNotificationsMarkReadOne` and `reqNotificationsMarkReadByItem`.
- Who notices: no one until web and mobile call them from push taps, banner taps, and inbox rows.
- Operator steps: none beyond the read-state migration.

## Mobile unread notification count on More

- Surfaces: mobile
- Change: when Notifications is not one of the visible tabs (the default layout), the More tab
  and the More screen's Notifications row show the unread notification count, updating live.
  When Notifications is a visible tab, its own tab badge shows the count as before.
- Who notices: signed-in mobile users on the default tab layout, who previously saw no unread
  indicator
- Operator steps: none

## Mobile banner notification settings

- Surfaces: mobile
- Change: Notification settings gain a Banner Notifications group, stored on this device only,
  with one switch per kind. New Item and Livestream Started start on. Livestream Scheduled,
  Product Updates, Maintenance, Terms of Service, and General start off.
- Who notices: mobile users who open Settings, then Notifications
- Operator steps: none

## Web Notifications inbox updates live

- Surfaces: web
- Change: on the Notifications page, a new notification appears at the top under Unread as soon
  as it is created, without a reload. While the page is visible, that notification is marked read
  on its own (`POST /account/notifications/:id/mark-read`), so the bell clears on every device; in
  a background tab it is marked when the tab becomes visible. The page now loads the list before
  marking everything read, so notifications that were unread when the page opened show under
  Unread for that visit instead of always appearing under Earlier.
- Who notices: logged-in web users with the inbox open.
- Operator steps: none.

## Web push click marks that notification read

- Surfaces: web
- Change: clicking a web push popup marks only that notification read
  (`POST /account/notifications/mark-read-by-item` with the push's item id and type), so the bell
  clears for it on every device without visiting the Notifications page. This works for popups
  shown by the service worker and by a focused tab. A focused tab on the Notifications page no
  longer shows a popup, because the new row appears there live. Repeated pushes for the same item
  and type replace each other instead of stacking. The service worker is now registered as
  `/webpush-sw.js?api_base=<API base URL>`; existing registrations are updated on the next visit
  with notifications allowed, and keep their subscription. The worker's push handler now extends
  the event lifetime correctly. On Chrome for Android, a focused tab now shows the popup through
  the service worker instead of failing silently.
- Who notices: web users with push enabled.
- Operator steps: none. The API's CORS must keep allowing credentialed requests from the web
  origin, which it already does.

## Mobile push tap marks that notification read

- Surfaces: mobile
- Change: tapping an OS push notification marks only that notification read (through
  `POST /account/notifications/mark-read-by-item` with the push's item and type), and the
  Notifications badge drops by one at once. Opening the inbox still marks every notification read.
- Who notices: signed-in mobile users who open the app from a push notification
- Operator steps: none beyond deploying the API with the mark-one endpoints

## Mobile banner notifications

- Surfaces: mobile
- Change: while the app is open and the Notifications inbox is not on screen, a new notification
  whose kind is turned on slides down from the top. The card shows the title and one line of the
  body. A tap opens that notification's page and marks only that notification read, so the unread
  badge drops when it was the only unread one. Dismissing the card with its Dismiss control,
  swiping it up, or letting it hide, leaves the badge. A light haptic plays when the card
  appears. A notification that arrives while the app is in the background, including while the
  stream stays open for background audio, never shows a banner and is not saved to show on
  return. The OS push shows it, and the badge and inbox still update. Cards waiting when the app
  goes to the background are cleared and stay unread. The dev client has to be rebuilt before
  the haptic is in the binary (`npm run mobile:prebuild`, then reinstall).
- Who notices: signed-in mobile users with the app in the foreground
- Operator steps: rebuild and reinstall the mobile dev client so expo-haptics is included

## Verified publisher links: schema

- Surfaces: api, workers, ops
- Change: new app migration `0023_channel_verified_publisher.sql`. Publisher claims
  (`channel_publisher_remote_item`) may now hold several rows per feed and gain a nullable
  `item_id` for item-level claims. New table `channel_verified_publisher` holds links between a
  publisher feed and a content feed that reference each other (content channel, publisher
  channel, optional item, claim position). Archiving or taking down a show removes its links on
  either side. `GET /channel` and item reads that embed the channel now return
  `channel_publisher.channel_publisher_remote_items` (array) instead of
  `channel_publisher.channel_publisher_remote_item` (object); no Podverse client reads it.
- Who notices: no one yet; nothing reads the links until the artist page and player changes ship.
- Operator steps: run app linear migrations before rolling the API. The API readiness marker
  `API_EXPECTED_MIGRATION_FILENAME` moves to `0023_channel_verified_publisher.sql`; a GitOps
  overlay that pins it must move with it.

## Verified publisher match rule

- Surfaces: workers (parser), api
- Change: an album is linked to a publisher (artist) feed only when both feeds reference each
  other: the album's `<podcast:publisher>` names the publisher's guid and the publisher feed's
  `podcast:remoteItem` names the album's guid. When either pointer carries a `feedUrl`, it must
  match the other feed's URL; http versus https, host case, and one trailing slash are ignored,
  and URLs of duplicate feeds merged into a channel count as that channel's. Both feeds must be
  active or pending archive. Links are stored in `channel_verified_publisher` and recomputed from
  stored references.
- Who notices: no one yet; readers ship separately.
- Operator steps: none.

## Parser keeps verified publisher links current

- Surfaces: workers (parser)
- Change: after storing a feed's channel tables, the parser recomputes verified publisher links
  for that feed as a content feed and for every content feed that names it as publisher, so a
  reference dropped from either feed removes the link on that feed's next parse. A failed
  recompute is logged and does not fail the parse. `<podcast:publisher>` is now mapped as a list
  of claims (first is primary); feeds with one publisher store the same data as before.
- Who notices: no one directly; artist pages and players read the links once their changes ship.
- Operator steps: none. Feeds whose content has not changed are not reparsed; run the
  verified publisher backfill command once to fill links for existing feeds.

## New-album notifications skip albums that do not name the artist

- Surfaces: workers (parser), notifications
- Change: when an artist feed adds album references, the new-album notification names only an
  album that names that artist back (a verified publisher link), or a Podcast Index preview for
  an album Podverse has not parsed. A parsed album whose `<podcast:publisher>` does not point at
  the artist is skipped.
- Who notices: artist followers stop getting alerts for albums the artist page does not list.
- Operator steps: none.

## Channel merges keep verified publisher links honest

- Surfaces: workers (duplicate merge), api
- Change: absorbing a duplicate feed removes the absorbed channel's verified publisher links on
  either side (journaled, so a revert restores them), then recomputes the surviving channel's
  links so the absorbed feed's URL counts as one of its URLs.
- Who notices: no one directly; artist pages stop listing a merged duplicate album.
- Operator steps: none.

## Backfill command for verified publisher links

- Surfaces: workers, k8s cron
- Change: new worker command `ormVerifiedPublisherLinksBackfill` (npm script
  `orm_verified_publisher_links_backfill`) recomputes verified publisher links for every channel
  with publisher claims or stored links. Flags: `-limit` (batch size), `-afterId` (resume),
  `-dry-run`. New suspended CronJob `worker-verified-publisher-links-backfill` for one-off runs.
- Who notices: operators; artist pages list verified albums for feeds parsed before this release
  once it has run.
- Operator steps: after the `0023_channel_verified_publisher.sql` migration and the parser
  release, run the command once per deployment (trigger a Job from the suspended CronJob).

## Verified publishers on channel and item responses

- Surfaces: api, helpers (web and mobile clients read it)
- Change: `GET /channel/:idOrIdText` and `GET /item/:idOrIdText` add `verified_publishers`, an
  ordered list of `{ id_text, title, medium_id }`. On a channel it lists publishers (artists)
  verified on the whole channel, meaning both feeds reference each other; on an item it lists
  publishers credited on that item alone (empty until feeds can express item credits). Publishers
  whose feed is not active or pending archive are left out. `@podverse/helpers` adds
  `DTOVerifiedPublisher`, `resolveVerifiedPublishers`, and `joinVerifiedPublisherTitles`.
- Who notices: no one until the player and track page changes ship; API consumers see a new field.
- Operator steps: none.

## Artist pages list only verified albums

- Surfaces: api (web artist page and mobile artist screen read it)
- Change: `GET /publisher-feed/channel/:idOrIdText` now returns as `channelsAdded` only albums
  whose feed names the artist back (verified link), in the artist feed's order. `channelsUnadded`
  lists albums the artist feed names that Podverse has not parsed, from Podcast Index; unknown
  references stay hidden. Albums Podverse has parsed that do not name the artist back are no
  longer shown. `itemsAdded` is now the tracks on the verified albums (newest first, at most 500)
  instead of the artist feed's own track references; `itemsUnadded` is always empty. Field names
  are unchanged, so installed apps pick this up without an update.
- Who notices: listeners on artist pages; albums that never named the artist disappear, and the
  Tracks tab fills with every track on the artist's verified albums.
- Operator steps: run the verified-link backfill (`ormVerifiedPublisherLinksBackfill`) after the
  migration and before this API ships, or artist pages show no albums until each feed is reparsed.

## Verified publishers on item lists, queue, and playlists

- Surfaces: api (web player and mobile player and queue cache read it); OpenAPI `Item` schema
- Change: item list endpoints (global, category, subscribed, by channel, auto-queue), queue
  resource reads (now playing, upcoming, history, promote, replay), and playlist resource reads
  now include `verified_publishers` on each item and its embedded channel, the same field
  `GET /channel` and `GET /item` carry. By-channel item lists (`/item/channel/...`), whose items
  have no embedded channel, also include `channel_wide_verified_publishers` on each item: the
  publishers verified on the whole channel. Clip, soundbite, and live item lists do not include
  either field yet.
- Who notices: no one until the player artist line ships; mobile stores both fields with queue
  and list payloads (including its stored album track lists, which car album track lists and
  downloads read), and rows stored earlier show no artist until they refresh.
- Operator steps: none.

## Adding an Add by RSS artist also parses its albums

- Surfaces: workers, api (parse status response), web and mobile once they read it
- Change: when an Add by RSS parse is an artist (publisher) feed, the worker resolves every feed
  the artist lists. Albums already in the Podverse directory come back as links to the directory
  album and are not fetched. Other albums are parsed for that member as their own Add by RSS
  parses on the `add-by-rss-background` queue. The artist's parse status gains
  `publisherListedFeeds` (directory links, album request ids, or why a listed feed was skipped),
  and each album's status gains `publisherRequestId`. At most 100 listed feeds per artist. Feeds
  named only by track-level references are not fetched. A listed album with no feed URL is looked
  up on Podcast Index, except for artist feeds fetched with credentials. Credentials go only to
  albums on the artist feed's own domain, re-sealed per album message; albums elsewhere are
  fetched without them and report the withheld state. Nothing is added to the public directory.
- Who notices: members who add an Add by RSS artist, once web and mobile show the albums
- Operator steps: the Add by RSS parser workers now validate Podcast Index env at startup (the
  k8s deployments already mount it; a custom deployment of `mqAddByRSSRunParser` must provide
  `PODCAST_INDEX_*`). The `add-by-rss-background` consumer must be running.

## Web artist page splits verified albums from albums not yet added

- Surfaces: web
- Change: the directory artist Albums tab shows Verified Albums, then Not Yet Added with the
  note "This artist's feed lists these albums. They move up once both feeds confirm the link."
  A Not Yet Added row opens the Podcast Index preview. The Tracks tab lists tracks on the
  verified albums, newest first, and no longer renders item references from the artist feed.
  A browser-only slot between Verified Albums and Not Yet Added stays empty until Add by RSS
  albums for that artist are wired in; it is not in the server HTML.
- Who notices: listeners on web artist pages
- Operator steps: none

## Artist screen separates verified albums from albums not yet added

- Surfaces: mobile
- Change: On an artist screen, Albums lists verified albums first, under a Verified Albums heading. Albums the artist names that Podverse has not parsed yet appear under Not Yet Added, with a note that they move up once both feeds confirm the link. Tapping one opens the Podcast Index preview on the same tab, where a member can add the feed. Albums Podverse has parsed that do not name the artist back are not listed. Tracks lists the tracks on the verified albums, and each row names its album. Track references that exist only on the artist feed are not listed.
- Who notices: listeners browsing an artist
- Operator steps: none

## Web player shows the artist above the album

- Surfaces: web
- Change: While a directory album track is playing, the full-size player shows the verified
  artist in smaller text between the track title and the album title. One artist links to that
  artist's page. Several artists show as "A, B" and open a list of those artists. The player
  bar's second line reads "Artist · Album" when an artist is verified, and stays the album title
  otherwise. Playback with no verified artist, and Add by RSS playback, keep the two lines they
  have today.
- Who notices: anyone playing a directory album track on the website
- Operator steps: none

## Track pages link the verified artist

- Surfaces: web
- Change: A directory track page lists each verified artist as a link under the track title.
  An album with no verified artist shows no artist link there. Album pages are unchanged.
- Who notices: anyone opening a directory track on the website
- Operator steps: none

## Mobile full player shows the album's artist

- Surfaces: mobile
- Change: the full player shows the verified artist under the track title, above the album. It
  links to the artist page, on Home when the artist is followed and on Browse otherwise. Several
  artists read "A, B", and a tap opens a list of each artist. Music without a verified artist,
  podcasts, and videos look as before. The title block grows by one line only for items with an
  artist, decided when the item starts.
- Who notices: mobile listeners playing music from albums whose artist feed lists them
- Operator steps: none (needs the API from plans 10 and 12)

## Mobile mini player names the artist

- Surfaces: mobile
- Change: the mini player's second line reads "Artist · Album" for music with a verified artist,
  and the channel or album title otherwise. That line now scrolls after the title when it is too
  long, for every item, instead of being cut off.
- Who notices: mobile listeners; podcast listeners see long channel names scroll
- Operator steps: none

## Mobile track pages link the artist

- Surfaces: mobile
- Change: on a directory track page, the byline under the album name shows the verified artist
  and opens the artist page. Several artists read "A, B" and open a list of each artist. Tracks
  without a verified artist keep the feed's author text. Album pages are unchanged.
- Who notices: mobile listeners browsing music
- Operator steps: none (needs the API from plan 10)

## Lock screen and car show the artist and album

- Surfaces: mobile (iOS and Android native media engine)
- Change: when music with a verified artist plays from the phone, the lock screen, Control Center, the Android media notification, CarPlay, and Android Auto show the track as the title, the artist names as the artist, and the album as the album. Without a verified artist, the album title stays in the artist field as before.
- Who notices: mobile listeners using the lock screen or a car
- Operator steps: native rebuild of the mobile app (new store build); check the lock screen on an iOS device and the media notification on Android

## Car-started music shows the artist

- Surfaces: mobile (CarPlay and Android Auto native services, native cache)
- Change: music started from the car's Queue, History, or album track lists, including with the
  phone app closed, shows the verified artist as the artist and the album as the album. With no
  verified artist, the album (or podcast) title fills the artist field; car plays from a track
  list used to leave that line blank. Album track lists stored before this update show the
  artist after the album's next refresh.
- Who notices: listeners who start music or podcasts from CarPlay or Android Auto
- Operator steps: native rebuild of the mobile app; check in the CarPlay simulator and the
  Android Auto DHU

## Downloaded album tracks show the artist on the phone

- Surfaces: mobile
- Change: playing a downloaded album track shows the album's verified artist in the full player,
  mini player, lock screen, and track page, including in Offline Mode. The artist comes from the
  album's stored track list, so it shows only while this device follows the album; downloads of
  albums you no longer follow show no artist. Track lists stored before this update show the
  artist after the album's next refresh.
- Who notices: listeners who download music
- Operator steps: none

## Car Downloads show the artist

- Surfaces: mobile (CarPlay and Android Auto native services, native cache)
- Change: in the car's Downloads list, a downloaded album track from an album you follow reads
  "Artist · Album", and starting it from the car shows the verified artist as the artist and the
  album as the album, including with the phone app closed. Downloads of podcasts and of albums
  you no longer follow are unchanged. The list updates when an album refreshes, when you unfollow
  one, and after account sync.
- Who notices: listeners who download music and play it in the car
- Operator steps: native rebuild of the mobile app; check in the CarPlay simulator and the
  Android Auto DHU

## Public read for a directory channel by feed guid

- Surfaces: api, helpers-requests
- Change: `GET /channel/directory-match?feed_guid=…&feed_url=…` returns `{ id_text, title,
medium_id }` for the parsed, publicly visible directory channel with that podcast guid (or, for
  a channel with no guid, that feed URL), else `null`. Reads only. The web and mobile players use
  it to link an Add by RSS album to its directory artist.
- Who notices: API consumers; members whose Add by RSS albums name a directory artist
- Operator steps: none

## Add by RSS artists list their albums, including ones you have not followed

- Surfaces: web
- Change: adding an Add by RSS artist now brings in every album its feed lists. Albums already in
  the Podverse directory link to the directory album. The others are parsed for you and shown
  only on that artist's page until you follow one. Albums that name the artist's guid show there
  too, an album two artists list shows under both, and tracks the artist credits one by one show
  in Tracks once their album is on this browser. Albums on another site that need a username and
  password appear under Needs Username and Password on the artist page. Matching is by feed guid
  on this browser; nothing is shared with other members.
- Who notices: members who add music artist feeds by RSS
- Operator steps: none

## Follow an album from an Add by RSS artist's page

- Surfaces: web
- Change: albums that appear only under an Add by RSS artist open, play, and show their tracks
  and livestreams like any Add by RSS album. Settings on that album includes the username and
  password section. Subscribe on the album follows it and keeps the same page and track links.
  Until you follow, the album is not in your library lists, on Home, or in the livestream lists.
- Who notices: members who add music artist feeds by RSS
- Operator steps: none

## Directory artist pages show your Add by RSS albums by that artist

- Surfaces: web
- Change: on a Podverse artist page, a signed-in member now sees "Your Add by RSS Albums" and
  matching tracks: Add by RSS albums on this browser whose podcast:publisher names that artist.
  Rows carry an Add by RSS icon. The sections are built in the browser only; they are not in the
  page HTML and nobody else sees them.
- Who notices: members who add music albums by RSS
- Operator steps: none

## The player names Add by RSS artists

- Surfaces: web
- Change: when you play an album you added by RSS, the player shows its artist above the album
  title (and in the player bar) when that artist is an Add by RSS artist on this browser, linking
  to its Add by RSS artist page. If the album names an artist that is in the Podverse directory,
  the line links to the directory artist instead. Directory albums with no verified artist show
  the Add by RSS artists on this browser that list them. Verified directory artists always take
  priority. Nothing is parsed or followed to fill the line.
- Who notices: members who add music by RSS
- Operator steps: none

## Add by RSS track pages link the artist

- Surfaces: web
- Change: a track page for an album you added by RSS now shows the artist under the track title
  when this browser knows it: an Add by RSS artist links to its Add by RSS page, and an artist
  in the Podverse directory links to the directory artist page.
- Who notices: members who add music by RSS
- Operator steps: none

## Mobile stores the albums an Add by RSS artist lists

- Surfaces: mobile
- Change: adding or refreshing an Add by RSS artist feed now stores every album it lists. Add by
  RSS albums are fetched in the background and kept on the device, linked to the artist, without
  being followed; directory albums are linked with their artwork. Albums on another domain never
  receive the artist's username and password; one that needs its own waits under the artist in
  Needs Username and Password. When the device already holds credentials for such an album, it
  parses the album with them itself. Each Add by RSS album's publisher pointer is also matched
  against the directory so its artist can be shown. Album fetch failures go to the error log, not
  an on-screen message. Nothing is written to the public directory.
- Who notices: members who add Add by RSS artist feeds (the screens arrive in the following entries)
- Operator steps: none

## Follow an album from an Add by RSS artist on mobile

- Surfaces: mobile
- Change: an album held on the device because an Add by RSS artist lists it shows Subscribe on
  its page. Subscribing follows it like any Add by RSS feed. Unsubscribing an album that an Add by
  RSS artist on the device still lists keeps it under that artist instead of deleting it.
  Removing an Add by RSS artist removes the albums only it listed and that were never followed.
- Who notices: members with Add by RSS artist feeds
- Operator steps: none

## Mobile Add by RSS artist pages list their albums and tracks

- Surfaces: mobile
- Change: an Add by RSS artist feed opens on a new Albums tab: the albums the artist lists
  (directory albums open their directory page; Add by RSS albums open on the device), then Add by
  RSS albums on the device that name the artist. Albums that need their own username and password
  show above the album rows under Needs Username and Password. The Tracks tab lists the artist's
  own tracks, the tracks of those Add by RSS albums, and any single tracks the artist references
  in other albums on the device; directory albums' tracks stay on the directory album. Albums
  still being fetched show a processing notice.
- Who notices: members with Add by RSS artist feeds
- Operator steps: none

## Mobile directory artist pages show your Add by RSS albums

- Surfaces: mobile
- Change: a directory artist page lists, under Your Add by RSS Albums, the Add by RSS albums on
  this device whose publisher pointer names that artist, and adds their tracks after the verified
  tracks. Rows carry an RSS marker read as "Add by RSS". Only this device sees them. Add by RSS
  pages opened from Browse or Search now stay on that tab.
- Who notices: members with Add by RSS albums by directory artists
- Operator steps: none

## Mobile player shows Add by RSS artists

- Surfaces: mobile
- Change: playing an Add by RSS album shows its artist on the full player, mini player, and lock
  screen: an Add by RSS artist on this device that lists the album or that the album names, else
  the directory artist its publisher pointer matches. A directory album with no verified artist
  shows the Add by RSS artists on this device that list it. Tapping opens that artist; several
  open a chooser. Verified artists always come first, and nothing is fetched to fill the line.
- Who notices: members who play Add by RSS music
- Operator steps: none

## Mobile Add by RSS track pages link the artist

- Surfaces: mobile
- Change: an Add by RSS track page shows its album's artist under the album title as a link: an
  Add by RSS artist on this device opens its Add by RSS page, and a directory artist the album
  points to opens the directory artist page. Several artists open a chooser. Without one, the
  feed's author text shows as before.
- Who notices: members who open Add by RSS tracks
- Operator steps: none

## Unfollow many feeds in one request

- Surfaces: api, helpers-requests
- Change: `POST /account/unfollow/bulk` takes `channel_id_texts` and/or `add_by_rss_feed_urls`
  (at most 1000 together) and ends this account's follow of each; unknown ids and URLs are
  skipped. Returns 204. Never membership-gated, like the single unfollows. Web and mobile use it
  when a member unsubscribes from an artist together with its albums.
- Who notices: API consumers
- Operator steps: none

## Web asks about albums when you unsubscribe from an artist

- Surfaces: web
- Change: on a directory artist page, Unsubscribe opens "Unsubscribe from [Artist]?" when you
  follow at least one of the artist's verified albums. The dialog says how many, and offers
  Cancel, Artist Only (today's behavior), and Artist and Albums (one request ends the artist and
  those album follows). With no followed album, Unsubscribe works as before with no dialog.
- Who notices: signed-in members who follow an artist and its albums
- Operator steps: none

## Web asks about albums when you unsubscribe from an Add by RSS artist

- Surfaces: web
- Change: Unsubscribe on an Add by RSS artist opens "Unsubscribe from [Artist]?" when you follow
  at least one album it lists or that names it (Add by RSS or directory). Artist Only keeps those
  album follows; Artist and Albums ends them with the artist in one request. Albums you never
  followed, which only showed under the artist, still leave with it without asking.
- Who notices: signed-in members with Add by RSS artists
- Operator steps: none

## Mobile asks about albums when you unsubscribe from an artist

- Surfaces: mobile
- Change: unsubscribing from an artist (directory or Add by RSS) on its screen, or from the
  Artists chip on Home or in the Add by RSS library, opens "Unsubscribe from [Artist]?" when you
  follow at least one of its albums: verified albums for a directory artist; albums it lists or
  that name it for an Add by RSS artist. Artist and Albums ends them together; Artist Only keeps
  the albums; Cancel changes nothing. Albums you never followed leave with the artist without
  asking. Works signed out on the device; signed in, one request updates the account. Offline,
  directory artists unsubscribe without the question.
- Who notices: members who follow an artist and its albums
- Operator steps: none

## Publisher feeds that name no remote-item medium are podcast publishers

- Surfaces: workers (parser), api
- Change: A feed whose `podcast:medium` is `publisher` and whose remote items carry no `medium`
  attribute, or that lists no remote items, is now stored as a podcast publisher
  (`publisher-podcast`) instead of a plain podcast. The Podcasting 2.0 spec reads a missing
  `medium` as podcast. These feeds stop counting as podcasts in lists filtered to podcasts. A
  publisher feed whose remote items name music or video keeps its type, and remote items without
  a medium do not count against it. Existing channels change on their next parse.
- Who notices: listeners browsing podcast lists; podcast networks that publish a publisher feed
- Operator steps: none

## Embed player titles scroll instead of truncating

- Surfaces: web (embed player)
- Change: in the embed player, the title line, the podcast or artist line, and the chapter, clip,
  or soundbite strip on the video layout each stay on one line. A line too long for the space
  scrolls horizontally after a 2.5 second rest on its first word, then hands off to the next long
  line, one line at a time. Short lines stay still. Hovering a scrolling line pauses it. With
  reduced motion turned on, long lines stay still and end in an ellipsis.
- Who notices: listeners using embedded players on other sites, with long episode, podcast, or
  chapter titles
- Operator steps: none

## Player bar titles scroll on one line

- Surfaces: web
- Change: The bottom player bar, on wide and narrow windows, shows the title and the channel name on one line each. A line wider than its space scrolls, rests, and repeats. Reduced motion keeps the ellipsis and does not scroll. The first line always shows the episode or track title. A chapter, clip, or official clip title no longer replaces it there; it appears on the new strip above the bar.
- Who notices: listeners using the web player bar
- Operator steps: none

## Segment strip above the web player bar

- Surfaces: web
- Change: A slim strip above the bottom player bar, on wide and narrow windows, names the chapter, clip, or official clip that is playing. It shows only while one is active. Clips get a scissors icon and official clips a microphone icon; chapters show the title alone, centered. A long title scrolls in turn with the bar's title and channel lines, and reduced motion keeps it still with an ellipsis. Dragging the progress bar updates the chapter name as you drag. Screen readers hear "Chapter: <title>", "Clip: <title>", or "Official Clip: <title>". While the strip shows, the floating video sits on top of it and the page gains a small bottom spacer so the last row can scroll clear. New catalog keys: `media_player.segment_strip_chapter`, `media_player.segment_strip_clip`, `media_player.segment_strip_official_clip`.
- Who notices: listeners using the web player on episodes with chapters, and anyone playing a clip or official clip
- Operator steps: none

## Full-size player titles scroll instead of truncating

- Surfaces: web
- Change: in the full-size player, the item title, the channel title, and the chapter, clip, or
  soundbite title each stay on one line. A line too long for the space scrolls horizontally after
  a 2.5 second rest on its first word, then hands off to the next long line, one line at a time.
  Short lines stay still and centered. Hovering a scrolling line pauses it. With reduced motion
  turned on, long lines stay still and end in an ellipsis. The lines remain links.
- Who notices: web listeners with long episode, podcast, or chapter titles
- Operator steps: none

## Livestreams play without video.js

- Surfaces: web, management-web (dependency only)
- Change: Video.js 10 removed the imperative `videojs()` player the web livestream controller used,
  so video.js is gone instead of upgraded. Livestream audio and video render the same native
  `MediaElement` as regular episodes: a progressive file sets `src`, and an HLS playlist plays
  natively or through the lazily loaded hls.js already used for non-live HLS. Play and pause follow
  the player, and each source still mounts a fresh element, so going live, back to an episode, and
  live again behaves as before. Live video sets `playsinline`, so iOS keeps it in the floating
  portal. Only the selected source is played, as before (no automatic fallback). `video.js` and
  `@types/video.js` are removed from web, management-web, and both sidecars; nothing in
  management-web used them. The root `@xmldom/xmldom` override is dropped because only video.js 8's
  HLS stack pulled that package in. The livestream container attribute is now
  `data-livestream-player-audio` / `-video` (was `data-vjs-player-*`).
- Who notices: listeners playing livestreams on the web; the web bundle no longer ships video.js
- Operator steps: none

## Next.js 16.4.2

- Surfaces: web, management-web
- Change: `next` moves from 16.4.0 to 16.4.2, including the 16.4.1 fixes for unauthenticated
  remote code execution in `use cache` functions that return typed arrays, unauthenticated remote
  code execution in the Image Optimization API when SVG files are used, and denial of service in
  the App Router via Server Actions.
- Who notices: operators running the web apps
- Operator steps: none

## Web player bar names the track and its artist and album together

- Surfaces: web
- Change: The bottom player bar title is the item title; the playing chapter or clip stays in the
  segment strip above the bar. The bar's second line reads "Artist · Album" for music with a known
  artist and the channel title otherwise, and scrolls when it is too long. In the full player the
  artist link scrolls in turn between the title and the album.
- Who notices: web listeners playing music with artist attribution
- Operator steps: none

## Add by RSS artist page stays on Albums while its albums load

- Surfaces: web
- Change: Opening an Add by RSS artist page no longer jumps to Settings before the artist's albums
  and tracks are read from the browser store. When the page does move off an empty tab on its
  own, it returns to that tab once it has content, unless the listener picked another tab first.
  A newly added artist now lands on Albums when its listed albums arrive.
- Who notices: web members adding or opening Add by RSS artists
- Operator steps: none

## Narrow web player bar keeps long titles inside the screen

- Surfaces: web
- Change: On narrow windows the bottom player bar stays the width of the window when the title is
  long. Before, a long title stretched the bar past the screen edge, pushed the controls out of
  view, and kept the title from scrolling.
- Who notices: web listeners on phones and narrow windows
- Operator steps: none

## Live HLS streams keep playing in browsers that play HLS natively

- Surfaces: web
- Change: Starting a live item no longer asks the hidden on-demand player to play. In browsers that
  play HLS playlists themselves (Safari, and current Chrome), that request reported an invalid
  source about a second after the stream started and paused the live stream.
- Who notices: web listeners starting livestreams in Safari or current Chrome
- Operator steps: none

## Signed-in devices on web Settings

- Surfaces: web, i18n catalogs (consumer)
- Change: Settings → Account has a Signed-In Devices section listing every session of the
  account: device name (browser and OS, or the app's device label), "This Device" or the date it
  was last used, and a Sign Out button per device. "Sign Out of All Other Devices" ends every
  session but this one after a confirmation. Signed-out devices see "You were signed out from
  another device." The navbar's Logout and the list's own row share one sign-out routine.
- Who notices: signed-in web users
- Operator steps: none

## Mobile Signed-In Devices screen

- Surfaces: mobile, i18n (consumer catalog)
- Change: Settings has a new Signed-In Devices screen listing every web and mobile session on the
  account with its device label and last-used date. Every row has a Sign Out button (this device's
  row, marked This Device, signs the app out like Logout), and Sign Out of All Other Devices ends
  every session except this one after a confirm. The app now sends a device label at login
  ("iPhone · iOS", "iPad · iOS", "<manufacturer model> · Android"). The screen needs a connection
  and is unavailable in Offline Mode. Reuses web's `settings.account.sessions.*` copy and adds
  `settings.account.sessions.login_required`. New Maestro flow
  `auth-sessions`.
- Who notices: signed-in mobile users
- Operator steps: none

## Superuser can force-logout another admin

- Surfaces: management-api, management-web
- Change: a superuser on another admin's detail page gets Force Logout. It ends every session
  of that admin. The control is absent on the superuser's own page, and the API rejects that
  case. The signed-out admin gets the `admin_force_logout` notice.
- Who notices: superusers managing other admins; an admin who is force-logged out
- Operator steps: none

## Management login shows why an admin was signed out

- Surfaces: management-web
- Change: a renewed `pv_mgmt_auth` cookie from a server-rendered request is copied onto the
  browser response, so an admin who keeps using management-web is not signed out a year after
  login. When a session was ended, the login page shows one of: "You were signed out from
  another device", "An administrator signed you out", "Your password was changed", or "You were
  signed out for your security".
- Who notices: admins who were signed out from another session, by a superuser, by a password
  change, or because a refresh token was reused
- Operator steps: none

## Sign-up, reset, and set-password use one password field

- Surfaces: web
- Change: Sign Up, Reset Password, and Set Password each keep a single password field. The
  confirm field and the mismatch check are gone. The request still sends one password.
- Who notices: people creating an account, resetting a password, or finishing an invite on the website
- Operator steps: none

## Management password forms use one password field

- Surfaces: management-web
- Change: Redeem Admin Invite and Edit User each keep a single password field. The confirm
  field and the mismatch check are gone. Both requests still send one password.
- Who notices: a new admin setting a password from an invite link, and a superuser setting a user's password
- Operator steps: none

## Change password in web Settings

- Surfaces: web, i18n catalogs (consumer)
- Change: Settings → Account has a Change Password button that opens a modal with a
  current-password field and a new-password field. There is no confirm field and no show-password control. A successful
  change keeps this browser signed in and signs out every other session. The new password
  follows the sign-up rule. Catalog keys are `settings.account.change_password.*`.
- Who notices: signed-in web users
- Operator steps: reseeding E2E (`make e2e_seed`) picks up `e2e-change-password-web@example.com`

## Server-side session records (schema only)

- Surfaces: api database, k8s base env
- Change: new app migration `0024_account_session.sql` adds the `account_session` table (one row
  per login per client: client type, device label, last seen, idle expiry, revocation and reason,
  and refresh-token rotation state). Nothing reads or writes it until the API session work lands.
- Who notices: operators only
- Operator steps: apply app migrations through `0024_account_session.sql`. API readiness waits on
  that file (`API_EXPECTED_MIGRATION_FILENAME`, set in both `infra/k8s/base/api/source/api.env`
  and the `infra/k8s/base/ops/kustomization.yaml` migration-scripts literals).

## Mobile sign-up uses one password field

- Surfaces: mobile
- Change: Sign Up keeps a single password field. The confirm field and the mismatch check are
  gone. Creating the account still sends one password.
- Who notices: people creating an account in the mobile app
- Operator steps: none

## Daily purge of expired session rows

- Surfaces: workers, k8s cron, k8s workers env
- Change: new `accountSessionPurge` worker command and `worker-account-session-purge` CronJob (daily
  04:30) delete `account_session` rows whose idle expiry is more than
  `ACCOUNT_SESSION_RETENTION_DAYS` (default 30) days past. Revoked rows keep their idle expiry, so a
  signed-out device still gets its reason while its session could have been in use.
- Who notices: operators
- Operator steps: optional `ACCOUNT_SESSION_RETENTION_DAYS` on workers; the CronJob ships in base

## Server-side sessions for every main API login

- Surfaces: api, web, mobile, k8s base env, helpers, helpers-requests
- Change: every login (web and mobile) creates a server-side session, and every authenticated
  request checks it, so a session can be ended at once from the server. Web renews its cookie at
  most once a day of use, so the 365-day limit counts from last use instead of from login. Mobile
  refresh tokens rotate on every refresh; the previous token stays usable so a lost response never
  signs anyone out, and any older copy ends the session as suspected theft. `logout` and
  `/auth/mobile/revoke` end the calling session on the server. A 401 for a session ended elsewhere
  carries `code: session_ended` and a `notice` (`signed_out_elsewhere`, `password_changed`,
  `admin_force_logout`, `security`). Public routes treat an ended session as signed out instead of
  failing. `POST /auth/mobile/token` accepts an optional `device_label`.
- Why web and mobile differed: web had one 365-day JWT counted from login and never renewed; mobile
  had a 15-minute access token (900 seconds) refreshed silently by a 365-day refresh token, which
  already acted as an idle limit. Neither could be ended from the server.
- Who notices: every signed-in web and mobile user signs in once after the deploy, because tokens
  issued before it name no session and are rejected. After that, users active on web stop being
  signed out 365 days after login.
- Operator steps: `AUTH_SESSION_IDLE_EXPIRATION` (default 31536000) replaces `AUTH_JWT_EXPIRATION`
  and `AUTH_MOBILE_REFRESH_TOKEN_EXPIRATION` on the API; remove the old keys from API deployment
  env. Apply the session migration first (plan 10's entry).

## Server-side admin session records (schema only)

- Surfaces: management-api database, k8s base env
- Change: new management migration `0004_admin_session.sql` adds the `admin_session` table (one
  row per admin login per client: client type, device label, last seen, idle expiry, revocation
  and reason, and refresh-token rotation state). Nothing reads or writes it until the management
  API session work lands. Deleting an admin removes the rows with the account.
- Who notices: operators only
- Operator steps: apply management migrations through `0004_admin_session.sql`. Management API
  readiness waits on that file (`MANAGEMENT_API_EXPECTED_MIGRATION_FILENAME`, set in both
  `infra/k8s/base/management-api/source/management-api.env` and the
  `infra/k8s/base/ops/kustomization.yaml` migration-scripts literals).

## Password reset and invite completion end every session

- Surfaces: api
- Change: resetting a forgotten password (`POST /account/reset-password`) or completing an invite
  (`POST /account/set-password`) ends every session of the account on every device, including
  the browser that sent the request, and the response clears that browser's web cookie. Signed-out
  devices get the `password_changed` notice on their next request. Deleting an account clears the
  web cookie in the same response; its sessions are deleted with it. Reset and invite completion
  now apply the sign-up password rule (at least 8 characters, at least one that is not a
  lowercase letter) instead of an 8-character minimum; a password that breaks it is a 400
  `Password does not meet the requirements` and leaves the email link usable.
- Who notices: users who reset their password, or finish an invite, are signed out everywhere and
  sign in again with the new password. The web forms already applied the sign-up rule, so web
  users see no new rejection.
- Operator steps: none

## Mobile refresh is safe with refresh-token rotation

- Surfaces: mobile
- Change: the app only sends a refresh token after it is saved in secure storage, and every
  refresh (foreground, background tasks, car sync) sends the most recently saved one. A failed
  secure-storage write after a refresh no longer fails the request; the app keeps using the
  previous refresh token, which the server still accepts. This keeps normal use from looking like
  a stolen token once the API rotates refresh tokens.
- Why mobile already stayed signed in (asked during planning): tokens live in secure storage, the
  15-minute (900-second) access token is refreshed silently before each request needs it, and each
  refresh returns a new 365-day refresh token, so any signed-in use within a year keeps the login.
  Only a server 401 signs the app out; offline and server errors never do.
- Who notices: nobody directly; it prevents unexpected "signed out for your security" sign-outs.
- Operator steps: none

## Admin force-logout ends every session of a user

- Surfaces: management-api
- Change: A superuser `POST /users/:id/force-logout` ends every session of that account and
  returns how many sessions ended. `POST /users/:id/password` now does the same after the password
  is saved. Signed-out devices are told an administrator signed them out, or that the password
  changed. Deleting a user still removes sessions with the account.
- Who notices: superusers calling the management API; a user who is force-logged-out or whose
  password an admin sets is signed out on every device on the next request
- Operator steps: none

## Daily purge of expired admin session rows

- Surfaces: management-api, k8s cron, k8s management-api env
- Change: `node apps/management-api/dist/index.js adminSessionPurge` and CronJob
  `management-api-admin-session-purge` (daily 04:45) delete `admin_session` rows whose idle
  expiry is more than `ADMIN_SESSION_RETENTION_DAYS` (default 30) days past. Revoked rows keep
  their idle expiry, so a signed-out admin still gets the reason while the session could have
  been in use.
- Who notices: operators
- Operator steps: optional `ADMIN_SESSION_RETENTION_DAYS` on the management API; the CronJob
  ships in base

## Session list and sign-out endpoints

- Surfaces: api, helpers, helpers-requests
- Change: new signed-in endpoints. `GET /auth/sessions` lists the account's active sessions
  (`id_text`, `client_type`, `device_label`, `created_at`, `last_seen_at` to within a day,
  `is_current`). `DELETE /auth/sessions/:session_id_text` ends one; ending your own is the same as
  logout. `POST /auth/sessions/revoke-others` ends every other session and returns
  `revoked_count`. Devices signed out this way get the `signed_out_elsewhere` notice. They work
  with a lapsed membership or unaccepted terms.
- Who notices: web and mobile clients that build the session list screens.
- Operator steps: none

## Force Logout on the management user page

- Surfaces: management-web
- Change: The user detail page has a Force Logout button. After confirmation it signs that user
  out of every device and stays on the page. Saving a new password on the edit page now says the
  user was signed out of every device.
- Who notices: superusers on the management user page
- Operator steps: none

## Server-side sessions for every management admin login

- Surfaces: management-api, management-web, k8s base env
- Change: every admin login (browser cookie and mobile token pair) creates a server-side session
  in the management database, and every authenticated request checks it, so a session can be
  ended at once. The `pv_mgmt_auth` cookie renews at most once a day of use, so the 365-day
  limit counts from last use instead of from login. Mobile refresh tokens rotate on every
  refresh; the previous token stays usable, and any older copy ends the session. Logout and
  `/auth/mobile/revoke` end the calling session. A 401 for a session ended elsewhere carries
  `code: session_ended` and a `notice`. `POST /auth/mobile/token` accepts an optional
  `device_label`. Bearer is still preferred over the cookie. Revoke still responds `Mobile token
family revoked`.
- Who notices: every signed-in admin signs in once after the deploy, because tokens issued before
  it name no session and are rejected. After that, admins who stay active stop being signed out
  365 days after login.
- Operator steps: `AUTH_SESSION_IDLE_EXPIRATION` (default 31536000) replaces `AUTH_JWT_EXPIRATION`
  and `AUTH_MOBILE_REFRESH_TOKEN_EXPIRATION` on the management API; remove the old keys from its
  deployment env. Apply the admin session migration first (plan 60).
- Also: `@podverse/helpers` no longer exports `DEFAULT_AUTH_JWT_EXPIRATION`,
  `DEFAULT_AUTH_MOBILE_REFRESH_TOKEN_EXPIRATION`, `MobileRefreshJwtPayload`, or
  `isMobileRefreshJwtPayload`.

## Change password while signed in

- Surfaces: api, helpers, helpers-requests, k8s base env
- Change: new signed-in `POST /account/change-password` with `current_password` and
  `new_password`. It checks the current password, applies the sign-up password rule to the new
  one, ends every other session of the account (those devices get the `password_changed` notice),
  and keeps the session that sent it, on web and mobile. Returns `{ message, revoked_count }`.
  Failures are 400 with `code` `current_password_incorrect` or `invalid_new_password`. A change
  also voids any pending reset-password email link. Works with a lapsed membership or unaccepted
  terms. Rate limited per account by `ACCOUNT_CHANGE_PASSWORD_MAX_PER_10_MINUTES` (default 4).
  New request helper `reqAccountChangePassword` and `ACCOUNT_CHANGE_PASSWORD_ERROR_CODES` in
  `@podverse/helpers`.
- Who notices: users who change their password from Settings stay signed in where they are and
  are signed out everywhere else; web and mobile clients that build the form.
- Operator steps: optional `ACCOUNT_CHANGE_PASSWORD_MAX_PER_10_MINUTES` on the API (default 4).

## Web keeps its session cookie fresh on every kind of visit

- Surfaces: web
- Change: the web middleware now runs on every page route. When the signed-in cookie is due for
  its once-a-day renewal, it asks the API to renew and passes
  the API's `Set-Cookie` straight to the browser. Pages rendered on the web server previously
  dropped a renewed cookie, so a visitor who only loaded pages would still have been signed out
  365 days after the last cookie the browser stored. Now the 365-day limit counts from the last
  visit of any kind.
- Who notices: nobody directly; signed-in web users stay signed in while they keep visiting.
- Operator steps: none

## Changing an admin password ends that admin's sessions

- Surfaces: management-api
- Change: redeeming an admin invite (`POST /admins/invite-link/redeem`) ends every session of
  that admin. An admin setting their own password ends every other session and keeps the
  browser that sent the change. Another admin setting the password ends every session of the
  target. Those browsers get the `password_changed` notice on the next request.
- Who notices: an admin whose password was just set is signed out on other devices and signs in
  with the new password.
- Operator steps: none

## Web says why it signed you out

- Surfaces: web, helpers-requests, i18n catalogs (consumer)
- Change: when a browser's session was ended somewhere else, its next page load signs it out and
  shows a dialog with the reason: "You were signed out from another device.", "Your password was
  changed.", "An administrator signed you out.", or "You were signed out for your security." The
  browser's saved Add by RSS credentials for that account are cleared, as with Logout. Signing
  out yourself, or a session that ran past the idle limit, shows no dialog. New shared helper
  `parseAuthSessionEndedError` in `@podverse/helpers-requests` reads the 401 body.
- Who notices: web users signed out from another device, by an administrator, by a password
  change, or by the theft check
- Operator steps: none

## Admin session list and sign-out endpoints

- Surfaces: management-api
- Change: signed-in management API endpoints. `GET /auth/sessions` lists the admin's active
  sessions. `DELETE /auth/sessions/:session_id_text` ends one; ending your own matches logout.
  `POST /auth/sessions/revoke-others` ends every other session and returns `revoked_count`.
  Devices signed out this way get the `signed_out_elsewhere` notice. Management-web does not
  show this list.
- Who notices: a future management client that calls the endpoints
- Operator steps: none

## Web notices an ended session without a reload

- Surfaces: web, helpers-requests
- Change: an open web page whose session was ended elsewhere signs out on its next request to the
  API that is refused with a signed-out notice, then shows the same "You've Been Signed Out"
  dialog as a fresh page load. `ApiRequestService` in `@podverse/helpers-requests` accepts an
  optional `onRequestError` listener, called with every error a request throws before the caller
  gets it.
- Who notices: web users who leave a tab open while signed out from another device or by an
  administrator
- Operator steps: none

## Mobile says why it was signed out

- Surfaces: mobile, i18n (consumer catalog)
- Change: when the server ends the app's session, the "You've Been Signed Out" dialog now opens
  with the reason: signed out from another device, password changed, signed out by an
  administrator, or signed out for your security (a reused refresh token). With no reason it says
  the session expired. Sessions ended during background work now also leave the notice for the
  next time the app opens. Reuses web's `authentication.session_ended.*` sentences and adds
  `authentication.session_ended.expired`; `authentication.forced_logout_body` no longer states a
  reason.
- Who notices: mobile users signed out remotely
- Operator steps: none

## Change password in mobile Settings

- Surfaces: mobile
- Change: Settings has a Change Password screen with a current-password field and a
  new-password field. There is no confirm field and no show-password control. A successful
  change keeps this device signed in and signs out every other session. The screen reuses
  web's `settings.account.change_password.*` copy. Signed out, it asks the person to log in.
  Offline Mode shows the shared offline message. New Maestro flow `auth-change-password`
  uses its own seeded accounts and puts each password back before the flow ends.
- Who notices: signed-in mobile users
- Operator steps: reseeding E2E (`make e2e_seed`) picks up the iOS and Android change-password accounts

## Access token lifetime setting renamed

- Surfaces: api, management-api, k8s base env, lighthouse env
- Change: `AUTH_MOBILE_ACCESS_TOKEN_EXPIRATION` is renamed `AUTH_ACCESS_TOKEN_EXPIRATION`. It
  sets the lifetime of the access token in the access/refresh pair issued to token clients (the
  mobile app today, any non-browser client later); the web cookie is unaffected. Default stays 900
  seconds. Clients refresh it silently, so it never changes how long anyone stays signed in;
  `AUTH_SESSION_IDLE_EXPIRATION` does. `@podverse/helpers` exports
  `DEFAULT_AUTH_ACCESS_TOKEN_EXPIRATION` in place of `DEFAULT_AUTH_MOBILE_ACCESS_TOKEN_EXPIRATION`.
- Who notices: operators who set the old key; it is ignored after this change
- Operator steps: rename the key in API and management API deployment env and local `.env` files
  if you set a non-default value
