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
