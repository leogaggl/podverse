# Artist, album, and track attribution

## Request

I'm wondering how Podverse is set up to handle the artist's albums, tracks feature. It is significantly different from podcasts and episodes because artists and albums are both channel items, although with different mediums. One is a publisher, one is not. So there are references going on that may make it difficult for us to query for, let's say, all the tracks by an artist.

Furthermore, while we can count on there always being an album feed, there may not even be an artist feed that corresponds with that album feed. And furthermore, in order to maintain integrity so that artists cannot wrongfully claim that they are the creator of an album, there needs to be some cross-referencing of IDs that are within the feeds, so that we can verify that they both represent a relationship that should exist.

I believe the podcast index's specs should already explain how to handle this scenario. Furthermore, on the player screen, if an artist's name is available, we may want to add yet another row of text above the album title, which will be smaller text and it will represent the artist's name. But that will somehow have to go up the chain from item to album to artist. And we, as I said, need to make sure we verify the integrity of these cross references.

I want you to ask me as many questions as you need if you are unclear on the difficulties here and what we need to do to resolve them. And it is very important that you bear in mind both web and mobile experiences, as well as add by RSS and non-add by RSS.

## Operator answers

Four rounds of questions. A later answer replaces an earlier one where they conflict; each
replaced answer says so.

### Round 1

- **Which albums count as an artist's albums?** Only when both feeds point at each other. The
  operator: "I think I want answer A only when both feeds point at each other. But does the spec as
  it exists today in Podcast Index support this functionality? If it doesn't, it sounds like we may
  need to push for approval. However, regardless, it seems important that we have this cross feed
  verification." Answer given: the publisher doc already describes two-way validation; requiring
  it in both directions is Podverse's display policy and needs no approval.
- **Unparsed albums on the artist page:** (replaced in round 3) "I suspect we may need to hide
  until parsed and verified. So, for the sake of integrity, that's maybe what we want." The
  operator also asked: "can't the artist feed contain content that is not just an album, but
  perhaps a direct reference to an item? Do we have a solution for how to handle this in the UI and
  database?"
- **Artist Tracks tab:** all tracks on the artist's verified albums.
- **Match rule:** guids match both ways, and when the album's pointer has a `feedUrl` it must match
  the artist feed's URL (http/https and known redirects allowed).
- **Player line order:** track title, then the artist (smaller), then the album.
- **Player surfaces:** mobile full player and web full-screen player modal. On lock screen,
  CarPlay, and Android Auto: "Lock screen, CarPlay, and Android Auto sound good, but if they are
  limited to only two rows, how would you recommend handling that? Should it be a scrolling marquee
  where we concatenate values together specifically just for those displays. ... And likewise, for
  the mobile mini-player and the web-player bar, there may not be enough vertical real estate to
  put three lines in there. So, do we make that concatenated string that can marquee into view as
  needed?" Settled in the design below: structured fields, not concatenated strings.
- **Artist line is a link:** "On the full player screens, yes."
- **No verified artist:** the artist line is hidden.
- **Album and track pages:** "yes on the track pages, but not on the album pages right now."
- **Add by RSS:** "With AdByRSS, I am thinking that we do not actually need this verification
  process because it is only in the case of a public directory that we need this verification. But
  if somebody uses the AdByRSS, then we could just trust the input as it is."
- **Record labels shown as artists:** "I would say yes, but I hope that whatever decision we go
  forward with could be potentially migrated and changed in the future for the publisher
  experience because this is an odd and opinionated case."
- **Publisher medium bug:** handled by the separate set `publisher-medium-and-namespace-draft`.

### Round 2

- **Unverified albums on the artist page:** (led to the round 3 answer) "What if an artist feed
  has been parsed, but the albums within it or tracks have not been parsed yet? Will a user be able
  to at least see in some way what those feeds are and be able to manually add it for parsing if
  they're a premium member, like other feeds? Will it be able to link them to a podcast index?
  Detail page like our search page does, so they can choose if they want to add it to our database
  or not. We need this experience to be thought through and nice and clean to the best it can be."
