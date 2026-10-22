# 30 — Add by RSS item actions: queue, playlist, mark played, download

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

Rows: R29 (what Add by RSS items can support), R30 (reuse), R54 (track rows get the same actions).
Mobile only. No UI in this plan; plans 33 and 34 put these actions on the item detail header and
the list rows.

Runs after `21-add-by-rss-detail-chips.md` (it creates `lib/addByRss/downloadIdText.ts` and
`AddByRssHomeEpisode.downloadItemIdText`, both used here).

## Answers

**R29.** What an Add by RSS item can do on mobile, checked against the code:

| Action          | Where the support is                                           | Offered |
| --------------- | -------------------------------------------------------------- | ------- |
| Play            | `useAddByRssPlayback.playItem`                                 | Yes     |
| Queue Next      | `queueRepository.addAddByRssNext` (only queue reorder uses it) | Yes     |
| Queue Last      | `queueRepository.addAddByRssLast`                              | Yes     |
| Add to Playlist | `useAddToPlaylist` takes `{ kind: 'add-by-rss', … }`           | Yes     |
| Mark as Played  | `addResourceToHistory` takes `'add_by_rss'`; `markAsPlayed` no | Yes     |
| Download        | `downloadManager` handles feed-URL channel ids, credentials    | Yes     |
| Share           | Add by RSS pages are not shareable                             | No      |
| Like            | mobile rows have no like action                                | No      |
| Go to Track     | no Add by RSS track page (R24)                                 | No      |

"Offered" holds for podcast episodes and music tracks alike (R54): track rows offer Queue Next,
Queue Last, Add to Playlist, Mark as Played, and Download (plan 34). Every action here takes the
medium from `resolveAddToPlaylistTarget` (decision 3), so a track queues, lands in a music
playlist, and is marked played in music history with no music-only code.

Web's Add by RSS row menu (`AddByRSSEpisodeRow.tsx` under
`apps/web/src/components/AddByRSS/Podcast/Episode/`) offers the same set plus Like. The mobile
podcast episode row is the parity source, so Like stays out.

## Locked decisions

1. **Download item.** Move `mappedAddByRssItemToDto` out of `downloads/autoDownloadEvaluate.ts`
   into a new `lib/addByRss/downloadItem.ts` as `addByRssDownloadItem`. Its `id_text` comes from
   plan 21's `addByRssDownloadItemIdText(feedUrl, itemBundle.item, index)`, so a download started
   from a row, from auto-download, and the Downloaded chip all use one id.
2. **Row data.** `AddByRssHomeEpisode` gains `downloadItem: DTOItem | null` and `itemKey: string`.
   `itemKey` is `itemBundle.item.guid ?? String(itemIndex)`, the same value the row `id` already
   ends with. Plan 33's route uses it.
3. **Queue medium.** Medium comes from the existing `resolveAddToPlaylistTarget` in
   `components/player/fullPlayerRows.ts`, called with `{ kind: 'add-by-rss', resourceData }`.
   `'music'` maps to `MediumEnum.Music`; `'av'` maps to `MediumEnum.Podcast`. The full player and
   rows then agree on which queue an item belongs to.
4. **Gates.** Queue and Mark as Played use `queue_history_sync`, as `useHomeRowPlayback` does.
   Add to Playlist opens `needs_account` when signed out, as `PodcastEpisodesSection` does.
5. **Notices.** The same four keys `useHomeRowPlayback` uses: `features.queue.added_to_queue`,
   `features.queue.add_error`, `features.history.marked_as_played`,
   `features.history.mark_as_played_error`. No new catalog keys.

## Files

