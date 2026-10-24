# Artist, album, and track attribution — execution order

Prompts and models: [COPY-PASTA.md](COPY-PASTA.md). Request and settled review answers:
[00-REQUEST.md](00-REQUEST.md). Ledger and decisions: [00-SUMMARY.md](00-SUMMARY.md).

Phases run one after another. Prompts inside one phase run at once and own disjoint files, counting
the shared files in **parallel-plan-execution** § Shared files. Every phase has two or more
prompts, so no implementation prompt writes `release-notes/scratchpad.md`: each puts its entry in
its final message under "Release notes entry", and **Close** appends them all in plan order.

Final messages land in `.artifacts/plan-runner/artist-album-attribution/<NN>.md`. A prompt reads
the notes in the final messages of the plans its `## Runs after` names. Finished plans move to
`.llm/plans/completed/artist-album-attribution/`; a plan cited by a later plan is read there.

## Before Phase 1

- **Docker running.** Plan 01 adds the app migration and runs `make db_regen_linear_baseline`. If
  it reports the regen did not run, Close puts that command first in the verification.
- **Migration numbers.** Plan 01 takes app migration `0022` (`0021` is the last in the tree today);
  if another set lands one first, it takes the next free number and uses that name in the
  readiness marker and the release entry. Plan 80 takes mobile SQLite migration version 25 on the
  same terms.

## Outside this set

- **`web-player-marquee`** runs on its own worktree. Its plans 20 and 30 edit
  `MediaPlayerInfoDesktop.tsx`, `MediaPlayerInfoMobile.tsx`, `MediaPlayerInfoModal.tsx`, and
  `MediaPlayerInfoModal.module.scss`, which plans 50 and 76 here also edit. Plans 50 and 76 change
  the text expressions and add the artist row in place, leaving the title and subtitle elements
  where they are. Whichever branch merges second keeps both edits.
- **`publisher-medium-and-namespace-draft`** owns `detectDuckTypedPublisherMediumId` and
  `docs/proposals/podcast-namespace/`. No prompt here edits either.
- Other sets have landed edits in the mobile full player, mini player, and Add by RSS screens.
  Every prompt re-reads its files before editing; the plans' anchors are symbols, not line
  numbers.

## Dependency graph

From each plan's `## Runs after`:

| Plan | Change | Runs after | Phase |
| --- | --- | --- | --- |
| 01 | Publisher claims as lists, and the verified publisher link table | none | 1 |
| 20 | Add by RSS publisher listed feeds: response contract and pure planning | none | 1 |
| 02 | Verified publisher match rule and recompute service | 01 | 2 |
| 80 | Mobile stores what an Add by RSS artist lists, and albums it holds only for that artist | 20 | 2 |
| 90 | API: unfollow many feeds in one request | none | 2 |
| 03 | Recompute links on every parse, and map publisher claims as a list | 02 | 3 |
| 04 | New-album notifications name only verified or not-yet-parsed albums | 02 | 3 |
| 05 | Channel merges remove the absorbed channel's verified publisher links | 01, 02 | 3 |
| 06 | Worker command to backfill verified publisher links | 02 | 3 |
| 10 | Verified publishers on channel and item responses | 02 | 3 |
| 21 | Find directory channels for the feeds an Add by RSS artist lists | none | 3 |
| 22 | Adding an Add by RSS artist also parses the albums it lists | 20, 21 | 4 |
| 23 | E2E fixture: an Add by RSS artist that lists two albums | 20, 21 | 4 |
| 70 | Public read: which directory channel a feed guid is | 10, 21 | 4 |
| 81 | Mobile answers "which artist" for Add by RSS from memory | 10, 80 | 4 |
| 11 | Artist endpoint: verified albums, Not Yet Added, tracks from verified albums | 10 | 5 |
| 60 | Mobile verified-artist helpers and the artist chooser sheet | 10 | 5 |
| 71 | Web: store what an Add by RSS artist lists, and the albums parsed with it | 20, 22 | 5 |
| 82 | Mobile stores an Add by RSS artist's albums as their parses finish | 20, 22, 70, 80, 81 | 5 |
| 12 | Verified publishers on item lists, queue resources, and playlist resources | 10 | 6 |
| 13 | E2E fixtures for the artist page's album groups | 11 | 6 |
| 61 | Mobile full player artist line | 60 | 6 |
| 62 | Mobile mini player "Artist · Album" line | 60 | 6 |
| 63 | Mobile track screen artist byline | 60 | 6 |
| 64 | Lock screen and car now-playing: artist and album fields (phone-started playback) | 60 | 6 |
| 74 | Web: open, play, and follow an album an Add by RSS artist lists | 71 | 6 |
| 83 | Mobile: follow an album an Add by RSS artist listed, and unfollow back to listed | 80, 82 | 6 |
| 40 | Mobile artist screen: verified albums, Not Yet Added, track list | 11 | 7 |
| 50 | Web player artist line | 11, 12 | 7 |
| 65 | Car-started playback: artist and album from the native cache | 12, 64 | 7 |
| 66 | Maestro: artist line on the track screen, mini player, and full player | 61, 62, 63 | 7 |
| 67 | Phone playback from a download shows the album's artist | 12 | 7 |
| 30 | Web artist page: verified albums, Not Yet Added, verified tracks | 11, 13 | 8 |
| 41 | Maestro: artist album groups and the Podcast Index preview | 40, 13 | 8 |
| 68 | Car Downloads list and car-started download plays show the artist | 65, 67 | 8 |
| 72 | Web: match Add by RSS artists and albums by guid | 50, 71 | 8 |
| 84 | Mobile Add by RSS artist screen: Albums and Tracks | 80, 81, 82, 83 | 8 |
| 86 | Mobile player artist line for Add by RSS albums and albums Add by RSS artists list | 60, 61, 62, 63, 64, 65, 81 | 8 |
| 51 | Directory track page artist byline | 50 | 9 |
| 73 | Web: Add by RSS artist page Albums and Tracks by guid | 71, 72 | 9 |
| 76 | Web: player artist line for Add by RSS artists | 50, 70, 72 | 9 |
| 85 | Mobile directory artist page: Your Add by RSS Albums and their tracks | 40, 80, 81, 82, 84 | 9 |
| 91 | Catalog keys for the unsubscribe-from-artist dialog | 40 | 9 |
| 75 | Web: Your Add by RSS Albums and tracks on a directory artist page | 30, 72, 73, 74 | 10 |
| 77 | Web: artist byline on Add by RSS track pages | 51, 74, 76 | 10 |
| 87 | Mobile Add by RSS track screen: artist link in the byline | 63, 81, 85, 86 | 10 |
| 92 | Web: ask about albums when unsubscribing from a directory artist | 11, 30, 90, 91 | 10 |
| 94 | Mobile: the unsubscribe-from-artist dialog, its data, and many unfollows at once | 40, 83, 84, 90, 91 | 10 |
| 78 | Web E2E: an Add by RSS artist's albums, player line, byline, and directory page | 11, 30, 50, 51, 73, 74, 75, 76, 77 | 11 |
| 88 | Maestro: an Add by RSS artist on mobile, end to end | 23, 61, 82, 83, 84, 86, 87 | 11 |
| 93 | Web: ask about albums when unsubscribing from an Add by RSS artist | 71, 72, 73, 90, 91, 92 | 11 |
| 95 | Mobile: every artist unsubscribe asks about albums | 40, 83, 84, 85, 94 | 11 |
| 96 | Playwright: the unsubscribe-from-artist dialog on web | 13, 78, 92, 93 | 12 |
| 97 | Maestro: the unsubscribe-from-artist dialog on mobile | 41, 88, 95 | 12 |
| Close | Append release entries, archive the set, cumulative verification | 01–97 | 13 |

## Shared files that set the order

Each file below is edited by several plans, each in a different phase.

- `apps/api/openapi.yml`: 20 (P1), 90 (P2), 10 (P3), 70 (P4), 11 (P5), 12 (P6).
- `packages/orm/src/index.ts`: 01 (P1), 02 (P2), 21 (P3).
  `packages/orm/src/services/channel/channelVerifiedPublisher.ts`: 02, 10, 11.
  `packages/orm/src/entities/channel/channel.ts`: 01, 10. `packages/orm/src/entities/item/item.ts`:
  10, 12.
- `packages/helpers/src/dtos/item/item.ts`: 10, 12. `packages/helpers/src/dtos/index.ts`: 10, 70.
  `packages/helpers-requests/src/api/_request.ts`: 90, 70.
- `apps/api/src/controllers/channel.ts`: 10, 70. `apps/api/src/controllers/item.ts`,
  `apps/api/src/lib/verifiedPublishers.ts`, and `verified-publisher-reads.integration.test.ts`: 10,
  12. `category-channel-item-read.test.ts`: 10, 11. `tools/web/seed-e2e.mjs`: 11, 13.
