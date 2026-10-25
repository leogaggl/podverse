## Account menu has no outline

- Surfaces: web, management-web
- Change: The account menu in the top bar no longer shows the blue dropdown border or focus ring.
- Who notices: anyone using the account menu in the top right

## Subscribed filter is a single line

- Surfaces: web
- Change: The subscribed podcasts filter no longer shows a "Filter" label inside the field. The
  placeholder ("Type a Title") is the visible hint, so the control is one line tall. Screen readers
  still hear it as Filter.
- Who notices: someone filtering the subscribed list

## Agreement screens stay blank until the text loads

- Surfaces: web
- Change: Taste Profile and Terms of Service show only the loading spinner until the agreement text is ready. The title, body, and buttons appear together, so the centered block does not shift while the page loads.
- Who notices: someone signing up or logging in who still has to accept the current terms or choose Taste Profile

## Image viewer dismiss points down

- Surfaces: mobile
- Change: The full-screen image viewer slides up from the bottom. Its header control is a down
  chevron labeled Dismiss, matching the other slide-up screens.
- Who notices: someone who opens artwork full screen

## Buy and Extend Membership are green on mobile

- Surfaces: mobile
- Change: Buy Membership and Extend Membership use the same green success button as web, including
  the default dark theme. Sign Up and Login stay the blue primary button. The membership screen,
  the expiry banner, and membership dialogs all follow this.
- Who notices: someone buying or extending a membership in the mobile app

## Status messages sit in the middle of the page

- Surfaces: web
- Change: Screens whose only content is a status message now center that text horizontally and
  vertically in the page column. This covers sign-up success, forgot-password and email-change
  confirmations, password reset and set-password completion, email verification, checkout success,
  contact-only sign-up, removed-clip notice, and the Videos, My Clips, and Mobile App placeholders.
- Who notices: someone who just created an account, reset a password, or opened one of those pages

## Chip rows have a wider gap

- Surfaces: mobile
- Change: Section chips, sort and category chips, and settings option chips sit 6pt apart
  instead of 4pt.
- Who notices: someone scanning a chip row on Home, Browse, a channel, or a settings form

## Chip rows scroll by dragging

- Surfaces: web
- Change: Horizontal chip rows have no scrollbar. Pressing and dragging with the mouse scrolls the
  row. The chips keep the normal pointer. A drag does not select the chip or open Sort or Category.
  A click that barely moves still does. Touch scrolling is unchanged.
- Who notices: someone whose chip row is wider than the page, on a laptop or desktop

## Sidebar shows the current page

- Surfaces: web
- Change: The sidebar row for the page you are on has a stronger background than hover and is
  exposed as the current page. Home, Browse, Search, Recommendations, and each My Library
  destination light up on that page and on routes nested under it. A podcast, playlist, or other
  catalog page leaves the sidebar unmarked. My Clips lights up only while the profile clips tab
  is in the URL.
- Who notices: someone using the sidebar to tell which section they are in

## Ending a session closes its live account event streams

- Surfaces: api, management-api, helpers, orm
- Change: when a session ends (sign out of one device, Sign Out of All Other Devices, a password
  change or reset, admin Force Logout, admin password set, or a reused refresh token), every open
  `GET /account/events` stream of that session closes at once on every API pod. Before closing,
  the stream sends a last `session.ended` event with `{ notice }`: the same notice the
  session-ended 401 carries, or null when the device signed itself out. Revocations publish a
  `session.ended` event on the Redis channel `podverse:account-events` after they commit. A
  session-ended 401 on `GET /account/events` no longer clears the `jwt` cookie, so the browser's
  next request can report why the session ended. The 30-minute stream lifetime stays as the
  backstop when an event is lost during a Redis outage, and for deleted accounts. API key streams
  name no session and are unaffected.
- Who notices: web users see the signed-out dialog right away (separate entry); mobile apps sign
  out with the reason within about a second instead of on their next request
- Operator steps: none

## Web signs out at once when a session is ended elsewhere

- Surfaces: web
- Change: an open web page whose session is ended from another device, by an administrator, by a
  password change, or as suspected theft now signs out and shows the "You've Been Signed Out"
  dialog with the reason within a second or two, in every open tab of that browser. It no longer
  waits for the page's next request. The live account event stream delivers it.
- Who notices: web users who keep a tab open while signed out from elsewhere
- Operator steps: none