| File                                                   | Change                            |
| ------------------------------------------------------ | --------------------------------- |
| `src/lib/addByRss/downloadItem.ts`                     | New: `addByRssDownloadItem`       |
| `src/lib/addByRss/downloadItem.test.ts`                | New                               |
| `src/downloads/autoDownloadEvaluate.ts`                | Use `addByRssDownloadItem`        |
| `src/screens/home/addByRssHomeDetailData.ts`           | `downloadItem`, `itemKey` on rows |
| `src/screens/home/addByRssHomeDetailData.test.ts`      | Cover both fields                 |
| `src/data/repositories/queueRepository.ts`             | Widen `markAsPlayed` target       |
| `src/hooks/useQueueMutations.ts`                       | Add by RSS add and mark functions |
| `src/screens/home/useHomeRowPlayback.ts`               | Export `useQueueHistoryGate`      |
| `src/screens/home/addByRss/useAddByRssItemActions.tsx` | New hook                          |
| `vitest.config.ts`                                     | Include the new test              |

All paths are under `apps/mobile/`.

## Implementation

### `lib/addByRss/downloadItem.ts`

```typescript
export const addByRssDownloadItem = (
  feedUrl: string,
  itemBundle: AddByRSSMappedFeed['items'][number],
  index: number
): DTOItem | null => { /* body of mappedAddByRssItemToDto */ };
```

- Copy the body of `mappedAddByRssItemToDto` unchanged except `id_text`, which becomes
  `addByRssDownloadItemIdText(feedUrl, itemBundle.item, index)` (if plan 21 already made that
  change inside `autoDownloadEvaluate.ts`, carry it over as is).
- Keep the one `as DTOItem`. Put this constraint comment above it: the object holds only the
  fields download eligibility and the download manager read.
- Doc comment: the partial item a download of one Add by RSS episode is enqueued with; its
  channel id is the feed URL, which is how the download manager recognizes Add by RSS rows.
- In `autoDownloadEvaluate.ts`, delete `mappedAddByRssItemToDto` and call
  `addByRssDownloadItem(channelIdText, itemBundle, index)` in `loadItemsForChannels`.

### `addByRssHomeDetailData.ts`

In `buildAddByRssHomeDetailData`, reuse the existing `guid` local as the key:

```typescript
const itemKey = itemBundle.item.guid ?? String(itemIndex);
// …
downloadItem: addByRssDownloadItem(feed.feedUrl, itemBundle, itemIndex),
id: `${feed.idText}-${itemKey}`,
itemKey,
```

Rename the existing `guid` local to `itemKey`; the title fallback keeps using it. Leave plan 21's
`downloadItemIdText` in place. `addByRssLibraryFeedData.ts` spreads the episode into
`AddByRssLibraryItemRow`, so the Library rows get both fields with no change there.

### `queueRepository.ts`

Change `markAsPlayed`'s `target` parameter type to `MoveNowPlayingToHistoryTarget` (declared above
`addResourceToHistory` in the same file). Body:

```typescript
await addResourceToHistory(context, queueIdText, {
  ...target,
  completed: target.completed ?? true,
});
```

Existing callers pass `{ completed, idText, kind }` and still typecheck.

### `useQueueMutations.ts`

Add, beside the existing functions, and return them from the hook:

```typescript
const addAddByRssToQueue = useCallback(
  async (
    position: 'next' | 'last',
    resourceData: AddByRSSResourceData,
    medium: 'av' | 'music'
  ): Promise<boolean> => { … },
  [buildContext, guard, loadActive, queues, status]
);
const addAddByRssToQueueNext = (resourceData, medium) => addAddByRssToQueue('next', …);
const addAddByRssToQueueLast = (resourceData, medium) => addAddByRssToQueue('last', …);
const markAddByRssAsPlayed = useCallback(
  async (resourceData: AddByRSSResourceData, medium: 'av' | 'music'): Promise<boolean> => { … },
  [buildContext, guard, loadActive, queues, status]
);
```

- Same shape as `addToQueue` / `markAsPlayed`: return `false` unless `status === 'authenticated'`;
  `guard.run` keys `add:${position}:add-by-rss:${hashId}` and `mark:add-by-rss:${hashId}` with
  `hashId = getAddByRSSHashId(resourceData)` (from `@podverse/helpers`, as
  `lib/addByRss/localResourceData.ts` imports it); `mediumId = medium === 'music' ?
  MediumEnum.Music : MediumEnum.Podcast`; `getQueueForMedium(queues, mediumId)`, `false` when
  null.