- `apps/workers/src/lib/startup/categoriesForCommand.ts` and its test: 06 (P3), 22 (P4).
- **Consumer catalog originals** (`packages/i18n-catalog/consumer/originals/*.json`): 40 (P7),
  30 (P8), 91 (P9), 75 (P10). One catalog prompt per phase, so each may run `npm run i18n:compile`.
  Plan 40 lands first and inserts all four artist-page keys under `media.music`
  (`verified_albums`, `your_add_by_rss_albums`, `not_yet_added`, `not_yet_added_albums_note`).
  Plans 30 and 75 add only keys that are still missing and keep the values already there.
- `makefiles/local/e2e-spec-order-web.txt`: 50 (P7), 30 (P8), 51 (P9), 78 (P11), 96 (P12).
- `apps/mobile/vitest.config.ts`: 80 (P2), 81 (P4), 60 (P5), 64 (P6), 40 (P7), 84 (P8), 94 (P10).
- Mobile Add by RSS data: `addByRssRepository.ts` 80, 81, 82, 83, 84; `data/db/index.ts` 80, 81;
  `addByRssListedFeeds.ts` 80, 82; `lib/addByRss/domain.ts` 82, 83; `subscriptionsRepository.ts`
  83, 94; `AddByRssHomeDetailScreen.tsx` 83, 84, 95.
- Mobile player: `verifiedArtists.ts` 60, 65, 86; `ArtistChooserSheet.tsx` 60, 86;
  `FullPlayerScreen.tsx` and `fullPlayerContentLink.ts` 61, 86; `MiniPlayer.tsx` 62, 86;
  `TrackDetailScreen.tsx` 63, 86; `components/content/index.ts` 60, 84, 85; `AlbumListRow.tsx` and
  `AddByRssEpisodesSection.tsx` 84, 85.
- Mobile car and downloads: `projection.ts`, `projection.test.ts`, the two CarPlay Swift files,
  `PodverseNativeCacheModel.kt`, and `PodverseMediaLibraryService.kt` 65, 68;
  `channelItemsRepository.ts` and `downloadsRepository.ts` 67, 68.
- Mobile artist screen: `ArtistDetailScreen.tsx` 40, 95; `ArtistYourAddByRssAlbumsSection.tsx` and
  `ArtistYourAddByRssTracksSection.tsx` 40 (stubs), 85 (fills them).
- Web player: `artistPublishers.ts`, `mediaPlayerInfoResolution.ts` and their tests, and the three
  `MediaPlayerInfo*.tsx` components: 50, 76. `CoreTrackHeader.tsx`: 51, 77.
- Web Add by RSS: `types.ts`, `itemIndex.ts`, `listedFeeds.ts`, `actions.ts`, and their tests 71,
  74 (`actions.ts` also 93); `AddByRSSTrackItemPageClient.tsx` 74, 77.
- Web artist page: `ArtistPageAddByRssSections.tsx` 30 (mount points), 75 (fills them);
  `ArtistPageClient.tsx` 30, 92. `apps/web/src/lib/artistUnsubscribe.ts` and its test: 92, 93.
- E2E: `apps/web/e2e/add-by-rss-artist-albums.spec.ts` and `helpers/addByRSSArtist.ts` 78, 96;
  `apps/mobile/e2e/add-by-rss-artist.yaml`, `apps/mobile/e2e/README.md`, and
  `scripts/mobile/e2e-test.sh` 88, 97.

## Phases

Each prompt owns exactly its plan's `## Files`. The lists below repeat them for the phase.

### Phase 1 — schema and the Add by RSS listed-feeds contract

- **01** owns the app migration `0022_channel_verified_publisher.sql`, both bootstrap baseline
  archives, `infra/k8s/base/api/source/api.env`, `infra/k8s/base/ops/kustomization.yaml`;
  `packages/orm/src/` `index.ts`, `db/entities.ts`, `entities/channel/` `channel.ts`,
  `channelPublisher.ts`, `channelPublisherRemoteItem.ts`, `channelVerifiedPublisher.ts`,
  `services/archiver.ts` and its test, `services/channel/` `channel.ts`,
  `channelPublisherRemoteItem.ts`; `packages/helpers/src/dtos/channel/channelPublisherRemoteItem.ts`.
- **20** owns `apps/api/openapi.yml`, `packages/helpers/src/lib/addByRSSParseCache.ts`,
  `packages/parser-mapping/src/index.ts`, `packages/parser-mapping/src/addByRSS/`
  `resourceType.ts`, `publisherListedFeeds.ts` and their tests, and
  `.cursor/rules/add-by-rss-data-contracts.mdc`.

