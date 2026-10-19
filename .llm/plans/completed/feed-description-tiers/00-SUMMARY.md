# Feed description tiers — summary

Long show notes (Podcasting 2.0 episodes are the common case) are HTML and run past 2,500
characters. The parser cuts the raw string at 2,500 in `compatItemDescriptionDto` and
`compatChannelDescriptionDto` (`DATABASE_CONSTANTS.varchar_long`). The cut lands inside a tag,
`readDescriptionDocument` rejects the unbalanced markup, and Summary renders one plain run-on
paragraph with no bullets, headings, or links. The columns already allow 10,000
(`varchar_longer`). The 2,500 limit exists only in the parser.

A second cause hides short notes too. Partytime collapses line breaks in `<description>`, and
Podverse reads `<description>` before `content:encoded`. Plain-text notes lose their paragraphs.

Goal: notes keep their structure at any length. Length stays bounded so a feed cannot fill the
database. An admin raises one feed's bound by picking a preset. The app does no heavy parsing,
because the server stores clean markup that is ready to render.

Order and agent rules: [00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md). Prompts:
[COPY-PASTA.md](./COPY-PASTA.md).

## What specs and other apps do

| Source | Convention |
| --- | --- |
| Apple Podcasts RSS spec | `content:encoded` is the episode-notes field: paragraphs, lists, bold, italics, links. `itunes:summary` and `<description>` are plain text; Apple strips HTML and truncates them itself. |
| Apple Podcasts Connect | An episode description may be up to 10,000 characters. 4,000 is the long-standing show-level description limit. |
| PSP-1 | `<description>` up to 4,000 bytes, a few HTML tags inside CDATA. |
| Pocket Casts | Lists do not carry show notes. Notes load separately and are cached on device. Downloads save audio only, and listeners report missing notes offline. |

The common shape is to sanitize to a small allowlist at ingest, put a short plain preview in
lists, and serve the full notes on detail. Podverse also keeps notes with downloads.

## Locked decisions

1. **Sanitize at ingest with one grammar.** Stored HTML is built from the same allowlist and
   tokenizer `readDescriptionDocument` uses, then serialized canonically. Every stored row
   therefore renders rich. Renderers stay strict and unchanged. No new HTML dependency.
2. **Truncate the tree, not the string.** Count visible characters. Cut after the last block
   (paragraph, list item, heading) that fits. When the first block alone is too long, cut inside
   it at a word boundary and add an ellipsis. Close tags come from serialization, so output is
   always balanced. A second guard stops at the stored-length cap so markup cannot bloat a row.
3. **Source order.** Items: `content:encoded` when it has visible text, then the raw
   `<description>` (Partytime `descriptionRaw`), then `<description>`, then `itunes:summary`.
   Channels: `descriptionRaw`, then `<description>`. Plain text becomes paragraphs at blank lines
   and `<br>` at single line breaks.
4. **Tiers are presets, per feed.** Revised from the first proposal (4,000 / 10,000 / 25,000).
   Apple accepts 10,000 characters for an episode, so a 4,000 default would cut notes Apple
   publishes.

   | Tier key | Visible characters | Stored HTML cap |
   | --- | --- | --- |
   | `standard` (default) | 10,000 | 30,000 |
   | `extended` | 25,000 | 75,000 |
   | `maximum` (ceiling) | 50,000 | 150,000 |

   The stored cap is three times the visible limit, which leaves room for link-heavy notes. A
   database `CHECK (char_length(value) <= 150000)` is the backstop. The table lives in one
   helpers constant, so changing a value is a one-line edit.
5. **One tier covers the feed.** `feed.description_length_tier_override` applies to the channel
   description and every item description. Null means the default tier.
6. **A tier change forces a reparse.** Management clears `last_parsed_file_hash` and upserts a
   `feed-force-reparse` row in `scheduled_job` (dedupe key per feed). The existing
   `scheduledJobsRunDue` cron (every 5 minutes) runs it. No new queue; management-api gets no
   MQ access.
7. **The parser reports truncation.** Each description row gets `is_truncated` and
   `source_length` (visible characters in the source). Each feed gets
   `description_truncated_count`, `description_longest_source_length`, and
   `description_truncated_at`. Management lists truncated feeds and suggests the smallest tier
   that fits, so an admin can act before anyone reports a problem.
8. **Truncation is visible.** When `is_truncated`, the UI shows **Read Full Show Notes** linking
   to the item `<link>` (`item_about.website_link_url`). Channel About shows **Read Full
   Description** to `channel_about.website_link_url`. With no link, one sentence says the notes
   were shortened. The link is UI chrome, not stored HTML, so it is localized and never counted.
9. **Lists get a preview; detail gets the notes.** `preview` (plain text, at most 400 characters)
   is built at ingest. Rows read `preview`. Detail and the new
   `GET /item/:idOrIdText/description` return the full HTML. On mobile, the full player loads
   notes lazily from an on-device cache. The cache warms when an item becomes the active
   playback target and is pinned while the item is downloaded.
10. **Lists omit full notes in this release.** List responses stop carrying `value` (plan 09)
    in the same alpha deploy as the preview reads. No installed alpha client depends on list
    payloads still including `value`. A phone that already cached an older list row still has
    `value` and no `preview`; `getDescriptionPreviewText` computes the preview from that stored
    text (**dto-changes-are-device-data-migrations**). A fresh install only sees the new shape.
    A later break on an older binary is a new plan.
11. **Existing rows are repaired.** A backfill re-sanitizes stored values and fills `preview`.
    Rows exactly 2,500 characters long (the old raw cut) are marked truncated with
    `source_length` null. Throttled reparses for those feeds then recover the full notes.

## Storage

- Most descriptions are far below 10,000 characters, so the cap only governs outliers.
- Descriptions live in 1:1 side tables (`item_description`, `channel_description`). Item rows
  stay narrow. Postgres TOAST compresses values over about 2 KB and stores them out of line.
- Selecting only `preview` does not read the out-of-line `value`. After 09, `value` is
  `select: false`, so loading it is always an explicit choice.
- The larger saving is payload. Lists, and the phone's `channel_item` cache, stop carrying full
  notes.
- Worst case per feed is items × stored cap. The spam item limit already bounds item count.

## Out of scope

- Reader mode and full-article storage (see below).
- Images, tables, and blockquotes. They stay outside the allowlist and are unwrapped to text.
  Widening the allowlist is a renderer change on web and mobile together.
- Free-form numeric limits per feed. Presets only.
- Making `readDescriptionDocument` lenient. A stored row that fails it is a server bug to fix.
- Transcripts.
- Archived episodes and shows. Slimming them is the next set,
  `archived-content-slimming`, which reuses `preview` from here.
- Removed content. Clip and playlist snapshots, follow conversion, and deleting empty archived
  shows are the third set, `removed-content-references`.

## Plan set order

1. `feed-description-tiers` (this set)
2. `archived-content-slimming` (needs 01 and 03 from this set)
3. `removed-content-references` (after the second set; both edit `archiver.ts`)

## Future seam: reader mode

Postgres keeps only the capped summary, which never exceeds the `maximum` tier. Full article
bodies, if Podverse adds a reader view, go to object storage
(`packages/external-services-object-storage`), keyed by item id and content hash. A worker fetches
and extracts them from the item link on demand, not on every parse, and they expire. The
description endpoint from 06 is the seam: it can later return an `article_url`, and **Read Full
Show Notes** becomes **Open in Reader** when that URL is present. Nothing in this set has to
change for that.
