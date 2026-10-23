**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 04 — New-album notifications name only verified or not-yet-parsed albums

When an artist feed adds album references, `handleNewRemoteItemNotifications` sends one
new-content notification for the first album it can resolve. Today a parsed album resolves
whether or not it names the artist back. After this plan, a parsed album resolves only when a
verified publisher link joins it to the artist. That matches the artist page (area B), where a
parsed album that does not point back is not listed.

## Rows

R4, R9

## Runs after

02

## Files

packages/parser/src/lib/notifications/handleNewRemoteItemNotifications.ts
packages/parser/src/lib/notifications/handleNewRemoteItemNotifications.test.ts
release-notes/scratchpad.md

## Reuses

- `ChannelVerifiedPublisherService.isVerified(publisherChannelId, channelId)` from plan 02
  (album-level link).
- `pickFirstResolvedRemoteAlbum`, `groupNewRemoteItemsByFeed`, and the rest of
  `remoteAlbumNotification.ts` unchanged. The verified check sits in the resolver, which already
  depends on the ORM. `remoteAlbumNotification.ts` stays pure.

## Ordering this relies on

Plan 03 recomputes links inside `handleParsedChannel`, which runs before
`handleNewRemoteItemNotifications` in `parser.ts`. When the artist parse adds a reference to an
album that already names the artist, the link exists by the time this check runs.

## Change in `handleNewRemoteItemNotifications.ts`

1. Add `ChannelVerifiedPublisherService` to the `@podverse/orm` value import.
1. Give `resolveRemoteAlbumGroup` a second parameter, `publisherChannelId: number`.
1. Add a helper beside `localAlbum`:

```typescript
/** A parsed album resolves only when it and the artist feed reference each other. */
async function verifiedLocalAlbum(
  channel: Channel & { id_text: string },
  group: RemoteAlbumGroup,
  publisherChannelId: number
): Promise<ResolvedRemoteAlbum | null> {
  const verified = await new ChannelVerifiedPublisherService().isVerified(
    publisherChannelId,
    channel.id
  );
  return verified ? localAlbum(channel, group) : null;
}
```

1. In `resolveRemoteAlbumGroup`, replace `return localAlbum(parsedByGuid, group);` and
   `return localAlbum(channel, group);` with
   `return verifiedLocalAlbum(parsedByGuid, group, publisherChannelId);` and
   `return verifiedLocalAlbum(channel, group, publisherChannelId);`. A parsed album that is not
   verified returns `null` for its group, with no Podcast Index fallback, and
   `pickFirstResolvedRemoteAlbum` moves to the next group.
1. The Podcast Index branch stays as it is. It is reached only when no parsed-ready album was
   found by guid or URL, which is the same set the artist page's Not Yet Added section shows.
1. In `handleNewRemoteItemNotifications`, call
   `pickFirstResolvedRemoteAlbum(groups, (group) => resolveRemoteAlbumGroup(group, channel.id))`.
1. Update the function's doc comment: the link is a verified album, or the Podcast Index preview
   when the album is not parsed yet; a parsed album that does not name the artist back is skipped.

Check that `isParsedReadyAlbum`'s narrowed type (`Channel & { id_text: string }`) is what the two
call sites pass; it is, since both are inside `isParsedReadyAlbum` checks.

## Must stay true

- A non-artist channel and a run with no recipients make no ORM calls, as today.
- A parsed but unverified album is never announced and never falls back to its Podcast Index
  preview.

## Tests

In `handleNewRemoteItemNotifications.test.ts`:

- Add `isVerifiedMock` to the hoisted mocks, and add to the `@podverse/orm` mock:
  `ChannelVerifiedPublisherService: class { isVerified = isVerifiedMock; }`. In `beforeEach`,
  `isVerifiedMock.mockResolvedValue(true)`.
- Give `channelWithMedium` an `id: 9` and the local album fixture an `id: 41`, so the verified
  check receives real ids.
- In "announces one local album when a parse adds many album refs", also assert
  `isVerifiedMock` was called once with `(9, 41)`.
- New `it('skips a parsed album that does not name the artist back')`: the guid lookup returns
  the parsed album for `FEED_A`, `isVerifiedMock` resolves `false`, Podcast Index returns
  `{ feed: { id: 77, title: 'Preview album' } }` for `FEED_B`. Refs `[FEED_A, FEED_B]`. Expect
  `podcastGetByGuidMock` called once with `FEED_B` only, and the sent notification to be the
  `podcast-index-feed` for `'77'`.
- New `it('sends nothing when the only parsed album is unverified')`: one ref `FEED_A`, parsed and
  unverified. Expect no `podcastGetByGuidMock` call and no `sendItemNotificationsMock` call.

## Release scratchpad

```markdown
## New-album notifications skip albums that do not name the artist

- Surfaces: workers (parser), notifications
- Change: when an artist feed adds album references, the new-album notification names only an
  album that names that artist back (a verified publisher link), or a Podcast Index preview for
  an album Podverse has not parsed. A parsed album whose `<podcast:publisher>` does not point at
  the artist is skipped.
- Who notices: artist followers stop getting alerts for albums the artist page does not list.
- Operator steps: none.
```
