# Request: Add by RSS parity, item list rows, and web background activity

Input for `./scripts/abcplan/run.sh plan add-by-rss-parity`. See the **abcplan** skill.

## Request

The operator's words, verbatim, split into paragraphs.

The AdByRSS feeds should also be loaded on your home screen. There should also be the dedicated
AdByRSS screen, which only shows AdByRSS feeds, but they should also be on your home screen in
Podverse Mobile.

Also, when I swipe left on the Ad by RSS list row, it should reveal an unsubscribe button just
like the non Ad by RSS feeds.

Also, it appears that there are significant differences between the Add by RSS detail pages. For
example, the header looks very different, but it should look identical to the separate normal
server-side database non-Add by RSS. Content detail pages for both channel and item-level detail.

Also, I see feed username and password is in the header, but that should be put behind the
settings in the case of Add by RSS. And those inputs should just always be visible within the
settings on the detail of the channel of the Add by RSS.

Also on all of the item list rows that I am seeing, the date is very tiny. We should never be
using a font that tiny unless it's a very, very specific situation. So increase the size of the
date on list rows and also reduce the spacing between the list row item title and the item pub
date. Do this for regular and add by RSS list rows.

Also... When in grid view, tapping and holding should pop up a menu that has the same options
that will be available when you swipe left on a list row. So, I think currently the only option is
unsubscribe. So, when I tap and hold on a grid view, it should pop up unsubscribe and cancel as
buttons from the bottom of the screen using the common component we have for that.

When making the size of the date that appears in the other list views, like I was saying earlier,
you should try to make it consistent with how dates appear in other list views. Like how a date
that appears at the top of a channel list row. The spacing between elements should also be
comparable to the spacing between the text rows in channel list rows. The description text in an
item list row should also be larger, but it should not be bold. It should be just a size larger or
so. It shouldn't be as tiny as it is now.

Also, I am unsure but does the add by RSS detail channel for the item list rows does it display a
blue dot next to new content? Do any of the list rows display the blue dot to the right of
content? That blue dot on channel. Detail pages for their item list rows should go to the right of
the title of the list row in the upper right corner. It should be aligned to the top of the text
in that top. Text section of the item list row, and it should fill up vertically the space of that
top text row, but it should not impede upon the pub date or description or progress bar section
below that.

Also, both mobile and web should include AdByRSS on the home screen in addition to the separate
AdByRSS page, which the separate AdByRSS page will only have AdByRSS feeds, but the home page
should be a combination of the normal server side content and the AdByRSS content.

Also, in the mobile app, when I test an add by RSS list item row, it seems to play that content
immediately, but it should open a detail page for that item. At least for the podcast use case, we
have a distinction in the way UX is handled where music, if I were to click a track, I would not
expect it to open a detail page for the track, but if I click an episode, I would expect it to
open the detail page of that episode, unless I press the play button specifically on an episode
list item row.

Also, it is unclear to me if the Time duration is set for the add by RSS list rows in mobile. It
might be that I'm just not seeing it because I'm using a feed currently that may not have
durations. But if a duration is present, we do want that duration to display to the right of the
play button in the episode item row.

And also, there should be a more button for the add by RSS rows comparable to how they are for
the non add by RSS content. As I understand, add by RSS content with our infrastructure schema
should be able to support things like add to queue and possibly other things. Figure out what it
can support. We should be maximizing the consistency and also reusing where possible the
components. You can look to the web perhaps for more of an example of how this can be done.

Also, on the website, we want to add some sort of overlay on the page that displays when
background processes are happening, just like how the mobile app has. It should happen in a fixed
place in the bottom right of the screen, and it should be its own overlay. That if the user
clicks, it will expand to the left to display the message, filling a minimum and maximum width.
And that should be in a position that is high enough that whether the mini player on the bottom of
the screen is there or not, the loading spinner should still appear over that position so it
shouldn't be overlapping with the mini player or the clip chapter component that is above it. The
browser should remember whether or not the user last had that component expanded or not and on
page load, it should display with it expanded or collapsed depending on the last remembered state.
It should be collapsed by default. I'm not sure what we want to include on it. We don't want to
include too much, but I do think we want to include add by RSS to let the user know when add by
RSS feeds are being refreshed in the web browser. We don't want that loading spinner to appear if
there are no conditions by which a loading spinner should appear in the screen. So, if the user
has no add by RSS feeds, they should not see that loading spinner.

