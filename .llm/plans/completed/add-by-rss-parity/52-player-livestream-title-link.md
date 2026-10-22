# 52 — Full player livestream titles open the livestream page

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

Rows: R68 ("A livestream's title in the full player links to its page, regular and Add by RSS").
Mobile only. Web is unchanged.

Runs after `50-player-item-title-stack.md`, `51-player-add-by-rss-episode-link.md`,
`39-add-by-rss-track-lyrics-and-player-link.md` (the Add by RSS title kinds this extends),
`89-add-by-rss-livestream-detail.md` (the route and `liveItemDetail.ts`),
`93-add-by-rss-now-playing-chapters.md` and `94-full-player-add-by-rss-sections.md` (the last
plans that edit `FullPlayerScreen.tsx` and `localResourceData.ts`), and
`87-livestreams-e2e.md` (it creates `e2e/add-by-rss-livestream.yaml`). Never in one phase with a
plan that edits `fullPlayerContentLink.ts`, `FullPlayerScreen.tsx`, `navigation/index.tsx`,
`liveItemDetail.ts`, or that flow. Plan 53 runs after this plan and owns the album
channel link (R74). Leave the livestream branch of `resolveFullPlayerChannelLink` returning
`podcast`.

Parity source: the podcast page's live rows and plan 85's Browse rows open `EpisodeDetail` for a
directory live item, which is the regular livestream page. Plan 89's `AddByRssLivestreamDetail` is
the Add by RSS counterpart. The stack is plan 50's: tab root, then the channel, then the item.

## Answers

**Regular livestreams already link.** Mobile builds every directory livestream target with its
item (`resolveItemPlaybackStart` in `src/lib/playback/buildPlaybackTarget.ts`,
`buildAdoptedPlaybackTarget` in `engineSourceAdoption.ts`). `resolveFullPlayerTitleLink` returns
`episodeRequest(target.item, …)` for `'livestream'`, so the title opens `EpisodeDetail` for the
live item. The existing unit case "opens the episode for a livestream that has an item" proves it.
Plan 50 puts the channel under it. The title link uses the same text color as a plain title (only
the channel line uses the link color), on every item kind. That is why it reads as plain text.
This plan does not restyle titles. The earlier planning note that directory livestream titles stay
plain text was wrong. A directory livestream needs no code change here, only a stronger unit
assertion.

**Add by RSS livestreams do not link.** Plan 51's `addByRssEpisodeItemKey` (plan 93's
`findAddByRssLocalItem`) returns null for a livestream, and plan 89 left the title plain. This
plan adds the link to plan 89's page.

## Locked decisions

1. **New kind `'add-by-rss-livestream'`** on `FullPlayerContentTarget`. `idText` is this device's
   feed id, and `itemKey` holds plan 89's live item key (`addByRssLiveItemKey`: the trimmed live
   guid, else the live index as a string). The accessible name is `media.livestream.livestream`.
   The stack is Home, like the other Add by RSS kinds.
2. **Livestream wins over music.** A live item on a music feed still opens the livestream page.
   Check `isAddByRssLivestreamResourceData` before `isMusicPlaybackTarget`.
3. **Link only what this device can find.** The feed id and the live item key must both resolve
   from this device's stored feed. Otherwise the title stays plain, as plan 51 does for episodes.
   No network request.
4. **Match the live item** by the resource's `guid` first. A live bundle with a guid matches on
   its trimmed guid. A guidless bundle matches `${feedIdText}-${liveIndex}`, the guid
   `toLiveIndexItem` gives it. Otherwise match the resource's `enclosure_url` against
   `liveBundle.item.enclosure.url`. If nothing matches, return null.
5. **Title press** is plan 50's `onOpenItem` with plan 51's Add by RSS channel route
   (`AddByRssPodcastDetail`). Back from the livestream page opens the feed page; Back again opens
   Home's root.
6. **No new catalog key, no restyle, no web change.** Leave the livestream branch of
   `resolveFullPlayerChannelLink` returning `podcast`. Plan 53 opens an album feed's channel
   line on the album page.

## Files

Paths under `apps/mobile/`. `FullPlayerScreen.tsx` and `navigation/index.tsx` are large: Grep the
anchor and read that window.

| File                                               | Anchor                                              | Change                       |
| -------------------------------------------------- | --------------------------------------------------- | ---------------------------- |
| `src/lib/addByRss/liveItemDetail.ts`               | `addByRssLiveItemKey`                               | `resolveAddByRssLiveItemKey` |
| `src/lib/addByRss/liveItemDetail.test.ts`          | key describe                                        | Lookup cases                 |
| `src/screens/player/fullPlayerContentLink.ts`      | `resolveFullPlayerTitleLink`                        | `add-by-rss-livestream` kind |
| `src/screens/player/fullPlayerContentLink.test.ts` | title-link describe                                 | Livestream cases             |
| `src/screens/player/FullPlayerScreen.tsx`          | `resolveLocalAddByRssFeedIdText`, `addByRssItemKey` | Live key in the same effect  |
| `src/navigation/index.tsx`                         | `'add-by-rss-track'`                                | Route the new kind           |
| `e2e/add-by-rss-livestream.yaml`                   | `add-by-rss-livestream-playing` screenshot          | Player title round trip      |
| `release-notes/scratchpad.md` (repo root)          | end of file                                         | Entry                        |