- **Lock screen, CarPlay, Android Auto with no verified artist:** the album title goes in the
  artist field, as today, so the second line is never blank.
- **Mobile mini player and web player bar:** "If we don't have a marquee on web already, I think
  we should look for opportunities where a marquee should be added. And I think maybe that should
  be a separate plan set that this one should generate so we can complete the marquee work on a
  separate work tree. That separate marquee work for web will mirror many of the decisions that
  Mobile makes for the few instances where marquees happen. For example, the player bar on the
  bottom of the screen of web, instead of having two lines and then an ellipsis, they could just
  have one line per text and make that text marquee. And also do the same on the full-size
  player." That marquee work is the separate set `web-player-marquee` (request already written).
  Read for this set as: the compact players show "Artist · Album" on their second line when there
  is a verified artist (the question asked exactly that). On mobile that line takes its turn in
  the title's marquee group. On web it uses whatever single-line text the web player has when this
  set lands.
- **Add by RSS artist sources and multiple artists:** "We still want to do the cross matching. So,
  hypothetically, if a user parses an artist feed, or in other words, a publisher feed, all of the
  eligible items within it that fit within our schema should parse and be returned. And returned
  in a way where the AdByRSSUX understands that this album was from this artist. There could be an
  odd scenario where two artist, I mean, publisher feeds are parsed and they both reference the
  same album. And in that case, they would appear under albums for both of those artist feeds
  locally. ... Unless the Podcasting 2.0 spec strictly forbids it, what if there are two valid
  artists for one album or two valid artists for one track? Can we still reference those in the
  case of multiple publishers that have valid claims to content? Does the spec allow the Podcast
  Index for this sort of functionality? We either want to support the way that Podcast Index
  supports it, or we want to anticipate it in our design that this functionality should be
  supported because it is entirely valid for a music track, for example, to have two artists, and
  each of those artists will have their own artist feed. So it would seem that the GUID
  verification that goes two ways may need multiple GUIDs potentially along the album and artist.
  I would like you to think through this situation and how we can best handle it. And if no spec
  already exists for it, if there is an obvious adaptation you could anticipate, becoming adopted
  for the spec, then let's make sure our design is able to support that."
- **Add by RSS artist page Albums list:** Add by RSS albums on this device whose guid the artist
  feed lists (extended in round 3: albums already in the directory are linked, not parsed again).
- **Upstream proposal:** drafted; the separate set `publisher-medium-and-namespace-draft` writes
  it to `docs/proposals/podcast-namespace/PUBLISHER-ATTRIBUTION.md`.

### Round 3

- **Not-yet-parsed albums on a directory artist page:** a separate **Not Yet Added** section with
  a helper note. Tapping a row opens the Podcast Index preview. Albums that are parsed but do not
  point back disappear from the artist page.
- **Several verified artists per album and per track:** yes, many-to-many links now; only the
  parser changes later.
- **More than one artist in the player:** the line shows "A, B"; tapping opens a chooser listing
  each artist.
- **Albums parsed because the member added an Add by RSS artist:** they appear only under that
  artist. The member can follow each one separately.
- **One of those albums is already in the directory:** "Link to the directory album, but along
  with this experience, if a user deletes or unsubscribes from an artist, they may expect all of
  the albums they are subscribed to by that artist also to unsubscribe. So I am thinking we may
  want when a user unsubscribes from an artist and they are subscribed to albums within that
  artist, then we may want to pop up a prompt that asks them if they want to unsubscribe from all
  the albums too. And that should be the case whether it's an ad by RSS or non-ad by RSS."
- **Add by RSS album whose artist is not on the device:** "I was thinking A, but that could be
  confusing because then, if the user clicks the artist page, they would be taken to the public
  artist page where the Add by RSS album will not be found. So, we want to avoid that not found
  situation as it will be confusing unless we manually integrate these Add by RSS albums into the
  user's experience on the device so that it appears on that, even though it's not truly a part of
  the public page, the user has decided to manually make it one within their experience. ... I
  don't think we want to parse the artist feed as Add by RSS2, as that seems to create a less
  standardized environment than if they use the public artist page." Settled in round 4.
