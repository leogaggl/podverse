# Execution order

Request: [00-REQUEST.md](./00-REQUEST.md). Decisions and ledger: [00-SUMMARY.md](./00-SUMMARY.md).
Prompts: [COPY-PASTA.md](./COPY-PASTA.md).

## Before phase 1

- The operator answers in `00-REQUEST.md` § Review of the first, second, third, and fourth
  planning passes are final. No prompt reopens a planner choice listed there as confirmed.
- R66 (chapter artwork on private feeds) is not in this set. Its placeholder is
  `.llm/plans/active/add-by-rss-private-chapter-artwork-deferred/`.
- Docker is running before phase 31. Plan 80 runs `make db_regen_linear_baseline` and
  `make db_verify_linear_baseline`. Without Docker it leaves the archives alone and reports
  BLOCKED, and the operator starts Docker and resumes.
- App linear migration `0021` and mobile SQLite migration 24 are free today. If the tree has moved
  on when plans 80 and 82 run, they take the next free number and set the readiness markers to it.
  Plan 37's one-time retype pass is not a migration; it uses a `kv_meta` marker.

## Phases

Every prompt is **Cursor Grok 4.7** with Fast off; each prompt's reasoning is in
[COPY-PASTA.md](./COPY-PASTA.md). Phases run in order. A phase with two prompts
pairs one mobile plan with one web plan that share no file, so running them together is safe.
Neither prompt of a pair writes `release-notes/scratchpad.md`; each puts its entry in its final
message, and prompt 53 appends those entries. Running them one after the other is also correct.

| Phase | Prompts                                                                    | Wait for         |
| ----- | -------------------------------------------------------------------------- | ---------------- |
| 1     | 10 mobile item row type and dot · 60 web chip row foundation               | Section above    |
| 2     | 20 Add by RSS channel detail shell · 61 web channel list scope             | Phase 1          |
| 3     | 21 Add by RSS detail chips · 62 web item list scope                        | Phase 2          |
| 4     | 22 Add by RSS detail settings                                              | Phase 3          |
| 5     | 30 Add by RSS item actions · 63 web Browse page                            | Phase 4          |
| 6     | 31 Add by RSS download playback                                            | Phase 5          |
| 7     | 32 shared item detail header · 64 web Subscribed page                      | Phase 6          |
| 8     | 33 Add by RSS episode detail page                                          | Phase 7          |
| 9     | 37 Add by RSS music type, one-time retype pass, shared track header        | Phase 8          |
| 10    | 38 Add by RSS track page                                                   | Phase 9          |
| 11    | 34 Add by RSS item rows                                                    | Phase 10         |
| 12    | 35 Add by RSS chapters and transcript loading · 65 web Subscribed channels | Phase 11         |
| 13    | 36 Add by RSS episode Chapters and Transcript                              | Phase 12         |
| 14    | 66 web Subscribed Add by RSS items                                         | Phase 13         |
| 15    | 67 web Add by RSS chips page                                               | Phase 14         |
| 16    | 68 web sidebar and removed routes                                          | Phase 15         |
| 17    | 40 mobile Home Add by RSS channels · 69 web chips E2E                      | Phase 16         |
| 18    | 41 mobile Home Add by RSS items · 70 web background activity store         | Phase 17         |
| 19    | 42 Add by RSS library swipe                                                | Phase 18         |
| 20    | 43 grid long-press menu                                                    | Phase 19         |
| 21    | 44 Home Episodes and Tracks row actions                                    | Phase 20         |
| 22    | 71 web background activity overlay                                         | Phase 21         |
| 23    | 92 web follow sync stub insert                                             | Phase 22         |
| 24    | 50 player item title stack                                                 | Phase 23         |
| 25    | 51 player Add by RSS episode link                                          | Phase 24         |
| 26    | 39 Add by RSS track Lyrics, player link, and flow                          | Phase 25         |
| 27    | 90 playing Add by RSS row                                                  | Phase 26         |
| 28    | 91 full player Add by RSS mark played                                      | Phase 27         |
| 29    | 93 Add by RSS now-playing chapters                                         | Phase 28         |
| 30    | 94 full player Add by RSS sections                                         | Phase 29         |
| 31    | 80 channel "may have livestreams" flag                                     | Phase 30, Docker |
| 32    | 81 upcoming livestreams endpoints                                          | Phase 31         |
| 33    | 82 Add by RSS "may have livestreams" flag                                  | Phase 32         |
| 34    | 88 livestreams are not an Add by RSS feed type                             | Phase 33         |
| 35    | 83 web Livestreams chip                                                    | Phase 34         |
| 36    | 84 web Add by RSS livestreams                                              | Phase 35         |
| 37    | 85 mobile livestream rows and Browse chip                                  | Phase 36         |
| 38    | 89 mobile Add by RSS livestream page                                       | Phase 37         |
| 39    | 86 mobile Home and library Livestreams chips                               | Phase 38         |
| 40    | 95 livestreams on the mobile Add by RSS feed page                          | Phase 39         |
| 41    | 87 livestreams E2E                                                         | Phase 40         |
| 42    | 96 web Add by RSS feed pages use the channel livestream order              | Phase 41         |
| 43    | 97 Scheduled and Ended on mobile channel livestream rows                   | Phase 42         |
| 44    | 52 full player livestream title link                                       | Phase 43         |
| 45    | 53 album livestream channel link, then archive and verification            | Phase 44         |

