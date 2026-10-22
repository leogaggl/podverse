# Summary: Add by RSS parity, item list rows, and web background activity

Plan set for [00-REQUEST.md](00-REQUEST.md). Models and run order live in `COPY-PASTA.md` once
the planning run assembles it; this file does not name a model per plan.

Scope decisions from the operator answers:

- Item list row typography and layout (date size, description size, title-to-date spacing, the
  new-content dot position) is **mobile only**. Web item rows are out of scope for those rows.
- The web background-activity overlay includes Add by RSS feed refreshes only (R38).
- After the first planning pass the operator reviewed every plan. Their answers are in
  `00-REQUEST.md` § Review of the first planning pass: web moves to Subscribed and Browse chips
  pages (area F, re-planned), a Livestreams chip on web and mobile (area H), more Add by RSS item
  actions and episode sections (area C, amended), and three gaps (area I). Planner choices listed
  there as confirmed are not open questions.
- After the second planning pass the operator answered every open question. Their answers are in
  `00-REQUEST.md` § Review of the second planning pass. They add rows R59–R66 (third pass below)
  and settle every planner choice the second Close listed; none of those is an open question now.
- After the third planning pass the operator answered every open question. Their answers are in
  `00-REQUEST.md` § Review of the third planning pass. They add rows R67–R71 (fourth pass below)
  and confirm plan 94's choices.
- After the fourth planning pass the operator answered every open question. Their answers are in
  `00-REQUEST.md` § Review of the fourth planning pass. They add rows R72–R74 (fifth pass below)
  and confirm that plan 52 restyles no title.

Parity source: for Add by RSS versus database content, the non-Add-by-RSS screen or row is the
source of truth (**add-by-rss-parity-sync**, **add-by-rss-components-sync**).

## Requirement ledger

Each row quotes the request. The **Plan** column is filled by the area step that owns the row.