## Unknown detail links show Not Found instead of an error page

- Surfaces: web
- Change: Podcast, album, episode, track, livestream, clip, chapter, and official clip pages now
  render the not-found page with HTTP 404 when the API answers 404 for the id in the URL. Before,
  the page threw and showed "Something Went Wrong" (and re-rendered repeatedly in dev). Every other
  API failure (5xx, network, auth) still shows the error page. Embed pages keep their current
  handling; the profile and playlist changes have their own entries.
- Who notices: visitors following a stale or mistyped link; search crawlers now get a 404 instead
  of a 500 for removed content
- Operator steps: none

## Signed-in listeners can open other accounts' public playlists

- Surfaces: api, web, mobile
- Change: `GET /playlist/:playlist_id_text` returns a public or unlisted playlist to every
  caller, including a signed-in account or API key that does not own it. Before, a signed-in
  non-owner got 404 while a signed-out visitor got the playlist. A private playlist still answers
  404 to everyone except its owner, and writes stay owner-only.
- Who notices: signed-in web users opening another account's playlist link or embed see the
  playlist and a Follow button instead of Not Found; mobile users following another account's
  playlist no longer get an error after the follow, and its detail screen loads; API key users
  can read other accounts' public playlists
- Operator steps: none

## Playlist and edit pages report API failures instead of showing Not Found

- Surfaces: web
- Change: `/playlist/[playlist_id]`, `/playlist/edit/[playlist_id]`, and `/clip/edit/[clip_id]`
  render the not-found page (HTTP 404) only when the API answers 404 for the id in the URL. Before,
  every failure, including 5xx, network, and auth errors, rendered Not Found. Those failures now
  show the error page and reach the logs. A signed-out visitor who opens the edit link of a clip
  whose episode was removed sees the removed-clip message, as on the clip page, instead of Not
  Found.
- Who notices: visitors during an API outage see an error instead of a false "missing" page;
  visitors following a stale playlist or edit link see no difference
- Operator steps: none

## Profile pages show the error page for API failures

- Surfaces: web
- Change: `/profile/[id_text]` still redirects to `/profiles` when the account does not exist or
  is private to the viewer (the API answers 404). Every other failure now shows the error page:
  a 5xx, network failure, timeout, or other non-404 answer for the account, and a failed
  `/auth/me` for a signed-in viewer. Before, all of these redirected to `/profiles` with no error
  shown. Opening your own profile still redirects to `/my-profile`.
- Who notices: visitors hitting a profile while the API is failing now see the error page instead
  of a silent jump to the profiles list; operators see those failures in logs and error reporting
- Operator steps: none

## Mobile chapter lists mark the playing chapter

- Surfaces: mobile
- Change: the full player's Chapters pane and the Chapters tab of an episode (directory and Add by
  RSS) now color the title of the chapter that is playing, and screen readers hear it as selected.
  While another of the member's devices plays that episode, the episode screens mark the chapter
  at that device's estimated position.
- Who notices: listeners of chaptered episodes; members signed in on more than one device
- Operator steps: none

## Cross-device playback API

- Surfaces: api, ops
- Change: new membership-gated routes under `/account/playback` for exclusive active-device
  handoff. `POST /account/playback/presence` checks a device in (a device is a login session) and
  returns this device's session id, the connected devices, and the current playback state.
  `POST /account/playback/state` lets the playing device publish its item (with the item's
  medium id, required), status, position, duration, and rate, or claim the active slot (one
  playing device per account; the last claim wins).
  `POST /account/playback/commands` sends a command (`play`, `pause`, `seek`, `set_rate`, `next`,
  `previous`, `play_item`, or `take_over` to move playback to another device) to the playing
  device through the account event stream; commands expire after 5 seconds and are never
  replayed. `next` and `previous` make the playing device run its own Next or Previous button on
  its own queue; the server never edits a queue for them. Live items reject seek and set rate.
  `POST /account/playback/commands/{command_id}/start-failed` lets the target report that it could
  not start audio, and the sending device is told. The account event stream now carries
  `playback.snapshot` (on connect), `playback.state`, `playback.devices`, `playback.command` (only
  to the target device), and `playback.start_failed` (only to the sender). Presence,
  the active device, and the latest state live in Redis (Valkey) with short expiry, on a new
  connection named `podverse-api-playback` per API pod. A device that stops checking in leaves
  the device list within about 50 seconds; a cleanly closed stream within about 5 seconds.
