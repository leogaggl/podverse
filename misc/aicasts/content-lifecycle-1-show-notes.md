# Content Lifecycle 1: Show Notes That Keep Their Shape

- **Version:** 2026-10-19T00:13-05:00
- **Episode ID:** content-lifecycle-show-notes
- **Changed:** List responses now carry only the preview, so the rollout section and the
  opening changed. Previous title: "Show Notes That Keep Their Shape". Regenerate the audio.
- **Description:** How Podverse cleans show notes when a feed is parsed, sets a length limit
  per feed, tells listeners when notes were cut, and keeps full notes on the phone for the
  player and for offline listening.
- **Status:** Built
- **Group:** Content Lifecycle, part 1
- **Sources:** `.llm/plans/completed/feed-description-tiers/`;
  `packages/helpers/src/lib/descriptionIngest.ts`,
  `packages/helpers/src/lib/descriptionLimits.ts`, `packages/helpers/src/lib/descriptionPreview.ts`,
  `infra/k8s/base/ops/source/database/linear-migrations/app/0016_description_length_tiers.sql`,
  `apps/workers/src/commands/orm/descriptions/`,
  `apps/management-web/src/app/(management)/feeds/flag-status/`,
  `apps/api/src/controllers/item.ts`,
  `apps/web/src/components/Content/Description/DescriptionTruncationNotice.tsx`,
  `apps/mobile/src/lib/content/`, `apps/mobile/src/hooks/useItemDescription.ts`,
  `apps/mobile/src/data/repositories/itemDescriptionCacheRepository.ts`
- **Length:** about 9 minutes (1,304 words)

## Directions for the voice service (do not read aloud)

- Two voices. **Claire** is a woman: warm, clear, measured. **Tom** is a man: relaxed, curious.
  Each line starts with the speaker's name and a colon. That name picks the voice. Never read it.
- About 150 words per minute. Natural turn-taking, no overlap.
- Read only the lines under **Script**, exactly as written. Do not read headings or these
  directions.
- A line that says `(pause)` is about one and a half seconds of silence. Never say "pause".
- No music, sound effects, intro, or outro.
- Pronunciation: **Podverse** "POD-verse", **Postgres** "POST-gress", **iTunes** "eye-tunes",
  **SQLite** "S-Q-lite". Spell out **RSS**, **HTML**, and **API** letter by letter.
- If your service writes its own script from this one, keep every number and every claim
  exactly, keep both voices, and add nothing the text does not say.

## Script

CLAIRE: This is part one of Content Lifecycle, on how Podverse handles feed content over its life: when it arrives, when it goes quiet, and when it's removed. This part is show notes, and all of it is built.

TOM: Show notes meaning the long description under an episode.

CLAIRE: Right. Podcasters write them in HTML. Paragraphs, bullet lists, headings, links. Podcasting two point oh shows tend to write long ones, with chapter lists, guest links, and value-for-value credits.

TOM: And they used to break.

CLAIRE: The parser cut every description at twenty-five hundred characters. It cut the raw text, so the cut usually landed in the middle of a tag. The app saw markup that never closed, refused to trust it, and showed one long paragraph of plain text. No bullets, no headings, no links.

TOM: Was twenty-five hundred a database limit?

CLAIRE: No. The column held ten thousand. The limit lived only in the parser. There was also a quieter cause. Some feeds put plain-text notes in the description tag, with line breaks between paragraphs. Our feed library collapsed those line breaks, and we read that tag before the richer one, called content encoded. So even short notes could lose their paragraphs.

(pause)

TOM: So what happens at ingest now?

CLAIRE: The parser builds a tree from the HTML, using the same small set of allowed tags the apps already render. It's forgiving about sloppy markup coming in. Then it writes the tree back out in one clean, consistent form.

TOM: Why not just make the apps more forgiving?

CLAIRE: Because then every app has to handle every kind of broken markup, forever. With one grammar shared by the server and the apps, every stored description renders rich, and the apps stay strict.

TOM: And when notes are too long?

CLAIRE: The cut happens on the tree, not the text. We count the characters a listener sees, not the tags. The cut lands after the last whole paragraph, list item, or heading that fits. If the first paragraph alone is too long, we cut inside it at a word boundary and add an ellipsis. Closing tags come from the writer, so the result is always balanced.

TOM: So: cut at a block, count what people see, and the markup always closes.

CLAIRE: Yes. The parser also picks a better source. For episodes it prefers content encoded when it has real text, then the raw description with its line breaks intact, then the regular description, then the iTunes summary. Plain text becomes real paragraphs.

