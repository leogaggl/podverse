# Content Lifecycle 3: When Content Is Removed, What You Made Stays

- **Version:** 2026-10-19T01:42-05:00
- **Episode ID:** content-lifecycle-removed-content
- **Changed:** The work is built, so the script describes removal as it ships, including the
  web and phone screens. Leftover directory follows stay until the show is deleted. Regenerate
  the audio.
- **Description:** How clips and playlist entries survive removal as small snapshots, how
  members following an archived show move to Add by RSS, and how empty shows are deleted.
- **Status:** Built
- **Group:** Content Lifecycle, part 3
- **Sources:** `.llm/plans/completed/removed-content-references/`;
  `packages/orm/src/services/removedReferences.ts`,
  `packages/orm/src/services/archivedFollowConversion.ts`,
  `packages/orm/src/services/archivedChannelCleanup.ts`,
  `packages/orm/src/services/archiver.ts`
- **Length:** about 8 minutes (1,205 words)

## Directions for the voice service (do not read aloud)

- Two voices. **Claire** is a woman: warm, clear, measured. **Tom** is a man: relaxed, curious.
  Each line starts with the speaker's name and a colon. That name picks the voice. Never read it.
- About 150 words per minute. Natural turn-taking, no overlap.
- Read only the lines under **Script**, exactly as written. Do not read headings or these
  directions.
- A line that says `(pause)` is about one and a half seconds of silence. Never say "pause".
- No music, sound effects, intro, or outro.
- Pronunciation: **Podverse** "POD-verse". Spell out **RSS** and **URL** letter by letter. Say
  "four-ten" for 410.
- If your service writes its own script from this one, keep every number and every claim
  exactly, keep both voices, and add nothing the text does not say.

## Script

CLAIRE: This is part three of Content Lifecycle, on how Podverse handles feed content over its life. Part one was show notes. Part two was slimming archived content. This part is removal: when content goes away for good, and how the things people made survive. It's built.

TOM: What was going wrong?

CLAIRE: Three things. First, a takedown deleted people's clips. When a feed was taken down, the archiver deleted every episode. Clips and playlist entries were tied to episodes in a way that deleted them too. No trace, no notice.

TOM: That's the one that would surprise people most.

CLAIRE: Second, followers lost an archived show without being told. Followed-show lists only include publicly visible shows, and an archived show isn't one. Its episode list came back empty, but as a success. The follow stayed in the database, and the phone kept a subscription with nothing in it, because mobile only dropped a follow when the server said not found.

TOM: And third?

CLAIRE: Empty shows were never deleted. No code path removed a show record. An archived or taken-down show with no episodes left kept its record, follows, notification settings, and stats.

TOM: So the goal: content can be removed, what someone made stays as a small reference, and data nobody can use is deleted.

CLAIRE: Exactly that.

(pause)

TOM: Start with clips. What stays?

CLAIRE: Clips and playlist entries each have two columns: a small snapshot, and the time its source was removed. They're filled only at removal, so rows that never lose their source pay almost nothing.

TOM: What's in the snapshot?

CLAIRE: The episode title, the show title, the publish date, and for a soundbite, its title. No links, images, notes, or audio. The clip keeps what the user wrote: title, description, start and end times. It shows as Content Removed, and it can't play.

TOM: How does the clip survive the delete?

CLAIRE: The database link changes. Deleting an episode clears the clip's link instead of deleting the clip. One helper captures the snapshots inside the same transaction as every episode delete, right before it.

TOM: What if someone adds a new delete path and forgets the helper?

CLAIRE: Clips still survive, with the user's own title. For playlist entries, a database check makes the delete fail loudly instead of losing rows quietly.

TOM: Who can see a snapshot?

CLAIRE: Only the owner. If you made the clip, you get it back with the titles. Anyone else opening that clip's link gets a four-ten, meaning gone, with no titles, and public clip lists leave removed clips out. In a playlist, everyone sees Content Removed in that spot, but only the owner sees the titles. Owners can delete removed clips and entries. Changing a removed clip's times is refused, since there's no audio to line them up with. The title and description can still change.

TOM: Queues?

CLAIRE: Queue entries pointing at a removed clip are pruned, alongside the existing pruning of inactive episodes. And takedown runs in one transaction per feed: capture the snapshots, clear merge records that point at those episodes, delete the episodes, then strip the show's related records. Follows of that show end when the empty show is deleted, later in the same archive run.

(pause)

TOM: Now follows. An archived show whose feed still works. What happens?

CLAIRE: Podverse members can follow any RSS feed directly, through Add by RSS. So for each archived show, the server checks the feed. One request, a ten-second timeout, reading at most sixty-four kilobytes. It counts as working if it succeeds and looks like an RSS or Atom feed. One archive run handles up to one hundred shows.

TOM: And if it works?

CLAIRE: Every follower whose membership includes Add by RSS gets an Add by RSS follow for that feed, with its title and image, and loses the directory follow. Their devices pick the show up through the normal Add by RSS refresh. On the phone, the sync log says the show was moved to Add by RSS. No push notification, no email.

TOM: Followers without that membership?

CLAIRE: They keep the directory follow until the show itself is deleted. Part five is the planned change that ends those follows sooner, and leaves each of them a short record they can read.

TOM: When is the move settled?

CLAIRE: One of three outcomes. The feed worked and the members moved. Or the feed never answered: later runs try again, up to three attempts at least a day apart, then mark it unreachable. Or nobody following had the membership. Taken-down shows, spam, and shows merged into another show are never converted.

TOM: How do the apps learn a show is archived?

CLAIRE: The episode list returns a four-ten with the reason archived, instead of an empty success. If you're signed in and you already have the Add by RSS follow, the response includes the feed URL. Only then. Taken-down shows return not found. If the show was merged, the merge answer wins. Show and episode pages for an archived show stay as they are, so clips of episodes that are still there keep working.

(pause)

TOM: What does a removed clip look like?

CLAIRE: On the web and on the phone, the owner sees the clip title, the time range, the episode and show titles, and the sentence "The episode for this clip was removed from Podverse." They can delete it. It does not play. Anyone else who opens that clip sees only that sentence.

TOM: And a playlist?

CLAIRE: The entry stays in place, labeled Content Removed. It can be removed from the playlist. It does not play. On an archived show's web page, the sentence is "This show is no longer in the Podverse directory," and Subscribe is hidden. On the phone, the refresh that follows a moved follow stores the feed with the title and image from that follow.

(pause)

TOM: Last, cleanup. When is a show deleted?

CLAIRE: When it has no episodes left, and its feed is either taken down, or archived with the follow move finished. Its follows, notification settings, auto-download rules, and stats go with it. Up to two hundred shows per run, and never a show involved in a merge.

TOM: And the feed record?

CLAIRE: It stays. It's small, and it does two jobs. It remembers the feed's status, and it stops the Podcast Index sync from adding the feed again as if it were new. If an admin restores the feed, the parser creates a fresh show record on the next parse. And the management app still finds the feed after its show is gone. There's one exception, in part five: once Podcast Index drops a retired feed from its list and the show record is gone, the feed record is deleted too.

(pause)

TOM: To remember. One: a removed clip or playlist entry stays as Content Removed, with titles only its owner sees, and it does not play. Two: snapshots are captured in the same transaction as the delete, and a missed capture fails loudly for playlists. Three: members following an archived show whose feed still works move to Add by RSS. Everyone else keeps the directory follow until the show is deleted. Four: empty removed shows are deleted, and the feed record stays to remember the feed's status.

CLAIRE: Removal keeps what people made and clears what nobody can use. Next part: duplicate feeds, and how two copies of one show become one.