It seems like AddByRSS is also missing chips at the top, potentially. Not all chips may be
supported by AddByRSS but add as much parity for what can be supported by our infrastructure.
Make sure those are a part of it. It also seems like the spacing below the recent chip is wrong.
And actually, that shouldn't even be a recent chip, it should be a sorting chip. That is a lack of
parity with the non-add-by-RSS Channel detail screen. Remember, we want as much parity as we can
reliably support between add-by-RSS and non-add-by-RSS content. So, reuse components and layouts.
Look to how the web has a process of layers to reusability for its media components like that for
list rows and grids and such.

Also, when a user taps on the media player in mobile, it takes them to. If you click the channel
title, it takes them to the channel. If you click the item title, it takes you to the item within
the home if it is subscribed to and downloaded, or it takes them within browse if it is not
subscribed to. If the user clicks the channel, that is fine, but it's working fine as it is. But
right now, if they click the item, it takes them directly to the item detail page when actually it
should navigate them to the channel detail page and then navigate them to the item detail page. So
it is within that hierarchy of the navigation stack.

## Operator answers

- **Web background-activity overlay contents.** Add by RSS feed refreshes are included. The
  planner also lists the other web background work it finds, with what each would show. The
  operator decides on each before any of it goes into a plan. That step reports BLOCKED with the
  list once everything else in its area is planned.
- **Item list row typography and layout** (larger date and description, tighter spacing between
  title and pub date, the new-content dot placed in the upper right of the title block): **mobile
  only**. Web item rows are out of scope for these changes.
- **R38 (overlay contents).** Add by RSS only. No other web background work joins the overlay.

### Review of the first planning pass

The operator reviewed every plan and open question after the first Close. These answers are
final.

**Web navigation and Home (replaces the first web Home plans, 60 and 61).**

- The web sidebar becomes **Subscribed** (Home) and **Browse**, which replace the Podcasts and
  Music sections. Library and Search stay. Add by RSS becomes one link inside Library that opens
  an Add by RSS chips page, replacing the six Add by RSS sidebar links.
- Each of those pages shows chips the way mobile does, for consistency and clarity:
  - **Subscribed (Home):** mobile Home's chips (Podcasts, Episodes, Clips, Artists, Albums,
    Tracks) plus Livestreams. Each chip lists the account's server follows and this browser's
    Add by RSS follows together. Clips is server only, because Add by RSS feeds have no clips.
    The All/Podcasts/Music dropdown goes away; the chips replace it, and no Music chip is needed.
  - **Browse:** mobile Browse's chips (Podcasts, Episodes, Clips, Artists, Albums, Tracks,
    Playlists, Users) plus Livestreams. Server content only.
  - **Add by RSS page:** Add by RSS feeds only (Podcasts, Episodes, Artists, Albums, Tracks) plus
    Livestreams.
- The old list URLs are **removed** (not found) and taken out of the sitemap: `/podcasts`,
  `/episodes`, `/clips`, `/artists`, `/albums`, `/tracks`, `/podcasts/livestreams`,
  `/music/livestreams`, and the `/add-by-rss/<list>` pages. Detail routes stay.

**Livestreams chip (web and mobile).**

- A Livestreams chip on Subscribed/Home, Browse, and the Add by RSS library, on **both web and
  mobile**. Any of them can contain livestreams; livestream support may need improving.
- The chip lists livestream **items**, not channels, so each row links straight to the
  livestream. Live now comes first and is marked as live; scheduled livestreams follow. Ended
  livestreams are not listed.
- Channels get a remembered **"may have livestreams"** flag: once a livestream appears in a feed
  at least once, it stays set, for filtering channels later. Today the parser archives a live
  item when it leaves the feed, so nothing remembers it. Add by RSS feeds keep the same flag on
  the device.

**Add by RSS items (mobile).**

- Add by RSS music track rows also offer **Add to Playlist** and **Mark as Played**, not only
  Queue Next, Queue Last, and Download.
- The Add by RSS episode page also gets **Chapters** and **Transcript**, including the mobile
  work to load them for Add by RSS items.

**Gaps the first pass left out: fix all three in this set.**

- A playing Add by RSS row shows pause and progress like other rows. The playback target reports
  the feed's id instead of the item's today.
- The full player offers queue actions for Add by RSS items. `resolveQueueMutationTarget` returns
  null for that kind today.
- On web, the background refresh and a page syncing at the same moment no longer collide on the
  unique `feedUrl` index in IndexedDB.

**Planner choices the operator confirmed (keep as written; not open questions).**

- Plan 20: the Add by RSS channel page sorts Recent or Oldest (podcasts) and Forward or Backward
  (music), with no A-Z.
- Plan 41: mobile Home's Episodes and Tracks chips include Add by RSS items; each source keeps
  its own newest 60; unranked Add by RSS items follow ranked items under Popularity.
- Plan 31: with Offline Mode on, Add by RSS plays downloads only, including from the queue and
  playlists.