### Phase 2 — match rule, mobile listed-feed storage, bulk unfollow endpoint

- **02** owns `packages/orm/src/index.ts`, `packages/orm/src/lib/verifiedPublisherMatch.ts` and its
  test, `packages/orm/src/services/channel/channelVerifiedPublisher.ts`, and
  `apps/api/src/test/channel-verified-publisher.integration.test.ts`.
- **80** owns `apps/mobile/src/data/db/` `migrations.ts` and its test, `schema.ts`, `index.ts`,
  `applyAddByRssPublisherRefs.ts`; `apps/mobile/src/lib/addByRss/publisherRefs.ts` and its test;
  `apps/mobile/src/data/repositories/` `addByRssListedFeeds.ts` and its test,
  `addByRssRepository.ts`, `channelSeenRepository.ts`; `apps/mobile/src/prefs/addByRSSFeeds.ts`;
  `apps/mobile/vitest.config.ts`.
- **90** owns `apps/api/openapi.yml`, `apps/api/src/controllers/account/accountUnfollowBulk.ts`,
  `apps/api/src/routes/account.ts`, `apps/api/src/test/account-follows-notifications.test.ts`,
  `packages/helpers/src/lib/followChannelsBulk.ts`, `packages/orm/src/services/account/`
  `accountFollowingChannel.ts`, `accountFollowingAddByRSSChannel.ts`, and
  `packages/helpers-requests/src/api/` `_request.ts`, `account/follow/unfollowBulk.ts`.

### Phase 3 — parser hooks, merges, backfill, read fields, directory match (6 prompts)

- **03** owns `packages/parser/src/lib/rss/channel/` `channel.ts`, `channelVerifiedPublisher.ts` and
  its test; `packages/parser-mapping/src/types/partytime.ts`,
  `packages/parser-mapping/src/compat/partytime/` `channel.ts`, `channel.publisherClaims.test.ts`.
- **04** owns `packages/parser/src/lib/notifications/handleNewRemoteItemNotifications.ts` and its
  test.
- **05** owns `packages/orm/src/services/channel/` `channelMergeRowJournal.ts`,
  `applyChannelMerge.ts`, and `apps/api/src/test/channel-merge.integration.test.ts`.
- **06** owns `apps/workers/package.json`, `apps/workers/src/commands/index.ts`,
  `apps/workers/src/commands/orm/verifiedPublisherLinks/backfill.ts` and its test,
  `apps/workers/src/lib/startup/categoriesForCommand.ts` and its test,
  `packages/worker-commands/src/registry.ts`, and `infra/k8s/base/cron/` `kustomization.yaml`,
  `worker-verified-publisher-links-backfill.cronjob.yaml`.
- **10** owns `apps/api/openapi.yml`, `apps/api/src/controllers/` `channel.ts`, `item.ts`,
  `apps/api/src/lib/verifiedPublishers.ts`, `apps/api/src/test/` `category-channel-item-read.test.ts`,
  `verified-publisher-reads.integration.test.ts`; `packages/helpers/src/` `index.ts`,
  `dtos/index.ts`, `dtos/channel/` `channel.ts`, `verifiedPublisher.ts`, `dtos/item/item.ts`,
  `lib/verifiedPublishers.ts` and its test; `packages/orm/src/entities/channel/channel.ts`,
  `packages/orm/src/entities/item/item.ts`, `packages/orm/src/services/channel/channelVerifiedPublisher.ts`.
- **21** owns `packages/orm/src/index.ts`,
  `packages/orm/src/services/channel/channelAddByRSSDirectoryMatch.ts`, and
  `apps/api/src/test/channel-add-by-rss-directory-match.integration.test.ts`.

### Phase 4 — Add by RSS fan-out, its fixture, the directory-match route, mobile artist index

- **22** owns `apps/workers/src/commands/mq/rss/runAddByRSSParser.ts`, `apps/workers/src/lib/addByRSS/`
  `fanOutAddByRSSPublisherListedFeeds.ts`, `resolveAddByRSSMessageCredentials.ts` and their tests,
  `apps/workers/src/lib/startup/categoriesForCommand.ts` and its test, `apps/workers/ENV.md`,
  `packages/mq/src/types/mq.ts`, `packages/mq/src/functions/mq/rss/addByRSS.ts` and its test,
  `docs/features/ADD-BY-RSS.md`, and `.cursor/rules/add-by-rss-client-held-credentials.mdc`.