- Writes: `queueRepository.addAddByRssNext` / `addAddByRssLast(context, queue.id_text,
  resourceData)`, and `queueRepository.markAsPlayed(context, queue.id_text, { completed: true,
  kind: 'add_by_rss', resourceData })`. Then `await loadActive(mediumId)` and return `true`.
- Extend the hook doc comment: Add by RSS items are written with their resource data, because
  they have no catalog id.

### `useHomeRowPlayback.ts`

Move `didOpenQueueHistoryGate` into an exported hook in the same file and call it from
`useHomeRowPlayback`. Behavior is unchanged.

```typescript
/** Opens the gate when the account queue and history are out of reach; true means stop. */
export function useQueueHistoryGate(): () => boolean { … }
```

### `addByRss/useAddByRssItemActions.tsx`

```typescript
export type AddByRssItemActionTarget = {
  feed: MobileAddByRSSFeedRecord;
  itemBundle: AddByRSSMappedFeed['items'][number];
  itemIndex: number;
  mappedFeed: AddByRSSMappedFeed;
};

export function useAddByRssItemActions(): {
  actionNoticeKey: AddByRssItemActionNoticeKey | null;
  addToPlaylist: (target: AddByRssItemActionTarget) => void;
  addToPlaylistSheet: ReactNode;
  markAsPlayed: (target: AddByRssItemActionTarget) => void;
  queue: (target: AddByRssItemActionTarget, position: QueueActionPosition) => void;
};
```

- `AddByRssItemActionNoticeKey` is the union of the four keys in decision 5.
- A private `resolveTarget(target)` builds `resourceData` with
  `toAddByRssItemPlaybackResourceData(feed, mappedFeed, itemBundle, itemIndex)` and the playlist
  target with `resolveAddToPlaylistTarget({ kind: 'add-by-rss', resourceData })`. When that
  returns `null` or a kind other than `'add-by-rss'`, the action does nothing.
- `queue`: `if (didOpenQueueHistoryGate()) return;` then call next or last with
  `playlistTarget.medium`; set `added_to_queue` or `add_error`; in `catch`, `handleGateError`
  first (from `useMembershipGate`), else `add_error`. Same flow as `runQueueAction`.
- `markAsPlayed`: same flow as `runMarkAsPlayedAction` with `markAddByRssAsPlayed`.
- `addToPlaylist`: when `useAuth().status !== 'authenticated'`, `openGate('needs_account')` and
  return; else `requestAddToPlaylist(playlistTarget)`.
- `addToPlaylistSheet` comes from `useAddToPlaylist()` (`screens/library/useAddToPlaylist.tsx`);
  callers render it once.
- Doc comment: the More menu actions for one Add by RSS episode or track, mirroring
  `useHomeRowPlayback` and the podcast Episodes section, written with resource data instead of a
  catalog id. The item's medium picks the queue, playlist kind, and history.

## Tests

- `downloadItem.test.ts` (new; add `'src/lib/addByRss/downloadItem.test.ts'` to the `include`
  list in `apps/mobile/vitest.config.ts`, beside the other `src/lib/addByRss/` entries):
  - an item with a guid and one enclosure yields `id_text` equal to
    `addByRssDownloadItemIdText(...)`, `channel.id_text` equal to the feed URL, and the enclosure
    source URI;
  - an item with no enclosures yields `null`;
  - a `pub_date` given as a `Date` and as an ISO string both yield the ISO string.
- `addByRssHomeDetailData.test.ts`: `itemKey` is the guid when present and the index otherwise;
  `downloadItem.id_text` equals `downloadItemIdText`; a row with no enclosure has
  `downloadItem: null`.
- No hook tests: `useQueueMutations` and the new hook are React Native hooks outside the vitest
  suite (**mobile-test-economics**). Plan 34's Maestro step opens the row More menu.

## Release scratchpad

None for this plan alone. Plans 33 and 34 carry the entries for the actions users see.
