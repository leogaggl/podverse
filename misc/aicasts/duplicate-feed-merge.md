# One Show, Not Two: Following Podcast Index Merges

- **Covers:** How Podverse records Podcast Index duplicate pairs, checks that their episodes
  match, folds the copies into one show, and keeps old links, phones, and downloads working.
- **Status:** Built on the current branch, not yet committed. Ships with the mode off.
- **Series:** Standalone
- **Sources:** `.llm/plans/completed/pi-duplicate-feed-merge/`,
  `apps/workers/src/commands/podcastIndex/deadFeeds/`,
  `packages/orm/src/lib/duplicateFeedMatch.ts`,
  `packages/orm/src/services/channel/applyChannelMerge.ts`, `apps/api/src/routes/identity.ts`,
  `apps/mobile/src/data/identityRemap.ts`
- **Length:** about 9 minutes (1,310 words)

## Directions for the voice service (do not read aloud)

- Two voices. **Claire** is a woman: warm, clear, measured. **Tom** is a man: relaxed, curious.
  Each line starts with the speaker's name and a colon. That name picks the voice. Never read it.
- About 150 words per minute. Natural turn-taking, no overlap.
- Read only the lines under **Script**, exactly as written. Do not read headings or these
  directions.
- A line that says `(pause)` is about one and a half seconds of silence. Never say "pause".
- No music, sound effects, intro, or outro.
- Pronunciation: **Podverse** "POD-verse", **iTunes** "eye-tunes", **GUID** "goo-id". Spell out
  **RSS** and **API** letter by letter. Say "four-ten" for 410.
- If your service writes its own script from this one, keep every number and every claim
  exactly, keep both voices, and add nothing the text does not say.

## Script

CLAIRE: This is a standalone cast about duplicate feeds: when the same show exists under two RSS addresses, and how Podverse folds them into one. This one is built. It ships switched off and gets turned on one environment at a time.

TOM: How does one show end up with two feeds?

CLAIRE: A few ways. A WordPress site can publish the same show at two addresses. A show moves hosts and the old address lingers. Or the same address gets spelled two ways. Podcast Index notices and merges them on its side. Until this work, Podverse kept both copies. Some listeners followed one, some the other, some both, and their progress, clips, and playlists were split across two shows that are really one.

TOM: What does Podcast Index give us to work with?

CLAIRE: Not much. Every hour it rewrites a list of feeds it has retired. About three point three million rows. For roughly eighty-three thousand of them, a second column names the feed it kept instead. That's the whole signal. No episode mapping, and no way to ask what changed since last time.

TOM: So who decides two feeds are the same show? Us or them?

CLAIRE: Them. Podcast Index decides the pair. Podverse never invents a duplicate because titles look alike or an identifier matches. Our checks can refuse a pair, or send it to a person for review. They can never create one. And a retired feed with no named replacement is left alone.

(pause)

TOM: Walk me through detection.

CLAIRE: It runs every hour, at a quarter past. It asks for the file only if it changed, and streams it rather than loading thirty megabytes into memory. Some replacements were later retired themselves, so the job follows each chain to the last feed still standing. If a chain loops, or ends on a retired feed, the pair is skipped. Then it keeps only pairs where Podverse has the old feed, and records each one as detected.

(pause)

TOM: Detected isn't the same as safe to merge.

CLAIRE: Right. Next it checks that the two feeds carry the same episodes. Matching goes in three tiers, strictly one to one. First, episode GUIDs, the ids feeds attach to each episode. Some feeds put the same junk value on every episode, like the number one, so a GUID that repeats within a feed is ignored.

TOM: Second?

CLAIRE: The audio file address. Before comparing, it lowercases the host, drops the query string, and unwraps the analytics prefixes many hosts put in front of the real file. So an address behind a tracking redirect still matches the plain one.

TOM: And third is fuzzy, I'm guessing.

CLAIRE: Carefully fuzzy. The same title, published within thirty-six hours, and durations within thirty seconds, or three percent of the longer one if that's more. It only counts when that pairing is the only possible one on both sides. If an episode could match two, it matches none.

TOM: Then when is a pair good enough?

