## Checkout channel enable reports whether it turned the channel on

- Surfaces: orm, workers
- Change: `BillingCheckoutChannelService.enableIfDisabled` reads the id TypeORM returns from a Postgres `UPDATE ... RETURNING`. The enable command's `changed` log matches whether that update turned a disabled channel on.
- Who notices: operators running the billing checkout-channel enable command

## Popularity and terms gates keep the choice under the explanation

- Surfaces: web
- Change: On the popularity-tracking gate and the terms gate, How It Works and View
  Terms of Service open above the choice buttons. The terms date sits under that
  disclosure title.
- Who notices: someone deciding on Popularity Tracking, or accepting updated terms, on
  the website

## Signature theme is named Podverse

- Surfaces: web, management-web, mobile
- Change: The built-in theme whose id is `dark` is labeled Podverse in every language.
  The id, CSS attribute, and saved preference stay `dark`.
- Who notices: anyone choosing a theme in Settings

## Chapter title above the mini player uses the full strip width

- Surfaces: mobile
- Change: The clip or chapter title above the mini player no longer has horizontal padding, so the scrolling title runs to both edges of the strip.
- Who notices: listeners watching a chapter or clip title scroll above the mini player

## Mini player channel title sits 1pt higher

- Surfaces: mobile
- Change: The channel title in the mini player paints 1pt above its layout slot. The item title
  above it keeps its position.
- Who notices: listeners looking at the mini player

## Show rows sit closer together

- Surfaces: mobile
- Change: Podcast, album, and artist list rows (Home, Browse, Search, Add by RSS) use a 10pt
  band above and below the 78pt artwork, and a tighter gap between the date, title, and footer,
  so the row is 98pt. Episode, clip, and track rows keep the taller padding.
- Who notices: anyone scrolling a podcast, album, or artist list

## Show-row titles use a regular weight

- Surfaces: mobile
- Change: The title on a podcast, album, or artist list row is regular weight (400) instead of
  the semibold it inherited from the subheading style. Date and footer weights stay as they are.
- Who notices: anyone reading a podcast, album, or artist list

## Player marquees rest between passes and take turns

- Surfaces: mobile
- Change: a scrolling title in the mini player or full player now rests on its first words for
  2.5 s before every pass instead of looping nonstop. When the episode title and the clip or
  chapter title both overflow, only one scrolls at a time, and they alternate after each pass.
  Speed is unchanged. Reduce Motion still turns scrolling off.
- Who notices: listeners with long episode or chapter titles, especially with the mini player
  visible for long sessions
- Operator steps: none

## Chapter title rests inset, then scrolls to the strip edge

- Surfaces: mobile
- Change: The clip or chapter title above the mini player still runs to the strip edges while it
  scrolls. At rest, a chapter title's first word sits 16pt in from the leading edge, the same
  inset as the other bottom strips, and that space scrolls away with the title. A clip icon sits
  at that same inset, with the title after it.
- Who notices: listeners reading a chapter or clip title above the mini player
- Operator steps: none

## Full player scrolls without a scrollbar

- Surfaces: mobile
- Change: The full player still scrolls the player region up and the pane (Summary, chapters,
  clips, transcript) inside the sheet. Neither scroller draws the vertical scroll indicator.
- Who notices: listeners scrolling the full player on a phone
- Operator steps: none

## Channel settings open from the channel header

- Surfaces: mobile
- Change: Podcast, album, and artist detail open settings from a gear at the top right of the
  channel header, including when nobody is signed in. It is not a section chip and not a stack
  title control. Check Feed, notification switches, and Auto Download open the login prompt on
  press. After sign-in, Auto Download still says it is not available yet.
- Who notices: someone browsing a channel in Podverse Next
- Operator steps: none

## Channel merge tables and merged feed lifecycle

- Surfaces: orm, api, k8s
- Change: App migration `0015_channel_merge.sql` adds `channel_merge`, `item_merge_map`,
  `channel_merge_journal`, and `podcast_index_dead_feed_sync`, and seeds feed lifecycle state
  `merged`. A feed in `merged` is not parsed and is not public. Nothing writes that state yet.
  API readiness waits on `0015_channel_merge.sql`.
- Who notices: operators applying the app database migration
- Operator steps: none beyond the normal migration apply

## Player title links follow the subscription

- Surfaces: mobile
- Change: Tapping the item title or the channel title on the full player opens that screen on
  Home when this device follows the channel, and on Browse when it does not. Add by RSS opens
  the feed on Home. A hidden Home or Browse tab opens on More, and Back returns to More.
- Who notices: listeners who tap the episode, track, clip, or channel title in the full player
- Operator steps: none

## Duplicate episode matching ignores repeated GUIDs

- Surfaces: orm
- Change: Duplicate-feed episode matching pairs unique GUIDs, then unique enclosure URLs after
  known tracking prefixes are removed, then title plus publish date plus duration together.
  A pair is verified when 80% of the smaller episode set matches and at least 3 episodes match,
  or when one episode matches and the feeds share a podcast GUID, an iTunes id, or a self link.
  The current deduplicator uses the GUID and enclosure rules. No merge is applied yet.