- **Removing an Add by RSS artist:** "You should ask the user if they want to remove all the albums
  at that time as well."
- **Home for spec drafts:** `docs/proposals/podcast-namespace/` (written by the separate set).

### Round 4

- **Add by RSS album that names a directory artist:** link to the public artist page, and show a
  **Your Add by RSS Albums** section there, on that device only.
- **Directory album with no verified artist, listed by an Add by RSS artist on the device:** its
  player artist line shows that Add by RSS artist, on that device only.

## Settled design

The operator accepted these in the rounds above. Planners keep them; anything not listed here is
open for the planner to decide and report under `## Decisions`.

### Verified publisher links (directory content)

- An album belongs to an artist only when both feeds reference each other: the artist feed's
  channel-level `podcast:remoteItem` (no `itemGuid`) names the album's guid, and the album's
  `<podcast:publisher>` remote item names the artist's guid. When the album's pointer has a
  `feedUrl`, it must also match the artist feed's URL (http/https and known redirects allowed).
  Guid-only matching is not enough: `channel.podcast_guid` is unique and the first feed parsed
  keeps it, so a feed can squat a real artist's guid.
- Store the result as verified link rows, many-to-many: publisher channel, album channel, and an
  optional item for a future track-level credit. Recompute an album's links whenever the album or
  any publisher it involves is parsed, so a reference dropped from either feed removes the link.
- Store publisher claims as lists. `channel_publisher_remote_item` allows one row per album today
  (unique on `channel_publisher_id`); relax that so several claims fit. Today's feeds still produce
  at most one, because `<podcast:publisher>` holds one remote item. The anticipated namespace shape
  is in `docs/proposals/podcast-namespace/PUBLISHER-ATTRIBUTION.md`: several publisher remote items
  in one `<podcast:publisher>` (first is primary), and `<podcast:publisher>` inside `<item>`,
  verified by an item-level remote item in the publisher feed.
- Name the link generically ("verified publisher"), not "artist". Whether a publisher is shown as
  an artist stays in `getChannelRouteKind` / `isArtistMediumId` in
  `packages/helpers/src/lib/medium.ts`, so a later record-label experience changes one helper and
  no data.
- Every reader takes a list of publishers: the player's artist line, the track page byline, the
  OS artist field, and the artist page's Albums and Tracks tabs.

### Directory artist page (web and mobile)

Albums tab, top to bottom:

1. **Verified albums.**
2. **Your Add by RSS Albums:** on that device or browser only, the member's Add by RSS albums that
   name this artist's guid, with the existing Add by RSS row marker. On web the artist page is
   server-rendered, so this section is a client-side part reading the browser's Add by RSS store;
   it never enters server HTML, SEO output, or anyone else's view.
3. **Not Yet Added:** albums the artist feed lists that Podverse has not parsed, built from Podcast
   Index lookup data as today's unadded rows are. A one-sentence helper note under the heading,
   along the lines of "This artist's feed lists these albums. They move up once both feeds confirm
   the link." Tapping a row opens the Podcast Index preview (web `/podcast-index/feed/[id]`,
   mobile `SearchResultDetail` on the current tab's stack), where a member can add the feed.
   References Podcast Index does not know are hidden. Once an album is parsed it moves to the
   verified list if it points back, and leaves the page if it does not.

Tracks tab: tracks on verified albums, plus tracks from Your Add by RSS Albums with the marker.
Item-level references in a directory artist feed are not shown; no spec mechanism can verify them.

### Players

- **Full players** (mobile full player, web full-screen modal): track title, then a smaller artist
  line, then the album. The artist line links to the artist page (on mobile, Home when followed,
  Browse otherwise, like the album line). It is hidden when there is no artist. Several artists
  show as "A, B", and tapping opens a chooser listing each artist.
- **Compact players** (mobile mini player, web player bar): two lines. The second line is
  "Artist · Album" when there is an artist, else the album as today. On mobile it scrolls in the
  same `MarqueeText` turn group as the title.