- Who notices: no one until web and mobile use it. Members on several devices then see and
  control playback across them. Operators see one more Redis connection per API pod.
- Operator steps: none; it uses the existing `KEYVALDB_*` settings.

## Required API env var for the playback presence leave grace

- Surfaces: api, k8s base env
- Change: the API requires `PLAYBACK_PRESENCE_LEAVE_GRACE_MS` and fails startup validation without it. It must be a whole number of milliseconds of at least 1, and there is no code default. It sets how long a device stays in the cross-device device menu after its account event stream closes. The k8s base `api.env` and `apps/api/.env.example` set 5000.
- Who notices: anyone running the API from an existing `apps/api/.env`, the Lighthouse API env, or a deployment overlay that does not inherit the base `api.env`
- Operator steps: add `PLAYBACK_PRESENCE_LEAVE_GRACE_MS="5000"` to local `apps/api/.env` and the Lighthouse API env, and check GitOps overlays

## Web player becomes a cross-device playback device

- Surfaces: web
- Change: A logged-in web tab with an active membership checks in as a playback device while the
  account event stream is open. Starting playback makes that browser the active device and
  publishes its play state, position, and speed (at most every 10 s while playing, at once on
  pause, seek, speed, or item changes). When another device or another tab of the same browser
  starts playing, this tab stops its audio and clears its player, and stops writing queue and
  position updates. Tabs of one browser count as one device; the tab that last started playback
  holds the audio. Closing the playing tab marks playback paused. Each published state names the
  item's medium (podcast, music, video, and so on, from its channel or Add by RSS feed), so other
  devices can link to it and share it without loading it.
- Who notices: members who play on more than one device or tab
- Operator steps: none; needs the account event stream and the playback routes deployed

## Mobile joins the cross-device device list

- Surfaces: mobile
- Change: a signed-in member's phone checks in to cross-device playback over the account event
  stream and keeps a live view of what plays on their other devices. It appears in the device list
  while the app is open, or in the background while it plays audio, and leaves within about five
  seconds after it pauses in the background. Offline Mode and a lapsed membership keep it out.
- Who notices: members with the web app open on another device see the phone in its device list
- Operator steps: none

## Web player follows commands from other devices

- Surfaces: web
- Change: The web tab playing for an account carries out play, pause, seek, speed, next,
  previous, and "play this item" commands sent from another device or tab, including pause for
  livestreams. Next and previous do exactly what this tab's own Next and Previous buttons do, on
  its own queue: with chapters they move between chapters, Previous restarts the item when it is
  past 3 s, and otherwise they load the next or previous item. Speeds snap to the nearest speed
  the web player offers. A position from another device that lands at or past the end of this
  tab's copy of the file (dynamic ads can make copies differ in length) starts 5 s before the end
  instead of ending the item. When the browser blocks audio without a tap, or the media fails to
  load, the tab reports it to the sender and offers tap to play. Items started from another
  device's queue still auto-advance from the server queue, and only the playing tab records
  history and positions.
- Who notices: members controlling web playback from another device
- Operator steps: none

## Switch or Continue prompt defers to live control

- Surfaces: web
- Change: The prompt offering to switch to the item another device last played no longer appears
  while that device is connected and playing; the player shows live control instead. It still
  appears when the other device is offline or has stopped, after this tab learns that (at most
  about 5 s after opening). An open prompt closes if another device starts playing or this tab
  starts playing.
- Who notices: members who move between devices
- Operator steps: none

## Mobile shares its playback and yields to the device you start

- Surfaces: mobile
- Change: while a member's phone plays, it publishes what it plays, its position, rate, and
  status to their other devices (on every play, pause, seek, rate change, and item change, and every
  10 seconds while playing, including in the background). Starting audio on the phone from the
  app, the lock screen, a headset, or the car makes it the active device. When another device starts
  playing, the phone's audio stops on its own, without changing the queue or history. What the
  phone publishes includes the medium of what it plays (podcast, music, video, and so on, Add by
  RSS included), so the member's other devices can link to it and share it.
- Who notices: members who play on more than one device
- Operator steps: none

## Send web playback to another device

