# Web Navigation 1: Subscribed, Browse, and One Add by RSS Page

- **Version:** 2026-10-22T18:57-05:00
- **Episode ID:** web-navigation-subscribed-browse-and-add-by-rss
- **Changed:** First version.
- **Description:** How the website moved from separate list pages for each kind of content to
  three chip pages, Subscribed, Browse, and Add by RSS, how Subscribed combines server follows
  with this browser's Add by RSS feeds, and the small overlay that shows Add by RSS feeds
  refreshing in the background.
- **Status:** Built
- **Group:** Web Navigation, part 1
- **Sources:** `.llm/plans/completed/add-by-rss-parity/` (plans 60–71, 92);
  `apps/web/src/utils/mediaListChips.ts`,
  `apps/web/src/components/MediaListChips/MediaListChips.tsx`,
  `apps/web/src/components/SideBar/SideBar.tsx`,
  `apps/web/src/app/page.tsx`, `apps/web/src/app/browse/page.tsx`,
  `apps/web/src/app/add-by-rss/page.tsx`, `apps/web/src/app/sitemap.ts`,
  `apps/web/src/hooks/useReadyAddByRSSFeeds.ts`,
  `apps/web/src/utils/subscribed/mergeSubscribedChannels.ts`,
  `apps/web/src/utils/subscribed/mergeSubscribedItems.ts`,
  `apps/web/src/utils/backgroundActivity/backgroundActivityStore.ts`,
  `apps/web/src/components/BackgroundActivity/BackgroundActivityOverlay.tsx`,
  `apps/web/src/utils/addByRSS/storage.ts`
- **Length:** about 8 minutes (1,229 words)

## Directions for the voice service (do not read aloud)

- Two voices. **Claire** is a woman: warm, clear, measured. **Tom** is a man: relaxed, curious.
  Each line starts with the speaker's name and a colon. That name picks the voice. Never read it.
- About 150 words per minute. Natural turn-taking, no overlap.
- Read only the lines under **Script**, exactly as written. Do not read headings or these
  directions.
- A line that says `(pause)` is about one and a half seconds of silence. Never say "pause".
- No music, sound effects, intro, or outro.
- Pronunciation: **Podverse** "POD-verse". Spell out **RSS** and **URL** letter by letter. Say
  **IndexedDB** "indexed D-B". Say "four-oh-four" for 404.
- If your service writes its own script from this one, keep every number and every claim
  exactly, keep both voices, and add nothing the text does not say.

## Script

CLAIRE: This is part one of Web Navigation. It covers how the website's sidebar and list pages were rebuilt around three chip pages, Subscribed, Browse, and Add by RSS, and the small overlay that shows Add by RSS feeds refreshing in the background. It's built.

TOM: What did the website look like before?

CLAIRE: The home page was one list of the shows you follow, with a dropdown to pick a medium. The sidebar had a Podcasts section and a Music section, each with its own list links. And Add by RSS had six links of its own in the sidebar, one for each kind of list.

(pause)

TOM: Why change it?

CLAIRE: Three reasons. The phone already organized the same content with a row of chips at the top of Home and Browse, so the website felt like a different product. Add by RSS feeds never appeared on the website's home page, only on their own pages. And the sidebar kept growing a link for every kind of list.

TOM: So the phone is the model.

CLAIRE: Yes. The chip lists on the website follow the phone's order.

(pause)

TOM: What rules does the new layout follow?

CLAIRE: Four. First, Subscribed shows what you follow, and that includes your Add by RSS feeds. Second, Browse is directory content only. Third, Add by RSS has one page, with its own chips, and nothing else in the sidebar. Fourth, each page remembers its chip on this device, and an explicit URL always wins.

(pause)

TOM: Walk me through the sidebar now.

CLAIRE: Search at the top. Then Subscribed, then Browse. Then the My Library group, open by default, with Queues, History, Playlists, My Clips, and Add by RSS.

TOM: There used to be a Profiles link.

CLAIRE: It's gone from the sidebar. Public profiles live under Browse, on the Users chip. The profiles page itself still exists.

(pause)

TOM: Start with Subscribed.

CLAIRE: It's the home page, titled Subscribed. Its chips, in order, are Podcasts, Episodes, Clips, Artists, Albums, Tracks, and Livestreams. The medium dropdown is gone; the chips replace it.

TOM: And Add by RSS feeds show up there?

CLAIRE: On every chip except Clips. Clips come from the server only. On the others, the page reads this browser's Add by RSS feeds that are ready to use, meaning feeds that don't still need a username and password here, and merges them with the server's list.