- **23** owns `apps/api/src/controllers/account/accountAddByRSSParse.ts`,
  `apps/api/src/lib/addByRSSE2ePublisherFixture.ts`, and
  `apps/api/src/test/add-by-rss-parse-publisher-fixture.test.ts`.
- **70** owns `apps/api/openapi.yml`, `apps/api/src/controllers/channel.ts`,
  `apps/api/src/routes/channel.ts`, `apps/api/src/test/channel-directory-match.test.ts`,
  `packages/helpers/src/dtos/index.ts`, `packages/helpers/src/dtos/channel/channelDirectoryMatch.ts`,
  and `packages/helpers-requests/src/api/` `_request.ts`, `channel/channel.ts`.
- **81** owns `apps/mobile/src/lib/playback/lineArtist.ts` and its test,
  `apps/mobile/src/lib/addByRss/addByRssArtistIndex.ts` and its test,
  `apps/mobile/src/hooks/useAddByRssArtistIndexVersion.ts`, `apps/mobile/src/data/db/` `index.ts`,
  `readAddByRssArtistIndex.ts`, `apps/mobile/src/data/repositories/addByRssRepository.ts`, and
  `apps/mobile/vitest.config.ts`.

### Phase 5 — artist endpoint, mobile helpers, web listed store, mobile album sync

- **11** owns `apps/api/openapi.yml`, `apps/api/src/controllers/publisherFeed.ts`,
  `apps/api/src/lib/remoteItems.test.ts`, `apps/api/src/test/` `category-channel-item-read.test.ts`,
  `publisher-feed-verified.integration.test.ts`, `packages/helpers/src/dtos/remoteItem.ts`,
  `packages/orm/src/services/` `publisherFeed.ts`, `publisherFeed.helpers.ts` and its test,
  `channel/channelVerifiedPublisher.ts`, and `tools/web/seed-e2e.mjs`.
- **60** owns `apps/mobile/src/lib/playback/verifiedArtists.ts` and its test,
  `apps/mobile/src/components/content/` `ArtistChooserSheet.tsx`, `index.ts`, and
  `apps/mobile/vitest.config.ts`.
- **71** owns `apps/web/src/utils/addByRSS/` `types.ts`, `storage.ts`, `itemIndex.ts`,
  `listedFeeds.ts` and its test, `actions.ts`, `actions.publisherListedFeeds.test.ts`, `sync.ts` and
  its test.
- **82** owns `apps/mobile/src/lib/addByRss/domain.ts` and its test,
  `apps/mobile/src/data/repositories/` `addByRssListedFeeds.ts` and its test, `addByRssRepository.ts`,
  `apps/mobile/src/hooks/useAddByRssAddFlow.ts`, `apps/mobile/src/sync/` `syncJobKinds.ts` and its
  test, `syncJobPlan.ts`, `syncJobs.ts`, `syncQueue.test.ts`, `SyncProvider.tsx`,
  `requestAddByRssRefresh.ts`, and `apps/mobile/src/screens/more/errorLogPresentation.ts`.

### Phase 6 — list and queue fields, artist fixtures, mobile player surfaces, listed albums (8 prompts)

- **12** owns `apps/api/openapi.yml`, `apps/api/src/controllers/` `item.ts`,
  `queue/queueResource.ts`, `playlist/playlistResource.ts`, `apps/api/src/lib/verifiedPublishers.ts`,
  `apps/api/src/test/` `verified-publisher-reads.integration.test.ts`, `queue.test.ts`,
  `playlist.test.ts`, `packages/helpers/src/dtos/item/item.ts`, and
  `packages/orm/src/entities/item/item.ts`.
- **13** owns `apps/api/src/lib/` `e2eArtistAlbumsFixture.ts`, `remoteItems.ts`,
  `apps/api/src/controllers/externalServices/podcastIndex.ts`,
  `apps/api/src/test/e2e-artist-albums-fixture.test.ts`, `tools/web/seed-e2e.mjs`, and
  `apps/web/e2e/helpers/seedConstants.ts`.
- **61** owns `apps/mobile/src/screens/player/` `FullPlayerScreen.tsx`, `fullPlayerLayout.ts`,
  `fullPlayerContentLink.ts`, and their tests.
- **62** owns `apps/mobile/src/components/player/MiniPlayer.tsx`.
- **63** owns `apps/mobile/src/components/channel/` `ChannelHeader.tsx`, `index.ts`, and
  `apps/mobile/src/screens/track/TrackDetailScreen.tsx`.