- Surfaces: web
- Change: Choosing a device for playback sends one transfer command. The target browser's most
  recently focused tab loads the item where the other device was (livestreams at the live point),
  at the same speed, starts it, and becomes the active device; the old device stops. When that
  position is at or past the end of the target's copy of the file (copies can differ in length
  with dynamic ads), it starts 5 s before that file's end. Choosing this device does the same
  locally. The sender sees a failure when the target reports it could
  not start, is not connected, or does not respond within 8 s. Add by RSS items resolve from the
  account's server queue.
- Who notices: members moving playback between devices
- Operator steps: none

## Your other devices can control the phone

- Surfaces: mobile
- Change: while a member's phone is the active device, their other devices can play, pause, seek,
  change speed, press Next and Previous, and start a different item on it. Next and Previous do
  exactly what a tap on the phone's own buttons does, using the phone's queue (and do nothing for a
  livestream, as on the phone). Choosing the phone in another device's device menu moves playback
  to the phone at the current position (or the live point for a livestream). When a move, a new
  item, or a seek lands at or past the end of the phone's own copy of the file (lengths can differ
  between devices), the phone starts 5 seconds before its end instead of finishing the item. The
  phone tells the other device when the media cannot load. Only the device that plays records end,
  auto-advance, history, and position.
- Who notices: members who play on more than one device
- Operator steps: none

## Web player controls the playing device from any tab

- Surfaces: web
- Change: While another device or another tab is playing for the account, this tab's play,
  pause, skip, seek, arrow keys, speed, and Next and Previous track buttons, and picking an item
  anywhere on the site, control the playing device instead of starting audio here. Next and
  Previous do on the playing device what its own buttons do, on its own queue. Picking the item that is already
  playing there toggles play and pause; another item plays there from its saved position, or
  from the chosen chapter. Seeking and skipping are not offered for livestreams.
- Who notices: members with more than one device or tab open
- Operator steps: none

## Control another device from the phone

- Surfaces: mobile
- Change: while another of a member's devices is playing, the phone's play, pause, seek, skip
  forward and back, Next, Previous, and speed controls drive that device, and picking an episode,
  clip, track, or queue item plays it there. Next and Previous do what those buttons do on the
  playing device, using that device's queue. Livestreams offer play, pause, Next, and Previous; no
  seek, skip, or speed. A member can move playback from the phone to another device, or bring it
  to the phone, at the current position or the live point.
- Who notices: members who play on more than one device
- Operator steps: none

## The switch-item prompt stays out of live control

- Surfaces: mobile
- Change: the prompt that offers to switch to the episode played on another device no longer
  appears while another of the member's devices is playing (that device is shown and controlled
  directly) or while the phone is the active device. It waits a moment at startup until the phone
  knows whether another device is active. When the other device stops, the phone's player loads
  what it was playing, paused at the same spot, without changing the queue or history. Without
  a membership, in Offline Mode, or when the other device is offline, the prompt works as before.
- Who notices: members who play on more than one device
- Operator steps: none

## Web player shows what another device is playing

- Surfaces: web
- Change: When another signed-in device or another tab of this browser is playing for the
  account, the web player bar, its mobile layout, and the full-screen player stay visible and
  show that item's title, show title, and artwork, with a status line "Playing on <device>",
  "Paused on <device>", "Starting on <device>", or "Playing in Another Tab". The controls that
  work remotely appear: play and pause, Next and Previous (run by the playing device on its own
  queue), jump back and forward, speed in Settings, Add to Playlist, and Share. Share is also
  on the player while this browser is the one playing, and it opens the same share dialog detail
  pages use. Share is unavailable for an Add by RSS item. The narrow layout shows
  Previous and Next for music and the jump buttons for other media, as it does locally. Volume,
  mute, clip, repeat, shuffle, and alternate enclosure are hidden there. The full-screen player
  links the title and show name and shows the current chapter or clip; the strip above the bar
  names the chapter, clip, or official clip playing on the other device, following its position.
  Add to Playlist is unavailable only for an Add by RSS item this browser has not loaded. For a
  livestream the progress bar is replaced by a Live label and the jump and speed controls are
  hidden. When the playing device goes away, the player returns to the queue's item, paused, on
  this device. While a transfer is pending, the player shows "Sending to <device>…".
- Who notices: members signed in on more than one device or tab
- Operator steps: none

## Web progress bar follows the playing device