- **Lock screen, CarPlay, Android Auto:** structured fields, not concatenated strings. Title is the
  track, artist is the artist names joined, album is the album. With no artist, the album title
  stays in the artist field. iOS has `MPMediaItemPropertyAlbumTitle` and Media3 has
  `setAlbumTitle`; this needs a native change and a rebuild, and a device check.
- Mobile stores items and channels on disk (queue cache, channel items). The artist names ride in
  those payloads as an added field; older stored rows show no artist line until they refresh.

### Track pages

Track pages (web and mobile, directory and Add by RSS) show the artist as a link in the byline.
Album pages do not, for now.

### Add by RSS

- No verification: the member trusts their own feeds. Matching is by guid, on the device. Nothing
  from an Add by RSS feed changes a public page or server-side data anyone else sees.
- **Adding an Add by RSS artist** also parses every album it lists and returns them with the
  artist. Albums already in the directory are linked to the directory album instead of parsed
  again. The rest are stored on the device as Add by RSS albums linked to the artist. They appear
  only under the artist (not on Home or as separate follows) until the member follows one.
- An album two Add by RSS artists both list appears under both. Item-level references in an Add by
  RSS artist feed show in its Tracks tab once their album is parsed.
- **Artist line for an Add by RSS album:** an Add by RSS artist on the device that lists it or that
  it names; otherwise a directory artist with that guid (public artist page, which then shows the
  Your Add by RSS Albums section); otherwise hidden. Never parse the artist feed as Add by RSS just
  to fill the line.
- **Directory album with no verified artist** that an Add by RSS artist on the device lists: the
  player artist line shows that Add by RSS artist, on that device only.
- Credentials are sent only to the artist feed's own domain (`resolveCredentialScope`). Albums
  hosted elsewhere are fetched without them, and private ones there land in the existing
  "Needs username and password" state.

### Unsubscribing from or removing an artist

Directory and Add by RSS, web and mobile:

- When the member follows at least one album by the artist, ask before unsubscribing. For a
  directory artist, "albums by the artist" are its verified albums. For an Add by RSS artist they
  are albums it lists or that name it.
- Dialog: title "Unsubscribe from [Artist]?", body "You also follow 3 albums by this artist.",
  buttons **Cancel**, **Artist Only**, **Artist and Albums**. Use each surface's existing word for
  leaving a feed (mobile Add by RSS rows say Unsubscribe today).
- Albums the member never followed (albums shown only under an Add by RSS artist) go with the
  artist without asking.

## Not in this set

- **Web marquee:** the separate set `web-player-marquee`. This set does not add a marquee to web.
- **Publisher medium bug and the namespace draft:** the separate set
  `publisher-medium-and-namespace-draft` changes `detectDuckTypedPublisherMediumId` and writes
  `docs/proposals/podcast-namespace/`. This set does not edit either.
- **A spec submission:** nobody submits the draft as part of this work.

## Glossary

- **AdByRSS, ad by RSS, add by RSS:** Add by RSS (feeds a member adds by URL, stored on their
  device or browser, parsed server-side).
- **Directory, public directory, non-Add by RSS:** feeds parsed into Podverse's database.
- **podcast index:** Podcast Index, both the directory and the podcast namespace spec.
- **Artist feed, publisher feed:** a channel whose medium is `publisher` and whose remote items are
  mostly music, stored as `PublisherMusic` (22) and routed to `/artist`.
- **Album feed:** a channel with medium `music` (`Music` 3 or `MusicL` 12). **Track:** an item in
  an album.
- **Verified:** both feeds reference each other, per the match rule above.
- **ABC memory:** abcmemory (committed agent guidance under `.cursor/`).
- **Player bar:** the web bottom player (desktop and mobile web). **Full-size player:** the web
  full-screen player modal.

## Orientation

Checked while writing this file. Re-verify: `add-by-rss-parity` is running and edits player title
and channel links and Add by RSS screens, and other sets are landing in the tree.

- `infra/k8s/base/ops/source/database/linear-migrations/app/0001_app_schema.sql`:
  `channel_publisher (channel_id UNIQUE)`, `channel_publisher_remote_item (channel_publisher_id
  UNIQUE, feed_guid, feed_url, item_guid, title, medium_id)`, and `channel_podcast_guid_key`
  unique on `podcast_guid`.
