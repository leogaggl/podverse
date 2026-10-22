# Artist, album, and track attribution — summary

The request and the settled design are in [00-REQUEST.md](00-REQUEST.md). Models and the run
order are in `COPY-PASTA.md` once the set is assembled.

## Requirement ledger

One row per distinct ask, quoting the request. A row listed under several areas is planned by
each area for its own surface or layer; Close fills Plan from every plan's `## Rows`.

- **R1** (area A) "I'm wondering how Podverse is set up to handle the artist's albums, tracks feature" — Plan: (pending)
- **R2** (areas A, B) "there are references going on that may make it difficult for us to query for, let's say, all the tracks by an artist" — Plan: (pending)
- **R3** (area A) "while we can count on there always being an album feed, there may not even be an artist feed that corresponds with that album feed" — Plan: (pending)
- **R4** (area A) "in order to maintain integrity so that artists cannot wrongfully claim that they are the creator of an album, there needs to be some cross-referencing of IDs that are within the feeds, so that we can verify that they both represent a relationship that should exist" — Plan: (pending)
- **R5** (area A) "I believe the podcast index's specs should already explain how to handle this scenario" — Plan: (pending)
- **R6** (areas F, G) "on the player screen, if an artist's name is available, we may want to add yet another row of text above the album title, which will be smaller text and it will represent the artist's name" — Plan: (pending)
- **R7** (area B) "that will somehow have to go up the chain from item to album to artist. And we, as I said, need to make sure we verify the integrity of these cross references" — Plan: (pending)
- **R8** (all areas) "it is very important that you bear in mind both web and mobile experiences, as well as add by RSS and non-add by RSS" — Plan: (pending)
- **R9** (area A) "I want answer A only when both feeds point at each other ... regardless, it seems important that we have this cross feed verification" — Plan: (pending)
- **R10** (area A) "guids match both ways, and when the album's pointer has a `feedUrl` it must match the artist feed's URL (http/https and known redirects allowed)" — Plan: (pending)
- **R11** (area A) "Guid-only matching is not enough: `channel.podcast_guid` is unique and the first feed parsed keeps it, so a feed can squat a real artist's guid" — Plan: (pending)
- **R12** (area A) "Store the result as verified link rows, many-to-many: publisher channel, album channel, and an optional item for a future track-level credit" — Plan: (pending)
- **R13** (area A) "Recompute an album's links whenever the album or any publisher it involves is parsed, so a reference dropped from either feed removes the link" — Plan: (pending)
- **R14** (area A) "Store publisher claims as lists. `channel_publisher_remote_item` allows one row per album today (unique on `channel_publisher_id`); relax that so several claims fit" — Plan: (pending)
- **R15** (area A) "what if there are two valid artists for one album or two valid artists for one track? ... let's make sure our design is able to support that" (round 3: "many-to-many links now; only the parser changes later") — Plan: (pending)
- **R16** (area A) "Record labels shown as artists: 'I would say yes, but I hope that whatever decision we go forward with could be potentially migrated and changed in the future for the publisher experience'" (settled: "Name the link generically ('verified publisher'), not 'artist'") — Plan: (pending)
- **R17** (area A) "can't the artist feed contain content that is not just an album, but perhaps a direct reference to an item? Do we have a solution for how to handle this in the UI and database?" — Plan: (pending)
- **R18** (areas B, D, E) "Item-level references in a directory artist feed are not shown; no spec mechanism can verify them." — Plan: (pending)
- **R19** (areas C, H, I) "Item-level references in an Add by RSS artist feed show in its Tracks tab once their album is parsed." — Plan: (pending)
- **R20** (areas B, D, E) "Artist Tracks tab: all tracks on the artist's verified albums." — Plan: (pending)
- **R21** (areas B, F, G) "Every reader takes a list of publishers: the player's artist line, the track page byline, the OS artist field, and the artist page's Albums and Tracks tabs." — Plan: (pending)
- **R22** (areas D, E) "Albums tab, top to bottom: 1. Verified albums. 2. Your Add by RSS Albums ... 3. Not Yet Added" — Plan: (pending)
- **R23** (areas B, D, E) "Will a user be able to at least see in some way what those feeds are and be able to manually add it for parsing if they're a premium member, like other feeds? ... We need this experience to be thought through and nice and clean" (round 3: "a separate Not Yet Added section with a helper note") — Plan: (pending)
- **R24** (areas D, E) "Tapping a row opens the Podcast Index preview" (web `/podcast-index/feed/[id]`, mobile `SearchResultDetail` on the current tab's stack) — Plan: (pending)
- **R25** (area B) "Albums that are parsed but do not point back disappear from the artist page." — Plan: (pending)
- **R26** (area B) "References Podcast Index does not know are hidden." — Plan: (pending)
- **R27** (areas F, G) "Player line order: track title, then the artist (smaller), then the album" on the "mobile full player and web full-screen player modal" — Plan: (pending)
- **R28** (areas F, G) "Artist line is a link: 'On the full player screens, yes.'" — Plan: (pending)
- **R29** (area G) "on mobile, Home when followed, Browse otherwise, like the album line" — Plan: (pending)
- **R30** (areas F, G) "No verified artist: the artist line is hidden." — Plan: (pending)
- **R31** (areas F, G) "More than one artist in the player: the line shows 'A, B'; tapping opens a chooser listing each artist." — Plan: (pending)
- **R32** (areas F, G) "for the mobile mini-player and the web-player bar, there may not be enough vertical real estate to put three lines in there" (settled: "The second line is 'Artist · Album' when there is an artist, else the album as today") — Plan: (pending)
- **R33** (area G) "On mobile it scrolls in the same `MarqueeText` turn group as the title." — Plan: (pending)
- **R34** (area G) "Lock screen, CarPlay, and Android Auto sound good, but if they are limited to only two rows, how would you recommend handling that?" (settled: "structured fields, not concatenated strings") — Plan: (pending)
- **R35** (area G) "Lock screen, CarPlay, Android Auto with no verified artist: the album title goes in the artist field, as today, so the second line is never blank." — Plan: (pending)
- **R36** (area G) "iOS has `MPMediaItemPropertyAlbumTitle` and Media3 has `setAlbumTitle`; this needs a native change and a rebuild, and a device check." — Plan: (pending)
- **R37** (area G) "Mobile stores items and channels on disk (queue cache, channel items). The artist names ride in those payloads as an added field; older stored rows show no artist line until they refresh." — Plan: (pending)
- **R38** (areas F, G) "yes on the track pages" (directory track pages, web and mobile, artist as a link in the byline) — Plan: (pending)
- **R39** (areas F, G) "but not on the album pages right now" — Plan: (pending)
- **R40** (areas C, H, I) "if somebody uses the AdByRSS, then we could just trust the input as it is" (settled: "Matching is by guid, on the device. Nothing from an Add by RSS feed changes a public page or server-side data anyone else sees.") — Plan: (pending)
- **R41** (area C) "if a user parses an artist feed, or in other words, a publisher feed, all of the eligible items within it that fit within our schema should parse and be returned" — Plan: (pending)
- **R42** (areas C, H, I) "returned in a way where the AdByRSSUX understands that this album was from this artist" — Plan: (pending)
- **R43** (areas C, H, I) "One of those albums is already in the directory: 'Link to the directory album'" (settled: "Albums already in the directory are linked to the directory album instead of parsed again.") — Plan: (pending)
- **R44** (areas H, I) "two ... publisher feeds are parsed and they both reference the same album. And in that case, they would appear under albums for both of those artist feeds locally" — Plan: (pending)
- **R45** (areas H, I) "Add by RSS artist page Albums list: Add by RSS albums on this device whose guid the artist feed lists" — Plan: (pending)
- **R46** (areas H, I) "Albums parsed because the member added an Add by RSS artist: they appear only under that artist. The member can follow each one separately." — Plan: (pending)
- **R47** (areas H, I) "Add by RSS album that names a directory artist: link to the public artist page, and show a Your Add by RSS Albums section there, on that device only." — Plan: (pending)
- **R48** (area H) "On web the artist page is server-rendered, so this section is a client-side part reading the browser's Add by RSS store; it never enters server HTML, SEO output, or anyone else's view." — Plan: (pending)
- **R49** (areas H, I) "Tracks tab: tracks on verified albums, plus tracks from Your Add by RSS Albums with the marker." — Plan: (pending)
- **R50** (areas H, I) "Artist line for an Add by RSS album: an Add by RSS artist on the device that lists it or that it names; otherwise a directory artist with that guid ...; otherwise hidden." — Plan: (pending)
- **R51** (areas H, I) "I don't think we want to parse the artist feed as Add by RSS2" (settled: "Never parse the artist feed as Add by RSS just to fill the line.") — Plan: (pending)
- **R52** (areas H, I) "Directory album with no verified artist, listed by an Add by RSS artist on the device: its player artist line shows that Add by RSS artist, on that device only." — Plan: (pending)
- **R53** (areas H, I) "Track pages (web and mobile, directory and Add by RSS) show the artist as a link in the byline." (the Add by RSS track pages) — Plan: (pending)
- **R54** (areas C, H, I) "Credentials are sent only to the artist feed's own domain (`resolveCredentialScope`). Albums hosted elsewhere are fetched without them, and private ones there land in the existing 'Needs username and password' state." — Plan: (pending)
- **R55** (area J) "when a user unsubscribes from an artist and they are subscribed to albums within that artist, then we may want to pop up a prompt that asks them if they want to unsubscribe from all the albums too. And that should be the case whether it's an ad by RSS or non-ad by RSS." — Plan: (pending)
- **R56** (area J) "Removing an Add by RSS artist: 'You should ask the user if they want to remove all the albums at that time as well.'" — Plan: (pending)
- **R57** (area J) "For a directory artist, 'albums by the artist' are its verified albums. For an Add by RSS artist they are albums it lists or that name it." — Plan: (pending)
- **R58** (area J) "Dialog: title 'Unsubscribe from [Artist]?', body 'You also follow 3 albums by this artist.', buttons Cancel, Artist Only, Artist and Albums. Use each surface's existing word for leaving a feed" — Plan: (pending)
- **R59** (area J) "Albums the member never followed (albums shown only under an Add by RSS artist) go with the artist without asking." — Plan: (pending)

## Out of scope

From the request's "Not in this set": no web marquee (set `web-player-marquee`), no edits to
`detectDuckTypedPublisherMediumId` or `docs/proposals/podcast-namespace/` (set
`publisher-medium-and-namespace-draft`), no spec submission.

Other active sets touching the same files: `add-by-rss-parity` plans 52 and 53 edit full player
title and channel links (mobile `FullPlayerScreen.tsx`, `fullPlayerContentLink.ts`, web modal);
`web-player-marquee` will change the web player bar and modal text. Areas F, G, H, and I re-read
those files at planning time and do not plan against stale copies.

## Areas

### A. Verified publisher links (wave 1, plans 01–09)

- Rows: R1, R2, R3, R4, R5, R8, R9, R10, R11, R12, R13, R14, R15, R16, R17.
- Scope: a forward linear migration for verified publisher link rows (publisher channel, album
  channel, optional item) and list-shaped publisher claims; ORM entities and write services;
  parser recompute on album and publisher parses; the match rule (guid both ways plus `feedUrl`
  check); the linear baseline regen and readiness marker that follow a migration.
- Starts from: `infra/k8s/base/ops/source/database/linear-migrations/app/`,
  `packages/orm/src/entities/channel/channelPublisher*.ts`, `channelRemoteItem.ts`,
  `packages/orm/src/services/channel/channel.ts`, `packages/parser/src/lib/rss/channel/channelPublisher.ts`,
  `packages/parser/src/lib/rss/channel/channel.ts`, `packages/parser-mapping/src/compat/partytime/channel.ts`,
  `packages/helpers/src/lib/medium.ts` (read; route kind stays there).
- Depends on: none.
- Shares: `packages/parser-mapping/src/compat/partytime/channel.ts` (area C reads list claims),
  `packages/orm/src/services/publisherFeed.ts` (area B owns the read path), helpers DTO exports.
- Notes: `remoteAlbumNotification.ts` fires new-album notifications for `PublisherMusic` feeds;
  whether it should require a verified link is open for this area.

### B. Directory API (wave 2, plans 10–19)

- Rows: R2, R7, R8, R18, R20, R21, R23, R25, R26.
- Scope: artist page response with verified albums and Not Yet Added (Podcast Index enriched,
  unknown references hidden), Tracks tab from verified albums only, verified publisher lists on
  the item, channel, and track responses players and track pages read; helpers DTOs, OpenAPI,
  API integration tests.
- Starts from: `apps/api/src/controllers/publisherFeed.ts` (`buildRemoteItemsFinalResult`,
  `enrichUnaddedChannelsByFeedUrl`), `packages/orm/src/services/publisherFeed.ts`
  (`getPublisherFeedRemoteItemsForChannel`, `promoteUnmatchedAlbumsByFeedUrl`),
  `channelGetOneRelations`, item and channel read controllers, `apps/api/openapi.yml`.
- Depends on: A.
- Shares: `apps/api/openapi.yml` and helpers DTOs (areas C, J), `publisherFeed.ts` service (A).

### C. Add by RSS artist parse, server side (wave 2, plans 20–29)

- Rows: R8, R19, R40, R41, R42, R43, R54.
- Scope: when an Add by RSS parse is a publisher feed, parse every album it lists, link albums
  already in the directory instead of parsing them, return the albums with the artist and the
  artist-to-album relation, carry item-level references; credentials only to the artist feed's
  own domain.
- Starts from: `apps/api/src/controllers/account/accountAddByRSSParse.ts`,
  `apps/api/src/routes/account.ts`, `apps/workers/src/commands/mq/rss/runAddByRSSParser.ts`,
  `packages/helpers/src/lib/addByRSS/credentialScope.ts`,
  `packages/parser-mapping/src/compat/partytime/compatFull.ts` (`publisherRemoteItems`,
  `remoteItems` in the bundle).
- Depends on: A (list-shaped publisher claims in parser-mapping).
- Shares: `apps/api/openapi.yml`, helpers Add by RSS types, parser-mapping (A).

### D. Web directory artist page (wave 3, plans 30–39)

- Rows: R8, R18, R20, R22, R23, R24.
- Scope: Albums tab with Verified, a mount point for Your Add by RSS Albums (area H fills it),
  and Not Yet Added with the helper note; rows open `/podcast-index/feed/[id]`; Tracks tab from
  verified albums; Playwright coverage.
- Starts from: `apps/web/src/app/artist/[channel_id]/` (`page.tsx`, `ArtistPageList.tsx`),
  `apps/web/src/components/List/Music/Albums/ListAlbumRemoteItemNodes.tsx`.
- Depends on: B.
- Shares: the artist page files (areas H and J), i18n catalogs.

### E. Mobile directory artist screen (wave 3, plans 40–49)

- Rows: R8, R18, R20, R22, R23, R24.
- Scope: the same Albums sections and Tracks tab on `ArtistDetailScreen`, with a mount point
  for Your Add by RSS Albums (area I fills it); Not Yet Added rows open `SearchResultDetail` on
  the current tab's stack; Maestro coverage.
- Starts from: `apps/mobile/src/screens/artist/ArtistDetailScreen.tsx`
  (`unparsedPodcastIndexFeedTarget`, `resolveUnaddedTrackParentAlbum`).
- Depends on: B.
- Shares: `ArtistDetailScreen.tsx` (areas I and J), i18n catalogs, `apps/mobile/e2e/` artist flow.

### F. Web artist line: players and track page (wave 3, plans 50–59)

- Rows: R6, R8, R21, R27, R28, R30, R31, R32, R38, R39.
- Scope: full-screen modal artist line (link, hidden when none, "A, B" plus chooser), player bar
  second line "Artist · Album", directory track page byline link; album page unchanged.
- Starts from: `apps/web/src/utils/mediaPlayer/mediaPlayerInfoResolution.ts`,
  `apps/web/src/components/MediaPlayer/Modal/MediaPlayerInfoModal.tsx`,
  `Desktop/MediaPlayerInfoDesktop.tsx`, `Mobile/MediaPlayerInfoMobile.tsx`,
  `apps/web/src/app/track/[item_id]/`.
- Depends on: B.
- Shares: `mediaPlayerInfoResolution.ts` and the player components (area H), i18n catalogs.

### G. Mobile artist line: players, track screen, stored payloads, native now-playing (wave 3, plans 60–69)

- Rows: R6, R8, R21, R27, R28, R29, R30, R31, R32, R33, R34, R35, R36, R37, R38, R39.
- Scope: full player artist line (link to Home or Browse, chooser), mini player "Artist · Album"
  in the title's `MarqueeText` turn group, directory track screen byline, the artist names field
  in stored item and channel payloads, iOS and Android now-playing title, artist, and album
  fields with the no-artist fallback; album screen unchanged.
- Starts from: `apps/mobile/src/screens/player/FullPlayerScreen.tsx`, `fullPlayerContentLink.ts`
  (`resolveFullPlayerChannelLink`), `apps/mobile/src/components/player/MiniPlayer.tsx`,
  `apps/mobile/src/screens/track/TrackDetailScreen.tsx`, `channelItemsRepository`,
  `playbackContentRepository`, `queueRepository`, `packages/playback-core/src/playbackTarget.ts`,
  `apps/mobile/src/lib/playback/mediaEngineSourceMeta.ts`, `PodverseAudioEngine.swift`,
  `PodverseAudioEngine.kt`, `PodverseMediaLibraryService.kt`.
- Depends on: B.
- Shares: `FullPlayerScreen.tsx`, `fullPlayerContentLink.ts`, `MiniPlayer.tsx` (area I), mobile
  `data/db/schema.ts` and `migrations.ts` (area I), `playbackTarget.ts` (area F if web reads it),
  i18n catalogs.

### H. Web Add by RSS artists (wave 4, plans 70–79)

- Rows: R8, R19, R40, R42, R43, R44, R45, R46, R47, R48, R49, R50, R51, R52, R53, R54.
- Scope: browser store of artist-to-album links from area C's response; Add by RSS artist page
  Albums and Tracks; albums that live only under their artist until followed; Your Add by RSS
  Albums and their tracks on the public artist page (client-side only); the player artist line
  and track page byline for Add by RSS albums and for directory albums an Add by RSS artist lists.
- Starts from: `apps/web/src/utils/addByRSS/storage.ts`, `apps/web/src/components/AddByRSS/Artist/`,
  `apps/web/src/components/AddByRSS/List/AddByRSSArtistsPageClient.tsx`, plus area D's artist page
  plans and area F's player plans.
- Depends on: B, C, D, F.
- Shares: artist page files (D, J), `mediaPlayerInfoResolution.ts` (F), `storage.ts` (J).

### I. Mobile Add by RSS artists (wave 4, plans 80–89)

- Rows: R8, R19, R40, R42, R43, R44, R45, R46, R47, R49, R50, R51, R52, R53, R54.
- Scope: the same as area H on the device: stored artist-to-album links, Add by RSS artist
  screen Albums and Tracks, albums only under their artist until followed, Your Add by RSS Albums
  on `ArtistDetailScreen`, the player artist line and Add by RSS track screen byline.
- Starts from: `apps/mobile/src/lib/addByRss/`, `apps/mobile/src/prefs/addByRSSFeeds.ts`,
  `apps/mobile/src/data/repositories/addByRssRepository.ts`,
  `apps/mobile/src/screens/home/AddByRssHomeDetailScreen.tsx`, `AddByRssTrackDetailScreen.tsx`,
  `apps/mobile/src/screens/home/addByRss/`, plus area E's and area G's plans.
- Depends on: B, C, E, G.
- Shares: `ArtistDetailScreen.tsx` (E, J), player files (G), mobile db schema (G),
  `subscriptionsRepository` (J).

### J. Unsubscribe and remove prompt (wave 5, plans 90–99)

- Rows: R8, R55, R56, R57, R58, R59.
- Scope: the three-button dialog on web and mobile, for directory artists (verified albums the
  member follows) and Add by RSS artists (albums it lists or that name it), and silent removal of
  albums the member never followed.
- Starts from: `apps/web/src/components/Media/Header/SubscribeButton.tsx`,
  `apps/web/src/components/AddByRSS/Artist/AddByRSSArtistHeader.tsx`,
  `apps/web/src/components/AddByRSS/List/AddByRSSListClient.tsx`, mobile `ArtistDetailScreen.tsx`
  unsubscribe, `subscriptionsRepository`, mobile Add by RSS row actions.
- Depends on: B, D, E, H, I.
- Shares: artist page and screen files (D, E, H, I), `storage.ts` (H), i18n catalogs.

## Waves

| Wave | Areas | Planning steps |
| --- | --- | --- |
| 1 | A | 02 |
| 2 | B, C | 03, 04 |
| 3 | D, E, F, G | 05, 06, 07, 08 |
| 4 | H, I | 09, 10 |
| 5 | J | 11 |

## Shared files

Files more than one area will edit. Assemble serializes the plans that share them.

- `apps/api/openapi.yml`: B, C, and J if it adds an endpoint.
- `packages/helpers` DTO and Add by RSS type exports: A, B, C.
- `packages/i18n-catalog/*/originals/*.json`: D, E, F, G, H, I, J.
- `apps/web/src/app/artist/[channel_id]/*`: D, H, J.
- `apps/web/src/utils/mediaPlayer/mediaPlayerInfoResolution.ts` and web player components: F, H.
- `apps/mobile/src/screens/artist/ArtistDetailScreen.tsx`: E, I, J.
- `apps/mobile/src/screens/player/FullPlayerScreen.tsx`, `fullPlayerContentLink.ts`,
  `MiniPlayer.tsx`: G, I.
- `apps/mobile/src/data/db/schema.ts`, `migrations.ts`: G, I.
- `apps/web/src/utils/addByRSS/storage.ts`: H, J.
- `apps/mobile/src/navigation/index.tsx`: E, G, I if they add a screen or sheet.
- `apps/mobile/e2e/*.yaml` artist and player flows: E, G, I, J.
- `release-notes/scratchpad.md`: every plan that changes a shipped surface.

## Order

First planning pass: step 01 split the request into areas A–J in five waves.

## Decisions to review

Product choices the area planners made that the request and answers did not settle, collected
from each step's `## Decisions`. Each item names its step and plan, the choice made, and the
main alternative. Answer by number; an item with no answer stands as planned.

### Step 02 — area A, verified publisher links (plans 01–06)

- **D1** (step 02, plan 02) The feed URL check runs both ways: a link also fails when the
  publisher's back-reference carries a `feedUrl` that does not match the album's URLs. This
  blocks a feed that has taken a real album's guid; the cost is that a stale URL in the artist
  feed hides the link. Alternative: check only the album's pointer, as the settled design states.
- **D2** (step 02, plan 02) "Known redirects" means merge aliases: the feed's current URL plus
  the URLs of feeds absorbed into it by an applied merge. Alternative: record HTTP redirects
  during fetches (Podverse stores none today).
- **D3** (step 02, plan 02) URL comparison keeps the query string and ignores scheme, host case,
  and one trailing slash. Alternative: reuse `hostAndPath` from `duplicateFeedMatch.ts`, which
  drops the query.
- **D4** (step 02, plan 01) Claims get an `item_id` column now, so track-level credits later need
  only a parser change. Alternative: add the column later with its own migration.
- **D5** (step 02, plan 02) Links ignore medium; whether a publisher shows as an artist stays in
  `isArtistMediumId` / `getChannelRouteKind`. Alternative: link only `PublisherMusic` publishers.
- **D6** (step 02, plan 02) Only channels whose feed is `active` or `pending_archive` take part
  (no lifecycle row counts as active). Alternative: include every channel.
- **D7** (step 02, plan 04) New-album notifications require a verified link, checked in
  `handleNewRemoteItemNotifications.ts`; an unverified parsed album is skipped with no Podcast
  Index fallback. Alternative: check in `remoteAlbumNotification.ts`, or fall back to Podcast
  Index.
- **D8** (step 02, plan 03) A recompute failure during a parse is logged, not thrown; the next
  parse or the backfill repairs it. Alternative: fail the parse job.
- **D9** (step 02, plan 06) A worker command does the backfill, so the match rule has one
  implementation in TypeScript. Alternative: an SQL backfill inside the migration.
- **D10** (step 02, plan 05) A merge absorb deletes the absorbed feed's links and recomputes the
  survivor; a revert does not recompute because the journal restores the rows. Alternative: move
  the rows to the survivor.
- **D11** (step 02, plan 02) Advisory lock namespace `744` for `pg_advisory_xact_lock` (`743` is
  the queue replay lock). Alternative: none named.

### Step 03 — area B, directory API (plans 10–13)

- **D12** (step 03, plan 10) The API attaches a ready-to-render `verified_publishers` list:
  channel-wide on channels, item-only on items. Alternative: return the raw link rows.
- **D13** (step 03, plan 10) One shared helper, `resolveVerifiedPublishers`, merges channel-wide
  credits first, then item credits; it drops publishers without a title and does not filter by
  medium. Alternative: each screen merges on its own.
- **D14** (step 03, plan 10) Reads filter publishers by feed lifecycle (active, pending archive,
  or no lifecycle row). Alternative: trust stored rows until the next recompute.
- **D15** (step 03, plan 11) The artist endpoint keeps `channelsAdded`, `channelsUnadded`,
  `itemsAdded`, and `itemsUnadded`, so installed mobile builds still work; `itemsUnadded` is now
  always empty. Alternative: new field names.
- **D16** (step 03, plan 11) Tracks load inline with the artist page, newest first, capped at
  500. Alternative: a separate paginated tracks endpoint.
- **D17** (step 03, plan 11) A reference matching a channel with no `channel_about` yet (not
  finished parsing) stays in Not Yet Added. Alternative: hide it.
- **D18** (step 03, plan 11) The existing seeded E2E Music Artist becomes medium
  `publisher-music`, so mobile `artist.yaml` keeps working. Alternative: a new artist fixture.
- **D19** (step 03, plan 12) Clip, soundbite, and live item lists do not get
  `verified_publishers` in this set. Alternative: attach it everywhere.
- **D20** (step 03, plan 13) In E2E fixtures mode the artist page never calls live Podcast Index;
  the preview route serves a fixture feed at reserved id 2147483631. Alternative: reuse the
  Podcast Index package's mock ids (2147483640 and up), which Lighthouse already uses.

### Step 04 — area C, Add by RSS artist parse on the server (plans 20–23)

- **D21** (step 04, plan 22) Each listed album is its own queue message, not parsed inline with
  the artist. Alternative: parse inline (blocks the on-demand consumer).
- **D22** (step 04, plan 22) Dedupe is off for album messages, because dedupe keys only on feed
  URL and would drop other members' album parses. Alternative: keep dedupe.
- **D23** (step 04, plan 22) Credentials are re-sealed per album, only for albums in the artist
  feed's credential scope; others get `credentialsWithheld`. Alternative: send none.
- **D24** (step 04, plan 22) Podcast Index lookup by URL runs only when the artist feed is
  public, so a private artist feed's guids never go to Podcast Index. Alternatives: never, or
  always.
- **D25** (step 04, plan 22) No fan-out when the artist parse comes back unchanged; the client
  keeps its stored list. Alternative: fan out every time.
- **D26** (step 04, plan 20) References that point only at an item are not fetched; they are
  listed as unresolved unless an album reference from the same feed carries their guid.
  Alternative: fetch their feeds.
- **D27** (step 04, plan 20) At most 100 listed feeds per artist; the number dropped is logged.
  Alternative: no cap.
- **D28** (step 04, plan 20) Only the `artists` type fans out; references whose medium is
  `publisher`, and references to the artist itself, are skipped. Alternative: any publisher
  medium fans out.
- **D29** (step 04, plan 20) The artist entry lists request ids, not album payloads, so each poll
  stays small. Alternative: embed the payloads.
- **D30** (step 04, plan 21) Directory match is by guid, then by URL with a guid check.
  Alternative: guid only.

### Step 05 — area D, web directory artist page (plan 30)

- **D31** (step 05, plan 30) A section heading shows only when that section has rows; "Verified
  Albums" still shows when it is the only section. Alternative: hide it until another section
  exists (it would pop in after hydration).
- **D32** (step 05, plan 30) The Albums and Tracks chips stay hidden when the server lists are
  empty, unless the device has Add by RSS rows for the artist. Alternative: always show the
  Albums chip.
- **D33** (step 05, plan 30) The Not Yet Added note is exactly "This artist's feed lists these
  albums. They move up once both feeds confirm the link." Alternative: other wording.
- **D34** (step 05, plan 30) The Tracks tab has no "Verified Tracks" heading. Alternative: mirror
  the albums heading.
- **D35** (step 05, plan 30) A Not Yet Added row only opens the Podcast Index preview, where the
  existing Add control lives. Alternative: an Add Feed control on the artist page.

### Step 06 — area E, mobile directory artist screen (plan 40)

- **D36** (step 06, plan 40) The Verified Albums heading shows whenever that list has rows,
  including when it is the only section (same as D31). Alternative: a plain list until a second
  section exists.
- **D37** (step 06, plan 40) Track rows stay without artwork and show the album title as their
  context line. Alternative: repeat album art, or keep the artist name as the subtitle.
- **D38** (step 06, plan 40) Device-only tracks go in a separate slot after the verified tracks,
  so they do not take `artist-track-row-*` indexes. Alternative: insert them into the one list.
- **D39** (step 06, plan 40) The Add by RSS slot stays out while the directory request is loading
  or has failed, so the existing error state still shows. Alternative: show device albums under
  that error.

### Step 07 — area F, web artist line (plans 50–51)

- **D40** (step 07, plan 50) Several verified artists show as "A, B" and open the existing Modal
  as a chooser, portaled to `document.body` because the player modal clips overflow.
  Alternative: list the artists under the title.
- **D41** (step 07, plan 50) With an artist but no album title, the bar's second line is the
  artist name alone. Alternative: "Artist · Untitled".
- **D42** (step 07, plan 51) On the web track page, each verified artist is its own link under
  the track title; no chooser. Alternative: the same "A, B" chooser button as the player.

### Step 08 — area G, mobile artist line (plans 60–66)

- **D43** (step 08, plan 60) A publisher shows as an artist only when
  `getChannelRouteKind(medium_id)` is `'artist'`. Alternative: show every verified publisher,
  which would put podcast networks on podcast players.
- **D44** (step 08, plan 61) The full player's artist line is reserved per item when the item
  starts; a later refresh of the same item does not resize the block. Alternative: reserve the
  line for every music item, leaving a blank gap when there is no artist.
- **D45** (step 08, plan 61) The artist link opens on Home when the artist itself is followed,
  Browse otherwise; the album's follow state does not decide it. Alternative: follow the album's
  state.
- **D46** (step 08, plan 62) The mini player's second line always uses `MarqueeText`, so long
  podcast channel names now scroll too. Alternative: scroll only when an artist is present.
- **D47** (step 08, plan 63) The mobile track screen puts verified artists in the album header
  byline, falling back to the feed's author text when there are none. Alternative: a separate
  artist row in `TrackDetailHeader`.
- **D48** (step 08, plans 60 and 64) The OS album field is empty when there is no artist; the
  channel title stays in the artist field, as today. Alternative: always fill the album field.
- **D49** (step 08, plan 65) Car lists are unchanged. Only Now Playing gets artist and album, and
  only for plays started from Queue and History; car plays from album track lists and downloads
  keep today's fields because their cache entries have no channel payload. Alternative: plumb
  channel data into those cache entries.
- **D50** (step 08) No download-row migration: a track whose player channel comes from its
  download row has no artist line. Alternative: a mobile SQLite column holding the channel's
  verified publishers, plus enqueue plumbing (not planned).

### Step 09 — area H, web Add by RSS artists (plans 70–78)

- **D51** (step 09, plan 71) Listed albums and artist links get their own browser stores
  (database version 8), so library lists, Home, and the items index never show unfollowed albums.
  Alternative: a flag on `feeds` that every reader filters.
- **D52** (step 09, plans 72 and 73) The Add by RSS artist page shows the artist's channel-level
  listing plus Add by RSS albums naming its guid. Tracks are every track on those albums plus
  tracks it credits one by one, only when that album is on this browser; directory album tracks
  are not on this Tracks tab. Alternative: fetch directory items.
- **D53** (step 09, plans 70 and 76) The R50 directory fallback uses a new public endpoint that
  looks a directory artist up by guid. Alternative: a client-side search, which cannot resolve by
  guid.
- **D54** (step 09, plan 75) New Add by RSS row marker (none existed): an RSS icon in an image
  role labelled "Add by RSS", shown only in the directory artist page's Add by RSS sections.
  Alternative: none named.
- **D55** (step 09, plan 75) The directory artist page's Your Add by RSS Albums counts only
  albums that name the artist; the artist's own listing is already shown in the directory
  sections. Alternative: include albums the directory artist feed lists.
- **D56** (step 09, plan 76) Verified artists win in the player; device artists fill an empty
  line only. Logged-out visitors and the embed player get no device artists. Alternative: merge
  both.
- **D57** (step 09, plan 77) Directory track pages keep the verified-only byline; Add by RSS
  track pages use the device rules. Alternative: add device artists to directory track pages.
- **D58** (step 09, plan 71) Listed records stay after the member follows the album; pruning
  removes only albums no followed artist lists. Alternative: drop the listed record on follow.
- **D59** (step 09, plan 74) Listed-only albums are limited until followed: Settings offers Check
  for Updates only, and there are no livestream rows. Credentials go through the artist page's
  Needs Username and Password section and the credentials page. Alternative: full album features
  before follow.
- **D60** (step 09, plans 71 and 73) An artist's list refreshes after 24 hours, re-parsed with no
  cache hints, when the artist page is visited. Alternative: other interval or trigger.

### Step 10 — area I, mobile Add by RSS artists (plans 80–88)

- **D61** (step 10, plans 80 and 82) Mobile reuses web plan 70's `GET /channel/directory-match`
  and stores the result per album. Alternative: add the matches to every parse entry (a second
  server plan, dropped).
- **D62** (step 10, plan 80) Listed-only albums are a `followed` column on the existing mobile
  Add by RSS table, so every Add by RSS screen and playback path works on them unchanged. This
  differs from web's separate stores (D51). Alternative: a separate table, as web uses.
- **D63** (step 10, plan 82) One album-sync job checks every pending album each round, capped at
  about 30 seconds. Alternative: one job per album (would hold the one-at-a-time sync queue for
  minutes).
- **D64** (step 10, plan 81) An in-memory index answers which artist to show, so the full
  player's line is still decided synchronously when an item starts. Alternative: read the
  database when playback starts.
- **D65** (step 10, plan 81) Your Add by RSS Albums includes listed-only albums, matching web
  plan 75; R46's "only under that artist" is read as "not on Home or in the library".
  Alternative: show followed albums only.
- **D66** (step 10, plan 83) Unsubscribing an album that some artist on the device still lists
  sets it back to listed-only, and the screen stays open. Alternative: delete it.
- **D67** (step 10, plan 84) Albums that need credentials show above the album rows, because
  `PodcastSectionList` has no footer slot. Alternative: add a footer slot and show them below.
- **D68** (step 10, plan 84) Tracks of directory albums are not on the Add by RSS artist's Tracks
  tab; their album row opens the directory album (same as D52). Alternative: fetch directory
  items.
- **D69** (step 10, plans 86 and 87) Directory track screens keep only verified artists in the
  byline (same as D57). Alternative: add device artists.
- **D70** (step 10, plan 86) The car's started-playback artist names stay verified-only.
  Alternative: include device artists.
- **D71** (step 10, plan 85) The row marker is an RSS icon whose accessible name is "Add by RSS",
  matching web plan 75 (D54). Alternative: none named.

### Step 11 — area J, unsubscribe and remove prompt (plans 90–97)

- **D72** (step 11, plan 90) One bulk unfollow endpoint covers directory and Add by RSS follows,
  with no transaction because deleting follows is safe to retry. Alternative: two bulk endpoints,
  or one request per album, either of which can stop halfway.
- **D73** (step 11, plan 91) "Unsubscribe" is the title word on every surface, with no "Remove"
  variant. The body uses two keys (one album, several albums) instead of an ICU plural, because
  mobile's i18next setup has no ICU support. Alternative: per-surface wording.
- **D74** (step 11, plans 92 and 94) Artist and Albums is the primary action. Web, left to right:
  Cancel, Artist Only, Artist and Albums. Mobile, top to bottom: Artist and Albums, Artist Only,
  Cancel. Alternative: Artist Only as primary.
- **D75** (step 11, plan 92) On the web directory page, the verified albums reach the
  Unsubscribe button as a prop threaded through the header components. Alternative: a context.
- **D76** (step 11, plan 93) On web Add by RSS, albums are worked out when Unsubscribe is
  pressed, fetching directory album ids five at a time; if reading the stores fails, the artist
  is unsubscribed alone with no dialog. Alternative: load at page load (the header also appears
  on two other pages).
- **D77** (step 11, plans 94 and 95) Mobile directory artist offline, or when fetching its
  verified albums fails: unsubscribe without the dialog rather than block it. Alternative: block
  or show an error.
- **D78** (step 11, plan 94) Mobile closes the dialog first, then runs the writes under the
  screen's existing busy state. Alternative: a busy prop on `ConfirmDialog`.
- **D79** (step 11, plan 95) The remove buttons on the credentials pages, web and mobile, are
  unchanged: they already confirm, and the feed they remove has not been read, so the device
  holds no albums it lists. Alternative: route them through the dialog too.
- **D80** (step 11, plan 97) The new Maestro flow drives Cancel and Artist and Albums; Artist Only
  is covered by unit tests and the web spec. The `add-by-rss-artist.yaml` cleanup answers Artist
  Only when the dialog appears, so other flows' album follows stay as they expect. Alternative:
  drive all three buttons in Maestro.
- **D81** (step 11, plan 96) The web Add by RSS E2E test follows the directory album, not the Add
  by RSS album, because two parse stubs would share one request-id prefix and collide; the listed
  album the member never followed then shows it is not counted (R59). Alternative: follow the
  Add by RSS album.