- **64** owns `apps/mobile/modules/podverse-media-engine/src/` `types.ts`,
  `bridgeCommandSerialization.ts` and its test, `PodverseAudioEngine.swift`, `PodverseAudioEngine.kt`,
  `apps/mobile/src/lib/playback/` `mediaEngineSourceMeta.ts`, `engineSourceAdoption.ts` and their
  tests, and `apps/mobile/vitest.config.ts`.
- **74** owns `apps/web/src/utils/addByRSS/` `types.ts`, `itemIndex.ts`, `listedFeeds.ts` and its
  test, `actions.ts`, `actions.publisherListedFeeds.test.ts`;
  `apps/web/src/components/AddByRSS/Detail/AddByRSSDetailClient.tsx`,
  `apps/web/src/components/AddByRSS/Artist/Album/AddByRSSAlbumHeader.tsx`,
  `apps/web/src/components/Settings/AddByRSSCredentialsSettingsSection.tsx`, and
  `apps/web/src/app/add-by-rss/` `album/AddByRSSAlbumPageClient.tsx`,
  `track/AddByRSSTrackItemPageClient.tsx`, `livestream/AddByRSSLivestreamItemPageClient.tsx`,
  `credentials/AddByRSSCredentialsPageClient.tsx`.
- **83** owns `apps/mobile/src/data/repositories/` `addByRssRepository.ts`,
  `subscriptionsRepository.ts`, `apps/mobile/src/hooks/useAddByRssFeeds.ts`,
  `apps/mobile/src/lib/addByRss/domain.ts` and its test, and
  `apps/mobile/src/screens/home/AddByRssHomeDetailScreen.tsx`.

### Phase 7 — mobile artist screen, web player, car and download artist fields

- **40** owns `apps/mobile/src/screens/artist/` `ArtistDetailScreen.tsx`, `artistDetailSections.ts`
  and its test, `ArtistYourAddByRssAlbumsSection.tsx`, `ArtistYourAddByRssTracksSection.tsx`;
  `apps/mobile/vitest.config.ts`; the four consumer catalog originals (the `media.music` keys only).
- **50** owns `apps/web/src/lib/artistPublishers.ts` and its test,
  `apps/web/src/utils/mediaPlayer/mediaPlayerInfoResolution.ts` and its test,
  `apps/web/src/components/MediaPlayer/` `Modal/MediaPlayerInfoModal.tsx`,
  `Modal/MediaPlayerArtistChooser.tsx`, `Desktop/MediaPlayerInfoDesktop.tsx`,
  `Mobile/MediaPlayerInfoMobile.tsx`, their two Modal SCSS modules,
  `apps/web/e2e/media-player-artist-line.spec.ts`, and `makefiles/local/e2e-spec-order-web.txt`.
- **65** owns `apps/mobile/src/lib/playback/verifiedArtists.ts` and its test,
  `apps/mobile/src/data/nativeCache/` `projection.ts` and its test, `carCacheReproject.ts`,
  `apps/mobile/src/data/repositories/queueRepository.ts`, `PodverseCarPlayCacheModel.swift`,
  `PodverseCarPlaySceneDelegate.swift`, `PodverseNativeCacheModel.kt`, and
  `PodverseMediaLibraryService.kt`.
- **66** owns `apps/mobile/e2e/track.yaml`.
- **67** owns `apps/mobile/src/data/repositories/` `channelItemsRepository.ts`,
  `downloadsRepository.ts`, `playbackContentRepository.ts`, and
  `apps/mobile/src/lib/playback/buildChannelFromDownload.ts` and its test.

### Phase 8 — web artist page, artist Maestro, car downloads, Add by RSS matching and screens (6 prompts)

- **30** owns `apps/web/src/app/artist/[channel_id]/` `page.tsx`, `ArtistPageClient.tsx`,
  `ArtistPageList.tsx`, `ArtistPageListHeader.tsx`, `ArtistPageAlbumSections.tsx`,
  `ArtistPageAddByRssSections.tsx`; `apps/web/src/styles/components/Artist/ArtistPageAlbumSections.module.scss`;
  `apps/web/src/components/List/Music/Albums/Tracks/` `ListTracksRemoteItems.tsx`,
  `ListTrackRemoteItemNodes.tsx`, `ListTrackRowRemoteItemUnadded.tsx`, `ListTrackGridNodeUnadded.tsx`;
  the four consumer catalog originals; `apps/web/e2e/artist-page-albums-and-tracks.spec.ts`; and
  `makefiles/local/e2e-spec-order-web.txt`.
