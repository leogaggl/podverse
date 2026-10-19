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
- Change: `PODCAST_INDEX_DUPLICATE_MERGE_MODE=off` exits before the Podcast Index dead-feed CSV download.
  `dry_run` and `apply` upsert `detected` pairs for feeds we already have, after following
  duplicate chains and skipping cycles, dead-end survivors, and rows with no duplicate target.
  The hourly cron is no longer suspended. A `podcast_guid` unique collision leaves that column
  unset and does not fail the parse. Recent-feed enqueue skips feeds whose lifecycle is `merged`.
- Who notices: operators. Listeners see no merge yet.
- Operator steps: none until alpha is set to `dry_run` after reviewing counts. Base stays `off`.
  Add `PODCAST_INDEX_DUPLICATE_MERGE_MODE=off` to an existing local workers env if startup validation asks for it.

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
- Operator steps: `PODCAST_INDEX_DUPLICATE_MERGE_MODE` stays `off` until an environment is ready

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

## Full player Summary keeps even pane padding

- Surfaces: mobile
- Change: Summary and transcript in the full player keep the same inset under the text as above
  it. That bottom inset stays on the card while the text scrolls.
- Who notices: listeners reading the summary or transcript in the full player
- Operator steps: none

## Full player pane error stays inset

- Surfaces: mobile
- Change: The "Something went wrong" message and Try Again button in the full-player pane sit
  in from the left and right edges of the card. Chapter, clip, and summary content keep their
  own inset.
- Who notices: listeners when a full-player section fails to load
- Operator steps: none

## The phone keeps a show that was merged

- Surfaces: mobile, api
- Change: Subscriptions, downloads, and listening progress follow a show when its duplicate feed
  is merged. Downloaded audio is not fetched again. Signed-out subscriptions are included.
- Who notices: mobile listeners subscribed to a duplicate RSS feed
- Operator steps: none

## Operators can review show merges

- Surfaces: management-api, management-web
- Change: Duplicate feeds Podcast Index marked, but that do not clearly share episodes, wait in
  Merge Review. Approve lets the next apply run move them. Revert undoes an applied merge.
- Who notices: operators, not listeners
- Operator steps: none

## Full player type, range hyphen, and description clocks

- Surfaces: mobile, web, i18n
- Change: The full-player episode title is 24pt semibold and the chapter or clip line is 20pt
  regular, so the artwork square is wider. Chapter and clip ranges use a hyphen (`1:15:03 - 1:22:25`)
  in every locale. A clock in a full item description (including the collapsed preview) can be
  pressed to play that item from that time on mobile and web. Channel About and list previews stay
  plain text.
- Who notices: listeners on the full player, and anyone reading an episode, track, livestream, or
  clip summary
- Operator steps: none

## Description columns allow longer show notes

- Surfaces: ops (app DB migration 0016), k8s base api env
- Change: Feeds gain a description length tier override and truncation counts. Item and
  channel descriptions gain a plain preview, a truncated flag, and the source length, and the
  stored text may now exceed 10,000 characters (database cap 150,000).
- Who notices: operators. Listeners notice once the parser change ships.
- Operator steps: the API waits for 0016_description_length_tiers.sql. Changing value to text
  may rewrite item_description; deploy in a quiet window.

## Long show notes keep their formatting

- Surfaces: parser, workers, k8s base cron
- Change: Descriptions are sanitized to the supported tags and shortened at a paragraph or
  list-item boundary within the feed's tier (default 10,000 visible characters), so lists,
  headings, and links survive. Items prefer content:encoded. Plain-text notes keep their line
  breaks. Each feed records how many descriptions were shortened and the longest source.
  A feed-force-reparse scheduled job reparses one feed without sending new-episode
  notifications for items older than the job. ormDescriptionsBackfill repairs rows cut by the
  old 2,500-character limit and schedules throttled reparses.
- Who notices: listeners see full, formatted show notes. Operators get a backfill job.
- Operator steps: scheduledJobsRunDue now validates the full parser env, so the
  worker-scheduled-jobs CronJob mounts the MQ, Podcast Index, Add-by-RSS, and web push secrets
  like worker-recent-feeds. After deploy, run the suspended worker-descriptions-backfill
  CronJob by hand until it reports no feeds remaining.

## Admins can raise a feed's description length

- Surfaces: management-api, management-web
- Change: Flag Status shows how many of a feed's descriptions were shortened, the longest
  source, and the smallest tier that fits. Admins choose Standard (10,000), Extended (25,000),
  or Maximum (50,000). A change schedules a forced reparse. The directory can filter to feeds
  with shortened descriptions, sorted by longest source. `GET /feeds` accepts
  `description_truncated` and the `description_longest_source_length` sort; the PATCH
  `/feeds/:id/policy-state` body accepts `description_length_tier_override`; the lookup row
  carries the tier and truncation telemetry. The database table browser cannot change the tier.
- Who notices: operators

## Item show notes endpoint

- Surfaces: api
- Change: GET /item/:idOrIdText/description returns one item's full show notes, a plain
  preview, whether the notes were shortened, and the item link. List responses now include
  preview and is_truncated on item_description. A merged episode answers 410 with
  `merged_into`, like the detail route; an item with no notes answers 200 with null fields.
- Who notices: API clients; the apps use it to load notes on demand

## Web shows when show notes were shortened

- Surfaces: web
- Change: Episode, track, and livestream Summary and channel About show "Read Full Show Notes"
  or "Read Full Description" linking to the episode or show website when Podverse shortened the
  notes, or a short sentence when there is no link. List rows use the stored preview. Add-by-RSS
  episode, track, podcast, album, and artist pages show the same notice from the parsed feed.
- Who notices: web listeners on episodes with very long notes

## Mobile loads full show notes on demand and keeps them offline

- Surfaces: mobile
- Change: List rows use a short stored preview. The full player loads show notes from a small
  on-device cache that warms when an episode starts playing and is kept for downloaded
  episodes, so notes are available offline. Summary shows "Read Full Show Notes" when Podverse
  shortened the notes, and channel About says the description was shortened. New SQLite table
  item_description_cache (migration 23). The notes read is the public
  `GET /item/:id/description`, sent without a bearer so download completion can use it too.
- Who notices: mobile listeners, especially offline with downloads

## Archived episodes and shows record when they were slimmed

- Surfaces: ops (migration)
- Change: New nullable item.archived_slimmed_at and channel.archived_slimmed_at, plus a partial
  index on unslimmed archived items. No behavior change on its own.
- Who notices: operators (one migration)
- Operator steps: deploy; the API waits for the new marker

## Archived episodes and shows keep only what clips and playlists need

- Surfaces: workers (archiveAll), orm, parser
- Change: archiveAll now deletes transcripts, chapters, people, value, funding, soundbites not
  in a playlist, and the other detail rows from archived episodes, and reduces their notes to
  the 400-character preview. Archived shows keep only title, image, About, and a preview. The
  data returns on the next parse if the episode or feed comes back. Fixes a takedown cleanup
  failure for shows whose trailers belong to a season. New ormArchivedSlimReport command.
- Who notices: operators (database size); users see shorter notes on archived episodes, with a
  link to the full notes
- Operator steps: run ormArchivedSlimReport before and after the next archiveAll runs

## Clip pages show the episode summary

- Surfaces: web
- Change: A clip page shows the episode Summary under the clip header, including the shortened-notes
  link when the stored description was cut.
- Who notices: listeners opening a clip, including a clip of an archived episode
