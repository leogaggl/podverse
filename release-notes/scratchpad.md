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

## Popularity tracking storage foundation

- Surfaces: api, workers, ops (app database)
- Change: new app migration `0022_popularity_tracking_foundation.sql` adds the popularity-tracking
  tables: a pseudonymous listener-id mapping in its own `listener_identity` schema that only the
  read-write role can use (the read-only role has no access), monthly-partitioned listen and open
  events with a default partition, per-show taste profile and Hidden From Taste Profile rows,
  anonymous daily totals per channel, item, clip, playlist, and profile, and range totals for
  public sorts. Server receive time is the only clock on listen events: it decides the
  daily-totals day and when taste scores fade from; no device listen time is stored. Two
  security-definer functions let the existing read-write role create and drop event partitions.
  DB bootstrap and the rebootstrap job now grant the app migrator `CREATE` on the app database so
  migrations can create schemas. The old stats tables stay until a later migration in the same
  release drops them.
- Who notices: operators running migrations; nobody else until the write path and jobs use it
- Operator steps: in each existing environment, run the `ops-db-rebootstrap-roles` job once and
  wait for it to finish, then run `ops-db-migrate-app`. New databases get the grant from bootstrap.
  `API_EXPECTED_MIGRATION_FILENAME` advances to `0022_popularity_tracking_foundation.sql`.

## Terms describe listen records and the Taste Profile

- Surfaces: api, web, mobile
- Change: The Popularity Tracking section of the terms now matches the explanation: what a counted listen is, the Taste Profile and Hidden From Taste Profile list, how long listen records and the Taste Profile are kept, what is deleted when tracking is turned off, and what stays paused when tracking stops without that choice. The terms version does not change, so existing accounts are not asked to accept the terms again.
- Who notices: anyone who reads the terms
- Operator steps: none

## Popularity Tracking explanation asks again

- Surfaces: api, web, mobile
- Change: The Popularity Tracking explanation now describes listen records kept on a monthly schedule, a Taste Profile kept until the listener turns tracking off, a Hidden From Taste Profile list, immediate deletion of that personal data when they confirm turning it off, and a paused Taste Profile when a membership ends or a new explanation is waiting. Public counts stay. `POPULARITY_TRACKING_AGREEMENT_VERSION` moves from `2026-10-15` to `2026-10-21`, so a listener who had turned tracking on is asked again and tracking stays off until they say yes. A listener who said no is not asked again. The terms version does not change.
- Who notices: Premium listeners who already turned Popularity Tracking on
- Operator steps: set `POPULARITY_TRACKING_AGREEMENT_VERSION` and `NEXT_PUBLIC_POPULARITY_TRACKING_AGREEMENT_VERSION` to `2026-10-21` on the API and the web sidecar. For a local checkout, the version in `dev/env-overrides/local/legal.env` is already updated; run `make local_env_setup` from the repo root so generated env files pick it up. Do not change `TERMS_OF_SERVICE_VERSION`.

## Management database browser lists popularity tables

- Surfaces: management-api, management-web
- Change: the database browser lists five read-only popularity tables, one row per channel,
  item, clip, playlist, and profile, with day, week, month, and all-time counts, in place of
  the rolling aggregate tables. Listener-linked stats tables stay off the browser.
- Who notices: operators using the database browser
- Operator steps: none

## Raw popularity listen data is kept 90 days

- Surfaces: api, web, workers, k8s base env
- Change: `STATS_TRACK_EVENT_RETENTION_DAYS` defaults to 90 (was 30) and the base API, workers,
  and web sidecar env files set 90. The Popularity Tracking explanation and terms fill
  `{retention_days}` from it, the web settings help shows it, and the partition job drops a whole
  month of raw listen and open events once every row in it is older than this.