- **41** owns `apps/mobile/e2e/artist.yaml`.
- **68** owns `apps/mobile/src/data/nativeCache/projection.ts` and its test,
  `apps/mobile/src/data/repositories/` `downloadsRepository.ts`, `channelItemsRepository.ts`, the two
  CarPlay Swift files, `PodverseNativeCacheModel.kt`, and `PodverseMediaLibraryService.kt`.
- **72** owns `apps/web/src/utils/addByRSS/` `publisherLinks.ts`, `credentialsStatus.ts`, and their
  tests.
- **84** owns `apps/mobile/src/prefs/detailListPrefs.ts`, `apps/mobile/src/screens/home/addByRss/`
  `addByRssDetailSections.ts`, `addByRssArtistAlbums.ts` and their tests, `useAddByRssArtistAlbums.ts`,
  `AddByRssArtistAlbumsSection.tsx`, `AddByRssArtistTracksSection.tsx`, `AddByRssEpisodesSection.tsx`,
  `AddByRssDownloadedSection.tsx`; `apps/mobile/src/screens/home/AddByRssHomeDetailScreen.tsx`;
  `apps/mobile/src/components/content/` `AlbumListRow.tsx`, `index.ts`;
  `apps/mobile/src/data/repositories/addByRssRepository.ts`; and `apps/mobile/vitest.config.ts`.
- **86** owns `apps/mobile/src/lib/playback/verifiedArtists.ts` and its test,
  `apps/mobile/src/components/content/ArtistChooserSheet.tsx`, `apps/mobile/src/screens/player/`
  `fullPlayerContentLink.ts` and its test, `FullPlayerScreen.tsx`,
  `apps/mobile/src/components/player/MiniPlayer.tsx`, and
  `apps/mobile/src/screens/track/TrackDetailScreen.tsx`.

### Phase 9 — track byline, Add by RSS artist page and player line, Your Add by RSS on mobile, dialog keys

- **51** owns `apps/web/src/components/Core/Artist/Album/Track/CoreTrackHeader.tsx`,
  `apps/web/src/styles/components/Common/Media/Podcast/Episode/EpisodeHeader.module.scss`,
  `apps/web/e2e/track-artist-byline.spec.ts`, and `makefiles/local/e2e-spec-order-web.txt`.
- **73** owns `apps/web/src/app/add-by-rss/artist/` `AddByRSSArtistPageClient.tsx`,
  `AddByRSSArtistPageList.tsx`, `addByRSSArtistAlbumListItems.ts` and its test,
  `apps/web/src/components/AddByRSS/List/AddByRSSNeedsCredentialsSection.tsx`, and
  `apps/web/src/utils/addByRSS/albumTracks.ts` and its test.
- **76** owns `apps/web/src/lib/artistPublishers.ts` and its test,
  `apps/web/src/utils/addByRSS/deviceArtistLinks.ts` and its test,
  `apps/web/src/hooks/useDeviceArtistLinks.ts`,
  `apps/web/src/utils/mediaPlayer/mediaPlayerInfoResolution.ts` and its test, and the three
  `MediaPlayerInfo*.tsx` components.
- **85** owns `apps/mobile/src/screens/artist/` `ArtistYourAddByRssAlbumsSection.tsx`,
  `ArtistYourAddByRssTracksSection.tsx`, `useArtistYourAddByRssTrackDetails.ts`;
  `apps/mobile/src/components/content/` `AddByRssRowMarker.tsx`, `AlbumListRow.tsx`, `index.ts`;
  `apps/mobile/src/screens/home/addByRss/` `AddByRssEpisodesSection.tsx`, `addByRssStackParams.ts`;
  `apps/mobile/src/navigation/index.tsx`; and `.cursor/rules/mobile-tab-stack-isolation.mdc`.
- **91** owns the four consumer catalog originals (the unsubscribe-dialog keys only).

### Phase 10 — Your Add by RSS on web, Add by RSS track bylines, unsubscribe dialogs

- **75** owns `apps/web/src/app/artist/[channel_id]/ArtistPageAddByRssSections.tsx`,
  `apps/web/src/utils/addByRSS/artistPageAddByRss.ts` and its test,
  `apps/web/src/components/AddByRSS/AddByRSSRowMarker.tsx` and its SCSS module,
  `apps/web/src/components/Common/Artist/Album/` `types.ts`, `CommonAlbumRow.tsx`,
  `CommonAlbumGridNode.tsx`, `Track/CommonTrackRow.tsx`,
  `apps/web/src/components/AddByRSS/Artist/Album/Track/` `AddByRSSTrackRow.tsx`,
  `AddByRSSTrackNodes.tsx`, and the four consumer catalog originals.
