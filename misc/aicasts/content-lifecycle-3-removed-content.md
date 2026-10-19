# When Content Is Removed, What You Made Stays

- **Covers:** How clips and playlist entries survive removal as small snapshots, how followers
  of an archived show move to Add by RSS, and how empty shows are deleted.
- **Status:** Planned
- **Series:** Content lifecycle, part 3 of 3
- **Sources:** `.llm/plans/active/removed-content-references/`
- **Length:** about 7 minutes (991 words)

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

CLAIRE: This is part three of three on how Podverse handles feed content over its life. Part one was show notes. Part two was slimming archived content. This part is removal: when content goes away for good, and how the things people made survive. It's planned, not built yet.

TOM: What breaks today?

CLAIRE: Three things. First, a takedown silently deletes people's clips. When a feed is taken down, the archiver deletes every episode. Clips and playlist entries are tied to episodes in a way that deletes them too. No trace, no notice.

TOM: That's the one that would surprise people most.

CLAIRE: Second, followers lose an archived show without being told. Followed-show lists only include publicly visible shows, and an archived show isn't one. Its episode list comes back empty, but as a success. The follow stays in the database forever, and the phone keeps a subscription with nothing in it, because mobile only drops a follow when the server says not found.

TOM: And third?

CLAIRE: Empty shows are never deleted. No code path removes a show record. An archived or taken-down show with no episodes left keeps its record, follows, notification settings, and stats forever.

TOM: So the goal: content can be removed, what someone made stays as a small reference, and data nobody can use is deleted.

CLAIRE: Exactly that.

(pause)

TOM: Start with clips. What stays?

CLAIRE: Clips and playlist entries each get two new columns: a small snapshot, and the time its source was removed. They're filled only at removal, so rows that never lose their source pay almost nothing.

TOM: What's in the snapshot?

CLAIRE: The episode title, the show title, the publish date, and for a soundbite, its title. No links, images, notes, or audio. The clip keeps what the user wrote: title, description, start and end times. It shows as Content Removed, and it can't play.

TOM: How does the clip survive the delete?

CLAIRE: The database link changes. Deleting an episode clears the clip's link instead of deleting the clip. One helper captures the snapshots inside the same transaction as every episode delete, right before it.

TOM: What if someone adds a new delete path and forgets the helper?

CLAIRE: Clips still survive, with the user's own title. For playlist entries, a database check makes the delete fail loudly instead of losing rows quietly.

TOM: Who can see a snapshot?

CLAIRE: Only the owner. If you made the clip, you get it back with the titles. Anyone else opening that clip's link gets a four-ten, meaning gone, with no titles, and public clip lists leave removed clips out. In a playlist, everyone sees Content Removed in that spot, but only the owner sees the titles. Owners can delete removed clips and entries. Changing a removed clip's times is refused, since there's no audio to line them up with.

TOM: Queues?

CLAIRE: Queue entries pointing at a removed clip are pruned, alongside the existing pruning of inactive episodes. And takedown runs in one transaction per feed: capture the snapshots, clear merge records that point at those episodes, delete the episodes, then strip the show's related records.

(pause)

TOM: Now follows. An archived show whose feed still works. What happens?

CLAIRE: Podverse members can follow any RSS feed directly, through Add by RSS. So once per archived show, the server checks the feed. One request, a ten-second timeout, reading at most sixty-four kilobytes. It counts as working if it succeeds and looks like an RSS or Atom feed.

TOM: And if it works?

CLAIRE: Every follower whose membership includes Add by RSS gets an Add by RSS follow for that feed, with its title and image, and loses the directory follow. Their devices pick the show up through the normal Add by RSS refresh. On mobile, the sync log notes the move. No push notification, no email.

TOM: Followers without that membership?

CLAIRE: Same as today. The show drops out of their list, with the existing sync log line.

TOM: And a feed that doesn't answer?

CLAIRE: Later runs try again, up to three attempts at least a day apart, then mark it unreachable. Taken-down shows, spam, and shows merged into another show are never converted.

TOM: How do the apps learn a show is archived?

CLAIRE: The episode list now returns a four-ten with the reason archived, instead of an empty success. If you're signed in and already have the Add by RSS follow, the response includes the feed URL. Only then, so it never shows a feed URL to anyone else. Taken-down shows return not found. If the show was merged, the merge answer wins. Show and episode detail stay as they are, so clip pages keep working. On the web, an archived show's page says it's no longer in the Podverse directory, and hides the Follow button.

(pause)

TOM: Last, cleanup. When is a show deleted?

CLAIRE: When it has no episodes left, and its feed is either taken down, or archived with the follow move finished. Its follows, notification settings, auto-download rules, and stats go with it. Up to two hundred shows per run, and never a show involved in a merge.

TOM: And the feed record?

CLAIRE: It stays. It's small, and it does two jobs. It remembers the feed's status, and it stops the Podcast Index sync from adding the feed again as if it were new. If an admin restores the feed, the parser creates a fresh show record on the next parse. And the management app still finds the feed after its show is gone.

(pause)

TOM: To remember. One: a removed clip or playlist entry stays as Content Removed, with titles only its owner sees. Two: snapshots are captured in the same transaction as the delete, and a missed capture fails loudly for playlists. Three: members following an archived show whose feed still works move to Add by RSS. Four: empty removed shows are deleted, and the feed record always stays.

CLAIRE: Across all three parts: notes arrive clean and bounded, archived content shrinks to what's used and grows back if it returns, and removal keeps what people made while clearing what nobody can use.
