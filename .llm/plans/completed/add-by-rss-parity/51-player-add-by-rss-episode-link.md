# 51 — Add by RSS episode title uses the player stack

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

Rows: R44 for an Add by RSS episode. Mobile only. R45 stays as plan 50 left it: the channel
title is still one screen, and Home versus Browse does not change.

Runs after `50-player-item-title-stack.md` and `33-add-by-rss-episode-detail.md`. Do not run
it in the same phase as plan 50, or as a plan that edits `e2e/add-by-rss.yaml` (20, 21, 34,
40, 41, 42).

Parity source: plan 50's directory pair. An Add by RSS episode uses the same three routes on
Home: tab root, `AddByRssPodcastDetail`, `AddByRssEpisodeDetail`.

## Answers

An Add by RSS title returns null today (`resolveFullPlayerTitleLink`, case `add-by-rss`),
because there was no item screen. Plan 33 adds `AddByRssEpisodeDetail` with
`{ feedIdText, itemKey }`. `itemKey` is the item guid, or the index as a string when the item
has no guid (plan 30). Music has no item page (plan 30, R24), so a music title stays plain
text. A livestream has no episode page, so its title stays plain text.

The playback target's `id_text` is the feed id, not the item. `channel_id_text` can be another
device's id. The feed id is the one `resolveLocalAddByRssFeedIdText` already resolves. A
device-local guid (`${feedIdText}-${index}` from `toIndexItem` in
`packages/parser-mapping/src/addByRSS/itemIndex.ts`) is not the item key.

## Locked decisions

1. **Link only a non-music, non-livestream item this device can find.** Otherwise the title
   stays plain text, as it does today. The channel title is unchanged.
2. **The press does not await.** The title becomes a link only after the feed id and the item
   key are both in state.
3. **Stack** is plan 50's `onOpenItem`. `playerContentStack` treats `add-by-rss-episode` like
   `add-by-rss` (Home, including `MoreOverflowHome`). Do not open this page on Browse or on
   the Library stack.
4. **No new catalog key.** The accessible name uses `media.podcast.episode`. `imageUrl` on
   the episode target is null. The route does not take a preview image.
5. **Leave plan 50's title press and `openFullPlayerItem` shape.** Add the Add by RSS cases
   in front of the fallbacks. Do not change the directory cases.

## Files

Paths under `apps/mobile/` unless noted. Large files: Grep the anchor, read that window.

| File | Anchor | Change |
| --- | --- | --- |
| `src/lib/addByRss/localResourceData.ts` | `findLocalItemIndex` | `addByRssEpisodeItemKey` |
| `src/lib/addByRss/localResourceData.test.ts` | existing describe | Item-key cases |
| `src/screens/player/fullPlayerContentLink.ts` | `resolveFullPlayerTitleLink` | `add-by-rss-episode` |
| `src/screens/player/fullPlayerContentLink.test.ts` | title-link describe | Music stays null; an episode links |
| `src/screens/player/FullPlayerScreen.tsx` | `resolveLocalAddByRssFeedIdText` | Resolve the item key in that effect |
| `src/navigation/index.tsx` | `openFullPlayerItem`, `homeContentParams` | Add by RSS routes |
| `e2e/add-by-rss.yaml` | `assert-add-by-rss-now-playing.js` | Back stack, then return to My Library |

## Implementation

### `addByRssEpisodeItemKey`

In `localResourceData.ts`. Do not export `findLocalItemIndex`.

```typescript
/** Item key for AddByRssEpisodeDetail: the item guid, or the index when the item has none. */
export const addByRssEpisodeItemKey = (
  mappedFeed: AddByRSSMappedFeed,
  resourceData: AddByRSSResourceData
): string | null => {
  if (isAddByRssLivestreamResourceData(resourceData)) {
    return null;
  }
  const itemIndex = findLocalItemIndex(
    mappedFeed,
    toNonEmptyTrimmedString(resourceData.guid),
    toNonEmptyTrimmedString(resourceData.enclosure_url)
  );
  if (itemIndex < 0) {
    return null;
  }
  const guid = toNonEmptyTrimmedString(mappedFeed.items[itemIndex]?.item.guid);
  return guid ?? String(itemIndex);
};
```

`toNonEmptyTrimmedString` is already imported there.

### Title target

Add `'add-by-rss-episode'` to `FullPlayerContentTarget['kind']`, plus optional `itemKey`.
`idText` on that kind is the local feed id. `itemKey` is set only for that kind.

`resolveFullPlayerTitleLink` gains
`addByRss: { feedIdText: string | null; itemKey: string | null }`. Every existing call,
including plan 50's tests, passes `{ feedIdText: null, itemKey: null }`.

The `add-by-rss` case:

- `isMusicPlaybackTarget(target)` from `src/lib/playback/engineAudioProfile.ts` → `null`.
  Its native import is `import type`, so the unit test stays on node.
- Empty feed id or item key → `null`.
- Otherwise `{ idText: feedIdText, imageUrl: null, itemKey, kind: 'add-by-rss-episode', name }`.

Rewrite the doc comment that says Add by RSS has no item screen. Music and livestreams have
no item page. A directory livestream without an item has no title link.

`fullPlayerOpenScreenLabelKey`: `add-by-rss-episode` returns `media.podcast.episode`.

`playerContentStack`: `add-by-rss-episode` returns Home, including when `isSubscribed` is
false. Name both Add by RSS kinds in the comment.

### `FullPlayerScreen.tsx`

`addByRssItemKey` state, cleared in the effect that already calls
`resolveLocalAddByRssFeedIdText`. When `activeTarget.kind === 'add-by-rss'`, pass that
target's `resourceData` (not the partial `{ channel_id_text, feed_url }` object) to
`addByRssEpisodeItemKey` after the feed id resolves: `getFeedByIdText`, then
`getMappedFeedByUrl(record.feedUrl)`. No record or no mapped feed → key stays null. Depend
on that `resourceData` value so a new item re-runs the lookup. Keep the `isCurrent` flag.

Pass the third argument:
`{ feedIdText: addByRssFeedIdText, itemKey: addByRssItemKey }`.

Plan 50's title press already calls `onOpenItem` when both links exist. Do not rewrite it.

### `navigation/index.tsx`

`homeContentParams`, for the one-screen fallback plan 50 uses when the channel link is null:

```typescript
case 'add-by-rss-episode':
  return {
    initial: false,
    params: { feedIdText: request.idText, itemKey: request.itemKey ?? '' },
    screen: 'AddByRssEpisodeDetail',
  };
```

`catalogContentParams`: `add-by-rss-episode` throws the same error as `add-by-rss`
(`Add by RSS content opens on Home.`).

In `openFullPlayerItem`, before the fallbacks plan 50 left:

- Channel kind `add-by-rss` →
  `{ name: 'AddByRssPodcastDetail', params: { feedIdText: channel.idText } }`.
- Item kind `add-by-rss-episode` → `AddByRssEpisodeDetail` with
  `{ feedIdText: item.idText, itemKey: item.itemKey ?? '' }`.

`playerContentStack` already sends that kind to Home, so the Browse branch does not run.
Leave the directory route builders as plan 50 wrote them.

## Tests

`localResourceData.test.ts` (already included). Use `convertParsedRSSFeedToCompat`, as that
file already does.

- Resource `guid` equal to the item guid → that guid.
- Guidless item, matched by enclosure, resource `guid` set to `${feedIdText}-${index}` →
  `String(index)`.
- `{ liveItem: {} }` → null.
- Guid and enclosure that are not in the feed → null.

`fullPlayerContentLink.test.ts` (plan 50 adds it to `vitest.config.ts`):

- Add by RSS with `medium_id: MediumEnum.Music`, a feed id, and an item key → `null`.
- `medium_id: MediumEnum.Podcast` with both ids → kind `add-by-rss-episode` and that item
  key. Missing either id → `null`.
- `playerContentStack({ isSubscribed: false, kind: 'add-by-rss-episode' })` → `'Home'`.

`e2e/add-by-rss.yaml`. Insert after the `assert-add-by-rss-now-playing.js` `runScript` and
before `add-by-rss-home-remove`. Playback starts on the Library detail. The title tap
replaces the Home stack only, so that Library detail is still there. Return to My Library
before Remove, which expects `rss-root-screen`:

```yaml
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
      id: add-by-rss-episode-detail-screen
    timeout: ${TIMEOUT_FAST}
- tapOn:
    id: stack-header-back
- extendedWaitUntil:
    visible:
      id: add-by-rss-home-detail-screen
    timeout: ${TIMEOUT_FAST}
- tapOn:
    id: tab-my-library
- extendedWaitUntil:
    visible:
      id: add-by-rss-home-detail-screen
    timeout: ${TIMEOUT_FAST}
```

The seeded episode guid is `https://e2e-seed-addbyrss.example/item-guid/fresh`, so the item
key is that guid. No new flow file. `TIMEOUT_FAST`: the feed is already parsed and playing.

## Release scratchpad

```markdown
## Add by RSS episode titles in the player open the feed first

- Surfaces: mobile
- Change: Tapping an Add by RSS episode's title on the full player opens that feed and then
  the episode, so Back returns to the feed. The channel title is unchanged.
- Who notices: anyone playing an Add by RSS episode on the phone
- Operator steps: none
```
