# Podcast Index duplicate feed merge — summary

Podcast Index merges duplicate feeds (WordPress `/feed` vs `/feed/podcast`, host moves, URL
spellings of the same show). Listeners may follow one or both copies. Podverse should follow
those merges so subscriptions, progress, clips, and downloads stay on one show, without a burst
of notifications or a second parse of the same episodes.

Order and agent rules: [00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md). Prompts:
[COPY-PASTA.md](./COPY-PASTA.md).

## What Podcast Index publishes

There is no app-facing guide for following a merge. The formal signal is a feed marked dead with
`duplicateOf` set to the surviving feed id.

| Source | What it gives | What it does not give |
| --- | --- | --- |
| `GET /podcasts/dead` | `id`, `title`, `url`, `duplicateOf` | A "since" cursor, or a redirect |
| Hourly CSV `https://public.podcastindex.org/podcastindex_dead_feeds.csv` | `id,duplicateOf` (~3.3M rows; ~83k have a duplicate target, as of 2026-10-17) | Episode-level mapping |
| `byfeedid` for a dead id | Empty feed, no pointer to the survivor | The redirect asked for in web-ui#282 (still open) |
| Episode responses | `feedDuplicateOf` on some payloads | A guarantee that episode GUIDs match |

Dave's note on [database#42](https://github.com/Podcastindex-org/database/issues/42): a number in
the second column means that feed was marked dead because it duplicated another feed URL.

`<podcast:guid>` is meant to follow a show across host moves. Podcast Index's own `podcastGuid`
column is not unique ([database#30](https://github.com/Podcastindex-org/database/issues/30)).
Treat a shared GUID as a strong hint, not a key.

PowerPress duplicates usually share episode GUIDs and enclosure URLs (one WordPress database,
two feed URLs). Host moves usually keep episode GUIDs and change enclosure URLs. Junk GUIDs
(`1`, the same value on every item) and "2.0" relaunches must not be matched on GUID alone.

Chains exist: about 9.4k duplicate targets are themselves dead, and a few hundred of those are
also duplicates. Resolve to the last live id. If that id is dead too, do not merge.

## What Podverse does today

`podcastIndexDeadFeedsFlagAndMerge` records Podcast Index duplicate pairs, then assesses them.
`PODCAST_INDEX_DUPLICATE_MERGE_MODE=off` returns before the download. `dry_run` writes `verified` or
`needs_review` and does not move account rows. `apply` re-points the feed we already have when
the survivor has no Podverse channel, and absorbs follows, queue progress, clips, and playlists
when both channels exist. An account that follows both keeps one follow. Moved rows are
journaled. The old feed's lifecycle becomes `merged`. Pairs below the match line stay
`needs_review`.

Base env stays `off`. A row with no `duplicateOf` is not archived.

Opening a merged show or a matched episode on the web follows the surviving show. The API
answers those ids with `410` and `merged_into`, and `POST /identity/resolve` lists ids that
moved. An episode with no match on the survivor still plays. On the phone, subscriptions,
downloads, and listening progress follow the surviving show, and the downloaded file stays
where it is. Operators review pairs that stayed `needs_review`. Approve marks a pair
verified so the next apply run can move it. Reject drops it from the queue. Revert undoes
an applied merge.

## Locked decisions

- **Podcast Index decides the pair.** A row counts only when `duplicateOf` is set. Podverse never
  invents a duplicate from title or GUID similarity. Our checks can refuse a pair or send it to
  review. They cannot create one.
- **Re-point before absorb.** If the surviving Podcast Index id has no Podverse channel, move the
  existing feed's URL and `podcast_index_id` onto that survivor. Channel and episode ids stay.
  Devices see no change. Absorb (move account rows from channel A onto channel B) only when both
  feeds already have Podverse channels. B is the channel whose feed is the Podcast Index survivor.
- **Ignore plain dead rows.** No `duplicateOf` means do nothing.
- **No listener-visible side effects.** A merge, and the reparse that follows a re-point, must not
  send new-episode notifications or auto-download pushes for episodes published before the merge.
  The first parse of any channel with no stored episodes gets the same skip (plan 05).
- **Old ids keep resolving.** Web uses `permanentRedirect`. The API returns `410` with
  `merged_into`, plus `POST /identity/resolve` for batch lookup. Mobile rewrites local keys in
  place and keeps downloaded files.
- **Every applied merge is journaled and reversible** from management web. Pairs below the
  confidence line wait for review. They are not applied.
- **Rollout.** Base env `PODCAST_INDEX_DUPLICATE_MERGE_MODE=off`. Alpha runs `dry_run`, then `apply`, after
  a review of the dry-run counts. `off` records nothing. `dry_run` writes `detected` /
  `verified` / `needs_review` and never `applied`. `apply` writes `applied` only for `verified`
  pairs (and for pairs an admin approved).

## Out of scope

- Detecting duplicates Podcast Index has not marked.
- Fuzzy-merging two channels a human merely thinks are the same show.
- Deleting the old channel row. It stays, lifecycle `merged`, so links and revert still work.
- Add-by-RSS feeds. They have no Podcast Index id.
- Asking Podcast Index to add a `since` parameter or a `byfeedid` redirect. Questions for Dave
  are below; the design does not wait on them.

## Questions for Dave (not blockers)

- Will the identity-layer / WordPress sweep show up as `duplicateOf` in the dead CSV and
  `podcasts/dead`?
- Can `podcasts/dead` or the CSV grow a `since` (or `Last-Modified` that changes per row, not
  only when the file is rewritten)?
- Can `byfeedid` return the survivor id for a dead duplicate (web-ui#282)?
- Does the identity layer expose one canonical feed id per podcast we could read directly?

## Confidence line (used by 03 and 08)

A pair is `verified` when either:

- at least 80% of the smaller episode set matches, and at least 3 episodes match, or
- at least one episode matches and the two feeds share a `<podcast:guid>`, an iTunes id, or one
  feed's `atom:link rel=self` points at the other.

Otherwise the pair is `needs_review`. Zero episode overlap with none of those shared identifiers
stays `needs_review` and must not be auto-applied. Re-point mode uses the same line, comparing
the survivor feed XML (fetched, not saved) to the episodes already stored.
