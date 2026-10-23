# Add by RSS 3: The Same Screens on the Phone

- **Version:** 2026-10-22T18:57-05:00
- **Episode ID:** add-by-rss-the-same-screens-on-the-phone
- **Changed:** First version.
- **Description:** How the phone's Add by RSS feed pages, rows, and new episode and track pages
  were rebuilt on the same components as directory content, which actions Add by RSS rows offer,
  how Add by RSS feeds joined Home, and the one-time fix that gave music feeds their real type.
- **Status:** Built. It reaches people in the next store build.
- **Group:** Add by RSS, part 3
- **Sources:** `.llm/plans/completed/add-by-rss-parity/` (plans 10, 20–22, 30–39, 40–44);
  `apps/mobile/src/screens/home/AddByRssHomeDetailScreen.tsx`,
  `apps/mobile/src/screens/home/addByRss/AddByRssSettingsPane.tsx`,
  `apps/mobile/src/screens/home/addByRss/AddByRssEpisodesSection.tsx`,
  `apps/mobile/src/screens/home/HomeFeedRow.tsx`,
  `apps/mobile/src/components/player/MediaRowActions.tsx`,
  `apps/mobile/src/screens/home/AddByRssEpisodeDetailScreen.tsx`,
  `apps/mobile/src/screens/home/AddByRssTrackDetailScreen.tsx`,
  `apps/mobile/src/data/repositories/segmentsRepository.ts`,
  `apps/mobile/src/data/db/applyAddByRssResourceTypes.ts`,
  `apps/mobile/src/screens/home/homeFeedData.ts`,
  `apps/mobile/src/screens/home/homeItemMerge.ts`,
  `apps/mobile/src/screens/home/homeItemRowActions.ts`,
  `apps/mobile/src/screens/home/HomeFeedGridCell.tsx`,
  `apps/mobile/src/screens/rss/AddByRssRootScreen.tsx`
- **Length:** about 8 minutes (1,265 words)

## Directions for the voice service (do not read aloud)

- Two voices. **Claire** is a woman: warm, clear, measured. **Tom** is a man: relaxed, curious.
  Each line starts with the speaker's name and a colon. That name picks the voice. Never read it.
- About 150 words per minute. Natural turn-taking, no overlap.
- Read only the lines under **Script**, exactly as written. Do not read headings or these
  directions.
- A line that says `(pause)` is about one and a half seconds of silence. Never say "pause".
- No music, sound effects, intro, or outro.
- Pronunciation: **Podverse** "POD-verse". Spell out **RSS** and **API** letter by letter.
- If your service writes its own script from this one, keep every number and every claim
  exactly, keep both voices, and add nothing the text does not say.

## Script

CLAIRE: This is part three of Add by RSS. The earlier parts covered one episode across devices, and what the website does when a host blocks it. This part is about the phone: how its Add by RSS screens were rebuilt to work like the screens for directory content. It's built, and it reaches people in the next store build.

TOM: How different were they?

CLAIRE: Very. An Add by RSS feed's page had a different header, with the feed's username and password fields sitting in it. Where a podcast page has a sort control, it had a Recent chip, and the spacing under it was off. Tapping an episode row played it right away instead of opening anything. There was no More button. And Add by RSS feeds didn't appear on Home at all, only in the Add by RSS library.

(pause)

TOM: What rules did the rebuild follow?

CLAIRE: Four. First, the directory screen is the source of truth. If a podcast page does something, the Add by RSS page does the same thing, or there's a reason it can't. Second, reuse the same components rather than drawing a look-alike. Third, credentials stay on the device. Fourth, an Add by RSS row offers every action the device can actually perform for it, and nothing it can't.

TOM: Why insist on the same components? A copy would look the same.

CLAIRE: Until the next change to the podcast page. Then the copy drifts, and the two screens quietly stop matching.

(pause)

TOM: Start with the feed's page.

CLAIRE: It now uses the same shell and header as a podcast page. Artwork, title, an Unsubscribe button, and the settings gear. Below that, the section chips. A podcast feed has Episodes, Downloaded, and About, plus Funding and People when the feed has them. A music feed has Tracks and About, with Funding and People when present, and no Downloaded.

TOM: And the Recent chip?

CLAIRE: It's a real sort chip now, the same control the podcast page uses. For a podcast feed it offers Recent and Oldest. For a music feed it offers Ordered and Reverse. The choice is remembered per feed. It orders the episode or track list only.

TOM: Where did the username and password go?