## Why this order

- **Mobile channel detail:** 10 owns `HomeFeedRow.tsx` styling; 20 → 21 → 22 all rewrite
  `AddByRssHomeDetailScreen.tsx`.
- **Mobile item rows and pages:** 30 needs 21's `downloadIdText.ts`; 31 follows 30; 32 shares no
  file with 30–31; 33 needs 30 and 32. 37 needs 32's `itemDetailDateLabel`, makes music feeds
  music, and retypes stored feeds once in `data/db/index.ts`; it is alone in its phase because it
  edits mobile `vitest.config.ts`. 38 needs 33 and 37. 34 navigates to 33's and 38's routes, so
  it follows both. 35 needs 33's `screens/home/addByRss/`; 36 needs 32–35.
- **Mobile Home and library:** 40 → 41 → 42 → 43 → 44 share `HomeScreen.tsx` and
  `AddByRssRootScreen.tsx`. 41 also needs 30, 33, 34, 37, and 38. 44 needs 41's `HomeFeedRead`
  and 43's `unsubscribeAction`.
- **Player:** 50, 51, 39, 90, 91, 93, and 94 each edit some of `fullPlayerContentLink.ts`,
  `FullPlayerScreen.tsx`, `navigation/index.tsx`, `localResourceData.ts`, `e2e/add-by-rss.yaml`,
  and mobile `vitest.config.ts`, so each has its own phase. 51 needs 50 and 33. 39 needs 34, 36,
  38, and 51. 90 needs 21, 30–34, 41, 44, and 51. 91 needs 30, 44, 50, and 51. 93 needs 35, 51,
  and 90. 94 needs 93, 36, 39, 50, 51, 90, and 91.
- **Web chips:** 60 → 61 → … → 69 run one at a time. 65 owns `useReadyAddByRSSFeeds`, which 66,
  70, and 84 build on. 68 and 71 both edit `utils/localSettings/localSettings.ts` (`sba` versus
  `bae`); 69 and 71 both edit `makefiles/local/e2e-spec-order-web.txt`; 69 and 92 both edit
  `add-by-rss-auto-parse.spec.ts`. 92 needs 70's wrapper in `sync.ts`.
