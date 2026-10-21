# Add by RSS 1: The Same Episode on Every Device

- **Version:** 2026-10-20T09:36-05:00
- **Episode ID:** add-by-rss-same-episode-every-device
- **Changed:** First version.
- **Description:** How an Add by RSS episode gets one id on every device, how the phone records
  its playback, and how the website picks up that episode at the phone's position without ever
  swapping out what it is already playing.
- **Status:** Built. The phone side ships in the next store build.
- **Group:** Add by RSS, part 1
- **Sources:** `.llm/plans/completed/add-by-rss-cross-device/`;
  `packages/helpers/src/lib/addByRSSHash.ts`,
  `infra/k8s/base/ops/source/database/linear-migrations/app/0020_add_by_rss_feed_identity.sql`,
  `apps/mobile/src/playback/playbackEventSource.ts`,
  `apps/web/src/hooks/useMediaPlayerControllerQueueHeadLoading.ts`,
  `apps/web/src/utils/addByRSS/playFromQueueResource.ts`,
  `apps/web/src/hooks/useAddByRSSMetadataUpgrade.ts`,
  `apps/web/src/utils/addByRSS/backgroundRefresh.ts`,
  `apps/workers/src/lib/addByRSS/applyAddByRSSFollowMetadata.ts`
- **Length:** about 10 minutes (1,494 words)

## Directions for the voice service (do not read aloud)

- Two voices. **Claire** is a woman: warm, clear, measured. **Tom** is a man: relaxed, curious.
  Each line starts with the speaker's name and a colon. That name picks the voice. Never read it.
- About 150 words per minute. Natural turn-taking, no overlap.
- Read only the lines under **Script**, exactly as written. Do not read headings or these
  directions.
- A line that says `(pause)` is about one and a half seconds of silence. Never say "pause".
- No music, sound effects, intro, or outro.
- Pronunciation: **Podverse** "POD-verse". Spell out **RSS**, **URL**, and **SQL** letter by
  letter. Say **MD5** "M-D-five". Say **guid** "GWID".
- If your service writes its own script from this one, keep every number and every claim
  exactly, keep both voices, and add nothing the text does not say.

## Script

CLAIRE: This is part one of Add by RSS, on feeds that people follow directly by their RSS URL instead of through the Podverse directory. This part is about one episode on many devices: how the phone and the website agree that they are playing the same thing. It's built. The phone side reaches people in the next store build.

TOM: Remind me what makes Add by RSS different.

CLAIRE: The feed is parsed on the device. There's no server copy of the show or its episodes. When an Add by RSS episode goes into a queue or a playlist, the server stores a bundle of resource data with it, like the title, the audio URL, and the artwork, plus an id that is a hash of a few of those fields.

(pause)

TOM: So what went wrong?

CLAIRE: On a test deployment, someone added a feed by RSS on the phone and played an episode. Then they opened the website, signed in as the same person. The website didn't show that episode as now playing. Pressing play on an Add by RSS episode on the website did nothing visible, and then the player switched to a different episode from the server's queue.

TOM: That last one sounds like the worst.

CLAIRE: It is. There were four causes. The phone never recorded Add by RSS playback at all. Each device gave the same episode a different id. The website let the server's queue head replace an item it was already playing. And the website didn't parse a feed on its own, so a feed added on the phone showed up on the website as a bare URL.

(pause)

TOM: What rules does the fix hold to?

CLAIRE: Four. First, reconciliation never swaps items under local playback. While something is loaded, a different item from the server is never loaded automatically. Second, one episode, one id, on every device. Third, credentials stay on the device. A feed URL never leaves with a username or password in it. Fourth, the follow carries real names, so every device can show a title and artwork before its own parse finishes.

TOM: Start with the id. Why did it differ?

CLAIRE: It was the MD5 hash of the device's channel id plus the episode's guid. But that channel id is a random id each device creates for its own copy of the feed. Same episode, different id on every device.

TOM: And now?

CLAIRE: The hash input is the feed URL plus the guid. When an episode has no guid, it's the feed URL plus the audio file's URL. The feed URL is canonical, with any username and password removed, before it reaches the hash.

TOM: Any traps in that?

CLAIRE: Two. When a feed has no guid for an item, the device makes one up from its own channel id and the item's position. That guid differs per device too, so the new form treats it as no guid and falls back to the audio URL. And the hash is taken over JSON text, so the order of the keys is part of the contract.

TOM: What about rows stored before this?