| Row | Request words                                                                                                                                                                      | Area | Plan                                                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | "The AdByRSS feeds should also be loaded on your home screen" (mobile; Home is a combination of server-side and Add by RSS content, see R22)                                       | D    | 40-home-add-by-rss-channels.md, 41-home-add-by-rss-items.md                                                                                           |
| R2  | "There should also be the dedicated AdByRSS screen, which only shows AdByRSS feeds" (mobile)                                                                                       | D    | 40-home-add-by-rss-channels.md                                                                                                                        |
| R3  | "when I swipe left on the Ad by RSS list row, it should reveal an unsubscribe button just like the non Ad by RSS feeds"                                                            | D    | 42-add-by-rss-library-swipe.md                                                                                                                        |
| R4  | "the header looks very different, but it should look identical to the separate normal server-side database non-Add by RSS" — channel-level detail                                  | B    | 20-add-by-rss-detail-shell.md                                                                                                                         |
| R5  | Same header parity for "item-level detail"                                                                                                                                         | C    | 32-item-detail-header.md, 33-add-by-rss-episode-detail.md                                                                                             |
| R6  | "feed username and password is in the header, but that should be put behind the settings in the case of Add by RSS"                                                                | B    | 22-add-by-rss-detail-settings.md                                                                                                                      |
| R7  | "those inputs should just always be visible within the settings on the detail of the channel of the Add by RSS"                                                                    | B    | 22-add-by-rss-detail-settings.md                                                                                                                      |
| R8  | "increase the size of the date on list rows" (item list rows, mobile only)                                                                                                         | A    | 10-item-row-type-and-dot.md                                                                                                                           |
| R9  | "reduce the spacing between the list row item title and the item pub date"                                                                                                         | A    | 10-item-row-type-and-dot.md                                                                                                                           |
| R10 | "Do this for regular and add by RSS list rows"                                                                                                                                     | A    | 10-item-row-type-and-dot.md                                                                                                                           |
| R11 | "When in grid view, tapping and holding should pop up a menu that has the same options that will be available when you swipe left on a list row"                                   | D    | 43-grid-long-press-menu.md                                                                                                                            |
| R12 | "pop up unsubscribe and cancel as buttons from the bottom of the screen using the common component we have for that"                                                               | D    | 43-grid-long-press-menu.md                                                                                                                            |
| R13 | "make it consistent with how dates appear in other list views. Like how a date that appears at the top of a channel list row"                                                      | A    | 10-item-row-type-and-dot.md                                                                                                                           |
| R14 | "The spacing between elements should also be comparable to the spacing between the text rows in channel list rows"                                                                 | A    | 10-item-row-type-and-dot.md                                                                                                                           |
| R15 | "The description text in an item list row should also be larger, but it should not be bold. It should be just a size larger or so"                                                 | A    | 10-item-row-type-and-dot.md                                                                                                                           |
| R16 | Question: "does the add by RSS detail channel for the item list rows ... display a blue dot next to new content?"                                                                  | A    | 10-item-row-type-and-dot.md                                                                                                                           |
| R17 | Question: "Do any of the list rows display the blue dot to the right of content?"                                                                                                  | A    | 10-item-row-type-and-dot.md                                                                                                                           |
| R18 | "That blue dot on channel. Detail pages for their item list rows should go to the right of the title of the list row in the upper right corner ... aligned to the top of the text" | A    | 10-item-row-type-and-dot.md                                                                                                                           |
| R19 | "it should fill up vertically the space of that top text row, but it should not impede upon the pub date or description or progress bar section below that"                        | A    | 10-item-row-type-and-dot.md                                                                                                                           |
| R20 | "both mobile and web should include AdByRSS on the home screen in addition to the separate AdByRSS page" (web; mobile is R1)                                                       | F    | 65-web-subscribed-add-by-rss-channels.md, 66-web-subscribed-add-by-rss-items.md, 69-web-chips-e2e.md                                                  |
| R21 | "the separate AdByRSS page will only have AdByRSS feeds" (web; mobile is R2)                                                                                                       | F    | 67-web-add-by-rss-chips-page.md                                                                                                                       |
| R22 | "the home page should be a combination of the normal server side content and the AdByRSS content" (web; mobile Home follows the same rule under R1)                                | F    | 64-web-subscribed-page.md, 65-web-subscribed-add-by-rss-channels.md, 66-web-subscribed-add-by-rss-items.md                                            |
| R23 | "when I tap an add by RSS list item row, it seems to play that content immediately, but it should open a detail page for that item" (podcast episodes)                             | C    | 34-add-by-rss-item-rows.md                                                                                                                            |
| R24 | "music, if I were to click a track, I would not expect it to open a detail page for the track"                                                                                     | C    | 34-add-by-rss-item-rows.md                                                                                                                            |
| R25 | "if I click an episode, I would expect it to open the detail page of that episode, unless I press the play button specifically on an episode list item row"                        | C    | 34-add-by-rss-item-rows.md                                                                                                                            |
| R26 | Question: "it is unclear to me if the Time duration is set for the add by RSS list rows in mobile"                                                                                 | C    | 34-add-by-rss-item-rows.md                                                                                                                            |
| R27 | "if a duration is present, we do want that duration to display to the right of the play button in the episode item row"                                                            | C    | 34-add-by-rss-item-rows.md                                                                                                                            |
| R28 | "there should be a more button for the add by RSS rows comparable to how they are for the non add by RSS content"                                                                  | C    | 30-add-by-rss-item-actions.md, 34-add-by-rss-item-rows.md                                                                                             |
| R29 | "add by RSS content ... should be able to support things like add to queue and possibly other things. Figure out what it can support"                                              | C    | 30-add-by-rss-item-actions.md, 31-add-by-rss-download-playback.md, 33-add-by-rss-episode-detail.md                                                    |
| R30 | "maximizing the consistency and also reusing where possible the components. You can look to the web perhaps for more of an example"                                                | C    | 30-add-by-rss-item-actions.md, 32-item-detail-header.md, 34-add-by-rss-item-rows.md                                                                   |
| R31 | "on the website, we want to add some sort of overlay on the page that displays when background processes are happening, just like how the mobile app has"                          | G    | 70-web-background-activity-store.md, 71-web-background-activity-overlay.md                                                                            |
| R32 | "It should happen in a fixed place in the bottom right of the screen, and it should be its own overlay"                                                                            | G    | 71-web-background-activity-overlay.md                                                                                                                 |
| R33 | "if the user clicks, it will expand to the left to display the message, filling a minimum and maximum width"                                                                       | G    | 71-web-background-activity-overlay.md                                                                                                                 |
| R34 | "high enough that whether the mini player ... is there or not ... it shouldn't be overlapping with the mini player or the clip chapter component that is above it"                 | G    | 71-web-background-activity-overlay.md                                                                                                                 |
| R35 | "The browser should remember whether or not the user last had that component expanded ... on page load, it should display with it expanded or collapsed"                           | G    | 71-web-background-activity-overlay.md                                                                                                                 |
| R36 | "It should be collapsed by default"                                                                                                                                                | G    | 71-web-background-activity-overlay.md                                                                                                                 |
| R37 | "include add by RSS to let the user know when add by RSS feeds are being refreshed in the web browser"                                                                             | G    | 70-web-background-activity-store.md, 71-web-background-activity-overlay.md                                                                            |
| R38 | "I'm not sure what we want to include on it. We don't want to include too much" — operator answer: list other web background work for the operator to decide (BLOCKED step)        | G    | Resolved: Add by RSS only; no other web background work joins the overlay. 70-web-background-activity-store.md, 71-web-background-activity-overlay.md |
| R39 | "We don't want that loading spinner to appear if there are no conditions ... if the user has no add by RSS feeds, they should not see that loading spinner"                        | G    | 70-web-background-activity-store.md, 71-web-background-activity-overlay.md                                                                            |
| R40 | "AddByRSS is also missing chips at the top ... add as much parity for what can be supported by our infrastructure"                                                                 | B    | 20-add-by-rss-detail-shell.md, 21-add-by-rss-detail-chips.md                                                                                          |
| R41 | "It also seems like the spacing below the recent chip is wrong"                                                                                                                    | B    | 20-add-by-rss-detail-shell.md                                                                                                                         |
| R42 | "that shouldn't even be a recent chip, it should be a sorting chip. That is a lack of parity with the non-add-by-RSS Channel detail screen"                                        | B    | 20-add-by-rss-detail-shell.md                                                                                                                         |
| R43 | "reuse components and layouts. Look to how the web has a process of layers to reusability for its media components like that for list rows and grids"                              | B    | 20-add-by-rss-detail-shell.md                                                                                                                         |
| R44 | "if they click the item ... it should navigate them to the channel detail page and then navigate them to the item detail page ... within that hierarchy of the navigation stack"   | E    | 50-player-item-title-stack.md, 51-player-add-by-rss-episode-link.md                                                                                   |
| R45 | "If the user clicks the channel, that is fine ... it's working fine as it is" (channel title link and the Home-versus-Browse choice stay as they are)                              | E    | 50-player-item-title-stack.md                                                                                                                         |

Rows R46–R58 come from the operator's review of the first planning pass (`00-REQUEST.md`
§ Review of the first planning pass). They quote those answers rather than the original request.

