# Podcast namespace proposal folder and the publisher attribution draft

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

## Rows

R2, R3, R4

## Runs after

01

## Files

docs/proposals/podcast-namespace/DOCS-PROPOSALS-PODCAST-NAMESPACE.md
docs/proposals/podcast-namespace/PUBLISHER-ATTRIBUTION.md
.cursor/rules/podcast-namespace-proposals.mdc
.cursor/rules/rule-index.mdc

## Purpose

Podverse sometimes needs something the Podcast Index namespace (`podcast:*` tags) cannot express.
This plan gives those needs a home in the repo, writes the first draft, and adds the abcmemory rule
that points agents at the folder. Nothing is submitted upstream.

Write the three new files with the content below, as given. Fix only Markdown that does not render.

## 1. `docs/proposals/podcast-namespace/DOCS-PROPOSALS-PODCAST-NAMESPACE.md`

````markdown
# Podcast namespace proposals

Drafts of changes Podverse would like in the
[Podcast Index namespace](https://github.com/Podcastindex-org/podcast-namespace). Each draft
records a need that the current `podcast:*` tags cannot express, so later work can find it. A
draft may never be submitted.

Podverse never emits a tag from a draft in feeds it generates, and never requires one to parse a
feed. Where it costs little, the data model accepts a draft's shape so adoption needs no migration.

| Proposal | Status | Podverse features |
| --- | --- | --- |
| [Publisher attribution](PUBLISHER-ATTRIBUTION.md) | Draft, not submitted | Artist pages, the player's artist line, track bylines |

Statuses: **Draft, not submitted**; **Submitted** (link the discussion); **Adopted** (link the
tag doc); **Dropped** (say why).
````

## 2. `docs/proposals/podcast-namespace/PUBLISHER-ATTRIBUTION.md`

````markdown
# Two-way publisher attribution, multiple publishers, and track-level publishers

**Status:** Draft, not submitted. Intended for a
[podcast-namespace discussion](https://github.com/Podcastindex-org/podcast-namespace/discussions).

**Tags:** [`podcast:publisher`](https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/tags/publisher.md),
[`podcast:remoteItem`](https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/tags/remote-item.md),
and the [publisher medium](https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/examples/publishers/publishers.md).

## Problem

1. The publisher doc discards a feed's claim on a publisher when the publisher does not list it
   back. It does not say what to do when a publisher lists a feed that does not point back. An app
   that builds "albums by this artist" from the publisher's list alone lets any publisher feed
   claim any album.
2. `<podcast:publisher>` holds exactly one `remoteItem`, so an album by two artists, each with
   their own publisher feed, can credit only one of them.
3. Publishers can only be credited at the channel level. A featured artist on one track of another
   artist's album cannot be credited in a verifiable way.

Nothing else in the namespace fills these gaps. `podcast:person` names a person with a link and an
image, but no feed guid, and its role taxonomy has no music group. `podcast:valueTimeSplit` remote
items route payments, not credit.

## Proposal

1. **Clarify two-way attribution.** A publisher's `remoteItem` that points at a feed which does not
   name that publisher in `<podcast:publisher>` should not be presented as that publisher's
   content.
2. **Allow multiple publishers.** `<podcast:publisher>` may hold one or more
   `<podcast:remoteItem medium="publisher">` elements. Order matters: the first is the primary
   publisher. Apps that read only the first keep working.
3. **Allow track-level publishers.** `<podcast:publisher>` may appear in `<item>`. The credit is
   valid when that publisher feed contains a `remoteItem` with the item's `feedGuid` and
   `itemGuid`. Item-level publishers add to the channel-level ones.

Album feed by two artists:

```xml
<podcast:publisher>
  <podcast:remoteItem medium="publisher" feedGuid="artist-a-guid" feedUrl="https://a.example.com/artist.xml"/>
  <podcast:remoteItem medium="publisher" feedGuid="artist-b-guid" feedUrl="https://b.example.com/artist.xml"/>
</podcast:publisher>
```

Each artist's publisher feed lists the album:

```xml
<podcast:remoteItem medium="music" feedGuid="album-guid" feedUrl="https://music.example.com/album.xml"/>
```

A featured artist on one track:

```xml
<item>
  <guid>track-7</guid>
  <podcast:publisher>
    <podcast:remoteItem medium="publisher" feedGuid="artist-c-guid" feedUrl="https://c.example.com/artist.xml"/>
  </podcast:publisher>
</item>
```

Artist C's publisher feed then contains:

```xml
<podcast:remoteItem medium="music" feedGuid="album-guid" itemGuid="track-7"/>
```

## Matching

Match `feedGuid` in both directions. When the content feed's pointer includes `feedUrl`, apps may
also require it to match the publisher feed's URL. That guards against a feed declaring another
feed's guid.

## Compatibility

Existing feeds stay valid. Apps that read one publisher still show the primary one.

## Podverse

- Point 1 is display policy, so Podverse applies it without waiting for the namespace: an album
  appears on an artist page, and the artist appears in the player, only when both feeds reference
  each other.
- Points 2 and 3 need feeds to adopt them. Podverse stores publisher claims and verified links as
  lists, per album and per track, so they fit without a migration when feeds start using them.
````

## 3. `.cursor/rules/podcast-namespace-proposals.mdc`

````markdown
---
description: Where drafts of proposed Podcast Index namespace changes live, and how Podverse designs around a change the namespace has not adopted. Use when a feature needs something the podcast:* tags cannot express, or when reading or writing docs/proposals/podcast-namespace/.
globs: docs/proposals/podcast-namespace/**
alwaysApply: false
---

# Podcast namespace proposals

When a feature would be better served by a change to the Podcast Index namespace (`podcast:*`
tags), write the change down as a draft in `docs/proposals/podcast-namespace/`. Podverse may never
submit it. The draft records the need so later work can find it.

## Where

- One file per proposal, named for its topic (`PUBLISHER-ATTRIBUTION.md`).
- List every proposal in `DOCS-PROPOSALS-PODCAST-NAMESPACE.md` with its status: draft, submitted
  (link the discussion), adopted (link the tag doc), or dropped (say why).

## What a draft holds

- A status line and the discussion it targets.
- The problem, as what an app cannot do with today's tags.
- The proposed tag change, with feed examples.
- Compatibility: what existing feeds and apps keep doing.
- The Podverse features that depend on it.

## Designing around a draft

- When it costs little, shape the data model so the proposal fits without a later migration.
  Behavior still follows today's feeds.
- Never emit a tag from a draft in feeds Podverse generates, and never require one to parse a feed.
- When the namespace adopts, changes, or rejects a proposal, update the draft's status and the code
  that was waiting on it.
````

## 4. `.cursor/rules/rule-index.mdc`

Add one bullet to the list, after the `domain-terms` playlist bullet:

```markdown
- A feature needs a `podcast:*` tag the namespace lacks, or a namespace change draft →
  `podcast-namespace-proposals`
```

Make a targeted insertion; do not rewrite the file.

## Tests

None. Documentation and guidance only.

## Release scratchpad

none
