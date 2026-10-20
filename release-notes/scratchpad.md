## Custom API field no longer takes a login email

- Surfaces: mobile
- Change: Text fields stay out of platform autofill unless they name themselves. Login, sign-up,
  forgot-password, change-email, and Add by RSS username and password fields name themselves. The
  Custom API URL is a URL field. A value that is not an http(s) address shows the existing
  invalid-URL message immediately, with a danger border while the keyboard is open. An http(s)
  address that is not a canonical API base shows that message on blur and on Save.
- Who notices: someone pointing the app at another server, especially when a saved login email was
  landing in API URL
- Operator steps: none

## Web keeps an Add by RSS episode in the player

- Surfaces: web
- Change: Playing an Add by RSS episode no longer gets replaced by the server's previous
  now-playing item. Add by RSS plays are written to the podcast queue even when the feed has no
  medium tag, and the queue refreshes after the write. The automatic queue head load only ever
  reloads the item the player already holds; a different server item on a paused player is
  offered through the existing "continue here or switch" prompt.
- Who notices: anyone playing an Add by RSS feed on web, especially after using another device
- Operator steps: none

## Placeholder artwork is centered everywhere

- Surfaces: web, management-web (shared `Image` and `ImageNonReact` in packages/ui)
- Change: The headphones placeholder is centered on both axes in headers, list rows, and the
  player at every screen width, and the player uses the same placeholder size as lists. The
  shared `Image` placeholder now centers inside an inner box, so caller classes that switch
  `display` per breakpoint no longer knock it off-center. The player placeholder draws at 80% of
  the artwork box instead of filling it.
- Who notices: anyone viewing a show or episode without artwork
- Operator steps: none

## Add by RSS episodes have the same id on every device

- Surfaces: api, web, packages (helpers, parser-mapping, orm), database migration
- Change: Queue and playlist entries for Add by RSS episodes are identified by feed URL plus
  episode guid (or enclosure URL when the guid is missing or generated on the device), not by a
  per-device channel id. The API canonicalizes `feed_url` in `add_by_rss_resource_data` (drops
  `user:pass@`, normalizes the host) and recomputes the id. Adding the same episode from a second
  device moves the existing queue or playlist entry instead of duplicating it. Entries saved
  without a feed URL keep their old id; adding one of those again with a feed URL rewrites it to
  the new id. Likes and resume positions on web match both ids. Removing an unknown Add by RSS
  entry succeeds instead of failing.
- Who notices: anyone using Add by RSS on more than one device
- Operator steps: app migration `0020_add_by_rss_feed_identity.sql` rehashes stored queue and
  playlist rows that carry `feed_url` and removes the duplicates the rehash would create (keeping
  the queue row with the most progress and the earliest playlist row, and lowering playlist item
  counts to match). `API_EXPECTED_MIGRATION_FILENAME` moves to `0020_add_by_rss_feed_identity.sql`
  in the API env and the ops kustomization; the management-api marker is unchanged because its
  migrations live in the management database.

## Mobile records Add by RSS listening

- Surfaces: mobile
- Change: Playing an Add by RSS episode on the phone saves now-playing and position to the
  account, including when offline (sent after reconnect). Web and other devices can pick up where
  the phone left off. A now-playing Add by RSS episode from another device can be resumed on the
  phone even before this phone has parsed that feed.
- Who notices: anyone using Add by RSS on the phone and another device
- Operator steps: ships in the next store build

## Mobile Add by RSS details that ride with recorded listening

- Surfaces: mobile
- Change: The phone's md5 now matches the server's. Its pure-JS md5 encoded the input length
  wrongly, so every non-empty hash differed; nothing on the phone used md5 until Add by RSS ids,
  so no stored value changes. Finishing or skipping an Add by RSS episode moves it to queue
  history on the account, and queue advance reads the queue the episode played on (its medium, or
  the podcast queue). The handoff prompt names an Add by RSS episode by its title, or "Add by RSS"
  when no title is known, never by its id. Loading another device's Add by RSS episode at startup
  stays paused instead of starting playback. Queue and playlist adds send the feed URL without
  `user:pass@`.
- Who notices: anyone using Add by RSS on the phone with another device
- Operator steps: ships in the next store build

## Add by RSS helpers no longer pull Joi into client bundles

- Surfaces: web, mobile (through `@podverse/parser-mapping`)
- Change: The Add by RSS queue and playlist helpers import feed URL canonicalization from the
  client entry of `@podverse/helpers-validation` instead of its main entry, which also loads Joi.
  Web and mobile client bundles drop the Joi dependency this path had added.
- Who notices: no one directly; smaller client bundles
- Operator steps: none

## Add by RSS feeds show real names and refresh on their own

- Surfaces: workers, web, orm
- Change: After each parse, the server saves the feed's title and artwork on the follow, so other
  devices show real names before they parse. Web parses a newly seen feed on its own, including
  when its page is opened directly, and refreshes followed feeds in the background for members
  (at most every 30 minutes per account, on page load and when the tab becomes visible again).
  Free accounts still get the first parse of newly seen feeds. A feed marked as needing
  credentials waits until this browser has them. Pages update in place when a parse finishes,
  and a feed page with no episodes yet shows its parse status. The web E2E API profile raises
  the Add by RSS enqueue limit, because every fresh browser now first-parses the seeded follows.
- Who notices: anyone who adds a feed on one device and opens another
- Operator steps: none

## Web picks up Add by RSS listening from the phone

- Surfaces: web, packages (parser-mapping)
- Change: When the account's now-playing episode is from an Add by RSS feed played on another
  device, web loads it in the player at the same position, even before this browser has parsed
  the feed. Title, artwork, and notes fill in once the feed is parsed, without restarting audio.
  Web finds the episode in its own copy of the feed by feed URL and guid (or the enclosure URL
  when the guid was made up on the other device), so it no longer depends on the other device's
  item id. Episodes rebuilt from a queue row's stored bundle keep the feed URL, so they stay the
  same queue entry instead of being saved as a second one. A feed the account does not follow is
  not parsed or followed for the user; the episode keeps the row's title.
- Who notices: anyone switching from the phone to web with an Add by RSS episode
- Operator steps: none

## Web explains playback failures

- Surfaces: web, i18n catalog (playback error copy now shared by web and mobile)
- Change: When something cannot play, it stays in the player and the play button becomes an
  error icon. Pressing it explains why, with a details line, Try Again, Open Media Link, and
  Cancel. The error is announced to screen readers. Playback never skips ahead on its own after
  an error. Password-protected feed failures use this instead of a toast.
- Who notices: anyone whose episode fails to play on web
- Operator steps: none

## Web plays and shows media from hosts that block websites at a redirect

- Surfaces: web, packages (helpers-backend, ui), test-assets
- Change: Some hosts (Muse AI) block browsers at a redirect even though the final file allows
  them. After a failed load, web asks a new server route for the final address and loads it
  directly. No audio passes through Podverse servers, every hop is SSRF-checked, and credentials
  are never sent. When the final host blocks too, the player explains it.
- Who notices: listeners of Muse AI feeds and similar hosts on web
- Operator steps: none; the route is rate-limited with the existing proxy limiter

## A rejected Add by RSS password stays explained

- Surfaces: web
- Change: Adding a protected feed with the wrong password keeps the rejection on the credentials
  page. A background refresh no longer starts a second parse of a feed this page already queued,
  and syncing follows no longer overwrites that feed's parse result with an older copy.
- Who notices: someone who adds a username-and-password feed with the wrong password
- Operator steps: none