- **Livestreams:** 80 (schema, seed) → 81 (endpoint, `compareUpcomingLiveItems`) → 82 (device
  flag; it also edits 70's `actions.ts` and 37's `addByRssRepository.ts`) → 88 (no livestreams
  feed type; it edits files 22, 37, 41, 66, 67, 82, and 92 edit first) → 83 → 84 on web → 85 →
  89 → 86 → 95 on mobile → 87. 85 edits `HomeFeedRow.tsx` and `homeFeedData.ts` after 44 and 90.
  89 needs 31–33, 37–39, 50, 51, 85, and 90. 86 needs 85, 89, 82, 88, 90, and 40–44.
- **Feed page livestreams:** 95 edits `AddByRssEpisodesSection.tsx` (20, 21, 22, 34),
  `liveItemVisibility.ts`, the live-item controller, and `category-channel-item-read.test.ts`
  (81), and `lib/addByRss/liveRows.ts` (86), so it runs after all of them. It also needs 85's row
  helpers, 89's route and `playLiveItem`, and 90's `playbackMediaId`. It adds
  `compareChannelLiveItems` to `@podverse/helpers`, which 96 imports.
- **E2E:** 87 needs 36's fixture registry, 69's spec, and 95's row test ids. It creates
  `e2e/add-by-rss-livestream.yaml`, which 97 and 52 extend, and adds the live item to
  `media-list-chips.spec.ts`'s `PARSED_FEED`, which 96 extends.
- **Web channel livestream order:** 96 needs 95's comparator and 87's spec, so it follows 87.
  It shares no file with 97, but both append to the release scratchpad, so they do not pair.
- **Channel status label:** 97 edits `HomeFeedRow.tsx` (10, 85, 90), `liveItemRows.ts` and its
  test (85), `PodcastEpisodesSection.tsx` (10, 44, 85), `AlbumDetailScreen.tsx`, and step 7 of
  87's flow, so it follows 87. It runs before 52, which edits the same flow.
- **Player links last:** 52 edits `fullPlayerContentLink.ts`, `FullPlayerScreen.tsx`,
  `navigation/index.tsx`, `liveItemDetail.ts`, and 87's flow, so it runs after 50, 51, 39, 89,
  93, 94, 87, and 97. 53 edits `fullPlayerContentLink.ts` and its test after 52. Plan 53 is the
  last prompt, so it archives the set and carries the cumulative verification. Plan 52 moves
  only its own file.
- Web plans 65 and 66 restate mobile's merge rules (plans 40 and 41) in their own words, so they
  do not wait for the mobile code.

## File ownership in paired phases

| Phase | Mobile prompt owns                                                                                                             | Web prompt owns                                                                                                  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| 1     | 10: `HomeFeedRow.tsx`, `itemUnseen.ts`, `channelSeen.ts` in helpers, mobile `vitest.config.ts`, two guidance files, scratchpad | 60: chip utils and component, `localSettings.ts`, `routes.ts`, consumer and mobile catalog originals             |
| 2     | 20: Add by RSS detail screen and new `addByRss/` files, `ChannelHeader.tsx`, `e2e/add-by-rss.yaml`, scratchpad                 | 61: `app/_media-lists/{podcasts,artists,albums}/`, the three old list folders                                    |
| 3     | 21: section files, `downloadIdText.ts`, `ChannelAboutSection.tsx`, `e2e/add-by-rss.yaml`, scratchpad                           | 62: `app/_media-lists/{episodes,clips,tracks}/`, two Livestreams import paths                                    |
| 5     | 30: `downloadItem.ts`, `queueRepository.ts`, `useQueueMutations.ts`, `useAddByRssItemActions.tsx`                              | 63: `app/browse/`, playlists and profiles list modules, SEO, sitemap, consumer catalogs, scratchpad              |
| 7     | 32: `ItemDetailHeader.tsx`, `itemDetailDateLabel.ts`, `EpisodePlayChrome.tsx`, `components/content/index.ts`                   | 64: `app/page.tsx`, the deleted `HomePage*` files, `localSettings.ts`, `listViewMode.ts`, scratchpad             |
| 12    | 35: `credentialScope.ts` in helpers, web `chaptersTranscript.ts`, `itemSections.ts`, `segmentsRepository.ts`                   | 65: `useReadyAddByRSSFeeds.ts`, `utils/subscribed/`, channel row mappers, three channel list modules, scratchpad |
| 17    | 40: `homeFeedData.ts`, `HomeScreen.tsx`, `e2e/add-by-rss.yaml`, tab-stack rule, `ADD-BY-RSS.md`, scratchpad                    | 69: `apps/web/e2e/` specs, `e2e-spec-order-web.txt`                                                              |
| 18    | 41: `addByRssItemRows.ts`, `homeItemMerge.ts`, Home and library data, `APPS-MOBILE.md`, `mobile-react-native.mdc`, scratchpad  | 70: `utils/backgroundActivity/`, `useBackgroundActivity.ts`, web `utils/addByRSS/` tracking                      |

