**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 81 — Training scripts drop deleted migration files

Four published scripts cite SQL files the squash deletes, or tell a listener to run a one-time
backfill or a numbered migration. Rewrite those spots so the episode describes the schema and
behavior a first deploy has. Keep runtime fallbacks the code still implements.

When a script changes, the publisher replaces the episode. This plan edits the scripts only. It
does not generate audio.

Follow `.cursor/skills/abcaicast/SKILL.md` § Versions and identity on every file you touch:

- Keep **Episode ID**.
- Set **Version** from `date '+%Y-%m-%dT%H:%M%z'`, with a colon in the offset
  (`2026-10-23T21:05-05:00`).
- Set **Changed** to the sentence given for that file. Each one says to regenerate the audio.
- Recount the words under `## Script` only and set **Length** to
  `about N minutes (W words)` at about 150 words per minute.

Do not change the voice directions, the RSS title, or the opening line that names the group.

## Rows

R15

## Runs after

none

## Files

- misc/aicasts/content-lifecycle-1-show-notes.md
- misc/aicasts/content-lifecycle-2-archived-slimming.md
- misc/aicasts/add-by-rss-1-same-episode-every-device.md
- misc/aicasts/livestreams-1-a-flag-not-a-kind-of-show.md

## Tests

none

## Release scratchpad

none

## Edits

### `misc/aicasts/content-lifecycle-1-show-notes.md`

Episode ID `content-lifecycle-show-notes`.

**Changed:** Sources no longer cite `0016_description_length_tiers.sql`, and the script no longer
tells operators to run the description backfill or to deploy a column-widening migration in a
quiet window. Regenerate the audio.

In **Sources**, delete these two lines:

```markdown
  `infra/k8s/base/ops/source/database/linear-migrations/app/0016_description_length_tiers.sql`,
  `apps/workers/src/commands/orm/descriptions/`,
```

`apps/workers/src/commands/orm/descriptions/` is only `ormDescriptionsBackfill`. The script will
no longer mention that job.

In **Script**, delete this exchange (keep the phone-cache exchange above it, and keep
"Anything left open on purpose?"):

```markdown
TOM: And existing data with the old cut?

CLAIRE: A backfill re-cleans stored descriptions and fills in previews. Any description exactly twenty-five hundred characters long, the signature of the old cut, is marked as cut. Then it schedules reparses for those feeds, up to two hundred per run, one minute apart. It's a suspended job an operator runs by hand after deploy.

TOM: Anything for operators to watch?

CLAIRE: The migration widens the description columns, which may rewrite those tables. Deploy it in a quiet window.
```

Keep the earlier exchange that starts "What about rows a phone saved before that change?" The
app still builds a preview from stored text that has full notes and no preview.

Keep the opening that explains why ingest cleans HTML, including the twenty-five-hundred-character
cut. That is why the current grammar exists. It is not an operator step.

### `misc/aicasts/content-lifecycle-2-archived-slimming.md`

Episode ID `content-lifecycle-archived-slimming`.

**Changed:** Sources no longer cite `0017_archived_slimming.sql`. The spoken script is
unchanged; the audio is unchanged.

The script has no migration dialogue. In **Sources**, delete:

```markdown
  `infra/k8s/base/ops/source/database/linear-migrations/app/0017_archived_slimming.sql`,
```

`archivedSlimming.ts` and `archiver.ts` stay in Sources. Do not rewrite the script.

### `misc/aicasts/add-by-rss-1-same-episode-every-device.md`

Episode ID `add-by-rss-same-episode-every-device`.

**Changed:** Sources no longer cite `0020_add_by_rss_feed_identity.sql`, and the script no longer
says migration twenty rehashed stored rows or moved the readiness marker. Regenerate the audio.

In **Sources**, delete:

```markdown
  `infra/k8s/base/ops/source/database/linear-migrations/app/0020_add_by_rss_feed_identity.sql`,
```

`packages/helpers/src/lib/addByRSSHash.ts` stays.

Replace this exchange:

