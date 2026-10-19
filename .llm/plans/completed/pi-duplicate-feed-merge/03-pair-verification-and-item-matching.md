# 03 — Pair verification and episode matching

**Cursor model:** Codex 5.3 · **Reasoning:** high

## Summary

Pure functions that decide whether a Podcast Index pair is safe to apply, and which episode on
the old side is the same episode on the survivor. Matching is one-to-one. A weak pair is marked
for review instead of applied. This prompt does not write merge SQL or download the CSV.

Decisions and the confidence line: [00-SUMMARY.md](./00-SUMMARY.md).

## Where the code lives

New module `packages/orm/src/lib/duplicateFeedMatch.ts` plus
`duplicateFeedMatch.test.ts`. ORM-only is correct: mobile does not match episodes itself. It
asks `POST /identity/resolve` (plan 06).

Keep [packages/orm/src/services/deduplicator.helpers.ts](packages/orm/src/services/deduplicator.helpers.ts)
as a delegate to the new GUID and enclosure tiers so the current merge still compiles. Plan 04
deletes that delegate when it replaces `DeduplicatorService`. Do not edit `deduplicator.ts` here.

Inputs are plain objects, not entities, so the tests do not need a database:

```typescript
type MatchItem = {
  id: number;
  guid: string | null;
  enclosureUrl: string | null;
  title: string | null;
  pubDateMs: number | null;
  durationSeconds: number | null;
};

type MatchFeed = {
  podcastGuid: string | null;
  itunesId: string | null;
  selfUrl: string | null;
  items: MatchItem[];
};
```

## Episode match tiers

Run in order. Once an item is paired, neither side can pair again. A tier that would map two
items on one side to one item on the other pairs none of them (leave them for a later tier or
unmatched).

1. **GUID.** Exact string equality after trim. Skip the tier for a GUID value that appears more
   than once on either side (junk GUIDs such as `1` or a repeated placeholder).
2. **Enclosure.** Compare `normalizeEnclosureUrl` (below). Skip values that are not unique on
   their own side.
3. **Fuzzy.** All three must hold, and the pair must be the only fuzzy pair for both items:
   - titles equal after trim, case-fold, and collapsing internal whitespace
   - `pubDateMs` both present and within 36 hours
   - durations both present and within `max(30 seconds, 3% of the longer duration)`

Unmatched items stay unmatched. Never pair on title alone. Never pair many-to-one.

### Enclosure normalization

`normalizeEnclosureUrl(url)`:

- Parse as a URL. On failure, return null (do not match).
- Lowercase the host. Drop the fragment.
- Drop the query string.
- Unwrap a known tracking prefix and keep the inner media URL. Known prefixes, host or path:
  `dts.podtrac.com`, `www.podtrac.com`, `op3.dev`, `chrt.fm`, `pdst.fm`, `pfx.vpixl.com`,
  `claritaspod.com`, `mgln.ai`. If the inner value is a full `http(s)` URL, normalize that.
  If unwrapping fails, use the outer URL without its query.
- Remove a trailing slash on the path except when the path is `/`.

Do not fetch the URL. Do not follow redirects in this function. Redirect equivalence is the
GUID tier's job when the host move kept GUIDs.

## Pair confidence

`assessDuplicatePair(oldFeed, survivorFeed)` returns:

```typescript
type PairAssessment = {
  status: 'verified' | 'needs_review';
  confidence: number;
  pairs: Array<{ fromId: number; toId: number; tier: 'guid' | 'enclosure' | 'fuzzy' }>;
  stats: {
    oldCount: number;
    survivorCount: number;
    matched: number;
    byTier: { guid: number; enclosure: number; fuzzy: number };
    sharedPodcastGuid: boolean;
    sharedItunesId: boolean;
    selfLinkAgrees: boolean;
  };
};
```

`confidence` is `matched / min(oldCount, survivorCount)`, or `0` when the smaller set is empty.

`sharedPodcastGuid`: both non-null and equal, case-insensitive. `sharedItunesId`: both non-null
and equal after trim. `selfLinkAgrees`: one feed's `selfUrl` host+path equals the other feed's
feed URL host+path (the caller passes feed URL as `selfUrl` when the feed has no `atom:link`).

Apply the confidence line from [00-SUMMARY.md](./00-SUMMARY.md). Do not invent a third status.

Empty survivor (fetch failed, zero items) returns `needs_review` with `confidence: 0` and no
pairs. Do not throw.

## Tests

Table-driven, in `duplicateFeedMatch.test.ts`. Cover at least:

- PowerPress-shaped: same GUIDs and enclosures, 100% match, `verified`.
- Host move: same GUIDs, different enclosure hosts, GUID tier only, `verified`.
- Junk GUID `1` on every item, different enclosures and titles: zero pairs, `needs_review`.
- Tracking prefix: `https://dts.podtrac.com/redirect.mp3/example.com/ep.mp3?aid=1` matches
  `https://example.com/ep.mp3`.
- Fuzzy: titles match, dates 20h apart, durations 10s apart, no GUID overlap, plus a shared
  podcast GUID so the pair is `verified` via the second clause of the confidence line.
- Fuzzy without a shared identifier and only one episode: `needs_review`.
- Two old items with the same title and date as one survivor item: no fuzzy pair.
- One old item equally close to two survivor items: no fuzzy pair.

## Done when

- The helper is pure and exported from `@podverse/orm`.
- `deduplicator.helpers.ts` still exports `buildItemMapsForDedup` and
  `findDuplicateItemForDedup`, implemented via the new GUID and enclosure tiers.
- No database access in the new module.

## Operator verification

**Root**

```bash
npm run test -w @podverse/orm
```
