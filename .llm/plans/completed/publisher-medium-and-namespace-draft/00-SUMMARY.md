# Publisher medium default and namespace proposal draft

Two small changes that sit next to the `artist-album-attribution` set and do not depend on it.
Prompts and models are in [COPY-PASTA.md](COPY-PASTA.md).

## Requirement ledger

- **R1** "count a missing medium as podcast" for publisher feeds whose remote items omit `medium`, as a separate small change — Plan: 01
- **R2** "find a home for these specific types of drafts that make sense within the repo for how specs should be adapted in podcast index" — Plan: 02
- **R3** the draft itself: two-way publisher attribution, multiple publishers, and track-level publishers — Plan: 02
- **R4** "you may need to update ABC memory for this new place where these types of things can exist" — Plan: 02

## Locked decisions

- **Missing medium (R1):** only when no remote item in a `publisher` feed carries a medium, or the
  feed lists no remote items, is the feed `publisher-podcast`. Remote items without a medium still
  do not count toward any medium in a feed where some do. The operator chose this over counting
  every blank as podcast, which would turn an artist feed that marks some albums `music` and leaves
  others blank into a podcast publisher.
- **Existing channels:** no migration or backfill. `updateParsedChannel` in
  `packages/parser/src/lib/rss/channel/channel.ts` writes `compatChannelDto().medium_id` on every
  parse, so a channel takes the new medium the next time it is parsed.
- **Proposal home (R2):** `docs/proposals/podcast-namespace/`, one file per proposal, indexed by
  `DOCS-PROPOSALS-PODCAST-NAMESPACE.md` (full-path name per **documentation-conventions**).
- **abcmemory (R4):** a scoped rule `.cursor/rules/podcast-namespace-proposals.mdc`, listed in
  `.cursor/rules/rule-index.mdc`.
- **Proposal content (R3):** text is fixed in plan 02. It is a draft; nobody submits it as part of
  this set.

## Plans

| Plan | Change |
| --- | --- |
| [01-publisher-medium-default.md](01-publisher-medium-default.md) | `detectDuckTypedPublisherMediumId` returns `publisher-podcast` when no remote item names a medium |
| [02-podcast-namespace-publisher-draft.md](02-podcast-namespace-publisher-draft.md) | Proposal folder, publisher attribution draft, and the abcmemory rule |