- Plan 43: long-press on a Home "Downloaded only" tile offers Delete All.
- Plan 71: the overlay sits above the player plus the reserved 28px strip.
- Plans 21 and 22: a download whose episode left the feed stays off the Downloaded chip;
  pull-to-refresh without membership only re-reads the device copy; typed credentials stay in
  the fields after Save and Check.
- Plan 42: "Needs username and password" rows get no swipe.
- Plans 70 and 71: the overlay is hidden for accounts with no Add by RSS follows while the work
  still runs, and it stacks at `z-index: 150`.

### Review of the second planning pass

The operator answered every open question from the second Close, one at a time. These answers
are final. Quoted lines are the operator's words.

**Full player (plan 91).** Keep plan 91 as written: it fixes Mark as Played / Unplayed for Add by
RSS, which is the only full player action normal items have that Add by RSS lacks. "The 'add to
queue' features should never appear on the full player. It doesn't make sense for them to go
there because the currently playing item is already playing so adding it again into the queue
doesn't make sense." R57 means that, not new Queue Next / Queue Last buttons.

**Home episode and track rows (mobile, plan 41).** "Add Mark as Played to every Home episode and
track row, regular and Add by RSS. … I think we also want download, although, we should be
talking about items and not channels in that case. I think we should support share except not for
add by RSS."

- Every Home Episodes and Tracks row, regular and Add by RSS, offers Mark as Played and Download
  (the one-tap download control plus the More menu entry, as podcast episode rows have).
- Regular rows also offer Share. Add by RSS rows do not (they have no public page).
- The Podcasts, Artists, and Albums chips get no download action; they keep their downloaded
  count. Clips is unchanged.
- The server already stores Add by RSS history (`POST /queue/:id/item-add-by-rss/history` with
  `completed`), so no API change.

**Livestreams chip (plans 83–86).**

- One chip covers every medium, with no sort, range, category, or view controls, placed right
  after Tracks on every surface. Confirmed as planned.
- Rows offer no Queue Next, Queue Last, Add to Playlist, or Mark as Played. Regular (database)
  livestream rows offer Share; Add by RSS livestream rows offer nothing extra.
- Offline Mode: Home's Livestreams chip shows the unavailable message; the Add by RSS library's
  Livestreams chip still lists stored rows. Confirmed as planned.
- Web Subscribed merges Add by RSS livestreams into page 1 only. Confirmed as planned.
- The server flag is set by a live item of any status, and the migration backfills it from every
  existing live item. Confirmed as planned.

**Mobile Add by RSS livestream page (new).** Mobile gets an Add by RSS livestream page, the
counterpart of web's `/add-by-rss/podcast/livestream/[id]` and the regular livestream page. Add by
RSS livestream rows, live or scheduled, open it the way regular livestream rows open theirs; the
row's play button plays a live one. This replaces plan 86's choice (live row plays on tap,
scheduled row opens the feed page).

**Web Subscribed Episodes and Tracks (plan 66).** Under Recent, Add by RSS items mix into page 1
by date; under Top, they come after the last server page. Confirmed as planned.

**Livestreams are a flag, never a medium or a feed type.** "Feeds of type livestreams do not
always and not exclusively have livestreams. The livestream designation is a flag in addition to
their designation as a podcast, video, music, etc." And: "make sure non-add by RSS is consistent
with this understanding of a livestreams flag not changing the fundamental 'medium' of a feed."

- A feed or channel stays on its medium's chips (Podcasts, or Artists and Albums), regular and
  Add by RSS. Its regular items show on Episodes or Tracks; its live items show on Livestreams,
  found through the "may have livestreams" flag and its live items, never through a resource type.
- Remove `'livestreams'` from `AddByRSSResourceType` (`packages/helpers/src/lib/addByRSS/types.ts`)
  and every branch that reads it (web `AddByRSSDetailClient` header and label branches,
  `getAddByRSSDetailRouteSegment`, mobile `isResourceType` and `addByRssLibraryFeedData.ts`). A
  stored value is read as `'podcasts'`. No feed is stored with that value today: the add page
  saves `'podcasts'`, and `getAddByRSSResourceTypeFromMappedFeed` returns only podcasts, artists,
  or albums.
- Regular content already follows this model (medium from the feed, live items in `live_item`,
  links built from medium plus `livestream`). Plan 80 states that the flag never changes medium,
  and no plan adds a livestream medium or channel type.

**Web Library (plan 68).** Remove the Profiles link from Library; profiles live under Browse ›
Users, as on mobile.

**Deferred gaps.**

- Add by RSS chapters and transcript in the full player: in this set.
- A mobile Add by RSS track page, with Go to Track on Add by RSS track rows wherever regular
  track rows offer it: in this set.