- Who notices: listeners reading the explanation or terms; operators of deployments
- Operator steps: other deployments that pin either key to 30 should set 90 or remove the pin
  (alpha's GitOps values are already 90). Local: update `STATS_TRACK_EVENT_RETENTION_DAYS` in your
  home `legal.env`, then `make local_env_setup`.

## Management stats read range totals and daily listener counts

- Surfaces: management-api, management-web
- Change: the Stats page ranks channels, items, clips, playlists, and profiles by Day, Week,
  Month, and All-time counts from the popularity tables. Opening a row shows those four counts
  and a chart of each UTC day's listener count across the month window. The 7-day, 30-day, and
  1-year tabs and the rolling day and week charts are gone.
- Who notices: operators using the management Stats page
- Operator steps: none

## Popularity Tracking counts real listens, with a rate limit and daily cap

- Surfaces: api, k8s base env, web and mobile clients (once they send the new reports)
- Change: `POST /stats/listen` and `POST /stats/open` replace the five `POST /stats/{account,channel,clip,item,playlist}` routes, which are removed. A listen is reported once per listening session, after 60 seconds or 25% of the item (whichever comes first), with seconds heard and whether it finished; later reports for the same session update it. The request carries no device time: the server's receive time dates the listen for daily totals and Taste Profile score decay, so a report sent after offline time counts on the day it arrives. Each listen stores one event, adds to anonymous daily totals (one count per listener per item, show, and clip per UTC day), and updates the listener's Taste Profile with recent and long-term scores, except for shows in Hidden From Taste Profile. Profile and playlist opens count once per opener per day, never for your own profile or playlist, and never feed the Taste Profile. Both routes keep the Premium, capability, and consent gates and add a per-account rate limit; listens also have a daily cap.
- Who notices: Premium listeners with Popularity Tracking on; popularity sorts once the jobs roll daily totals up
- Operator steps: optional `STATS_TRACK_MAX_PER_MINUTE` (default 60) and `STATS_LISTEN_DAILY_CAP` (default 300) on the API

## Popularity listen events are partitioned by month and expire a month at a time

- Surfaces: workers, k8s base cron
- Change: new worker command `statsEventPartitionsMaintain` and daily CronJob
  `worker-stats-event-partitions` (03:30). It creates monthly partitions for popularity listen and
  open events two months ahead, then drops each month once every row in it is older than
  `STATS_TRACK_EVENT_RETENTION_DAYS` (90 days by default, so rows stay 90 to about 122 days).
  Retention never deletes rows one by one from a dated month.
- Who notices: operators; listeners only through the retention promise in the explanation
- Operator steps: after the migration runs on a deployment, start the job once by hand
  (`kubectl -n <namespace> create job --from=cronjob/worker-stats-event-partitions worker-stats-event-partitions-manual`)
  so dated partitions exist before the first listens arrive. Alpha picks up the CronJob when its
  `base/cron` ref moves.

## Turning Popularity Tracking off deletes listening data right away

- Surfaces: api (`PATCH /account-settings/listen-stats`), helpers
- Change: answering No to Popularity Tracking, in Settings or at the agreement prompt, now deletes
  the account's pseudonymous listener id in the same request. That removes its stored listen and
  open records, Taste Profile, and Hidden From Taste Profile list. Anonymous public totals stay. A
  membership lapse or a new explanation version waiting for a Yes deletes nothing; the Taste
  Profile is paused and resumes with the same id after a Yes. New shared helper
  `isPopularityTrackingOptOutDestructive` tells clients when to confirm first.
- Who notices: Premium listeners who turn tracking off; their recommendations start from scratch
  if they turn it back on
- Operator steps: none

## Web player reports counted listens to Popularity Tracking

- Surfaces: web
- Change: the web player no longer posts a channel, clip, and item stat each time media loads.
  It measures media seconds actually heard (seeks and skipped time do not count) and sends one
  `POST /stats/listen` once a listen meets the counted-listen rule (60 seconds or 25% of the item,
  whichever comes first), with later updates on completion and for each further minute heard.
  Soundbites and chapters count toward their item; clips count toward the clip; Add by RSS and
  live items are not reported. Profile and playlist page opens use `POST /stats/open`. Only a
  signed-in account whose Popularity Tracking decision allows it sends anything.
- Who notices: listeners who allow Popularity Tracking (nothing visible); operators reading
  popularity data, which now reflects real listening instead of page loads
- Operator steps: deploy with the API that serves `/stats/listen` and `/stats/open`

## Mobile reports counted listens through a durable outbox

- Surfaces: mobile
- Change: mobile playback no longer posts channel, clip, and item stats on every play and resume,
  and stats no longer ride playback outbox rows. The app measures media seconds actually heard
  (seeks and skipped time do not count) and records a listen once it meets the counted-listen rule
  (60 seconds or 25% of the item, whichever comes first), with updates on completion and for each
  further minute heard. Reports are kept in a new SQLite table (migration 25,
  `stats_listen_outbox`) and sent to `POST /stats/listen` when online, including after offline
  listening. A replayed listen counts and fades from the time the server receives it. Soundbites
  and chapters count toward their item; Add by RSS and live items are not reported; mobile records
  no profile or playlist opens. Only a signed-in account whose Popularity Tracking decision allows
  it stores or sends anything, and a declined decision deletes reports still waiting on the device.
  Listening the car plays while the app's JavaScript is not running is not counted.
- Who notices: listeners who allow Popularity Tracking (nothing visible); operators reading
  popularity data
- Operator steps: ship with an API that serves `/stats/listen`; the migration runs on app start

## Taste Profile endpoints

- Surfaces: api, helpers, helpers-requests
- Change: new signed-in routes `GET /account/taste-profile`, `GET /account/taste-profile/hidden`,
  `POST /account/taste-profile/hide`, and `POST /account/taste-profile/unhide`. Listeners can list
  the shows in their Taste Profile and their Hidden From Taste Profile list. Hiding a show deletes
  its taste data and stops later listens from adding it back; its listens still count in public
  totals. Unhiding either adds the show back as a fresh row or only takes it off the hidden list.
  The routes need an account, not a current membership, so a paused listener can still review
  and hide shows. Request helpers `reqAccountTasteProfile*` are on `ApiRequestService`.
- Who notices: client developers; listeners once the Settings UI ships
- Operator steps: none

## Popularity rankings refresh hourly from daily totals

- Surfaces: workers, k8s base cron
- Change: new worker command `statsPopularityRefresh` rebuilds day, week, month, and all-time
  popularity totals from the anonymous daily totals for every channel, item, clip, playlist, and
  profile. CronJob `worker-stats-popularity-refresh` runs it hourly at :05 for entities active in
  the last 30 days; `worker-stats-popularity-refresh-full` runs `-full` daily at 00:45 for every
  entity. The unscheduled `statsUpdateAggregated` and `statsUpdateAggregatedRolling` commands and
  their npm scripts are removed.
- Who notices: listeners see Top and trending sorts move within an hour of new listens; operators
- Operator steps: none beyond letting the CronJobs deploy; alpha picks them up when its
  `base/cron` ref moves. Run `statsPopularityRefresh -full` by hand to refresh at once.

## Top lists read the new popularity totals

- Surfaces: api
- Change: every Top sort (podcasts and other channels, episodes and live items, clips, playlists,
  profiles; global, category, subscribed, and per-channel or per-item) reads range totals rebuilt
  from anonymous daily listener counts instead of the old rolling count columns. Day covers today
  and yesterday (UTC), week today plus the previous 7 days, month today plus the previous 30, and
  all time every counted day. Entities with equal counts now come back in a stable order, so
  paging no longer repeats or skips them. Routes, parameters, and responses are unchanged.
- Who notices: listeners using Top sorts; lists are empty or padded with recent items until new
  listens are counted
- Operator steps: none beyond running the popularity refresh job that fills the totals

## Web asks before Popularity Tracking is turned off

- Surfaces: web
- Change: turning off the Popularity Tracking switch in Settings, or answering No Thanks at the
  agreement prompt after an earlier Yes, now opens a "Turn Off Popularity Tracking?" dialog. It
  says the Taste Profile, the Hidden From Taste Profile list, and stored listening history are
  deleted right away, and that recommendations start from scratch if tracking is turned on
  again. Cancel keeps tracking on; "Turn Off and Delete" sends the No. A listener who never said
  Yes is not asked.
- Who notices: signed-in web listeners who had allowed Popularity Tracking
- Operator steps: none

## Mobile asks before Popularity Tracking is turned off

- Surfaces: mobile
- Change: turning off Popularity Tracking in More > Settings, or answering No after an earlier
  Yes (in Settings or at the full-screen agreement prompt), now asks "Turn Off Popularity
  Tracking?" first. The message says the Taste Profile, the Hidden From Taste Profile list, and
  stored listening history are deleted right away, and that recommendations start from scratch
  if tracking is turned on again. Cancel keeps tracking on; "Turn Off and Delete" sends the No.
  Settings shows a dialog; the agreement prompt shows the same message in place. A listener who
  never said Yes is not asked.
- Who notices: signed-in mobile listeners who had allowed Popularity Tracking
- Operator steps: none

## Data export includes Popularity Tracking data

- Surfaces: api (`GET /account/download-data`), helpers
- Change: the account data export has a new `popularity_tracking` section: Taste Profile rows,
  the Hidden From Taste Profile list, and stored listen and open records. Each listen record is
  dated by `created_at`, the time the server received it. It does not include the pseudonymous
  listener id. The section is empty for listeners who never turned tracking on or who
  turned it off.
- Who notices: listeners who download their data
- Operator steps: none

## Web Settings shows the Taste Profile and Hidden From Taste Profile

- Surfaces: web
- Change: the Settings Account tab has two new sections under Popularity Tracking. Taste Profile
  lists the shows the listener's listening has added, newest listen first, with the last-listened
  date and a Remove button. Remove deletes that show's listening data from the Taste Profile and
  moves it to Hidden From Taste Profile, where later listens no longer add it. Each hidden show has
  an Unhide button that asks whether to add it back now or only take it off the hidden list so a
  later listen adds it again. Both lists page with Load More and are empty after Popularity
  Tracking is turned off.
- Who notices: signed-in web listeners who use Popularity Tracking
- Operator steps: none

## Mobile Popularity Tracking settings show the Taste Profile and Hidden From Taste Profile

- Surfaces: mobile
- Change: More > Settings > Popularity Tracking has two new sections under the switch, matching
  web Settings. Taste Profile lists the shows the listener's listening has added, newest listen
  first, with the last-listened date and a Remove button. Remove deletes that show's listening
  data from the Taste Profile and moves it to Hidden From Taste Profile, where later listens no
  longer add it. Each hidden show has an Unhide button that asks whether to add it back now or
  only take it off the hidden list. Both lists page with Load More and are empty after
  Popularity Tracking is turned off.
- Who notices: signed-in mobile listeners who use Popularity Tracking
- Operator steps: none

## Duplicate feed merges carry popularity and taste data

- Surfaces: workers (duplicate feed merge), management-api (merge revert)
- Change: absorbing a duplicate channel adds its anonymous daily listener and completion totals
  to the survivor, per day. For days still inside `STATS_TRACK_EVENT_RETENTION_DAYS`, a listener
  with listen events on both copies that day counts once; older days are added as they are. The
  merged-away copy's range totals are removed, and the hourly and nightly popularity refresh
  rebuilds the survivor's day, week, month, and all-time totals from the merged daily rows. Listen
  events for matched episodes move to the survivor, and each listener's taste profile rows for the
  two copies merge into one (counts added, scores faded to the same time and added). A show
  hidden from a taste profile stays hidden on the survivor. Reverting a merge restores the exact
  pre-merge daily and range rows; listen events and taste rows stay on the survivor.
- Who notices: operators reviewing merges; listeners see Top lists and their Taste Profile treat
  the two copies as one show
- Operator steps: none

## Old stats tables and their data are dropped

- Surfaces: api, workers, management-api, ops (app database)
- Change: a migration drops the old per-entity stats event tables, the rotating stats guid
  mapping, and the rolling aggregate count tables, with all their rows. Popularity counts start
  from zero in the new daily totals; nothing is imported from v4.
- Who notices: operators and alpha testers; Top and trending sorts are empty until new listens
  are counted
- Operator steps: run the linear migrations; `API_EXPECTED_MIGRATION_FILENAME` advances
