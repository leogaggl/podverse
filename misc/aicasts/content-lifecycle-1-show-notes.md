# Show Notes That Keep Their Shape

- **Covers:** How show notes are cleaned at ingest, bounded by per-feed tiers, flagged when
  cut, and served as previews in lists.
- **Status:** Planned
- **Series:** Content lifecycle, part 1 of 3
- **Sources:** `.llm/plans/active/feed-description-tiers/`
- **Length:** about 7 minutes (1,090 words)

## Directions for the voice service (do not read aloud)

- Two voices. **Claire** is a woman: warm, clear, measured. **Tom** is a man: relaxed, curious.
  Each line starts with the speaker's name and a colon. That name picks the voice. Never read it.
- About 150 words per minute. Natural turn-taking, no overlap.
- Read only the lines under **Script**, exactly as written. Do not read headings or these
  directions.
- A line that says `(pause)` is about one and a half seconds of silence. Never say "pause".
- No music, sound effects, intro, or outro.
- Pronunciation: **Podverse** "POD-verse", **Postgres** "POST-gress", **iTunes** "eye-tunes".
  Spell out **RSS**, **HTML**, and **API** letter by letter.
- If your service writes its own script from this one, keep every number and every claim
  exactly, keep both voices, and add nothing the text does not say.

## Script

CLAIRE: This is part one of three on how Podverse handles feed content over its life: when it arrives, when it goes quiet, and when it's removed. This part is show notes. It's planned, not built yet.

TOM: Show notes meaning the long description under an episode.

CLAIRE: Right. Podcasters write them in HTML. Paragraphs, bullet lists, headings, links. Podcasting two point oh shows tend to write long ones, with chapter lists, guest links, and value-for-value credits.

TOM: And today they break.

CLAIRE: Today the parser cuts every description at twenty-five hundred characters. It cuts the raw text, so the cut usually lands in the middle of a tag. The app sees markup that never closes, refuses to trust it, and shows one long paragraph of plain text. No bullets, no headings, no links.

TOM: Is twenty-five hundred a database limit?

CLAIRE: No. The column already holds ten thousand. The limit lived only in the parser. There's also a quieter cause. Some feeds put plain-text notes in the description tag, with line breaks between paragraphs. Our feed library collapses those line breaks, and we read that tag before the richer one, called content encoded. So even short notes can lose their paragraphs.

(pause)

TOM: So what changes at ingest?

CLAIRE: The parser builds a tree from the HTML, using the same small set of allowed tags the apps already render. It's forgiving about sloppy markup coming in. Then it writes the tree back out in one clean, consistent form.

TOM: Why not just make the apps more forgiving?

CLAIRE: Because then every app has to handle every kind of broken markup, forever. With one grammar shared by the server and the apps, every stored description renders rich, and the apps stay strict. The server gets cleaner instead.

TOM: And when notes are too long?

CLAIRE: The cut happens on the tree, not the text. We count the characters a listener sees, not the tags. The cut lands after the last whole paragraph, list item, or heading that fits. If the first paragraph alone is too long, we cut inside it at a word boundary and add an ellipsis. Closing tags come from the writer, so the result is always balanced. A second guard limits the stored size, so a feed full of links can't bloat a row.

TOM: So: cut at a block, count what people see, and the markup always closes.

CLAIRE: Yes. The parser also picks a better source. For episodes it prefers content encoded when it has real text, then the raw description with its line breaks intact, then the regular description, then the iTunes summary. Plain text becomes real paragraphs.

(pause)

TOM: There still has to be a limit, though. Otherwise one feed fills the database.

CLAIRE: There is, as three preset tiers per feed. Standard is the default: ten thousand visible characters, which is what Apple's podcast directory accepts for an episode description. Extended is twenty-five thousand. Maximum is fifty thousand, and that's the ceiling.

TOM: Visible characters. What about the markup?

CLAIRE: Each tier caps the stored size at three times the visible limit, so link-heavy notes still fit. And the database refuses any description over one hundred fifty thousand characters, as a backstop.

TOM: Who picks the tier?

CLAIRE: An admin, in the management app, by choosing a preset. No free-form numbers. Choosing a tier schedules a forced reparse through the existing scheduled-job runner, so the full notes come back within minutes.

TOM: How does an admin know a feed needs it?

CLAIRE: The parser records, for each description, whether it was cut and how long the source was. For each feed, how many descriptions were cut and the longest source it saw. Management lists the feeds with cut notes and suggests the smallest tier that would fit. Nobody has to wait for a complaint.

(pause)

TOM: What does a listener see when notes are cut?

CLAIRE: The episode's Summary shows a link, Read Full Show Notes, to the episode's own web page from the feed. A show's About section shows Read Full Description. With no link, one sentence says the notes were shortened. That link is part of the app, not the stored HTML, so it's translated and never counts against the limit.

(pause)

TOM: Longer notes sound heavier. How does the app stay fast?

CLAIRE: At ingest the parser also builds a plain-text preview, at most four hundred characters. Lists, like episode rows and the home screen, read the preview. Only detail screens load the full notes, and a new API endpoint returns one episode's description on its own.

TOM: And on the phone?

CLAIRE: The full player loads notes lazily from a cache on the phone. The cache fills when an episode becomes the one you're about to play, and it's pinned while the episode is downloaded. So show notes are there offline with the audio.

TOM: Storage?

CLAIRE: Descriptions live in their own tables, one row per episode, so episode rows stay narrow. Postgres compresses long values and stores them out of line, so reading only the preview never touches the full text. The bigger win is payload. Lists, and the phone's episode cache, stop carrying full show notes.

(pause)

TOM: Phones already in people's pockets expect the full description in lists. How does that roll out?

CLAIRE: Widen first, then narrow. New fields and new reads ship first. Only once every tester's build reads previews do list responses stop including full descriptions. Old cached rows on a phone have no preview, so the app computes one from the stored text.

TOM: And existing data with the old cut?

CLAIRE: A backfill re-cleans stored descriptions and fills in previews. Any description exactly twenty-five hundred characters long, the signature of the old cut, is marked as cut, and those feeds are reparsed slowly to recover the full notes.

TOM: Anything left open on purpose?

CLAIRE: Reader mode. If Podverse ever stores full articles, they go to object storage, fetched on demand and allowed to expire, never the main database. The new description endpoint is the seam. It could later return an article link, and Read Full Show Notes would become Open in Reader. Nothing here has to change for that.

(pause)

TOM: To remember. One: the server cleans notes at ingest with the same grammar the apps render, and cuts on whole blocks, so markup always closes. Two: each feed has one of three preset tiers, ten, twenty-five, or fifty thousand visible characters, with a database backstop. Three: when notes are cut, the listener gets a link to the full notes. Four: lists read a four-hundred-character preview, and only detail loads the full notes.

CLAIRE: Next part: what happens to an episode after it leaves its feed, when someone still has a clip of it.