- Chapter artwork on private feeds: not in this set. A placeholder plan is saved at
  `.llm/plans/active/add-by-rss-private-chapter-artwork-deferred/`.

### Review of the third planning pass

The operator answered every open question from the third Close, one at a time. These answers
are final.

**Livestreams on the Add by RSS feed page.** The mobile podcast page lists the channel's
livestreams above Episodes; the mobile Add by RSS feed page does not. Add that section to the Add
by RSS feed page on mobile and on web. Its rows open the Add by RSS livestream page (mobile plan
89; web `/add-by-rss/podcast/livestream/[id]`). Add the section only where it is missing.

**Full player livestream titles.** A livestream's title in the full player links to its page,
for regular livestreams and Add by RSS livestreams. Today both are plain text.

**Existing mobile music feeds (plan 37).** Do not wait for the next refresh. A one-time local
pass sets each stored Add by RSS feed's type from the medium in its stored parsed bundle, with
no network request. If the stored bundle does not carry the medium, the planner reports BLOCKED.

**Plan 94's choices are confirmed:** Summary and People come in with R64; feeds this device has
not parsed get no Chapters or Transcript; a time in Summary seeks playback; music feeds use the
episode chip labels.

**Plan 87:** add the check that an Add by RSS feed with live items still shows on the
`/add-by-rss` Podcasts chip.

**Plan 44:** its Maestro step checks that the Download control and the More menu's Download entry
are shown on Home rows, without starting a download.

### Review of the fourth planning pass

The operator answered every open question from the fourth Close, one at a time. These answers
are final.

**Full player title color (plan 52 confirmed).** Regular livestream titles already link; they use
the plain title color, as episode and track titles do. Keep that. Plan 52 links Add by RSS
livestream titles and restyles no title.

**Ended livestreams on web Add by RSS feed pages.** Web's Add by RSS podcast, album, and artist
pages list livestreams by the channel endpoint's rules (`GET /live-item/channel/:id`): live first,
then scheduled, then items that ended within the last day, newest end first. Older ended items
are hidden. Use plan 95's shared `compareChannelLiveItems` and the same one-day cutoff
(`isLiveItemEndedAndStale`), so web and mobile Add by RSS and the podcast page agree.

**Scheduled and Ended on mobile channel pages.** Mobile livestream rows inside a channel (the
podcast page, the album page, and the Add by RSS feed page from plan 95) show "Scheduled" or
"Ended" on a line that stays visible inside a channel, as web's channel pages do with
`showLiveItemStatus`. Today the podcast page builds that label into the context line, which is
hidden inside a channel, so only the Live badge shows.

**Full player channel link for music-feed livestreams.** "The channel line will always be the
album title on our music experience." For a regular livestream on an album feed, the full
player's channel line shows the channel title (the album) and opens the album page, on Home when
the device follows the album and on Browse when it does not, as other channel links choose.
Opening it nested under the artist is later work, and artist (publisher) feeds are not planned
here: "we don't have to document and plan for it right now."

## Glossary

- "AdByRSS", "Ad by RSS", "add by RSS": Add by RSS, feeds the user adds by URL that are parsed on
  the device or in the browser rather than stored in the server database.
- "server-side", "normal", "non-Add by RSS": channels and items from the Podverse API database.
- "blue dot": the new-content indicator on item list rows.
- "the common component we have for that" (grid long-press): the shared bottom-sheet action menu
  on mobile.
- "clip chapter component": the clip and chapter bar that sits above the web mini player.

## Orientation

Facts checked when this request was written. Planners verify them before relying on them.

- `apps/mobile/src/screens/home/HomeScreen.tsx` already sends rows with `source === 'addByRss'`
  to `HOME_STACK_ROUTES.AddByRssPodcastDetail`. Find why Add by RSS feeds do not appear on Home
  for the operator before planning new wiring.
- `apps/mobile/src/screens/home/AddByRssHomeDetailScreen.tsx` is the mobile Add by RSS channel
  detail. It imports `SettingsOptionNavRow` and `SortSelectRow` from `components/form`.
- `apps/mobile/src/screens/rss/` holds the Add by RSS root, add, and credentials screens and
  `addByRssLibraryFeedData.ts`.
- `apps/web/src/app/HomePageClient.tsx` and `HomePageList.tsx` are the web home. They do not
  reference Add by RSS. The web Add by RSS page is `apps/web/src/app/add-by-rss/`.
- Guidance that applies: **add-by-rss-parity-sync**, **add-by-rss-components-sync**,
  **mobile-reusable-components**, **mobile-sync-orchestration**, **mobile-playback**,
  **ui-component-promotion**.