CLAIRE: A pair is verified when at least eighty percent of the smaller feed's episodes match, and at least three do. Or when at least one episode matches and the feeds share a strong identifier: the same podcast GUID, the same iTunes id, or one feed's self link pointing at the other. Everything else waits for review.

TOM: So, eighty percent and three episodes, or one episode plus a shared identifier.

CLAIRE: That's the line.

(pause)

TOM: What does applying a pair actually do?

CLAIRE: There are two modes. If Podverse only has the old feed, it re-points it. The feed's address and Podcast Index id move to the survivor, and every show and episode id stays the same. Phones see nothing change. Matched episodes take the survivor's GUIDs, and one fresh parse picks up anything new.

TOM: And if we have both feeds?

CLAIRE: It absorbs the old show into the survivor. Follows move over, and someone who followed both ends up with one. Notification settings, auto-download rules, and pending follows move too. Queue progress moves, keeping whichever copy was finished, or else the further position. Clips and playlist entries move to the matching episode. Stats are added together.

TOM: What about an episode that only matched on the fuzzy tier? The audio could be different.

CLAIRE: Then a saved position goes back to the start, unless it was finished. Clips still move. Episodes with no match at all, but with progress or a clip, stay playable. Then the old feed is marked merged, which stops parsing and hides it from the directory. Its show record stays, so old links and undo keep working.

TOM: Undo how?

CLAIRE: Each pair applies in its own transaction, and every row it touches goes into a journal with its before and after. Undo walks the journal backwards and restores each row.

(pause)

TOM: Moving a whole backlog sounds like a flood of notifications.

CLAIRE: It used to be, even without merges. The first time Podverse parsed a show, every episode looked new: a notification and an auto-download push for the whole backlog. Now the first parse of any show with no stored episodes skips both. And the parse after a re-point skips them for anything published before the merge. A genuinely new episode still notifies.

TOM: Anything else fixed along the way?

CLAIRE: Each podcast GUID can belong to only one show, so two copies of a show made every parse of the second copy fail. Now that parse saves without the GUID and logs a warning.

(pause)

TOM: Say I have a bookmark to the old show. What happens?

CLAIRE: On the web, an absorbed show or a matched episode returns a permanent redirect to the survivor. It keeps the query string, and carries over the sort you chose for that show. The API answers old ids with a four-ten, meaning gone, plus the id to use instead. Episodes with no match still answer normally and still play. And a public resolve endpoint takes up to five hundred ids per list and returns only the ones that moved.

TOM: And the phone? Especially signed out, where the server doesn't know my subscriptions.

CLAIRE: That's why the resolve call is public. A new identity remap job runs on the normal sync queue, signed in or not. It runs when a followed show comes back gone or not found, so the app checks for a merge before it unfollows anything. It also makes a daily pass, at most once every twenty-four hours. When ids moved, it rewrites them on the phone: subscriptions, downloads, listening progress, sort choices, the last-played item, and the car browse cache.

TOM: Do downloads get fetched again under the new id?

CLAIRE: No. Downloaded files stay exactly where they are. The phone also remembers each remap it applied, so running it twice changes nothing.

(pause)

TOM: What about pairs that didn't clear the line?

CLAIRE: They go to a Merge Review page in the management app, which shows pairs waiting for review by default. Approve marks a pair verified, and the next run applies it. Reject drops it. Revert undoes an applied merge, after a confirmation.

TOM: And turning it on?

CLAIRE: One setting with three values: off, dry run, and apply. Off does nothing, not even the download, and it's the default everywhere. Dry run records and checks pairs but moves nothing. On alpha, the plan is dry run first, a look at the counts and some spot checks in Merge Review, then apply. One confirmed re-point and one confirmed absorb on real Podcast Index pairs come before turning it on anywhere else.

(pause)

TOM: To remember. One: Podcast Index decides the pair, and Podverse only checks it. Two: a pair is verified by matching episodes, eighty percent and at least three, or one episode plus a shared identifier. Three: re-point when we have one feed, absorb when we have both, and every change is journaled and reversible. Four: old links redirect, phones remap in place, and downloads are never fetched again.

CLAIRE: And none of it notifies listeners about episodes they already had.