- **77** owns `apps/web/src/components/Media/Header/TrackArtistByline.tsx`,
  `apps/web/src/components/Core/Artist/Album/Track/CoreTrackHeader.tsx`,
  `apps/web/src/components/AddByRSS/Artist/Album/Track/AddByRSSTrackDetailHeader.tsx`, and
  `apps/web/src/app/add-by-rss/track/AddByRSSTrackItemPageClient.tsx`.
- **87** owns `apps/mobile/src/screens/home/AddByRssTrackDetailScreen.tsx`.
- **92** owns `apps/web/src/lib/artistUnsubscribe.ts` and its test,
  `apps/web/src/components/Media/Header/` `UnsubscribeArtistModal.tsx`, `SubscribeButton.tsx`,
  `HeaderButtons.tsx`, `apps/web/src/components/Core/Artist/` `CoreArtistHeader.tsx`,
  `CoreArtistHeaderButtons.tsx`, `CoreArtistHeaderViewDesktop.tsx`, `CoreArtistHeaderViewTablet.tsx`,
  and `apps/web/src/app/artist/[channel_id]/ArtistPageClient.tsx`.
- **94** owns `apps/mobile/src/components/feedback/ConfirmDialog.tsx`,
  `apps/mobile/src/data/repositories/subscriptionsRepository.ts`, `apps/mobile/src/screens/artist/`
  `artistUnsubscribeTargets.ts` and its test, `useArtistUnsubscribe.tsx`, and
  `apps/mobile/vitest.config.ts`.

### Phase 11 — web Add by RSS E2E, Add by RSS Maestro, unsubscribe wiring

- **78** owns `apps/web/e2e/helpers/` `addByRSSCredentials.ts`, `addByRSSArtist.ts`,
  `apps/web/e2e/add-by-rss-artist-albums.spec.ts`, and `makefiles/local/e2e-spec-order-web.txt`.
- **88** owns `apps/mobile/e2e/add-by-rss-artist.yaml`, `apps/mobile/e2e/README.md`, and
  `scripts/mobile/e2e-test.sh`.
- **93** owns `apps/web/src/lib/artistUnsubscribe.ts` and its test, `apps/web/src/utils/addByRSS/`
  `artistUnsubscribe.ts`, `api.ts`, `actions.ts`, `actions.test.ts`, and
  `apps/web/src/components/AddByRSS/Artist/AddByRSSArtistHeader.tsx`.
- **95** owns `apps/mobile/src/screens/artist/ArtistDetailScreen.tsx`, `apps/mobile/src/screens/home/`
  `AddByRssHomeDetailScreen.tsx`, `HomeScreen.tsx`, and
  `apps/mobile/src/screens/rss/AddByRssRootScreen.tsx`.

### Phase 12 — unsubscribe E2E on web and mobile

- **96** owns `apps/web/e2e/helpers/` `channelFollows.ts`, `addByRSSArtist.ts`,
  `apps/web/e2e/add-by-rss-artist-albums.spec.ts`, `apps/web/e2e/artist-unsubscribe-albums-prompt.spec.ts`,
  and `makefiles/local/e2e-spec-order-web.txt`.
- **97** owns `apps/mobile/e2e/` `artist-unsubscribe.yaml`, `add-by-rss-artist.yaml`, `README.md`,
  and `scripts/mobile/e2e-test.sh`.

### Close — alone

Appends every "Release notes entry" from the final messages of the 37 plans that ship one (01, 02,
03, 04, 05, 06, 10, 11, 12, 22, 30, 40, 50, 51, 61, 62, 63, 64, 65, 67, 68, 70, 73, 74, 75, 76, 77,
82, 83, 84, 85, 86, 87, 90, 92, 93, 95) to `release-notes/scratchpad.md`, archives the set, and
ends with the cumulative verification.

## Deploy order

Ship the migration first, run the plan 06 backfill
(`ormVerifiedPublisherLinksBackfill`), then ship the API with plan 11. Otherwise artist pages show
no albums until each album and artist is parsed again. Mobile builds with plans 64, 65, and 68 need
a native rebuild (new store build).

## Checks that need a person

- Native: iOS lock screen and Control Center, the Android media notification, the CarPlay
  simulator, and the Android Auto DHU, for phone-started, car-started, and download plays (plans
  64, 65, 67, 68).
- Mobile Add by RSS: Your Add by RSS Albums on a directory artist page (R47, R49) and the player
  line for a directory album an Add by RSS artist lists (R52). No fixture album names a directory
  artist, so plans 81 and 86 cover these with unit tests only.
