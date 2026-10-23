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
