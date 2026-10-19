# Content Lifecycle 5: Retired Feeds and the Removed Content Log

- **Version:** 2026-10-19T08:48-05:00
- **Episode ID:** content-lifecycle-retired-feeds
- **Changed:** The work is built, so the script describes it as it ships: apply runs also store
  the count, resolvable pairs always wait for the merge process, stub deletes happen only on
  apply, and the phone keeps its Add by RSS line. Regenerate the audio.
- **Description:** How Podverse retires shows that Podcast Index has retired with no
  replacement, with a brake against a bad list, and how a signed-in listener can see why a
  followed show disappeared, without being notified.
- **Status:** Built. Ships with the retire mode off.
- **Group:** Content Lifecycle, part 5
- **Sources:** `.llm/plans/completed/podcast-index-retired-feeds/`;
  `apps/workers/src/commands/podcastIndex/deadFeeds/flagAndMerge.ts`,
  `packages/external-services-podcast-index/src/deadFeedDuplicateChains.ts`,
  `packages/orm/src/services/archiver.ts`,
  `packages/orm/src/services/archivedFollowConversion.ts`,
  `packages/orm/src/services/accountContentLog.ts`,
  `apps/workers/src/commands/orm/accountContentLog/purge.ts`,
  `apps/api/src/controllers/account/accountContentLog.ts`,
  `apps/web/src/components/Settings/Panels/SettingsAdvanced/SettingsRemovedContent.tsx`,
  `apps/mobile/src/screens/more/MoreRemovedContentScreen.tsx`,
  `apps/mobile/src/data/repositories/directoryChannelGone.ts`
- **Length:** about 10 minutes (1,502 words)

## Directions for the voice service (do not read aloud)

- Two voices. **Claire** is a woman: warm, clear, measured. **Tom** is a man: relaxed, curious.
  Each line starts with the speaker's name and a colon. That name picks the voice. Never read it.
- About 150 words per minute. Natural turn-taking, no overlap.
- Read only the lines under **Script**, exactly as written. Do not read headings or these
  directions.
- A line that says `(pause)` is about one and a half seconds of silence. Never say "pause".
- No music, sound effects, intro, or outro.
- Pronunciation: **Podverse** "POD-verse". Spell out **RSS**, **API**, and **OPML** letter by
  letter.
- If your service writes its own script from this one, keep every number and every claim
  exactly, keep both voices, and add nothing the text does not say.

## Script

CLAIRE: This is part five of Content Lifecycle. Part four covered feeds that Podcast Index retired in favor of another copy. This part covers the rest: feeds it retired with no replacement. And a quiet record, so a signed-in listener can find out why a show they followed went away. It's built, and it ships with the retire mode off.

TOM: So what happened to those feeds before this?

CLAIRE: Nothing. The hourly sync read the Podcast Index retired-feeds list, recorded the pairs that name a replacement, and skipped every other row. The feed stayed active and kept every episode. On-demand refresh, trending, and OPML import could all parse it again.

TOM: So we kept paying to store and parse shows the directory itself had given up on.

CLAIRE: Yes. And when a followed show disappeared for some other reason, a signed-in listener had nowhere lasting to see why. The phone's Error Log is a local sync log, and the web had nothing like it.

(pause)

TOM: What rules does the design hold to?

CLAIRE: Four. Podcast Index is the authority on which directory feeds are no longer valid. We retire those, and we keep what people made. We leave a short explanation a signed-in listener can find if they go looking. And we never notify anyone about it. No push, no email, no inbox row.

TOM: Which rows count?

CLAIRE: A feed we hold whose Podcast Index id is on the list, with no usable replacement. The replacement column is empty, or the replacement chain loops, or it ends on a feed that's retired too. Unless a merge for that feed is still in progress: detected, verified, waiting for review, or applied. Those wait.

TOM: And a feed whose replacement does resolve?

CLAIRE: That one belongs to the merge process from part four, so it waits too. It's retired only if its merge was rejected or reverted. Feeds already blocked from parsing are counted, but skipped.

TOM: Is there a grace period? Wait a week in case it comes back?

CLAIRE: No. The first run that lists a feed retires it. A week of waiting would only mean a week more of parsing a show the directory dropped.

(pause)

TOM: Retiring thousands of shows off one downloaded file sounds risky. What if Podcast Index publishes a bad list?

CLAIRE: That's the brake. Every run counts the feeds that qualify, including ones already retired, and compares that count with the one the sync stored last time. Growth is the difference.

TOM: And if it jumps?

CLAIRE: If growth is more than two thousand, or more than one percent of the feeds we hold, whichever is larger, an apply run retires nothing. It logs a warning and leaves the stored count alone. An operator looks at the list. If it's real, one dry run accepts the new count, then they switch back to apply. A count that goes down never trips the brake.

TOM: And with no stored count at all?

CLAIRE: Then apply retires nothing either. A dry run always stores the count, so the first apply on any environment needs a dry run before it. After that, every apply run the brake lets through stores its own count. Inside those limits, apply retires at most two hundred feeds per hourly run, lowest Podcast Index ids first.