| Row | Operator answer                                                                                                                       | Area | Plan                                                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R46 | Web sidebar: Subscribed (Home) and Browse replace the Podcasts and Music sections; Library and Search stay                            | F    | 68-web-sidebar-and-removed-routes.md, 69-web-chips-e2e.md                                                                                                                                                              |
| R47 | Web Subscribed (Home): mobile Home's chips, server and Add by RSS follows together (Clips server only); the medium dropdown goes away | F    | 60-web-chips-foundation.md, 61-web-channel-lists-scope.md, 62-web-item-lists-scope.md, 64-web-subscribed-page.md, 65-web-subscribed-add-by-rss-channels.md, 66-web-subscribed-add-by-rss-items.md, 69-web-chips-e2e.md |
| R48 | Web Browse: mobile Browse's chips (Podcasts, Episodes, Clips, Artists, Albums, Tracks, Playlists, Users), server content only         | F    | 60-web-chips-foundation.md, 61-web-channel-lists-scope.md, 62-web-item-lists-scope.md, 63-web-browse-page.md, 69-web-chips-e2e.md                                                                                      |
| R49 | Web Add by RSS: one Library link to an Add by RSS chips page, replacing the six Add by RSS sidebar links                              | F    | 60-web-chips-foundation.md, 67-web-add-by-rss-chips-page.md, 69-web-chips-e2e.md                                                                                                                                       |
| R50 | Old web list URLs are removed (not found) and taken out of the sitemap; detail routes stay                                            | F    | 61-web-channel-lists-scope.md, 62-web-item-lists-scope.md, 63-web-browse-page.md, 67-web-add-by-rss-chips-page.md, 68-web-sidebar-and-removed-routes.md, 69-web-chips-e2e.md                                           |
| R51 | A Livestreams chip on Subscribed/Home, Browse, and the Add by RSS library, on web and mobile                                          | H    | 83-web-livestreams-chip.md, 84-web-add-by-rss-livestreams.md, 85-mobile-livestream-rows-and-browse.md, 86-mobile-home-and-library-livestreams.md, 87-livestreams-e2e.md                                                |
| R52 | The Livestreams chip lists livestream items linking straight to the livestream: live now first and marked, then scheduled; no ended   | H    | 81-upcoming-livestreams-endpoint.md, 83-web-livestreams-chip.md, 84-web-add-by-rss-livestreams.md, 85-mobile-livestream-rows-and-browse.md, 86-mobile-home-and-library-livestreams.md, 87-livestreams-e2e.md           |
| R53 | Channels remember "may have livestreams" once a livestream appears in the feed; Add by RSS keeps the same flag on the device          | H    | 80-channel-may-have-livestreams.md, 82-add-by-rss-may-have-livestreams.md, 84-web-add-by-rss-livestreams.md, 86-mobile-home-and-library-livestreams.md                                                                 |
| R54 | Add by RSS track rows also offer Add to Playlist and Mark as Played                                                                   | C    | 30-add-by-rss-item-actions.md, 34-add-by-rss-item-rows.md                                                                                                                                                              |
| R55 | The Add by RSS episode page also has Chapters and Transcript, including loading them on mobile                                        | C    | 33-add-by-rss-episode-detail.md, 35-add-by-rss-chapters-transcript-data.md, 36-add-by-rss-episode-chapters-transcript.md                                                                                               |
| R56 | A playing Add by RSS row shows pause and progress                                                                                     | I    | 90-add-by-rss-playing-row.md                                                                                                                                                                                           |
| R57 | The full player offers queue actions for Add by RSS items                                                                             | I    | 91-full-player-add-by-rss-mark-played.md                                                                                                                                                                               |
| R58 | Web background refresh and a page sync no longer collide on the IndexedDB `feedUrl` index                                             | I    | 92-web-add-by-rss-stub-insert.md                                                                                                                                                                                       |

R57 is settled by the second review: it means Mark as Played / Unplayed parity in the full player.
Queue Next and Queue Last never appear on the full player, for any item.

Rows R59–R66 come from the operator's review of the second planning pass (`00-REQUEST.md`
§ Review of the second planning pass). The third-pass planning steps fill the Plan column.

| Row | Operator answer                                                                                                                                       | Area | Plan                                                                                                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| R59 | Every mobile Home Episodes and Tracks row, regular and Add by RSS, offers Mark as Played and Download; regular rows also offer Share                  | D    | 44-home-item-row-actions.md                                                                                                                  |
| R60 | Livestreams chip rows: no Queue, Add to Playlist, or Mark as Played; regular livestream rows offer Share, Add by RSS rows do not                      | H    | 85-mobile-livestream-rows-and-browse.md; amends 86, 87                                                                                       |
| R61 | A mobile Add by RSS livestream page; Add by RSS livestream rows open it the way regular livestream rows open theirs                                   | H    | 89-add-by-rss-livestream-detail.md; amends 86, 87                                                                                            |
| R62 | Livestreams are a flag, never a medium or feed type: remove `'livestreams'` from `AddByRSSResourceType`; regular content consistent                   | H    | 88-add-by-rss-livestreams-not-a-feed-type.md; amends 80, 82, 84, 86, 41, 65, 66, 67                                                          |
| R63 | Web Library drops the Profiles link; profiles live under Browse › Users                                                                               | F    | 68-web-sidebar-and-removed-routes.md, 69-web-chips-e2e.md                                                                                    |
| R64 | Add by RSS chapters and transcript in the mobile full player                                                                                          | I    | 93-add-by-rss-now-playing-chapters.md, 94-full-player-add-by-rss-sections.md                                                                 |
| R65 | A mobile Add by RSS track page, with Go to Track on Add by RSS track rows wherever regular track rows offer it                                        | C    | 37-add-by-rss-music-type-and-track-header.md, 38-add-by-rss-track-detail.md, 39-add-by-rss-track-lyrics-and-player-link.md; amends 34 and 41 |
| R66 | Chapter artwork on private feeds                                                                                                                      | —    | Deferred: `add-by-rss-private-chapter-artwork-deferred/`                                                                                     |
| R67 | Add by RSS feed pages (mobile and web) list the feed's livestreams above Episodes, as the podcast page does; rows open the Add by RSS livestream page | H    | 95-add-by-rss-feed-page-livestreams.md (mobile; web already lists them, no web plan); amends 87 |
| R68 | A livestream's title in the full player links to its page, regular and Add by RSS                                                                     | E    | 52-player-livestream-title-link.md (regular titles already link to `EpisodeDetail`; adds the Add by RSS link; edits plan 87's flow file)    |
| R69 | Existing mobile Add by RSS music feeds take their type from the stored parsed bundle in a one-time local pass, not at the next refresh                | C    | 37-add-by-rss-music-type-and-track-header.md                                                                                                 |
| R70 | Plan 87 checks that an Add by RSS feed with live items still shows on the `/add-by-rss` Podcasts chip                                                 | H    | 87-livestreams-e2e.md                                                                                                                        |
| R71 | Plan 44's Maestro step checks that Download (row control and More entry) is shown on Home rows, without starting a download                           | D    | 44-home-item-row-actions.md                                                                                                                  |
| R72 | Web Add by RSS feed pages order livestreams by the channel endpoint's rules and hide items ended more than a day ago, through plan 95's shared helper | H    | 96-web-add-by-rss-channel-live-order.md                                                                                                      |
| R73 | Mobile livestream rows inside a channel (podcast, album, Add by RSS feed page) show "Scheduled" or "Ended" on a line that stays visible              | H    | 97-mobile-channel-live-status-label.md (amends plan 95's decision 7; adds two asserts to plan 87's flow)                                     |
| R74 | The full player's channel line for a regular livestream on an album feed opens the album page (Home when followed, else Browse)                      | E    | 53-player-album-livestream-channel-link.md (Music and MusicL open `AlbumDetail`; publisher feeds stay on the podcast page; runs after 52)   |