TOM: Merging two lists sounds like a paging problem.

CLAIRE: It is, so each chip has its own rule. For shows, artists, and albums, the website loads the whole followed list and interleaves Add by RSS feeds by the current sort, then pages locally. Sorted by top, all server rows come first and Add by RSS feeds follow, newest first, since they have no listen counts. Ties go to the server row.

TOM: And episodes and tracks?

CLAIRE: Sorted by most recent, Add by RSS items merge into the first page by publish date. Sorted by top, they go on the last server page. The website takes up to sixty of the newest Add by RSS items before it merges. Livestreams add Add by RSS items to the first page only, live first, then scheduled.

(pause)

TOM: Browse next.

CLAIRE: Browse has the same seven chips, plus Playlists and Users. It shows directory content only. No Add by RSS feed ever appears there, because Add by RSS feeds live on the device, not in the directory.

TOM: And the Add by RSS page?

CLAIRE: One link in My Library opens it. Its chips are Podcasts, Episodes, Artists, Albums, Tracks, and Livestreams. No Clips. The Add Feed button sits in its header. The page isn't in the sitemap, and it asks search engines not to index it.

(pause)

TOM: How does a page remember its chip?

CLAIRE: The chip lives in the URL as a tab parameter, except the default chip, Podcasts, which keeps the URL clean. The choice is also saved in the website's local settings cookie, separately for Subscribed, Browse, and Add by RSS. On load, a tab in the URL wins and overwrites the saved choice. Without one, the saved choice applies, and then the default.

TOM: Why a cookie and not browser storage?

CLAIRE: Because the server renders these pages, and it can read a cookie. With browser storage, the first paint would show the default chip and then switch. The choice is never sent to an account. A laptop and a phone can disagree, and that's fine.

(pause)

TOM: What happened to the old list URLs?

CLAIRE: They're gone, with no redirects. Podcasts, Episodes, Clips, Artists, Albums, Tracks, both livestream lists, and the old Add by RSS lists now answer four-oh-four. Detail pages for a show, an episode, a clip, a track, or a livestream all stay. The sitemap adds Browse and drops the old lists.

TOM: Anything an operator has to do?

CLAIRE: One cleanup. The setting that used to order the sidebar's groups is no longer read. Remove it from the website's environment. If it stays, it's ignored.

(pause)

TOM: Now the overlay.

CLAIRE: The phone shows a small indicator while background sync runs. People wanted the same on the website. It's a round button in the bottom right of the screen, its own overlay, set high enough that it never covers the mini player or the clip and chapter bar above it.

TOM: What does it report?

CLAIRE: Add by RSS refreshes only. That was a deliberate choice; nothing else joins it. It appears only for a signed-in person who follows at least one Add by RSS feed, and only while that work is running. Someone with no Add by RSS feeds never sees a spinner.

TOM: And when I click it?

CLAIRE: Collapsed, it's a small circle with a spinner. That's the default. Clicking expands it to the left, at least fifteen rem wide and at most twenty-two and a half, or the screen width minus its margins, whichever is smaller. It reads Updating Your RSS Feeds. When it's waiting on a set of parse results, it adds a count, like two of five.

TOM: Does it remember if I left it open?

CLAIRE: Yes, in the same local settings cookie. The next time it appears, on any page, it opens the way you left it. Its accessible name is Background Activity, and screen readers hear the status line, not every change in the count.

(pause)

TOM: I heard one bug turned up along the way.

CLAIRE: Two pieces of code could sync Add by RSS follows at the same moment, the background refresh and a page's own sync. Each saw a feed missing from the browser's local database and inserted a placeholder for it, with different ids. The database allows only one record per feed URL, so the second insert failed and aborted that whole sync.

TOM: The fix?

CLAIRE: Placeholders are inserted only when missing, checked by feed URL inside one database transaction. Two syncs can still run at once. They just don't collide anymore.

(pause)

TOM: To remember. One: the website has three chip pages, Subscribed, Browse, and Add by RSS, and the sidebar is Search, Subscribed, Browse, and My Library. Two: Subscribed merges this browser's ready Add by RSS feeds into every chip but Clips, and Browse shows the directory only. Three: each page remembers its chip in a cookie, and a URL tab wins. Four: the old list URLs answer four-oh-four, and detail pages stay. Five: a bottom-right overlay shows Add by RSS refreshes, collapsed by default, and remembers whether you opened it.

CLAIRE: The website and the phone now organize the same content the same way.
