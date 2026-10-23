# Add by RSS 4: The Full Player on the Phone

- **Version:** 2026-10-22T18:57-05:00
- **Episode ID:** add-by-rss-the-full-player-on-the-phone
- **Changed:** First version.
- **Description:** How the phone's full player treats an Add by RSS item like a directory one:
  title links that open the feed and then the item, Mark as Played, a playing row that shows
  pause and progress, and chapters, transcript, and summary loaded from this device's copy of
  the feed.
- **Status:** Built. It reaches people in the next store build.
- **Group:** Add by RSS, part 4
- **Sources:** `.llm/plans/completed/add-by-rss-parity/` (plans 50, 51, 39, 52, 90, 91, 93, 94);
  `apps/mobile/src/screens/player/fullPlayerContentLink.ts`,
  `apps/mobile/src/navigation/index.tsx`,
  `apps/mobile/src/screens/player/FullPlayerScreen.tsx`,
  `apps/mobile/src/lib/addByRss/resourceData.ts` (`addByRssPlaybackMediaId`),
  `apps/mobile/src/lib/playback/buildPlaybackTarget.ts`,
  `apps/mobile/src/hooks/useAddByRssPlayback.ts`,
  `apps/mobile/src/playback/nowPlayingAddByRssSections.ts`,
  `apps/mobile/src/playback/addByRssNowPlayingSectionsStore.ts`,
  `apps/mobile/src/data/repositories/segmentsRepository.ts`
- **Length:** about 7 minutes (1,091 words)

## Directions for the voice service (do not read aloud)

- Two voices. **Claire** is a woman: warm, clear, measured. **Tom** is a man: relaxed, curious.
  Each line starts with the speaker's name and a colon. That name picks the voice. Never read it.
- About 150 words per minute. Natural turn-taking, no overlap.
- Read only the lines under **Script**, exactly as written. Do not read headings or these
  directions.
- A line that says `(pause)` is about one and a half seconds of silence. Never say "pause".
- No music, sound effects, intro, or outro.
- Pronunciation: **Podverse** "POD-verse". Spell out **RSS** letter by letter.
- If your service writes its own script from this one, keep every number and every claim
  exactly, keep both voices, and add nothing the text does not say.

## Script

CLAIRE: This is part four of Add by RSS. Part three covered the phone's Add by RSS pages and rows. This part covers the full player: what happens when you tap a title, mark an item played, or open its chapters while an Add by RSS item plays. It's built, and it reaches people in the next store build.

TOM: What was missing?

CLAIRE: For an Add by RSS item, the item's title in the full player didn't open anything. Mark as Played did nothing useful. The row for the item that was playing never showed a pause button or progress. And the player had no chapters, transcript, or summary to show for it.

(pause)

TOM: Same rule as before? The directory version is the source of truth?

CLAIRE: Yes. The full player for a directory episode is the model, and the same components are reused. They receive a chapter list or a link target; none of them gains a special Add by RSS branch.

(pause)

TOM: Start with the title.

CLAIRE: Tapping the item's title in the full player now opens a small stack: the tab's root, then the show's page, then the item's page, focused on the item. So Back from the item lands on its show, not wherever you happened to be. That applies to directory items too. Tapping the channel title still opens just the show's page.

TOM: Which tab does that happen on?

CLAIRE: A directory show you follow opens on Home, and one you don't follow opens on Browse. An Add by RSS feed is always a follow, so its links always open on Home: the Add by RSS feed page, then the Add by RSS episode, track, or livestream page.

TOM: What if the phone can't find that item locally?

CLAIRE: Then the title stays plain text. It becomes a link only after the phone has found both the feed and the item, so tapping it never waits on anything.

(pause)

TOM: Mark as Played.

CLAIRE: The full player's More sheet now offers Mark as Played, or Mark as Unplayed when the item is already done, for Add by RSS items as well. It uses the same access gate, notices, and in-progress state as the directory version. When there's nothing to mark, such as an Add by RSS livestream, the option is hidden rather than shown and doing nothing.

TOM: Can I queue from the full player?

CLAIRE: No, and not for any item. Queue: Next and Queue: Last never appear on the full player. Those live on rows and detail pages.

(pause)

TOM: Now the playing row. Why didn't it show pause?

CLAIRE: A row is marked as playing when its id equals the id of what the engine is playing. For an Add by RSS episode, the engine's id was the feed's id. So every episode of that feed had the same id, and no row's own id ever matched it.

TOM: And the fix?

CLAIRE: An Add by RSS episode or track now plays under its Add by RSS hash id, the same id part one described: stable across devices and different for every item. One helper computes it, and every place that needs the playing id calls that helper, so they can't drift apart. Rows carry the id computed once per load, so drawing a row never hashes anything.

TOM: What does someone see?

CLAIRE: The playing row shows a pause button, and progress when the row shows a duration. Pressing play on the playing row pauses it, and pressing it again resumes, instead of loading the episode a second time. Track rows have no play button, the same as directory track rows, so they show none of this.

TOM: Did the wrong id cause anything else?

CLAIRE: It did. The phone's native playback journal recorded that feed id, which no server row uses. New journal entries carry the hash. Older entries aren't rewritten; they still match nothing, as before.

(pause)

TOM: Chapters next.

CLAIRE: The player keeps one small store for the Add by RSS item now playing. It finds the item in this device's parsed copy of the feed and loads its chapters and transcript through the same request the episode page uses. A new item replaces what's there.

TOM: When does it load?

CLAIRE: Chapters load on their own when the item links a chapters file, the person is signed in, and Offline Mode is off. That matches directory episodes. A transcript-only item loads when someone picks the Transcript chip. A failed load stays failed until someone presses Retry; nothing retries by itself.

TOM: And once chapters arrive?

CLAIRE: They drive everything a directory episode's chapters drive: the chapter band under the artwork, chapter artwork, marks on the scrubber, and previous and next chapter. The chapter band's space is reserved per item from the start, so it never pops in mid-play.

TOM: Those chapters might come from a private feed.

CLAIRE: Right, fetched with this account's saved credentials. So the store lives for one item and one session. It's cleared on sign-out, answers that arrive after a reset or a new item are dropped, and nothing is saved to disk.

(pause)

TOM: What chips does the full player show for an Add by RSS item?

CLAIRE: Summary always, then Chapters and Transcript when the item links them, and People when it lists people. No Clips, Official Clips, or Funding, since those need directory data. Music uses the same chips. Livestreams get no sections at all.

TOM: What's in Summary?

CLAIRE: The parsed item's description, with Show more, and the item's website link when the text is cut short. A time in the summary seeks the player, as a chapter row does. The chips reset to Summary whenever a new Add by RSS item starts.

TOM: And while things are loading?

CLAIRE: The panes follow the episode page's order. Offline Mode with nothing loaded shows the Offline Mode message. Signed out shows the login prompt. A failed load shows the error with Retry. Otherwise a spinner, then the content.

(pause)

TOM: To remember. One: tapping the item title opens the show and then the item on the same tab, and Add by RSS always opens on Home. Two: the full player offers Mark as Played and Mark as Unplayed for Add by RSS items, and never offers queueing for anything. Three: an Add by RSS item plays under its hash id, so its row shows pause and progress. Four: one now-playing store loads chapters and transcript from this device's parsed feed, and it's cleared on sign-out. Five: the full player shows Summary, Chapters, Transcript, and People for Add by RSS items, but not for livestreams.

CLAIRE: In the full player, an Add by RSS item now gets the same treatment as any other episode.