74 rows.

## Areas

Plan number blocks never overlap; an area step writes only files in its own block.

### A — Mobile item list row typography and new-content dot

- **Rows:** R8, R9, R10, R13, R14, R15, R16, R17, R18, R19
- **Plan block:** 10–19
- **Plan:** [10-item-row-type-and-dot.md](10-item-row-type-and-dot.md)
- **Starts from:** `apps/mobile/src/screens/home/HomeFeedRow.tsx` (the row every item list uses:
  Home, Browse, podcast Episodes section, History, Add by RSS detail and root), its channel-row
  variant for the date and spacing reference, `components/primitives/UnseenIndicator.tsx`, and
  `apps/mobile/src/theme/typography`.
- **Depends on:** none.
- **Shares files with:** C (`HomeFeedRow.tsx` duration and more-button slots), D (`HomeFeedRow.tsx`
  channel rows on Home and the Add by RSS root).
- **Note:** mobile only. Web item rows do not change.

### B — Mobile Add by RSS channel detail parity

- **Rows:** R4, R6, R7, R40, R41, R42, R43
- **Plan block:** 20–29
- **Starts from:** `apps/mobile/src/screens/home/AddByRssHomeDetailScreen.tsx` and
  `addByRssHomeDetailData.ts`, compared with `screens/podcast/PodcastDetailScreen.tsx` and
  `components/channel/` (`ChannelDetailShell`, `ChannelHeader`, `ChannelSettingsPane`) and the
  `MenuSelectChip` sort chip. Credentials move from the header into settings; the credentials
  screen is `screens/rss/AddByRssCredentialsScreen.tsx`.
- **Depends on:** A (the episode rows it lists).
- **Shares files with:** C (`AddByRssHomeDetailScreen.tsx` row tap and more-button wiring),
  `components/channel/*` with the podcast detail screen.
- **Note:** credentials stay on the device (**add-by-rss-client-held-credentials**).

### C — Mobile Add by RSS item rows and item detail

- **Rows:** R5, R23, R24, R25, R26, R27, R28, R29, R30, R54, R55, R65, R69
- **Amendment (R65):** done.
  [37-add-by-rss-music-type-and-track-header.md](../../completed/add-by-rss-parity/37-add-by-rss-music-type-and-track-header.md)
  stores a feed's type from its parsed medium (mobile hard-coded `'podcasts'`, so no feed was
  ever music) and splits the track page header into `TrackDetailHeader`.
  [38-add-by-rss-track-detail.md](../../completed/add-by-rss-parity/38-add-by-rss-track-detail.md) adds `AddByRssTrackDetail` on
  Home and Library.
  [39-add-by-rss-track-lyrics-and-player-link.md](39-add-by-rss-track-lyrics-and-player-link.md)
  adds Lyrics, the full-player track link (kind `add-by-rss-track`), and
  `e2e/add-by-rss-track.yaml`. Plans 34 and 41 now pass Go to Track on Add by RSS track rows; a
  row tap still plays (R24). Run order: 30, 31, 32, 33, 37, 38, 34, 35, 36, then 39 after 51.
- **Amendment (R69):** done, inside plan 37. The stored bundle carries the medium as
  `channel.channel.medium_id`. The first database open rewrites `resource_type` from that
  field, with no network request. The pass runs in `initialize()`, gated by `kv_meta`.
  Plan 82 keeps migration version 24.
- **R65 shares files with:** D (plan 41's `HomeScreen.tsx`), E (plans 50 and 51:
  `fullPlayerContentLink.ts` and its test, `navigation/index.tsx`), H (step 15's R62 plan:
  `addByRssRepository.ts`), I (step 18's full-player plan may touch the same player files), the
  track page (`TrackDetailScreen.tsx`), and plan 36's files (`components/content/index.ts`,
  `accountAddByRSSParse.ts`, `e2e-test.sh`, `e2e/README.md`, `ADD-BY-RSS.md`,
  `mobile-test-economics`).
- **R69 shares files with:** `apps/mobile/src/data/db/index.ts` (no other plan),
  `apps/mobile/vitest.config.ts` (keep plan 37 out of any phase that also edits it), and
  `addByRssRepository.ts` through the `upsertFeed` change plan 37 already owns (plans 82 and
  88). The pass itself is `applyAddByRssResourceTypes.ts` and `storedResourceType.ts`.
- **Amendment (R54, R55):** done. Plans 30 and 34 give track rows Add to Playlist and Mark as
  Played; plan 33 leaves room for the chips; plan 35 adds the loading layer and plan 36 the
  Chapters and Transcript chips. Run order: 30, 31, 32, 33, 34, 35, 36.
- **Amendment shares files with:** plan 32 (`components/content/index.ts`), the podcast episode
  page (`EpisodeDetailScreen.tsx`, chapter row moved to `components/content/ItemChapterRow.tsx`),
  web (`apps/web/src/utils/addByRSS/chaptersTranscript.ts`), `packages/helpers`
  (`credentialScope.ts`), `segmentsRepository.ts`, `apps/mobile/vitest.config.ts`, the API E2E
  parse fixtures (`accountAddByRSSParse.ts`), and `scripts/mobile/e2e-test.sh`.
- **Plan block:** 30–39
- **Starts from:** the Add by RSS row wiring in `AddByRssHomeDetailScreen.tsx`,
  `screens/rss/AddByRssRootScreen.tsx`, `hooks/useAddByRssPlayback.ts`, and
  `components/player/MediaRowActions.tsx`; the parity source for the item detail is
  `screens/episode/EpisodeDetailScreen.tsx`. Mobile has no Add by RSS item detail route today
  (`navigation/index.tsx` lists only `AddByRssPodcastDetail`, `AddByRssCredentials`,
  `AddByRssRoot`, `AddByRssAdd`). Supported actions come from the Add by RSS paths in
  `data/repositories/queueRepository.ts`, `playlistRepository.ts`, `downloads/`, and the web
  `apps/web/src/components/AddByRSS/` rows.