- `packages/orm/src/entities/channel/channelRemoteItem.ts`: an artist feed's remote items (albums
  have no `item_guid`; track references have one).
- `packages/orm/src/entities/channel/channelPublisherRemoteItem.ts`: the album's pointer to its
  publisher, one-to-one with `ChannelPublisher`.
- `packages/orm/src/services/publisherFeed.ts`: `getPublisherFeedRemoteItemsForChannel` returns
  added and unadded albums and tracks from the artist's list alone, matched by guid then by feed
  URL (`promoteUnmatchedAlbumsByFeedUrl`). It never checks the album's pointer.
  `publisherFeed.helpers.ts` has `isPublisherAlbumRemoteRef`.
- `apps/api/src/controllers/publisherFeed.ts`: the endpoint behind web `/artist/[channel_id]` and
  mobile `ArtistDetailScreen`; enriches unadded rows from Podcast Index
  (`buildRemoteItemsFinalResult`, `enrichUnaddedChannelsByFeedUrl`).
- `packages/orm/src/services/channel/channel.ts`: `channelGetOneRelations` loads
  `channel_publisher` and `channel_remote_items`; `getAllByPodcastGuids`.
- `packages/parser/src/lib/rss/channel/channelPublisher.ts`: stores or deletes the album's
  publisher pointer on parse. `packages/parser/src/lib/rss/channel/channel.ts`: the guid collision
  path (`recordPodcastGuidCollision` leaves `podcast_guid` unset).
- `packages/parser-mapping/src/compat/partytime/channel.ts`: `compatChannelPublisherRemoteItemDtos`
  reads a single `parsedFeed.podcastPublisher`; `compatChannelRemoteItemDtos` reads
  `parsedFeed.podcastRemoteItems`.
- `packages/parser/src/lib/rss/remoteItemParser.ts` and `packages/parser/src/lib/rss/parser.ts`:
  remote feeds Podverse lacks are queued for parsing only when `config.parser.addRemoteItemsToMQ`
  is on (`PARSER_ADD_REMOTE_ITEMS_TO_MQ`, read in
  `apps/workers/src/lib/parser/buildWorkersParserConfig.ts`). It is empty, so off, in
  `infra/k8s/base/workers/source/workers.env` and `apps/workers/.env.example`. With it off, Not Yet
  Added albums move up only when a member adds them.
- `packages/parser/src/lib/notifications/remoteAlbumNotification.ts`: new-album notifications for
  `PublisherMusic` feeds.
- `apps/workers/src/lib/podcastIndex/classifyPublisherMusicRss.ts`: XML heuristics for publisher
  music feeds and album parents.
- Web artist page: `apps/web/src/app/artist/[channel_id]/` (`page.tsx`, `ArtistPageList.tsx`);
  album rows in `apps/web/src/components/List/Music/Albums/ListAlbumRemoteItemNodes.tsx`
  (`ListAlbumRowRemoteItemUnadded`, `ListAlbumGridNodeUnadded`). Podcast Index preview:
  `apps/web/src/app/podcast-index/feed/[podcast_index_id]/page.tsx`.
- Web track page: `apps/web/src/app/track/[item_id]/`. Web album page:
  `apps/web/src/app/album/[channel_id]/` (bylines use `channel_about.author`, the album's own
  unverified text).
- Web players: `apps/web/src/components/MediaPlayer/Desktop/MediaPlayerInfoDesktop.tsx`,
  `Mobile/MediaPlayerInfoMobile.tsx`, `Modal/MediaPlayerInfoModal.tsx`; text comes from
  `getMediaPlayerInfoResolution` (`displayItemTitle`, `channelTitle`).
- Web Add by RSS: `apps/web/src/utils/addByRSS/storage.ts` (browser store),
  `apps/web/src/components/AddByRSS/Artist/`, `apps/web/src/components/AddByRSS/List/AddByRSSArtistsPageClient.tsx`.
  The Add by RSS artist page shows no albums today.
