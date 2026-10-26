# Livestreams 1: A Flag, Not a Kind of Show

- **Version:** 2026-10-25T19:36-05:00
- **Episode ID:** livestreams-a-flag-not-a-kind-of-show
- **Changed:** Spoken order is now live items latest start first and scheduled items soonest start
  first. A scheduled item more than a day past its start is hidden, and a scheduled Add by RSS
  item with no start time stays. Regenerate the audio.
- **Description:** Why a livestream in Podverse is a flag on top of a show's medium, how channels
  and Add by RSS feeds remember that they may have livestreams, and how the Livestreams chip
  lists what is live now and what is scheduled, on the website and the phone.
- **Status:** Built. The phone side ships in the next store build.
- **Group:** Livestreams, part 1
- **Sources:** `.llm/plans/completed/add-by-rss-parity/` (plans 80–89, 95–97, 52, 53);
  `packages/parser/src/lib/rss/liveItem/channelLiveItemFlag.ts`,
  `packages/helpers/src/lib/liveItemVisibility.ts`,
  `packages/orm/src/services/item/item.ts` (`getManyUpcomingLiveItems`),
  `apps/api/src/controllers/liveItem.ts`,
  `packages/parser-mapping/src/addByRSS/liveItems.ts`,
  `packages/parser-mapping/src/addByRSS/resourceType.ts`,
  `apps/web/src/utils/subscribed/mergeSubscribedLivestreams.ts`,
  `apps/web/src/utils/addByRSS/channelLiveItems.ts`,
  `apps/mobile/src/screens/home/homeFeedData.ts`,
  `apps/mobile/src/lib/addByRss/liveRows.ts`,
  `apps/mobile/src/screens/home/AddByRssLivestreamDetailScreen.tsx`,
  `apps/mobile/src/screens/player/fullPlayerContentLink.ts`
- **Length:** about 10 minutes (1,428 words)

## Directions for the voice service (do not read aloud)

- Two voices. **Claire** is a woman: warm, clear, measured. **Tom** is a man: relaxed, curious.
  Each line starts with the speaker's name and a colon. That name picks the voice. Never read it.
- About 150 words per minute. Natural turn-taking, no overlap.
- Read only the lines under **Script**, exactly as written. Do not read headings or these
  directions.
- A line that says `(pause)` is about one and a half seconds of silence. Never say "pause".
- No music, sound effects, intro, or outro.
- Pronunciation: **Podverse** "POD-verse". Spell out **RSS**, **API**, and **URL** letter by
  letter. Say **SQLite** "S-Q-lite".
- If your service writes its own script from this one, keep every number and every claim
  exactly, keep both voices, and add nothing the text does not say.

## Script

CLAIRE: This is part one of Livestreams. It covers how Podverse thinks about a livestream, and the new Livestreams chip that lists what's on the air now and what's coming up. It's built on the website and the server. The phone side reaches people in the next store build.

TOM: When you say livestream, what is it in the data?

CLAIRE: A feed can carry live items next to its regular episodes. Each live item has a status: scheduled, live, or ended. It has a start time, and once it's over, an end time. In the database it's its own row, attached to a regular item that belongs to the channel.

(pause)

TOM: So what needed fixing?

CLAIRE: Two things. People wanted one place to see every livestream from the shows they follow, on Home, on Browse, and in the Add by RSS library, on both the website and the phone. And Add by RSS had drifted. It treated livestreams as a kind of feed, next to podcasts and albums. Some website rows for those feeds built links that put a feed's id where a livestream's id belonged, so they opened the wrong thing.

TOM: Why is treating it as a kind of feed wrong? Some feeds really are mostly live.

CLAIRE: Because a show is still a podcast, or an album, or a video show, when it goes live. The medium comes from the feed. If live were a medium, a podcast would vanish from the Podcasts chip the moment it scheduled a stream, and its regular episodes would vanish with it.

(pause)

TOM: What rules does the design hold to?

CLAIRE: Four. First, livestreams are a flag on top of the medium, never a medium, a feed type, or an Add by RSS type. Second, the flag is sticky. Once a feed has carried a live item, it stays marked, even after that item leaves the feed. Third, the Livestreams chip shows what's live now first, then what's scheduled, and never anything that has ended. Fourth, every surface sorts with the same shared comparison, so the website and the phone can't disagree on the order.

TOM: Restating the first one: a podcast with livestreams is still a podcast. Its episodes stay on Episodes, and its live items show up on Livestreams.

CLAIRE: Exactly.

(pause)

TOM: Start with the server. How does a channel remember?

CLAIRE: The channel table has a column, may have live items. It defaults to false. The parser sets it to true the first time a parse sees a live item in the feed, of any status. It writes only when the flag is still false, and nothing ever clears it. When the parser sets it, it writes the channel's own medium back unchanged, so setting the flag can never change what kind of show it is.