- **Depends on:** A (row slots), B (shares the channel detail screen).
- **Shares files with:** A (`HomeFeedRow.tsx`), B (`AddByRssHomeDetailScreen.tsx`; plan 38
  moves its header artwork into `addByRssHomeDetailData.ts`), D (`AddByRssRootScreen.tsx`), E
  (the new item detail routes are E's navigation targets).

### D — Mobile Home and Add by RSS library rows: inclusion, swipe, grid long-press

- **Rows:** R1, R2, R3, R11, R12, R59
- **Plan block:** 40–49
- **Plans:** 40, 41, 42, 43, and
  [44-home-item-row-actions.md](44-home-item-row-actions.md) (R59). Plan 44 runs after 41.
  Plan 86 also edits `HomeScreen.tsx` and `homeFeedData.ts`, so it runs after 44.
- **Starts from:** `apps/mobile/src/screens/home/HomeScreen.tsx` (already routes
  `source === 'addByRss'` rows to `AddByRssPodcastDetail`; find why Add by RSS feeds do not show
  for the operator first), `homeFeedData.ts`, `data/repositories/subscriptionsMerge.ts`,
  `hooks/useAddByRssFeeds.ts`, `screens/rss/AddByRssRootScreen.tsx`,
  `screens/home/HomeFeedGridCell.tsx`, `components/primitives/SwipeActionRow.tsx`, and
  `components/primitives/MoreMenu.tsx` (the bottom action sheet with Cancel).
- **Depends on:** A (row layout).
- **Shares files with:** A (`HomeFeedRow.tsx`), C (`AddByRssRootScreen.tsx`), H (plan 86:
  `HomeScreen.tsx`, `homeFeedData.ts`). Plan 44 also edits `e2e/add-by-rss.yaml` (with 41) and
  `apps/mobile/vitest.config.ts` (with 41).
- **Amendment (R59):** Mark as Played and Download on every Home Episodes and Tracks row, regular
  and Add by RSS. Share on directory rows only. The new work is plan 44; putting it in plan 41
  would pass 300 lines. Plan 41 only points at 44.
- **Amendment (R71):** done. Plan 44's Maestro step also asserts the download control and the
  More menu's Download entry on the Home episode row, and does not tap either.
- **Note:** Home shows no "Needs username and password" section
  (**add-by-rss-client-held-credentials**); background refresh follows
  **mobile-sync-orchestration**.

### E — Mobile player item-title navigation hierarchy

- **Rows:** R44, R45, R68, R74
- **Plan block:** 50–59
- **Starts from:** `apps/mobile/src/screens/player/fullPlayerContentLink.ts`
  (`resolveFullPlayerTitleLink`, `resolveFullPlayerChannelLink`, `playerContentStack`) and
  `FullPlayerScreen.tsx`.
- **Plans:** [50-player-item-title-stack.md](../../completed/add-by-rss-parity/50-player-item-title-stack.md), then
  [51-player-add-by-rss-episode-link.md](51-player-add-by-rss-episode-link.md), and later
  [52-player-livestream-title-link.md](52-player-livestream-title-link.md) (R68), then
  [53-player-album-livestream-channel-link.md](53-player-album-livestream-channel-link.md)
  (R74).
- **Depends on:** C (plan 33's `AddByRssEpisodeDetail` route, used by plan 51). Plan 33 does
  not edit `fullPlayerContentLink.ts`.
- **Shares files with:** C (`navigation/index.tsx`). Plan 50 also shares
  `mobile-tab-stack-isolation.mdc` with plan 40 and `vitest.config.ts` with plans 10, 20, 21,
  30, 32, and 41. Plan 51 also shares `e2e/add-by-rss.yaml` with plans 20, 21, 34, 40, 41,
  and 42.
  Plans 50 and 51 share the player link file, `FullPlayerScreen.tsx`, and
  `navigation/index.tsx`, so they run in that order and never in one phase.
- **Amendment (R68):** done.
  [52-player-livestream-title-link.md](52-player-livestream-title-link.md). A directory
  livestream's title already opens `EpisodeDetail`, the regular livestream page, so that half is a
  stronger unit assertion. An Add by RSS livestream's title opens plan 89's
  `AddByRssLivestreamDetail` under `AddByRssPodcastDetail` on Home (kind
  `add-by-rss-livestream`, key from `resolveAddByRssLiveItemKey` in `liveItemDetail.ts`). It adds
  a player round trip to plan 87's `e2e/add-by-rss-livestream.yaml`.
- **Run order with 52:** after 50, 51, 39, 89, 93, 94, and 87. Never in one phase with a plan that
  edits `fullPlayerContentLink.ts`, `FullPlayerScreen.tsx`, `navigation/index.tsx`,
  `liveItemDetail.ts`, or that flow. Plan 52 moves only its own file.
- **Amendment (R74):** done.
  [53-player-album-livestream-channel-link.md](53-player-album-livestream-channel-link.md).
  A directory livestream on an album feed (`isAlbumMediumId`: Music and MusicL) keeps showing
  `channel.title` and opens `AlbumDetail`, on Home when this device follows that album and on
  Browse when it does not, through the existing `playerContentStack` and `case 'album'` routes.
  Publisher feeds stay on the podcast page. Adding this to plan 52 would pass 300 lines.
- **Run order with 53:** after 52. Never in one phase with 52 (`fullPlayerContentLink.ts` and
  its test). Plan 53 does not edit `navigation/index.tsx` or `FullPlayerScreen.tsx`. It is the
  last prompt, so it archives the set and carries the cumulative verification.
- **R68 shares files with:** C (plan 39), E (plans 50, 51), H (plans 87, 89), and I (plans 93,
  94).
- **R74 shares files with:** E (plans 50, 51, and 52: `fullPlayerContentLink.ts` and
  `fullPlayerContentLink.test.ts`).

### F — Web Subscribed and Browse chips pages, with Add by RSS merged into Subscribed

- **Rows:** R20, R21, R22, R46, R47, R48, R49, R50, R63
- **Amendment (R63):** done. Plan 68's Library links are Queues, History, Playlists, My Clips,
  and Add by RSS. The Profiles `SideBarLink` (`ROUTES.PROFILES` in `SideBar.tsx`) is removed.
  Public profiles stay on Browse › Users (`/browse?tab=users`, plan 63) and on `/profiles`.
  Plan 69's navbar spec expects no `#sidebar a[href="/profiles"]`. No existing spec asserted
  that link.
- **Plan block:** 60–69. The first pass's plans 60 and 61 (Add by RSS merged into today's Home
  list) were removed; this area is planned again from the operator's review.
- **Starts from:** `apps/web/src/components/SideBar/SideBar.tsx`, `apps/web/src/constants/routes.ts`,
  `apps/web/src/app/HomePageClient.tsx` and `HomePageList.tsx`, the list pages under
  `apps/web/src/app/{podcasts,episodes,clips,artists,albums,tracks}/` and the two livestream list
  pages, `apps/web/src/app/add-by-rss/`, `apps/web/src/app/sitemap.ts`,
  `apps/web/src/lib/seo/routeSeoPolicy.ts` and `curatedPageMetadata.ts`. The chip reference is
  mobile's `HOME_MEDIA_TYPE_ORDER` and `BROWSE_MEDIA_TYPE_ORDER` in
  `apps/mobile/src/screens/browse/browseTypes.ts`. Chip choice persists per page
  (**filter-sort-persistence**).
- **Plans:** run in order, never two at once:
  [60-web-chips-foundation.md](60-web-chips-foundation.md),
  [61-web-channel-lists-scope.md](61-web-channel-lists-scope.md),
  [62-web-item-lists-scope.md](62-web-item-lists-scope.md),
  [63-web-browse-page.md](63-web-browse-page.md),
  [64-web-subscribed-page.md](64-web-subscribed-page.md),
  [65-web-subscribed-add-by-rss-channels.md](65-web-subscribed-add-by-rss-channels.md),
  [66-web-subscribed-add-by-rss-items.md](66-web-subscribed-add-by-rss-items.md),
  [67-web-add-by-rss-chips-page.md](67-web-add-by-rss-chips-page.md),
  [68-web-sidebar-and-removed-routes.md](68-web-sidebar-and-removed-routes.md),
  [69-web-chips-e2e.md](69-web-chips-e2e.md).
- **Depends on:** none.
- **Shares files with:** G (plan 65 owns `useReadyAddByRSSFeeds`, which plan 70 reports to the
  activity store; plan 68 and plan 71 both edit `localSettings.ts`; plan 71's spec opens
  `/add-by-rss` and its spec-order line sits beside plan 69's), H (adds `livestreams` to the chip
  lists in `utils/mediaListChips.ts` and rewires the unrouted Livestreams modules in
  `app/podcasts/livestreams/`), D (plans 40 and 68 edit different sentences of
  `mobile-tab-stack-isolation.mdc` and `docs/features/ADD-BY-RSS.md`), I (plan 92's step in
  `add-by-rss-auto-parse.spec.ts`), and mobile i18n (plan 60 moves `features.browse.users` to the
  consumer catalog).
- **Note:** cross-surface with D; both state the same Subscribed rule per surface. The web E2E
  specs that open the removed list pages move to the chips pages.

### H — Livestreams chip and "may have livestreams" flag (web and mobile)

- **Rows:** R51, R52, R53, R60, R61, R62, R67, R72, R73
- **Plan block:** 80–89 (and 95, 96, 97)
- **Amendment (R60, R61):** done.
  [89-add-by-rss-livestream-detail.md](../../completed/add-by-rss-parity/89-add-by-rss-livestream-detail.md) is the mobile Add by
  RSS livestream page (route `AddByRssLivestreamDetail` on Home and Library; Summary and People;
  play only while live; no More actions). It owns `addByRssLiveItemKey`,
  `toAddByRssLiveItemPlaybackResourceData`, and `playLiveItem`, which moved out of plan 86. Plan
  85: Browse livestream rows offer Share only. Plan 86: Add by RSS rows, live or scheduled, open
  plan 89's page; Home's directory rows offer Share through plan 44's `homeItemShareResource`.
  Plan 87: Browse Share check and a new `add-by-rss-livestream` flow on a live API fixture feed.
- **Amendment (R62):** done. Livestreams are a flag, never a medium or a resource type.
  [88-add-by-rss-livestreams-not-a-feed-type.md](../../completed/add-by-rss-parity/88-add-by-rss-livestreams-not-a-feed-type.md)
  removes `'livestreams'` from `AddByRSSResourceType`, adds `ADD_BY_RSS_RESOURCE_TYPES`,
  `isAddByRSSResourceType`, and `toAddByRSSResourceType` (a stored unknown type reads as
  podcasts) to `@podverse/parser-mapping`, deletes the four web feed-level livestream components
  (their links put a feed id into the livestream item route), and updates the
  `add-by-rss-parity-sync` skill and `add-by-rss-data-contracts` rule. Plan 80 records that
  regular content already keeps medium apart from livestreams (`live_item` rows, `/live-item`
  routes, medium plus `livestream` links). Plans 82, 84, and 86 state the flag-only rule; plans
  41 and 66 drop `'livestreams'` from their Episodes resource-type lists; plans 65 and 67 say a
  feed with livestreams stays on its medium's chip; plan 37 names plan 88.
- **Run order with 88 and 89:** 80, 81, 82, **88**, 83, 84, 85, **89**, 86, 87. Plan 88 runs
  after 22, 37, 41, 66, 67, and 92 (it edits files they edit first) and before 84 (which imports
  `ADD_BY_RSS_RESOURCE_TYPES`) and 86. Plan 89 runs after 31, 32, 33, 37, 38, 39, 50, 51, 85,
  and 90, and before 86. Plan 87 runs after 36 (its parse fixture registry and `e2e-test.sh`).
- **R62 shares files with:** B (plan 22: `add-by-rss-parity-sync` skill), C (plan 37:
  `addByRssRepository.ts`), D (plan 41: `addByRssItemRows.ts`), F (plan 67:
  `AddByRSSListClient.tsx`), I (plan 92: `storage.ts`), and plan 82 (`addByRssRepository.ts`,
  parser-mapping `index.ts`).
- **Starts from:** the `live_item` and `live_item_status` tables in
  `infra/k8s/base/ops/source/database/linear-migrations/app/0001_app_schema.sql`,
  `packages/parser/src/lib/rss/liveItem/liveItem.ts` (archives a live item that left the feed),
  `packages/orm/src/services/liveItem/liveItem.ts`, the API routes behind today's web livestream
  list pages, and the mobile Home, Browse, and Add by RSS library chip rows.
- **Plans:** run in order, never two at once:
  [80-channel-may-have-livestreams.md](80-channel-may-have-livestreams.md),
  [81-upcoming-livestreams-endpoint.md](81-upcoming-livestreams-endpoint.md),
  [82-add-by-rss-may-have-livestreams.md](../../completed/add-by-rss-parity/82-add-by-rss-may-have-livestreams.md),
  [88-add-by-rss-livestreams-not-a-feed-type.md](../../completed/add-by-rss-parity/88-add-by-rss-livestreams-not-a-feed-type.md),
  [83-web-livestreams-chip.md](../../completed/add-by-rss-parity/83-web-livestreams-chip.md),
  [84-web-add-by-rss-livestreams.md](../../completed/add-by-rss-parity/84-web-add-by-rss-livestreams.md),
  [85-mobile-livestream-rows-and-browse.md](../../completed/add-by-rss-parity/85-mobile-livestream-rows-and-browse.md),
  [89-add-by-rss-livestream-detail.md](../../completed/add-by-rss-parity/89-add-by-rss-livestream-detail.md),
  [86-mobile-home-and-library-livestreams.md](../../completed/add-by-rss-parity/86-mobile-home-and-library-livestreams.md),
  [87-livestreams-e2e.md](87-livestreams-e2e.md). Plans 83–84 run after 60–69; plans 85, 89,
  and 86 after 10, 40–44, and 90.
- **Depends on:** F (web chips pages), D (mobile Home chips), I (plan 90's
  `useAddByRssPlayback` toggle).
- **Shares files with:** F (`utils/mediaListChips.ts` and its test, the three chips pages,
  `localSettings.ts`, `routes.ts`, `media-list-chips.spec.ts`), D (`HomeScreen.tsx`,
  `homeFeedData.ts`, `AddByRssRootScreen.tsx`, `addByRssLibraryFeedData.ts`, `browseTypes.ts`,
  `vitest.config.ts`), A, C, and I (`HomeFeedRow.tsx`, `useAddByRssPlayback.ts`), and the E2E
  seed (`tools/web/seed-e2e.mjs`).
- **Plan 89 shares files with:** C (plans 32, 33, 38, 39: `ItemDetailHeader.tsx`,
  `addByRssStackParams.ts`, `useAddByRssItemDetail.ts`, `navigation/index.tsx`,
  `fullPlayerContentLink.ts`), E (plans 50, 51: `navigation/index.tsx`,
  `fullPlayerContentLink.ts`), I (plan 90: `ItemDetailHeader.tsx`, `useAddByRssPlayback.ts`,
  `domain.ts`), and C's plans 31 and 37 (`domain.ts`). Plan 86 also edits D's
  `homeItemRowActions.ts` and its test (plan 44). Plan 87 also edits C's
  `accountAddByRSSParse.ts`, `e2e-test.sh`, `e2e/README.md`, and the mobile-test-economics skill
  (plan 36).
- **Amendment (R67):** done.
  [95-add-by-rss-feed-page-livestreams.md](95-add-by-rss-feed-page-livestreams.md) lists a
  feed's live, scheduled, and recently ended livestreams above Episodes or Tracks on the mobile
  Add by RSS feed page, in the channel endpoint's order through a new `@podverse/helpers`
  comparator (`compareChannelLiveItems`) that `getManyByChannel` also uses. Rows open plan 89's
  page; play only while live; no More. Web's Add by RSS podcast, album, and artist pages already
  list live items (plan 88 keeps them), so this plan adds no web section. Plan 96 changes their
  order and hides ended items older than a day. Plan 87's `add-by-rss-livestream` flow
  gains the feed-page check.
- **Amendment (R72):** done.
  [96-web-add-by-rss-channel-live-order.md](96-web-add-by-rss-channel-live-order.md) orders the
  livestreams those web pages already list with plan 95's `compareChannelLiveItems`, and hides
  ended items older than a day through `isLiveItemEndedAndStale`. The sort control still orders
  episodes, tracks, and albums only. Plan 96 runs after 95 and 87, and before 52. It edits
  `media-list-chips.spec.ts`, which plan 87 writes, so the two never share a phase.
- **Amendment (R73):** done.
  [97-mobile-channel-live-status-label.md](97-mobile-channel-live-status-label.md) shows a
  neutral Scheduled or Ended `Badge` at the start of `HomeFeedRow`'s date line when the context
  line is hidden (inside a channel), where the in-channel Live badge already sits. Plan 85's
  context-line prefix reads the same word. The podcast page drops its hidden subtitle prefix, and
  the album page stops marking scheduled and ended items Live; both use a new
  `toChannelLiveRow` in `lib/rows/liveItemRows.ts`. Plan 87's `add-by-rss-livestream` flow gains
  two asserts on the feed page.
- **Run order with 97:** after 10, 85, 86, 95, 87, and 96; before 52. Never in one phase with 87
  or 52 (`e2e/add-by-rss-livestream.yaml`). It edits `HomeFeedRow.tsx`, `liveItemRows.ts` and its
  test, `PodcastEpisodesSection.tsx`, `AlbumDetailScreen.tsx`, `mobile-screen-layout.mdc`, and
  the `mobile-reusable-components` skill, so no plan that edits those shares its phase.
- **Amendment (R70):** done. Plan 87's signed-in Playwright test clicks Podcasts after the
  Livestreams chip and checks that the same Add by RSS feed is still listed there.
- **Run order with 95:** after 20, 21, 22, 34, 81, 85, 89, 90, and 86; before 87. Never in one
  phase with 20, 21, 22, 34 (`AddByRssEpisodesSection.tsx`), 81 (`liveItemVisibility.ts`, the
  live-item controller, `category-channel-item-read.test.ts`), or 86 (`lib/addByRss/liveRows.ts`).
  Plan 95 shares those files with B (20, 21, 22), C (34), and plans 81 and 86.
- **Run order with 96:** after 95 and 87; before 52. Never in one phase with 87
  (`apps/web/e2e/media-list-chips.spec.ts`). It does not edit `liveItemVisibility.ts`.
- **Note:** a schema change follows **linear-sql-greenfield-only** and **linear-baseline-0004**;
  the Add by RSS flag is device data (mobile SQLite migration 24). The chip has no sort,
  category, or view controls and covers every medium.

### I — Gaps left out of the first pass

- **Rows:** R56, R57, R58, R64
- **Amendment (R64):** done.
  [93-add-by-rss-now-playing-chapters.md](93-add-by-rss-now-playing-chapters.md) adds the
  now-playing Add by RSS store (this device's parsed item, plan 35's request, cleared on sign-out)
  and feeds its chapters to `useNowPlayingChapters`, so the segment band, chapter artwork,
  scrubber marks, and chapter prev/next work for Add by RSS.
  [94-full-player-add-by-rss-sections.md](94-full-player-add-by-rss-sections.md) gives the full
  player Summary, Chapters, Transcript, and People for Add by RSS items (not livestreams), with
  plan 36's pane states, and extends `e2e/add-by-rss-episode-sections.yaml` and
  `e2e/add-by-rss-track.yaml`. Plan 93 runs after 35, 51, and 90. Plan 94 runs after 93, 36, 39,
  50, 51, 90, and 91.
- **R64 shares files with:** C (plan 35's `itemSections.ts` and `addByRssEpisodeTabs.ts`, read
  only; plan 33's `addByRssHomeDetailData.ts`, read only; plans 36 and 39's flows), E (plan 51:
  `localResourceData.ts` and `FullPlayerScreen.tsx`; plan 50: `FullPlayerScreen.tsx`), I (plans
  90 and 91: `FullPlayerScreen.tsx`), `PlaybackProvider.tsx` (plan 31), `SyncProvider.tsx`,
  `apps/mobile/vitest.config.ts`, and `docs/features/ADD-BY-RSS.md`.
- **Plan block:** 90–99
- **Starts from:** the Add by RSS playback target built in
  `apps/mobile/src/lib/addByRss/localResourceData.ts` (resource data `id_text` is the feed's id),
  `resolveQueueMutationTarget` and its callers in the full player, and
  `apps/web/src/utils/addByRSS/sync.ts` with its IndexedDB store.
- **Plans:** [90-add-by-rss-playing-row.md](90-add-by-rss-playing-row.md),
  [91-full-player-add-by-rss-mark-played.md](91-full-player-add-by-rss-mark-played.md),
  [92-web-add-by-rss-stub-insert.md](92-web-add-by-rss-stub-insert.md),
  [93-add-by-rss-now-playing-chapters.md](93-add-by-rss-now-playing-chapters.md),
  [94-full-player-add-by-rss-sections.md](94-full-player-add-by-rss-sections.md). Plan 90 runs
  after 21, 30–34, 41, 44, and 51. Plan 91 runs after 30, 44, 50, and 51. Plan 92 runs after 70.
  Plans 90 and 91 both edit `e2e/add-by-rss.yaml`, so they never share a phase. Plans 93 and 94
  run in that order, never in a phase with each other or with another plan that edits
  `FullPlayerScreen.tsx`, `localResourceData.ts`, or `vitest.config.ts`.
- **Depends on:** C (Add by RSS rows and actions), G (plan 70 edits `sync.ts`).
- **Shares files with:** C, G.

### G — Web background-activity overlay

- **Rows:** R31, R32, R33, R34, R35, R36, R37, R38, R39
- **Plan block:** 70–79
- **Starts from:** the mobile sync indicator behind `apps/mobile/src/sync/SyncProvider.tsx` as
  the behavior reference, the web mini player and clip/chapter bar under
  `apps/web/src/components/MediaPlayer/`, and the web Add by RSS refresh code.
- **Plans:** [70-web-background-activity-store.md](70-web-background-activity-store.md), then
  [71-web-background-activity-overlay.md](71-web-background-activity-overlay.md).
- **Depends on:** F (Add by RSS refresh on web Home).
- **Shares files with:** F.
- **Note:** R38 is resolved: the overlay reports Add by RSS work only, and no other web
  background work joins it.

## Order

A, B, C, D, E, F, G — planning steps 02 through 08. The mobile row component comes first
because B, C, and D list it. C follows B because both edit the Add by RSS channel detail. E
follows C because it navigates to C's item detail. G runs last because it stops for the
operator.

Second pass, after the operator's review: C's amendment, then I, then F, then H, then a fresh
Close. I follows C because it changes the rows C plans. H follows F because it adds a chip to
F's pages.

Third pass, after the second review: D's Home row actions (R59), C's track page (R65), H's
flag-only livestreams (R62), H's Add by RSS livestream page and row actions (R60, R61), F's
Profiles link (R63), I's full player chapters and transcript (R64), then a fresh Close. D comes
first because steps 14 and 15 also edit plan 41. Step 15 comes before 16 because both edit plan
86, and 16 builds on the flag-only rule. New plan numbers: D writes 44 (R59; it does not fit in
plan 41), C writes 37–39, H writes 88 (step 15, only if the type removal needs its own plan) and
89 (step 16), I writes 93 and 94. Plan 86 runs after 44. Run order and phases:
[00-EXECUTION-ORDER.md](00-EXECUTION-ORDER.md).

Fourth pass, after the third review: H's livestreams section on Add by RSS feed pages (R67), E's
full player livestream title link (R68), C's one-time music type pass (R69), the E2E checks in
plans 87 and 44 (R70, R71), then a fresh Close. Step 19 comes first because it may add Maestro
steps that step 22 also touches in plan 87. Area H's block (80–89) is full, so R67 takes plan 95
(and 96 if it needs a split) from I's block. R68 takes plan 52. R69 amends plan 37. R70 amends
plan 87 (done), and R71 amends plan 44 (done). Plan 95 runs after 86 and before 87; plan 52 runs
last and closes the set. Run order and phases: [00-EXECUTION-ORDER.md](00-EXECUTION-ORDER.md).

Fifth pass: plan 96 (R72) runs after 95 and 87 and before 52. Plan 97 (R73) runs after 96
and before 52. R74 does not fit in plan 52. Plan 53 runs after 52 and closes the set, which
replaces the fourth pass's note that plan 52 closes the set. Run order and phases:
[00-EXECUTION-ORDER.md](00-EXECUTION-ORDER.md).