TOM: Who turns this on?

CLAIRE: An operator. The retire mode is its own setting, separate from the merge mode, with three values: off, dry run, and apply. Off is the default. A dry run counts and logs, and changes no feed.

TOM: Does that change how the file is downloaded?

CLAIRE: Yes. With retiring off, the sync asks Podcast Index whether the file changed, and skips it when it hasn't. With retiring on, it downloads the whole file every run. The two-hundred cap means later hours keep working through the same list. And if the file comes back empty, nothing is retired.

(pause)

TOM: So what does retiring a feed actually do?

CLAIRE: It moves the feed to pending archive, with a reason that says Podcast Index retired it, recorded as a system change. From there, everything is the machinery of earlier parts. The archive job, twice a day, archives the show. Episodes nobody clipped or added to a playlist are deleted. The rest are archived and slimmed, as in part two. Members with Add by RSS move to a direct follow of the feed, as in part three.

TOM: Can the archive job handle a big batch?

CLAIRE: It's bounded. One run archives at most one thousand pending feeds, and the episode updates and deletes run as set-based queries in chunks of one thousand. A backlog drains across runs.

TOM: And the listeners who couldn't move to Add by RSS?

CLAIRE: Their follow ends. Once the move is settled, whether members moved, the feed never answered, or nobody had the membership, every remaining directory follow is deleted, in the same archive run. A takedown deletes them too. Their clips stay, with the snapshots from part three.

TOM: And the recent-feeds job?

CLAIRE: It skips every state that blocks parsing: pending archive, archived, merged, and taken down.

TOM: What if a feed shows up on the list, gets retired, and then leaves the list?

CLAIRE: On an apply run, if its show record is already gone, the feed record is deleted, up to two hundred per run. A dry run only logs how many it would delete. If Podcast Index ever lists that address again, Podverse adds it as new. There's no automatic revival. If the show record still exists, because clips still need its episodes, it stays archived.

(pause)

TOM: Now the record for listeners. Where does it live?

CLAIRE: In a table called the account content log. Every row has a log type. Right now there's one type, removed content.

TOM: What's in a row?

CLAIRE: One row per account per show. The show's title and id. A reason: left the directory, or taken down. A follow outcome: ended, moved to Add by RSS, or nothing. And how many of that person's clips and playlist entries were affected.

TOM: One row per show, even if several things happen to it?

CLAIRE: Yes. A second event updates the same row. Taken down replaces left the directory, never the other way around. Moved to Add by RSS is kept over ended. The counts keep the larger value.

TOM: Who gets a row?

CLAIRE: When a show leaves the directory, each directory follower, at the moment their follow is moved or ended. Clips on an archived show still play, so clip owners aren't logged for that. When a show is taken down, each follower, each clip owner, and each playlist owner, inside the takedown transaction.

TOM: And what isn't logged?

CLAIRE: Merges, because the show didn't go anywhere. Queue pruning. And episodes archived while their clips still play.

TOM: Could a big show write a flood of rows?

CLAIRE: There are guards. At most one hundred rows per account, with older rows trimmed on each write. At most five thousand rows for any one show in one write. Past that, follows still end, and the run logs a warning.

TOM: How long do rows last?

CLAIRE: Thirty days from the last update, set by the account content log retention days setting. A daily worker at four fifteen in the morning deletes older rows.

(pause)

TOM: What does the listener actually see?

CLAIRE: Any signed-in listener can see it. No membership needed. On the web, Settings has a tab called Advanced, with a Removed Content list. On the phone, it's More, then Advanced, then Removed Content, just below Error Log. Both read one endpoint, newest first, at most one hundred entries.

TOM: What does an entry say?

CLAIRE: Short sentences. The show's title, or "A show" when there isn't one, is no longer in the directory, or was taken down. Your follow was moved to Add by RSS, or your follow ended. Then a count when it's above zero, like three of your clips now show Content Removed. Entries are text, not links. With no entries, it says nothing in your library was removed in the last thirty days.

TOM: Does the phone still write its own Error Log line when a show drops?

CLAIRE: Not when you're signed in. The phone still unfollows, but it skips the line that says the show was removed, because Removed Content explains it. Signed-out listeners still get that line, because they can't open Removed Content. The line that says a show moved to Add by RSS stays for everyone.

(pause)

TOM: How does it roll out?

CLAIRE: The base setting is off. On alpha, an operator sets dry run first, reads the logged count, and then sets apply. The merge mode stays a separate step.

TOM: To remember. One: a feed Podcast Index retired with no usable replacement is retired here too, with no grace period. Two: a brake stops a sudden jump, and nothing retires until a dry run has stored a count. Three: retired shows run through the same archive, slimming, and follow move as before, and leftover follows end. Four: signed-in listeners get one Removed Content entry per show, for thirty days, and nobody is notified.

CLAIRE: Clips stay as the lasting record. The log only explains what happened.