- Add by RSS parsing: `POST /account/add-by-rss/parse` (`AccountAddByRSSParseController` in
  `apps/api/src/routes/account.ts`), run by `apps/workers/src/commands/mq/rss/runAddByRSSParser.ts`.
  The mapped bundle already carries `publisherRemoteItems` and `remoteItems`; nothing reads them.
- Mobile artist: `apps/mobile/src/screens/artist/ArtistDetailScreen.tsx` (unadded albums open
  `SearchResultDetail` via `unparsedPodcastIndexFeedTarget`; unadded tracks use
  `resolveUnaddedTrackParentAlbum`; unsubscribe via `subscriptionsRepository.unsubscribe`, one
  channel per call).
- Mobile album and track: `apps/mobile/src/screens/album/AlbumDetailScreen.tsx`,
  `apps/mobile/src/screens/track/TrackDetailScreen.tsx`. Mobile Add by RSS screens:
  `apps/mobile/src/screens/home/AddByRssHomeDetailScreen.tsx`, `AddByRssTrackDetailScreen.tsx`,
  `apps/mobile/src/screens/home/addByRss/`, and `apps/mobile/src/lib/addByRss/`.
- Mobile players: `apps/mobile/src/screens/player/FullPlayerScreen.tsx` (`full-player-title-link`
  marquee in turn group `full-player`, then `full-player-channel-link`),
  `apps/mobile/src/screens/player/fullPlayerContentLink.ts` (`resolveFullPlayerChannelLink`),
  `apps/mobile/src/components/player/MiniPlayer.tsx`, and
  `apps/mobile/src/components/primitives/MarqueeText.tsx` (`turnGroup`, `turnOrder`).
- `packages/playback-core/src/playbackTarget.ts`: the `PlaybackTarget` union (`item-music` carries
  `item`, `channel`, `intent`).
- Native now-playing: `apps/mobile/modules/podverse-media-engine/ios/PodverseAudioEngine.swift`
  (`updateNowPlayingInfo` sets title and artist) and
  `apps/mobile/modules/podverse-media-engine/android/src/main/java/expo/modules/podversemediaengine/PodverseAudioEngine.kt`
  plus `PodverseMediaLibraryService.kt` (`meta["subtitle"]` goes to `setArtist`).
- Optional impact check the operator can run against alpha or production, counting albums artists
  list versus albums that point back:

```sql
SELECT
  count(*) AS albums_listed_by_artists,
  count(*) FILTER (WHERE cpri.feed_guid = artist.podcast_guid) AS albums_pointing_back
FROM channel artist
JOIN channel_remote_item cri ON cri.channel_id = artist.id AND cri.item_guid IS NULL
JOIN channel album ON album.podcast_guid = cri.feed_guid
LEFT JOIN channel_publisher cp ON cp.channel_id = album.id
LEFT JOIN channel_publisher_remote_item cpri ON cpri.channel_publisher_id = cp.id
WHERE artist.medium_id = 22;
```

## Likely areas

Non-binding; the Split step decides the areas, waves, and plan files.

- **A. Verified links:** schema for verified publisher link rows and list-shaped claims, ORM
  services, parser recompute on album and publisher parses, and the match rule.
- **B. API:** artist page response with the three album groups and verified-album tracks; artist
  names on item, channel, and track responses the players and track pages read; OpenAPI and
  integration tests.
- **C. Web directory pages:** artist page sections, track page byline, and Playwright coverage.
- **D. Mobile directory screens:** artist screen sections, track screen byline, and Maestro
  coverage.
- **E. Players:** web modal and bar, mobile full and mini players, the chooser, and the persisted
  payload fields.
- **F. Native now-playing:** iOS and Android title, artist, and album fields.
- **G. Add by RSS artists:** server-side fan-out parse, directory links, device storage and
  matching on web and mobile, Add by RSS artist pages, Your Add by RSS Albums on public artist
  pages, and the player artist line for Add by RSS and reverse cases.
- **H. Unsubscribe and remove prompt:** web and mobile, directory and Add by RSS.