- Surfaces: web
- Change: While another device or tab plays, the web player's progress bar shows that device's
  position and moves forward on its own between updates, with that device's duration. Clicking or
  dragging the bar seeks the playing device when released. Chapter marks are not shown on that
  remote bar; the strip above the player names the current chapter instead.
- Who notices: members with more than one device or tab open
- Operator steps: none

## Web player device switch

- Surfaces: web
- Change: When two or more devices are signed in and connected for the account, the web player
  (bar, mobile layout, and full-screen player) shows a Playback Devices button. Its menu lists
  the connected devices with this device first and marked This Device, and the playing device
  checked and marked Playing. Devices with the same name are numbered. Choosing another device
  moves playback there; choosing This Device moves it here, including from another tab of the
  same browser.
- Who notices: members signed in on more than one device
- Operator steps: none

## Web asks for a tap when a browser blocks audio after a transfer

- Surfaces: web
- Change: When playback is moved to a web browser that will not start audio until the page is
  clicked, that browser shows a Ready to Play Here prompt; Play Here starts playback and Not Now
  dismisses it. The device that sent playback shows an error naming the device when playback
  could not start there, did not respond, could not be reached, or the request failed.
- Who notices: members moving playback between devices
- Operator steps: none

## Web item rows show playback from another device

- Surfaces: web
- Change: The item playing on another signed-in device or another tab is marked as playing in
  web lists, the queue page, and detail pages, with its row progress moving. Clicking its play
  button there pauses or resumes it on the playing device. On the episode's Chapters tab and the
  chapter page, the chapter that device is in is highlighted and follows its position; its play
  button pauses or resumes that device.
- Who notices: members with more than one device or tab open
- Operator steps: none

## Mobile mini player shows another device's playback

- Surfaces: mobile
- Change: while another of a member's devices plays, the mini player shows that item, its
  progress, and "Playing on {device}" (or Paused / Starting), even when nothing is loaded on the
  phone. Play and pause act on that device. The chapter strip above the mini player names the
  chapter the other device is in, from the phone's estimate of its position. Livestreams show the
  title, the status line, and play/pause with no progress or strip. While playback is being sent
  to another device, the second line reads "Sending to {device}…".
- Who notices: members signed in on more than one device
- Operator steps: none

## Mobile says when another device did not start

- Surfaces: mobile
- Change: when a member moves playback from the phone to another device and it does not start
  there, the phone shows a dialog naming the device and the reason: it could not load the media, it
  needs a tap first, it did not respond, it disconnected, or it could not be reached. When a play,
  pause, seek, speed, or episode choice does not reach the playing device, the phone says so.
- Who notices: members signed in on more than one device
- Operator steps: none

## Mobile lists follow another device's playback

- Surfaces: mobile
- Change: while another of a member's devices plays, that item's row in episode, clip, track, and
  Add by RSS lists shows the pause icon, and tapping it pauses or resumes that device instead of
  restarting the item here. The queue screen hides the other device's now-playing item from the
  upcoming list. The lock screen, media notification, CarPlay, and Android Auto still show only the
  phone's own player.
- Who notices: members signed in on more than one device
- Operator steps: none

## Mobile device switch menu

- Surfaces: mobile
- Change: when two or more of a member's devices are connected, a device button appears in the
  mini player and in the full player's controls. It opens a "Play On" menu that lists the devices,
  marks this one, and checks the device that is playing. Choosing a device moves playback there at
  the current position (livestreams at the live point); choosing this device brings playback to the
  phone. The button shows a spinner while a move is pending.
- Who notices: members signed in on more than one device
- Operator steps: none

## Mobile full player shows another device's playback

- Surfaces: mobile
- Change: while another of a member's devices plays, the full player shows that item with its
  artwork, the chapter that device is in, "Playing on {device}" (or Paused / Starting / Sending
  to), live progress that can be dragged to seek, previous and next, play/pause, skip back and
  forward (not for music), and speed. The title opens the episode, track, or clip screen, and Add
  by RSS titles open the phone's copy when it has the feed. Add to Playlist and Share work; an Add
  by RSS item the phone does not have cannot be added to a playlist, and Add by RSS has no share
  link. Remote share links point at the item's own page, including the livestream and official
  clip pages. Livestreams show the item, a Live label, previous, next, and play/pause. Sleep
  timer, More, Create Clip, Boost, and V4V are hidden there. The screen stays open while it shows
  the other device.
- Who notices: members signed in on more than one device
- Operator steps: none

