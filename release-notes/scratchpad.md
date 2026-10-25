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

## Shared Add by RSS next and previous walk in playback-core

- Surfaces: packages (`@podverse/playback-core`)
- Change: new exports for the Add by RSS list walk: build a feed list context from ordered item ids, order episodes by publish date, step to the newer (Next) or older (Previous) item with the same end-of-list rules web uses, and read the next N ids ahead. Storage lookups and livestream ordering stay with each client. Available from the package root and the `./addByRSSListWalk` subpath. No caller changes in this entry.
- Who notices: developers of web, mobile, and other clients; no user-visible change on its own
- Operator steps: none

## Mobile Next turns on once something is next

- Surfaces: mobile
- Change: the full player's Next button turns on as soon as the next episode, track, playlist
  row, or Add by RSS feed item is found, and stays off at the real end. It no longer stays off
  after you start an item in the middle of a series. The queued-items count it checks now comes
  from the queue for what is playing (podcast or music), the same queue Next plays from.
- Who notices: mobile listeners
- Operator steps: none

## Reopening the app continues what the car was playing through

- Surfaces: mobile
- Change: when the app opens (or the car starts an item while it runs) and picks up an item the
  engine is already playing, it now continues the source the advance list came from if that item
  belongs to it: the same playlist, album, or podcast, with the same shuffle and repeat settings
  and the rows it already had. An item from the listener's queue keeps that playlist, album, or
  podcast waiting behind the queue, as a queue item played in the app does, even when the item is
  not part of it. An item that is in neither, even an episode of the same podcast, refills from
  its own podcast or album, as before. Clips and soundbites are picked up as clips and soundbites
  (their range, title, and progress), and Add by RSS episodes (from the advance list or the queue)
  as Add by RSS episodes with their feed's next episodes, instead of as a bare episode built from
  what the engine knew. The app keeps the source on the device so this works after the app was
  closed; sign-out deletes it.
- Who notices: CarPlay and Android Auto listeners who open the phone app after the car advanced on
  its own
- Operator steps: none

## A chapter played to its end moves on to what's next

- Surfaces: mobile
- Change: when a chapter started from the full player's chapter list reaches its end, the phone
  now continues the way it does at the end of an episode or clip: the next manual queue row plays,
  else the next auto-queue row, else the player clears, and the episode moves to history as
  finished (the engine already recorded it as finished). Before, playback paused at the chapter's
  end and nothing followed. While a chapter plays, listening progress, the listen session, and the
  sleep timer now work as they do for a whole episode. Web still pauses at a chapter's end; this
  is a deliberate mobile difference that matches how mobile already ends clips and soundbites.
- Who notices: mobile listeners who play chapters from the full player
- Operator steps: none

## Shared auto-queue policy in playback-core

- Surfaces: packages (`@podverse/playback-core`)
- Change: added new exports for auto-queue source choice (playlist in order or shuffled, music by season, podcast by publish date, channel shuffle), the forward fill with repeat wrap and shuffle paging, the backward walk Previous uses, playlist row mapping and playable-row checks, shuffle dedupe, config transitions, and `fillAutoQueueAhead` for bounded-window filling. Each client supplies its own fetch transport through `AutoQueueSourceFetchers`. Available from the package root and subpaths `./autoQueue` and `./autoQueueWalk`.
- Who notices: developers of web, mobile, and other clients; no direct user-visible change by itself
- Operator steps: none

## iOS engine walks the advance window with the app closed

- Surfaces: mobile (iOS native media engine)
- Change: the iOS engine stores `advance-window.json` and, when the app is not running, moves to the next entry in it at the end of an item, at the end of a clip or soundbite's range, or on a car or lock screen Next, before falling back to the account queue snapshot. Clip and soundbite entries play only their range; Add by RSS entries play their plain media URL or download. Entries are matched by kind and id, so a clip and its full episode are separate. When the app's JavaScript runtime goes away, the engine now takes advance back right away instead of waiting for a listener that is gone. Sign-out deletes the file with the other account-scoped car files.
- Who notices: CarPlay and lock screen listeners with the app closed
- Operator steps: ships with the next native iOS build

## Android engine walks the advance window with the app closed

- Surfaces: mobile (Android native media engine)
- Change: the Android engine stores `advance-window.json` and, when the app is not running, moves to the next entry in it at the end of an item, at the end of a clip or soundbite's range, or on an Android Auto, notification, or headset Next, before falling back to the account queue snapshot. Clip and soundbite entries play only their range; Add by RSS entries play their plain media URL or download. Entries are matched by kind and id, so a clip and its full episode are separate. When the app's JavaScript runtime goes away, the engine now takes advance back right away instead of waiting for a listener that is gone. Sign-out deletes the file with the other account-scoped car files.
- Who notices: Android Auto and notification listeners with the app closed
- Operator steps: ships with the next native Android build

## Mobile auto-queue fills right after Play

- Surfaces: mobile
- Change: playing an episode, track, clip, or playlist row now fetches the next auto-queue rows right away (and after a resume on launch), so Next is available mid-series without pressing it first. The fill uses the same shared source rules as web. Shuffle and Repeat both clear and reload the up-next rows; playlist plays start a new shuffle order; playlist clip rows whose episode is gone are skipped, as on web. A slow fill can no longer land on an item you have since moved past.
- Who notices: mobile listeners who start in the middle of a series or album
- Operator steps: none

## Mobile Previous steps back through what auto-queue played

- Surfaces: mobile
- Change: without chapters, Previous restarts the item past 3 seconds, as before. Otherwise it now steps back through the items auto-queue already played, and before the first one it plays the previous playlist row, album track (season order), or episode (publish date). With shuffle on it only restarts. Holding Previous, and the lock screen or car Previous command while the app is running, skip the 3-second restart. Previous no longer reads the account queue history, and it now works signed out.
- Who notices: mobile listeners using Previous on the full player, lock screen, CarPlay, or Android Auto
- Operator steps: none

## Mobile Add by RSS plays through the feed

- Surfaces: mobile
- Change: when an Add by RSS episode ends or you press Next, mobile plays the next newer episode in that feed (after anything in your queue), and Previous plays the next older one, as on web. Livestreams step through the feed's live list. Before, the player stopped at the end of an Add by RSS episode.
- Who notices: mobile listeners who play feeds added by RSS
- Operator steps: none

## Car and lock screen keep advancing through the auto-queue with the app closed

- Surfaces: mobile
- Change: the app writes a new native cache file, `advance-window.json`, holding what plays after the current item: the manual queue for that medium, then up to 10 automatic rows the app already resolved. For a regular item those are auto-queue rows (next episode by publish date, next album track by season order, or the next playlist row), including clips and soundbites, which play their own start-to-end range. For an Add by RSS episode they are the next episodes of that feed. When the app is not running, CarPlay, Android Auto, the lock screen Next button (music), and the end of an episode move through that list instead of stopping once the manual queue runs out. The app refills the list whenever it runs. The in-app auto-queue now keeps 10 rows resolved ahead instead of 1. The list stops at a livestream, and at an Add by RSS episode whose media needs the feed's password and is not downloaded; feed passwords and auth headers are never written to the file. Sign-out empties it.
- Who notices: listeners using CarPlay, Android Auto, or the lock screen with the phone app closed
- Operator steps: none; needs a native build that includes the advance-window reader