`vitest.config.ts` already includes both test files (plans 50 and 89).

## Implementation

### `liveItemDetail.ts`

Beside plan 89's `addByRssLiveItemKey`. Import `isAddByRssLivestreamResourceData` from
`./resourceData` and type `AddByRSSResourceData` from `@podverse/helpers/dto` (separate
`import type` line). `toNonEmptyTrimmedString` is already imported by plan 89.

```typescript
/**
 * The live item key for a playing Add by RSS livestream on this device's stored feed: by guid
 * (a guidless live item carries `${feedIdText}-${liveIndex}`), then by stream URL. Null when the
 * resource is not a livestream or the feed no longer lists it.
 */
export const resolveAddByRssLiveItemKey = (
  mappedFeed: AddByRSSMappedFeed,
  resourceData: AddByRSSResourceData,
  feedIdText: string
): string | null => {
  if (!isAddByRssLivestreamResourceData(resourceData)) {
    return null;
  }
  const guid = toNonEmptyTrimmedString(resourceData.guid);
  if (guid !== null) {
    const byGuid = mappedFeed.liveItems.findIndex((liveBundle, liveIndex) => {
      const bundleGuid = toNonEmptyTrimmedString(liveBundle.item.guid);
      return bundleGuid === null ? guid === `${feedIdText}-${liveIndex}` : bundleGuid === guid;
    });
    const liveBundle = mappedFeed.liveItems[byGuid];
    if (liveBundle !== undefined) {
      return addByRssLiveItemKey(liveBundle, byGuid);
    }
  }
  const enclosureUrl = toNonEmptyTrimmedString(resourceData.enclosure_url);
  if (enclosureUrl === null) {
    return null;
  }
  const byEnclosure = mappedFeed.liveItems.findIndex(
    (liveBundle) => toNonEmptyTrimmedString(liveBundle.item.enclosure?.url) === enclosureUrl
  );
  const liveBundle = mappedFeed.liveItems[byEnclosure];
  return liveBundle === undefined ? null : addByRssLiveItemKey(liveBundle, byEnclosure);
};
```

Read the live bundle's `item.enclosure` type before writing it. Drop the `?.` if `enclosure` is
not optional. `findIndex` returns `-1`, and `liveItems[-1]` is `undefined`, so no index check is
needed.

### `fullPlayerContentLink.ts`

- `FullPlayerContentTarget['kind']` gains `'add-by-rss-livestream'`. Extend the `itemKey` doc:
  for `add-by-rss-livestream` it is the live item key.
- Import `isAddByRssLivestreamResourceData` from `../../lib/addByRss/resourceData` (node-safe;
  `localResourceData.test.ts` already loads it).