- Who notices: no listener change until a merge runs
- Operator steps: none

## Full player Summary fills the sheet

- Surfaces: mobile
- Change: The collapsed Summary on the full player is long enough to fill the pane and run a
  little past it. Show more sits just below the fold, so a short scroll reaches it. Expanding
  still loads the rest of the description.
- Who notices: listeners reading a long episode summary in the full player
- Operator steps: none

## Title bar buttons sit further apart

- Surfaces: mobile
- Change: Buttons in the top-right of the title bar (podcast, album, and artist share /
  notifications / boost, Add by RSS add and view menu, and the full player action row) have an
  8pt gap between them.
- Who notices: listeners using a screen with more than one button in that corner
- Operator steps: none

## Dead-feed job records duplicate pairs only

- Surfaces: workers, external-services-podcast-index, mq, parser, k8s
- Change: `PI_DUPLICATE_MERGE_MODE=off` exits before the Podcast Index dead-feed CSV download.
  `dry_run` and `apply` upsert `detected` pairs for feeds we already have, after following
  duplicate chains and skipping cycles, dead-end survivors, and rows with no duplicate target.
  The hourly cron is no longer suspended. A `podcast_guid` unique collision leaves that column
  unset and does not fail the parse. Recent-feed enqueue skips feeds whose lifecycle is `merged`.
- Who notices: operators. Listeners see no merge yet.
- Operator steps: none until alpha is set to `dry_run` after reviewing counts. Base stays `off`.
  Add `PI_DUPLICATE_MERGE_MODE=off` to an existing local workers env if startup validation asks for it.

## Channel header title and subscribe stay inside the artwork

- Surfaces: mobile
- Change: Podcast, album, and artist headers are a title row (two lines, then an ellipsis) and a
  subscribe row pinned to the bottom of the artwork. A one-line title and a two-line title keep
  Subscribe in the same place. The settings gear is smaller and lines up with the top of the title.
  An author line under an artist name keeps the title to one line so that row still fits.
- Who notices: listeners on a channel screen, especially when the name wraps
- Operator steps: none

## Full player lists start at the pane edge

- Surfaces: mobile
- Change: Chapters, clips, and official clips in the full-player pane start at the top of the
  rounded sheet and run to the bottom. The first and last rows follow the sheet's rounded corners.
- Who notices: listeners on the full player Chapters, Clips, or Official Clips tab
- Operator steps: none

## Full player chapter marks are thin lines

- Surfaces: mobile
- Change: Chapter boundaries on the full-player progress bar are 2pt yellow rectangles that
  fill the height of the track, in the same places as the previous dots.
- Who notices: listeners playing an episode that has chapters
- Operator steps: none

## First parse skips new-episode side effects

- Surfaces: parser
- Change: The first successful parse of a channel with no stored episodes saves those episodes
  and does not send a new-episode notification or an auto-download push. A later parse that
  finds a genuinely new episode still does both. `suppressNewItemSideEffectsPublishedBeforeMs`
  on the parse options drops items whose `pub_date` is missing or earlier than that instant
  from those two side effects. A `pub_date` equal to the instant is kept. Live and remote-item
  notifications are unchanged.
- Who notices: listeners on a newly added show. A later merge reparse can pass the cutoff so
  episodes published before that instant are not notified or auto-downloaded.
- Operator steps: none

## Full player pane shows a vertical scroll bar

- Surfaces: mobile
- Change: The full-player content pane (Summary, clips, chapters, and the other section bodies)
  draws a vertical scroll indicator when that body is taller than the sheet. On iOS the thumb is
  the light system pill on dark themes and the dark pill on light themes, so it reads against the
  sheet. The player column above it still hides its indicator.
- Who notices: listeners scrolling Summary, chapters, or clips on the full player
- Operator steps: none

## Chapter and clip glow on the progress bar has square edges

- Surfaces: mobile
- Change: The pulsing band behind the current chapter or clip on the full-player progress bar
  uses square corners.
- Who notices: listeners playing a chapter or clip on the full player
- Operator steps: none

## Duplicate Podcast Index feeds collapse onto one show

- Surfaces: workers, orm, api
- Change: When Podcast Index marks a feed as a duplicate, Podverse either re-points the feed we
  already have or moves follows, queue progress, clips, and playlists onto the surviving channel.
  The old channel stops parsing. Pairs that do not look like the same episodes wait for review.
- Who notices: listeners who followed a duplicate RSS URL; operators reviewing merges
- Operator steps: `PI_DUPLICATE_MERGE_MODE` stays `off` until an environment is ready

## Chapter and clip titles stay in place when the chapter changes

- Surfaces: mobile
- Change: A chapter or clip title in the player no longer appears offset after the chapter
  changes. Each title measures itself from scratch and starts its scroll at the first word.
- Who notices: listeners skipping chapters on the full player, the mini player, or the chapter
  strip above the mini player
- Operator steps: none

## Old links follow a merged show

- Surfaces: api, web
- Change: Opening a show or episode that Podcast Index merged into another show lands on the
  surviving show. Episode links that have no match on the survivor still play.
- Who notices: anyone with a bookmark or shared link to a duplicate feed
- Operator steps: none