TOM: Who reads the flag?

CLAIRE: On the server, nobody yet. Channel responses carry it, and it's there for later list filters. The chip doesn't need it, because the server can read live item status directly.

TOM: Through what?

CLAIRE: Two new API routes. One lists upcoming livestreams across public channels. The other lists them from the channels a signed-in person follows. Both take a medium and a page, and nothing else. They return only live and scheduled items. Live items come first, latest start first, then scheduled items, soonest start first, then by item id, so page boundaries stay stable. A page holds sixty items. A scheduled item whose start is more than a day in the past is hidden. A live item stays listed with no time window. Ended items never appear, however recent.

(pause)

TOM: Now Add by RSS. There's no server copy of those feeds.

CLAIRE: Right, so each device keeps its own flag, may have livestreams, on its stored copy of the feed. One shared helper decides it, so the website and the phone follow the same rule. It's written only when a parse result is stored. The next value is the stored value, or whether this parse has any live items. So once it's true, it stays true.

TOM: What about a stored feed that has no flag yet?

CLAIRE: The website stores whole records. When it reads a record with no flag, it counts the feed if its stored parse has live items. The phone's column is part of its database from the first install.

TOM: Does that flag sync to the server?

CLAIRE: No. It stays on the device. The follow row doesn't change.

TOM: And the old livestreams feed type?

CLAIRE: It's gone. An Add by RSS feed's type is now podcasts, episodes, artists, albums, or tracks, chosen from its parsed medium. A stored value the app doesn't recognize, including the old livestreams value, reads as podcasts. The website components that treated a whole feed as a livestream, and built the broken links, were deleted.

(pause)

TOM: So where does someone see the chip?

CLAIRE: On the website, on Subscribed, which is the home page, on Browse, and on the Add by RSS page. On the phone, on Home, Browse, and the Add by RSS library. It's labeled Livestreams. It has no sort, category, or view controls, and it covers every medium. When it's empty, it says No Livestreams Found.

TOM: What's on it in each place?

CLAIRE: Browse is directory content only, from the public route. Subscribed on the website and Home on the phone combine the server's list with live items from this device's Add by RSS feeds. Only feeds flagged as may have livestreams are read. The Add by RSS library shows only Add by RSS items. Every place drops ended items and sorts live first, then scheduled.

TOM: How does the website combine the two lists without breaking paging?

CLAIRE: It adds the Add by RSS items to the first page only, sorted with the shared comparison. When two items tie, the server's row comes first.

(pause)

TOM: What can someone do with a row?

CLAIRE: Less than with an episode. There's no queueing, no adding to a playlist, and no marking as played. On the phone, a directory livestream row offers Share. An Add by RSS livestream row offers nothing. Tapping a row opens the livestream's page.

TOM: Which page, for Add by RSS?

CLAIRE: The phone has a new Add by RSS livestream page, on Home and in the Library. It shows a Summary, and People when the item lists any. Its play button works only while the item is live. It has no More menu. The website already had Add by RSS livestream pages, under podcast or music depending on the feed's medium.

TOM: What about a feed's own page?

CLAIRE: On the phone, an Add by RSS feed's page now lists its livestreams above Episodes or Tracks, the way a directory podcast page does. Inside a channel the order differs from the chip. Live first, latest start first, then scheduled, soonest start first, then ended, latest end first. An ended item more than a day old is hidden, and a scheduled item is hidden once its start is more than a day past. Live items have no time window. A scheduled Add by RSS item with no start time stays and sorts last among scheduled items. The website's Add by RSS pages use that same order and the same one-day rules. The episode sort chip doesn't reorder the livestream block.

TOM: How do I tell a scheduled row from an ended one inside a channel?

CLAIRE: On the phone, the row's date line starts with a small neutral badge that reads Scheduled or Ended. A live item keeps its red Live badge in the same place.

(pause)

TOM: Does the full player know about any of this?

CLAIRE: On the phone, tapping a livestream's title in the full player opens its page, for directory and Add by RSS livestreams alike. And for a directory livestream on an album feed, the channel line opens the album page: on Home if this phone follows the album, otherwise on Browse.

TOM: Does the phone record livestream playback, the way it does for episodes?

CLAIRE: No. Livestreams record no playback events, Add by RSS livestreams included.

(pause)

TOM: To remember. One: a livestream is a flag on top of a show's medium, never a medium or a feed type. Two: channels and Add by RSS feeds remember that they may have livestreams, and that flag is never cleared. Three: the Livestreams chip shows live first, then scheduled, never ended, from two new routes plus this device's Add by RSS feeds. Four: inside a channel, ended items stay for one day, with Scheduled and Ended badges on the phone. Five: livestream rows can be shared or opened, not queued, and they record no playback.

CLAIRE: A show can go live without becoming a different kind of show.