```markdown
TOM: What about rows stored before this?

CLAIRE: A payload without a feed URL keeps the old form, and the website matches both forms for its own feeds. Migration twenty rehashes every stored queue and playlist row that does carry a feed URL. It adds a SQL function that reproduces the JavaScript hash byte for byte, and a database test proves they match.

TOM: Rehashing could make two rows the same.

CLAIRE: So it removes duplicates first. In a queue, it keeps the row closest to now playing, then the one with the furthest playback position, then the newest. In a playlist, it keeps the entry nearest the top and lowers the playlist's item count. The API also recomputes the id from the resource data on every write, so the value a client sends is only advisory. An older website build talking to a newer API still works.
```

with:

```markdown
TOM: What if a stored payload has no feed URL?

CLAIRE: It keeps the older hash form, and the website matches both forms for its own feeds. The database has SQL functions that reproduce the JavaScript hash byte for byte, and an API test proves they match. The API recomputes the id from the resource data on every write, so the value a client sends is only advisory.
```

The functions (`add_by_rss_hash_id_from_feed` and `add_by_rss_hash_id_from_resource_data`) stay
in the squashed schema. `apps/api/src/test/add-by-rss-feed-identity.integration.test.ts` calls
them. The one-time `DELETE` / `UPDATE` of stored queue and playlist rows does not stay.

Delete this exchange:

```markdown
TOM: Rollout?

CLAIRE: Migration twenty runs with the API, and the readiness markers move to it. Ship the website and the API together. The phone records Add by RSS playback only after the next store build.
```

In the "To remember" line, replace item two:

```markdown
Two: the server recomputes that id, and migration twenty rehashed stored rows and dropped duplicates.
```

with:

```markdown
Two: the server recomputes that id from the resource data on every write.
```

### `misc/aicasts/livestreams-1-a-flag-not-a-kind-of-show.md`

Episode ID `livestreams-a-flag-not-a-kind-of-show`.

**Changed:** Sources no longer cite `0021_channel_may_have_live_items.sql`, and the script no
longer says migration twenty-one backfills channels or that phone migration twenty-four seeds
stored feeds. Regenerate the audio.

In **Sources**, delete:

```markdown
  `infra/k8s/base/ops/source/database/linear-migrations/app/0021_channel_may_have_live_items.sql`,
```

`packages/parser/src/lib/rss/liveItem/channelLiveItemFlag.ts` stays.

Replace this exchange:

```markdown
CLAIRE: Migration twenty-one adds a column to the channel table, may have live items. It defaults to false. The parser sets it to true the first time a parse sees a live item in the feed, of any status. It writes only when the flag is still false, and nothing ever clears it.

TOM: What about channels that already had live items before the migration?

CLAIRE: The migration backfills them. Any channel with a live item row today gets the flag. And when the parser sets it, it writes the channel's own medium back unchanged. So setting the flag can never change what kind of show it is.
```

with:

```markdown
CLAIRE: The channel table has a column, may have live items. It defaults to false. The parser sets it to true the first time a parse sees a live item in the feed, of any status. It writes only when the flag is still false, and nothing ever clears it. When the parser sets it, it writes the channel's own medium back unchanged, so setting the flag can never change what kind of show it is.
```

Replace this exchange:

```markdown
TOM: Phones already have feeds stored. Do they wait for the next refresh?

CLAIRE: No. Mobile database migration twenty-four adds the column and seeds it from the parsed feeds already on the phone, with no network request. The website stores whole records, so it needs no migration. When it reads a record saved before the flag existed, it also counts the feed if its stored parse has live items.
```

with:

```markdown
TOM: What about a stored feed that has no flag yet?

CLAIRE: The website stores whole records. When it reads a record with no flag, it counts the feed if its stored parse has live items. The phone's column is part of its database from the first install.
```

Keep the following "Does that flag sync to the server?" exchange.

Delete this exchange:

```markdown
TOM: Rollout?

CLAIRE: Migration twenty-one runs with the API, and the API's readiness marker moves to it. Phones run migration twenty-four on their first launch after the store build. There are no settings to turn on.
```

Keep the "To remember" lines. They do not name a migration.

## Leave unchanged

The other files under `misc/aicasts/` do not cite a numbered migration file. Do not edit them.
Do not edit `misc/aicasts/MISC-AICASTS.md`.
