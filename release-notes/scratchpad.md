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
- Change: new app migration `0022_account_session.sql` adds the `account_session` table (one row
  per login per client: client type, device label, last seen, idle expiry, revocation and reason,
  and refresh-token rotation state). Nothing reads or writes it until the API session work lands.
- Who notices: operators only
- Operator steps: apply app migrations through `0022_account_session.sql`. API readiness waits on
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
