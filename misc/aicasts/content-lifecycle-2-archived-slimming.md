# Keeping Only What Archived Content Still Needs

- **Covers:** How archived episodes and shows kept for clips and playlists shrink to what
  those surfaces show, and grow back when content returns.
- **Status:** Planned
- **Series:** Content lifecycle, part 2 of 3
- **Sources:** `.llm/plans/active/archived-content-slimming/`
- **Length:** about 6 minutes (925 words)

## Directions for the voice service (do not read aloud)

- Two voices. **Claire** is a woman: warm, clear, measured. **Tom** is a man: relaxed, curious.
  Each line starts with the speaker's name and a colon. That name picks the voice. Never read it.
- About 150 words per minute. Natural turn-taking, no overlap.
- Read only the lines under **Script**, exactly as written. Do not read headings or these
  directions.
- A line that says `(pause)` is about one and a half seconds of silence. Never say "pause".
- No music, sound effects, intro, or outro.
- Pronunciation: **Podverse** "POD-verse", **Postgres** "POST-gress". Spell out **RSS** letter
  by letter.
- If your service writes its own script from this one, keep every number and every claim
  exactly, keep both voices, and add nothing the text does not say.

## Script

CLAIRE: This is part two of three on how Podverse handles feed content over its life. Part one was show notes. This part is archived content, and keeping only what's still used. It's planned, not built yet.

TOM: Start with what archived means here.

CLAIRE: When an episode disappears from its feed, or a whole show is archived, the archiver steps in. If nobody has clipped the episode or added it to a playlist, it's deleted. That part is right.

TOM: And if someone has?

CLAIRE: Then the archiver keeps the episode, and keeps all of it. Full show notes, which after part one can be up to thirty thousand stored characters. Transcript and chapter records. People, value splits, funding, soundbites, location, license, chat, and season data. And an archived show keeps its whole show record and every related table, forever.

TOM: How much of that does anyone read?

CLAIRE: Almost none. A clip row shows the episode title, date, artwork, and show name, and plays the audio. The clip page adds the episode summary. That's it.

(pause)

TOM: So the goal is to drop the rest.

CLAIRE: Keep exactly what clips, playlists, and their pages show, and delete the rest. All of it came from RSS, so nothing is lost for good. If the episode comes back to its feed, or an admin restores the feed, the next parse rebuilds it.

TOM: Does this delete episodes or shows?

CLAIRE: No. It slims. It never deletes an episode, show, or feed record. Deletion is part three.

TOM: What does a kept episode hold on to?

CLAIRE: The episode record, for its title, dates, and links. Its duration and episode link. The audio file entry, with its alternate sources and integrity data, because clips and playlist entries have to play. The episode image, for artwork. The livestream record, because livestream screens need it. Any soundbite a playlist points to. And a reduced description.

TOM: And everything else goes. Transcripts, chapters, people, value, funding.

CLAIRE: Plus social interact, location, license, chat, content links, text records, seasons, and soundbites nobody references.

TOM: What's a reduced description?

CLAIRE: The four-hundred-character preview from part one, wrapped in a paragraph and marked as cut. So an archived episode's Summary shows that preview, then Read Full Show Notes, linking to the episode's page on the publisher's site. Chapters, transcripts, people, and funding just don't show, because they're empty.

TOM: Shows get the same treatment?

CLAIRE: An archived show keeps its show record, its feed record, its about details, its image, and a reduced description in the same form. Every other related table is emptied. Spam shows aren't slimmed at the show level, because their feed is still active. Taken-down shows are already stripped.

(pause)

TOM: How does it avoid redoing work?

CLAIRE: Each episode and each show gets one new timestamp: when it was slimmed. A small partial index finds archived episodes not yet slimmed, so a pass never rescans finished work.

TOM: When does it run?

CLAIRE: Inside the existing archive job, twice a day, at six in the morning and six in the evening. It runs after the step that deletes unreferenced archived episodes, so nothing is slimmed moments before it's deleted anyway. Batches of five hundred episodes per transaction, up to twenty thousand episodes and two hundred shows per run. A big backlog drains over a few runs, without long locks.

TOM: Say the episode comes back to its feed. What undoes the slimming?

CLAIRE: Nothing new. When the parser sees the episode in its feed again, it already sets it back to active. That same write now clears the slimmed timestamp. The parser's update logic already recreates missing related rows, so transcripts, chapters, and people come back on their own.

TOM: And a show?

CLAIRE: A show only parses again after an admin restores it. The archiver already clears the feed's parse fingerprint, so that first parse is never skipped as unchanged.

TOM: So reversal comes from code that already exists.

CLAIRE: That's the design.

(pause)

TOM: How do we know it's worth doing?

CLAIRE: A read-only report command prints how many archived episodes and shows exist, how many are slimmed, and roughly how many bytes the removable rows hold. Run it before and after.

TOM: Does the database file shrink?

CLAIRE: Not by itself. Postgres reuses freed space after routine vacuuming, but files on disk only shrink with a full vacuum or a repack. That's an operator choice, not part of this work.

TOM: Anything found along the way?

CLAIRE: A latent bug. A show's trailers can point at a season, and that link has no delete rule. The existing takedown cleanup deletes seasons before trailers, so a takedown fails for any show whose trailers are tied to a season. This work builds one shared cleanup list that removes trailers first, and both takedown and slimming use it.

(pause)

TOM: What changes for listeners?

CLAIRE: Very little, which is the point. Clip and playlist rows look the same. An archived episode's page shows a short summary and a link to the full notes. If an episode returns, everything returns with the next parse.

TOM: And the cost?

CLAIRE: One eight-byte timestamp per archived row. The saving is most of what an archived episode held: from up to about thirty kilobytes of notes down to about four hundred characters, plus metadata nobody read.

(pause)

TOM: To remember. One: an archived episode keeps only what clips, playlists, and their pages show. Two: slimming never deletes an episode, show, or feed. Three: it runs in bounded batches inside the archive job and never rescans. Four: if content returns to its feed, the parser restores it with no new code.

CLAIRE: Next part: what happens when content is removed outright, and how clips and follows survive it.