CLAIRE: Behind the gear, in the feed's settings. Those fields are always visible there. They're stored in secure storage on the phone, never on the server, and sent only with a request that needs them.

TOM: Does Offline Mode change anything?

CLAIRE: A podcast feed's page opens on Downloaded while Offline Mode is on, as a podcast page does. A music feed stays on Tracks.

(pause)

TOM: Now the rows.

CLAIRE: Item rows across the app share one row component, directory and Add by RSS alike. Tapping an Add by RSS episode row opens that episode's page. The play button plays it without leaving the list. When the episode has a duration, it shows to the right of the play button.

TOM: Same for tracks?

CLAIRE: No, on purpose. Tapping a track row plays it, because that's what people expect from music. To get to the track's page, there's Go to Track in the More menu.

TOM: What's in the More menu?

CLAIRE: For an episode: Queue: Next, Queue: Last, Add to Playlist, Mark as Played, and Download Episode when the file can be downloaded. Track rows offer the same, plus Go to Track. There's no Share on Add by RSS rows.

TOM: The rows changed for everyone, didn't they?

CLAIRE: The type did. On every item row, directory and Add by RSS, the date is larger, bold, and in the link color, matching the date on a show row. The description moved up a size but stays regular weight. Title, date, and description sit closer together. And the blue dot for new content moved to the top right corner, beside the title, so it never crowds the date or the progress bar.

(pause)

TOM: The episode pages are new?

CLAIRE: Yes. The phone had no page for an Add by RSS episode or track. Now there are two, registered on both the Home stack and the Library stack, so each tab keeps its own back history. The episode page uses the same header as a directory episode. It always has Summary, and Chapters, Transcript, and People when the episode has them.

TOM: How does the phone load chapters for a feed the server doesn't store?

CLAIRE: It sends the item's chapter and transcript addresses to the API, which fetches them and answers. If those addresses are inside the feed's credential scope, the phone includes the feed's credentials with that request, and only then. If the feed hasn't been parsed yet, or the item has no such addresses, it makes no request at all.

TOM: And the track page?

CLAIRE: The same header as a directory track page, with Summary, Lyrics, and People when present. Lyrics load the same way a transcript does.

(pause)

TOM: You said music feeds had a real type now. What did they have before?

CLAIRE: Nothing useful. The phone saved every Add by RSS feed as a podcast. So no feed was ever music, and an album added by RSS showed up as a podcast with episodes.

TOM: Now?

CLAIRE: The type comes from the medium in the parsed feed, so an album is an album and its items are tracks. For feeds already on the phone, the first time the database opens after the update, a one-time pass reads each feed's stored parse and corrects its type. No network request. A flag in the database records that the pass ran, so it never runs again.

(pause)

TOM: Last piece. Home.

CLAIRE: Home only read directory follows. That was intended at the time, and the docs said so. Now Home's show chips list directory follows and Add by RSS feeds together. Only feeds that are ready to use appear there. A feed still waiting on a username and password shows only in the Add by RSS library, in its Needs Username and Password section.

TOM: And episodes and tracks on Home?

CLAIRE: Home merges up to sixty of the newest Add by RSS items with the directory list. Sorted by popularity, Add by RSS items go after directory items, since they have no listen counts. Every episode and track row on Home offers Mark as Played and Download. Directory rows also offer Share.

TOM: Unsubscribing?

CLAIRE: Swipe left on an Add by RSS show row, on Home or in the library, and Unsubscribe appears, the same as for a directory show. Rows in the Needs Username and Password section don't swipe. In grid view, touching and holding a tile opens the same choice as a sheet from the bottom of the screen, with Cancel under it.

TOM: Anything left undone?

CLAIRE: One thing, deliberately. Chapter artwork on feeds that need a username and password is deferred. Those chapter images load without the feed's credentials, so when the image host requires them, the row and the player show the fallback artwork. Changing that means changing a credentials rule, so it's a product and security decision first.

(pause)

TOM: To remember. One: the directory screen is the source of truth, and Add by RSS uses the same components. Two: the feed page has a real sort chip, and the username and password live behind the settings gear. Three: an episode row opens the episode page, a track row plays, and the More menu offers queue, playlist, mark as played, and download, never Share. Four: music feeds now get their real type, fixed once for feeds already on the phone. Five: ready Add by RSS feeds appear on Home, with swipe and long press to unsubscribe.

CLAIRE: On the phone, a feed added by RSS now behaves like any other show. Next part: the full player.