A paired prompt edits only the files its plan lists. Reading the other surface's parity source is
fine; editing it is not.

## Notes every prompt keeps

- Each prompt moves its own plan to `.llm/plans/completed/add-by-rss-parity/`. Prompt 53 also
  moves `00-REQUEST.md`, `00-SUMMARY.md`, this file, and `COPY-PASTA.md`, then removes the empty
  active directory. Prompt 52 moves only its own file.
- Each plan's § Release scratchpad says whether it appends an entry. Plans 30, 32, 35, 60, 61,
  62, 69, 70, and 87 append none. Plan 51's entry covers episodes, plan 39's tracks, plan
  52's livestream titles, plan 53's album channel link, plan 96's web livestream order, and plan
  97's Scheduled and Ended labels.
- Plan 20 keeps `'alphabetical'` in the `sortAddByRssHomeEpisodes` input type for the Add by RSS
  library; plan 41 needs no change for it.
- Plan 37 stores each mobile Add by RSS feed's type from its parsed medium and retypes stored
  feeds once from `channel.channel.medium_id` in the stored bundle. Plans 34, 38, 39, 41, and 88
  rely on music feeds being stored as `'artists'` or `'albums'`.
- Plan 90 makes `addByRssPlaybackMediaId` the playback id for Add by RSS items. Plans 85, 86,
  89, 91, 93, and 95 compare Add by RSS playback ids through that helper.
- Plan 91 adds an optional third argument, `completed = true`, to plan 30's
  `markAddByRssAsPlayed`.
- Livestreams are a flag, never a medium or a feed type (plans 80, 82, 88). No plan adds a
  livestream medium, channel type, or Add by RSS resource type.
- Channel livestream lists use one order: live, then scheduled, then ended within a day, latest
  end first (`compareChannelLiveItems` and `isLiveItemEndedAndStale`). The API's
  `getManyByChannel` and plan 95's mobile feed page use it, and plan 96 moves web's Add by RSS
  feed pages onto it. The Livestreams chips stay upcoming-only (`compareUpcomingLiveItems`).
- Inside a channel, plan 97 puts a neutral Scheduled or Ended badge at the start of a livestream
  row's date line. Outside a channel, plan 85's context-line prefix states the word.
- Directory livestream titles in the full player already open `EpisodeDetail`. Plans 39, 51,
  and 89 leave Add by RSS livestream titles plain; plan 52 links them. Plan 53 then opens a
  directory livestream on an album feed from the channel line onto the album page.
- Some mobile unit tests sit outside the mobile Vitest include list (`homeFeedData.test.ts`,
  `homeFeedData.localPaint.test.ts`, `browseTypes.test.ts`, `syncJobKinds.test.ts`,
  `offlineModeViews.test.ts`). Plans keep them accurate; they do not add them to the list unless
  the plan says so.
- Mobile reads `@podverse/helpers` and `@podverse/parser-mapping` from the built packages.
  Verification builds packages before mobile type-check and tests.
- Product code comments describe the code as it stands and never cite a plan or step number.
