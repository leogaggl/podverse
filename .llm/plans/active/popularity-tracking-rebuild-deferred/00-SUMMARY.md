# Deferred: Popularity Tracking follow-ups

These gaps were left out of the `popularity-tracking-rebuild` set, which is closed in
`.llm/plans/completed/popularity-tracking-rebuild/`. Nothing here is scheduled. The set built the
data foundation: a permanent pseudonymous listener id in its own schema, monthly-partitioned listen
and open events kept 90 days, anonymous daily and range totals, per-show Taste Profile rows with a
Hidden From Taste Profile list, opt-out deletion with a warning, and the Taste Profile settings on
web and mobile. The old stats tables and code are gone. Contracts and lifetimes are in
`docs/features/POPULARITY-TRACKING.md`.

## "Also listened" scores and recommendation surfaces (R30)

**The gap.** A nightly job that turns Taste Profile rows into show-to-show "also listened" scores,
holding no listener ids and kept forever, and the "Listeners Also Like" and "For You" surfaces
built on those scores.

**Why it waits.** The operator scoped the set to the data foundation. The taste rows carry recent
(about 14-day half-life) and long-term (about 180-day half-life) scores, so the job can be added
without a schema change to the taste rows.

**Questions to settle first.**

1. What is the minimum number of shared listeners before a show pair is published, so that a score
   cannot point back to one person?
1. Which score drives each surface: the recent one, the long-term one, or a blend?
1. Are hidden shows excluded only from that listener's own "For You", or from the pair counts as
   well?

## Stale training episodes

**The gap.** `misc/aicasts/listener-privacy-1-popularity-tracking.md` still describes the rotating
id and the rolling counts. `misc/aicasts/content-lifecycle-4-duplicate-feed-merge.md` says stats
are added together on a merge; the merge now removes same-day listener overlap inside retention,
merges taste rows, and a revert does not move listener data back.

**Why it waits.** The episodes should describe shipped behavior, so they are rewritten with an
**abcaicast** run after this set ships.

**Questions to settle first.** None beyond confirming the set has shipped.

## Stale QA docs

**The gap.** `tools/qa/docs/faker/07d-stats-aggregated.md`, `07e-stats-events.md`,
`01-architecture.md`, and `08-llm-skills.md` still describe the old per-entity event tables, the
guid mapping, and the rolling aggregate tables.

**Why it waits.** They are documentation for the faker tooling, outside the set's scope, and
nothing reads them at runtime.

**Questions to settle first.**

1. Should the faker generators cover the new stores (daily totals, listen events, taste rows), or
   should the stats pages simply be removed from those docs?
1. If the generators cover listen events, must they keep generated listener ids out of every
   table except the `listener_identity` mapping, matching
   `.cursor/rules/popularity-listener-id-separation.mdc`?

## Alpha GitOps retention

**The gap.** `../k.podcastdj.com/apps/podverse-alpha` sets `STATS_TRACK_EVENT_RETENTION_DAYS` to
90 in its `api.env` and `web-sidecar.env`. That edit was made outside the set and is not pushed.

**Why it waits.** The operator pushes it with the alpha ref bump that deploys this set.

**Questions to settle first.** None. After that deploy, run the partition job once by hand so dated
partitions exist before the first listens arrive.

## When picked up

Run **abcplan** with the relevant section above as the request's starting context and answer its
questions first.