CLAIRE: A payload without a feed URL keeps the old form, and the website matches both forms for its own feeds. Migration twenty rehashes every stored queue and playlist row that does carry a feed URL. It adds a SQL function that reproduces the JavaScript hash byte for byte, and a database test proves they match.

TOM: Rehashing could make two rows the same.

CLAIRE: So it removes duplicates first. In a queue, it keeps the row closest to now playing, then the one with the furthest playback position, then the newest. In a playlist, it keeps the entry nearest the top and lowers the playlist's item count. The API also recomputes the id from the resource data on every write, so the value a client sends is only advisory. An older website build talking to a newer API still works.

(pause)

TOM: Now the phone. What did it skip?

CLAIRE: Writing a playback event returned early for Add by RSS. Now the phone records now playing and position the same way it does for directory episodes, under the same rule for meaningful events: play, pause, seek, ticks while playing, completion. It goes through the offline outbox, and the event carries the full resource data, so the server can create the row when the phone reconnects.

TOM: Which queue does it land in?

CLAIRE: The queue for the feed's medium. A feed that doesn't declare a medium plays on the podcast queue. The test feed had no medium, which is also why the website never recorded it. Add by RSS livestreams still record nothing.

(pause)

TOM: Then the swap on the website.

CLAIRE: The website kept a small note of which item this tab had. It remembered the server's head episode from page load, and playing an Add by RSS episode never updated that note. So the queue check saw the stale note equal the server head and loaded the server's episode over the one playing.

TOM: And the fix?

CLAIRE: This tab's identity comes from what the player has loaded, not from the note. A note that doesn't match the loaded item is stale and gets cleared. Then a hard rule in the loader: when the player isn't empty, it loads the server head only if that head is the same item. A different item goes through the handoff prompt instead, which asks the person which one to keep.

TOM: Restating: the server never pushes a different item into a player that already holds one.

CLAIRE: Right. Even if a later change breaks the identity lookup.

(pause)

TOM: Now the website opens and the phone's episode is now playing. How does it load something it never parsed?

CLAIRE: It tries four ways, in order. Its own copy, by its own id, for the same browser. Then by feed and episode: find the feed by its URL, then the item by guid, or by audio URL when the guid is missing or made up. Then a rebuild from an embedded bundle, if the row has one. Last, a minimal item built straight from the resource data: audio URL, titles, artwork, duration, publish date. That only fails when there's no audio URL.

TOM: And the position?

CLAIRE: The row's playback position. On page load the website loads it paused. It doesn't start playing on its own.

TOM: The minimal item sounds thin.

CLAIRE: It upgrades in place. If this browser follows the feed and has never parsed it, it starts a first parse. When the parse lands, a feed-changed event fires. If the same item is still loaded, the player swaps in the full title, artwork, chapters, transcript, notes, and value tags without reloading the audio. Same file, same position, same playing state. If the person doesn't follow that feed here, the minimal item stays. The website never follows or parses a feed on someone's behalf.

(pause)

TOM: Last piece. A feed added on the phone showed up on the website as a URL.

CLAIRE: Two changes. After each successful parse, the worker writes the feed's title and artwork onto the follow. An empty value never replaces a real one, and an image URL with credentials in it is dropped. A failure there is logged and never fails the parse. The website copies those onto feeds it hasn't parsed yet, so names show up right away.

TOM: And the website parsing on its own?

CLAIRE: A feed that has never been parsed in this browser is parsed on first sight, for any signed-in person. The list page and a feed's own page share one record of which feeds are already in flight, so a feed isn't parsed twice. Then there's a background refresh. It runs for signed-in people when the app loads and when the tab becomes visible again, at most once every thirty minutes per account.

TOM: Two tabs open at once?

CLAIRE: The start time is saved before the work begins, so the second tab sees it and stays idle. The full refresh runs only when the membership allows refreshing Add by RSS feeds, and an unchanged feed costs a not-modified answer. Errors are logged once and never shown as toasts.

(pause)

TOM: Rollout?

CLAIRE: Migration twenty runs with the API, and the readiness markers move to it. Ship the website and the API together. The phone records Add by RSS playback only after the next store build.

TOM: To remember. One: an Add by RSS episode's id is the feed URL plus the guid, or plus the audio URL, the same on every device. Two: the server recomputes that id, and migration twenty rehashed stored rows and dropped duplicates. Three: the phone records Add by RSS playback through its outbox, on the podcast queue when there's no medium. Four: the website never loads a different item over one it holds. Five: the website plays a phone's episode from the row's data, then fills it in when its own parse lands.

CLAIRE: One episode, one id, and nothing swapped out from under the listener. Next part: what the website does when a host won't let it play.