- `resolveFullPlayerTitleLink`, case `add-by-rss` (plan 39's branch): after the "empty feed id
  or item key → `null`" check and before `isMusicPlaybackTarget`, add
  `isAddByRssLivestreamResourceData(target.resourceData)` → `{ idText: feedIdText, imageUrl: null,
  itemKey, kind: 'add-by-rss-livestream', name }`.
- Replace the function's doc comment, whatever earlier plans left, with:

```typescript
/**
 * Where the visible item title opens. A directory livestream opens its live item's episode page,
 * the page its rows open. Add by RSS titles open this device's episode, track, or livestream page
 * and link only when this device has the feed and finds the item. A directory livestream
 * without an item has no title link.
 */
```

- `fullPlayerOpenScreenLabelKey`: `add-by-rss-livestream` → `'media.livestream.livestream'`.
- `playerContentStack`: `add-by-rss-livestream` → `'Home'`, beside the other Add by RSS kinds.
  Name it in the doc comment with them.

Grep `apps/mobile/src` for `'add-by-rss-track'` and add the livestream case beside every hit that
switches on `FullPlayerContentTarget['kind']`. An exhaustive `switch` fails type-check otherwise.

### `FullPlayerScreen.tsx`

The effect that resolves `addByRssFeedIdText` also sets `addByRssItemKey` (plan 51). Inside it,
after the mapped feed loads, change only the key call:

```typescript
const itemKey = isAddByRssLivestreamResourceData(resourceData)
  ? resolveAddByRssLiveItemKey(mappedFeed, resourceData, feedIdText)
  : addByRssEpisodeItemKey(mappedFeed, resourceData);
```

Use the names that effect already has for the resolved feed id, the mapped feed, and the full
target `resourceData`. `isAddByRssLivestreamResourceData` comes from
`../../lib/addByRss/resourceData` (already imported if plan 94 added it).
`resolveAddByRssLiveItemKey` comes from `../../lib/addByRss/liveItemDetail`. Keep the `isCurrent`
guard and the dependency list. `resolveFullPlayerTitleLink` already receives
`{ feedIdText, itemKey }`. The title press already calls `onOpenItem`. Neither changes.

### `navigation/index.tsx`

Beside each `add-by-rss-track` case plan 39 added:

- `homeContentParams`: `case 'add-by-rss-livestream'` → `{ initial: false, params: { feedIdText:
  request.idText, liveItemKey: request.itemKey ?? '' }, screen: 'AddByRssLivestreamDetail' }`.
- `catalogContentParams`: throw the same `Add by RSS content opens on Home.` error.
- `openFullPlayerItem`: item kind `add-by-rss-livestream` → `{ name: 'AddByRssLivestreamDetail',
  params: { feedIdText: item.idText, liveItemKey: item.itemKey ?? '' } }`.

Plan 89 registered `AddByRssLivestreamDetail` on the Home stack. Plan 51's channel case
(`add-by-rss` → `AddByRssPodcastDetail`) is the route under it.

## Tests

### `liveItemDetail.test.ts`

New `describe('resolveAddByRssLiveItemKey')`, on a mapped feed with two live items, the first with
a guid and the second without one:

- A livestream resource whose `guid` is the first live item's guid → that trimmed guid.
- A livestream resource whose `guid` is `${feedIdText}-1` → `'1'`.
- A livestream resource with an unknown `guid` and the second item's stream URL → `'1'`.
- An unknown guid and an unknown stream URL → `null`.
- A resource without `liveItem` or `livestream_item` (an episode) → `null`.

Build the feed the way plan 89's cases do in the same file.

### `fullPlayerContentLink.test.ts`

- The existing directory livestream case also expects `idText` `'ep-1'`, the live item's page.
- An Add by RSS target whose resource data has `liveItem: {}`, with a feed id and an item key →
  kind `add-by-rss-livestream`, `idText` the feed id, `itemKey` that key.
- The same with `medium_id: MediumEnum.Music` → still `add-by-rss-livestream`.
- The same with a null item key → `null`.
- `fullPlayerOpenScreenLabelKey('add-by-rss-livestream')` → `'media.livestream.livestream'`.
- `playerContentStack({ isSubscribed: false, kind: 'add-by-rss-livestream' })` → `'Home'`.
- Any case from plans 51 or 39 that expects `null` for an Add by RSS livestream with both ids
  set now expects the new kind. Update it rather than adding a duplicate.

### `e2e/add-by-rss-livestream.yaml`

Plan 87 step 5 plays the live row from `rss-root-screen` and takes the
`add-by-rss-livestream-playing` screenshot. Insert directly after that screenshot, before step 6's
cleanup:

```yaml
# The full player's livestream title opens the feed page and then the livestream page on Home.
- tapOn:
    id: mini-player
- extendedWaitUntil:
    visible:
      id: full-player-title-link
    timeout: ${TIMEOUT_FAST}
- tapOn:
    id: full-player-title-link
- extendedWaitUntil:
    visible:
      id: add-by-rss-livestream-detail-screen
    timeout: ${TIMEOUT_FAST}
- assertVisible:
    id: add-by-rss-livestream-detail-title
    text: E2E Add-by-RSS Live Now
- takeScreenshot: add-by-rss-livestream-player-title-opens-page
- tapOn:
    id: stack-header-back
- extendedWaitUntil:
    visible:
      id: add-by-rss-home-detail-screen
    timeout: ${TIMEOUT_FAST}
- tapOn:
    id: stack-header-back
- extendedWaitUntil:
    visible:
      id: home-screen
    timeout: ${TIMEOUT_FAST}
- tapOn:
    id: tab-my-library
- extendedWaitUntil:
    visible:
      id: rss-root-screen
    timeout: ${TIMEOUT_FAST}
```

Confirm `add-by-rss-livestream-detail-title` in `ItemDetailHeader` (`${testIDPrefix}-title`) before
writing it. Back twice leaves no feed page on the Home stack, so step 6's waits for
`add-by-rss-home-detail-screen` and step 7's live-row ids match only the Library stack's page.
`TIMEOUT_FAST`: the feed is parsed and playing. The flow is already registered in
`e2e-test.sh`, the README, and the mobile-test-economics skill; no list changes.

The directory half gets no Maestro step. The unit case holds the link, and plan 50's
`player-screen.yaml` steps hold the channel-then-item stack on `EpisodeDetail`, the same route.
Playing `E2E Live Audio Stream` from Browse would add a test-assets dependency to `browse.yaml`.

## Release scratchpad

```markdown
## Add by RSS livestream titles in the player open the livestream page

- Surfaces: mobile
- Change: Tapping an Add by RSS livestream's title on the full player opens that feed and then
  the livestream page, so Back returns to the feed. It links when this device has the feed and
  still lists the livestream. Directory livestream titles already open the livestream's page,
  under its channel page.
- Who notices: anyone who plays a livestream from a feed added by RSS on the phone
- Operator steps: none
```

Move this plan to `.llm/plans/completed/add-by-rss-parity/` when done.