(pause)

TOM: There still has to be a limit, though. Otherwise one feed fills the database.

CLAIRE: There is, as three preset tiers per feed. Standard is the default: ten thousand visible characters, which is what Apple's podcast directory accepts for an episode description. Extended is twenty-five thousand. Maximum is fifty thousand, and that's the ceiling.

TOM: Visible characters. What about the markup?

CLAIRE: Each tier caps the stored size at three times the visible limit, so link-heavy notes still fit. And the database refuses any description over one hundred fifty thousand characters, as a backstop.

TOM: Who picks the tier?

CLAIRE: An admin, in the management app, by choosing a preset. No free-form numbers. Choosing a different tier schedules a forced reparse through the existing scheduled-job runner, which wakes every five minutes. So the full notes come back within minutes.

TOM: How does an admin know a feed needs it?

CLAIRE: The parser records, for each description, whether it was cut and how long the source was. For each feed, how many descriptions were cut and the longest source it saw. The feed flag status page can filter to feeds with cut notes, and it suggests the smallest tier that would fit. Nobody has to wait for a complaint.

(pause)

TOM: What does a listener see when notes are cut?

CLAIRE: On the web, an episode's Summary ends with a link, Read Full Show Notes, to the episode's own page from the feed. A show's About ends with Read Full Description, pointing to the show's website. With no link, one sentence says the notes were shortened. That notice is part of the app, not the stored HTML, so it's translated and never counts against the limit.

TOM: Same on the phone?

CLAIRE: Almost. Summary shows the same Read Full Show Notes link, but only once the full prose is on screen. A collapsed preview never shows it. On episode and track pages that preview is seven hundred twenty characters. A show's About on the phone shows just the sentence, because the website link already sits right below it in About.

(pause)

TOM: Longer notes sound heavier. How does the app stay fast?

CLAIRE: At ingest the parser also builds a plain-text preview, at most four hundred characters. List rows on web and mobile read that preview. Only detail screens need the full notes, and a new API endpoint returns one episode's description on its own. It's public, so it needs no sign-in.

TOM: And the phone's full player? It used to read notes from whatever list the episode came from.

CLAIRE: Now it reads through a small cache on the phone, in its own SQLite table. A Summary first shows what it already has, the full notes or the preview. Then it checks the payload, then the cache, then the endpoint when the phone is online. If none of those answer, the preview stays. A failure is logged, never shown.

TOM: What fills the cache?

CLAIRE: Three things. Opening an episode, track, or clip page stores the notes it fetched. When an episode starts playing, its notes load in the background. And when a download finishes, its notes are pinned. Pinned rows stay until the download is deleted. Other rows are trimmed to the newest two hundred.

TOM: So a downloaded episode has its show notes in airplane mode.

CLAIRE: Exactly. Add by RSS episodes are the one exception. They have no server copy, so their notes come only from the feed the phone parsed.

(pause)

TOM: So list responses don't carry the full notes anymore?

CLAIRE: Right. A list row carries the preview and no full description. The episode detail response and the description endpoint still return the full notes. The database doesn't even load the full text for a list, unless a query asks for it by name.

TOM: What about rows a phone saved before that change?

CLAIRE: Those still have full notes and no preview, so the app computes a preview from the stored text. Every new field is optional, so an old row never breaks a screen.

TOM: And existing data with the old cut?

CLAIRE: A backfill re-cleans stored descriptions and fills in previews. Any description exactly twenty-five hundred characters long, the signature of the old cut, is marked as cut. Then it schedules reparses for those feeds, up to two hundred per run, one minute apart. It's a suspended job an operator runs by hand after deploy.

TOM: Anything for operators to watch?

CLAIRE: The migration widens the description columns, which may rewrite those tables. Deploy it in a quiet window.

TOM: Anything left open on purpose?

CLAIRE: Reader mode. If Podverse ever stores full articles, they go to object storage, fetched on demand and allowed to expire, never the main database. The description endpoint is the seam. It could later return an article link, and Read Full Show Notes would become Open in Reader.

(pause)

TOM: To remember. One: the server cleans notes at ingest with the same grammar the apps render, and cuts on whole blocks, so markup always closes. Two: each feed has one of three preset tiers, ten, twenty-five, or fifty thousand visible characters, with a database backstop. Three: when notes are cut, the listener gets a link to the full notes, or a sentence when there's no link. Four: lists read a four-hundred-character preview, and the phone keeps full notes in a cache that stays pinned for downloads.

CLAIRE: Next part: what happens to an episode after it leaves its feed, when someone still has a clip of it.
