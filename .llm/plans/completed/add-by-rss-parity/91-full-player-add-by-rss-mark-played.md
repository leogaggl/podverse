# 91 — The full player marks Add by RSS items played and unplayed

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

Row: R57. Mobile only. Paths are under `apps/mobile/` unless they start with `.llm/`.

Run after plan 30 (adds `markAddByRssAsPlayed` to `useQueueMutations` and widens
`queueRepository.markAsPlayed`) and after plans 50 and 51 (they edit `FullPlayerScreen.tsx` and
`e2e/add-by-rss.yaml`). Read each file as it stands.

## Answer: which full player queue actions Add by RSS is missing

The full player has two actions that write to the account queue and history:

- **Add to Playlist** (`FullPlayerActionRow`, `disableAddToPlaylist={addToPlaylistTarget === null}`)
  already works for Add by RSS: `resolveAddToPlaylistTarget` in
  `src/components/player/fullPlayerRows.ts` returns `{ kind: 'add-by-rss', medium, resourceData }`.
- **Mark as Played / Mark as Unplayed** (`FullPlayerMoreSheet`, item `full-player-more-mark-played`)
  calls `handleMarkAsPlayed` in `src/screens/player/FullPlayerScreen.tsx`, the only caller of
  `resolveQueueMutationTarget`. For `'add-by-rss'` that resolver returns `null`, so the handler
  returns at once. The menu item is shown and does nothing.

The full player offers no Queue Next or Queue Last for the playing item, for database items
either. The parity source is the database item in the same screen, so R57 means Mark as Played
and Mark as Unplayed. The API's `POST /queue/:queue_id_text/item-add-by-rss/history` already
accepts `completed` (`addItemAddByRSSToHistory` in
`apps/api/src/controllers/queue/queueResourceItemAddByRSS.ts`), so no server change.

## Locked decisions

1. **`FullPlayerQueueMutationTarget` becomes a union.** The existing shape stays for database
   items. Add by RSS adds `{ kind: 'add-by-rss'; medium: 'av' | 'music'; resourceData }`. The
   medium comes from `addToPlaylistMediumFromChannel(target)` (same file), the rule Add to
   Playlist and plan 30 use: `resourceData.medium_id === MediumEnum.Music` is music, everything
   else AV.
2. **Add by RSS livestreams resolve to `null`** (`isAddByRssLivestreamResourceData` from
   `src/lib/addByRss/resourceData.ts`). Livestreams have no Add by RSS now-playing or history row:
   `nowPlayingResourceFromTarget` and `playbackTargetToHistoryTarget` skip them.
3. **The More sheet hides Mark as Played when there is no target.** New prop `canTogglePlayed`,
   placed like `canToggleSubscription`. `FullPlayerScreen` passes
   `queueMutationTarget !== null`. A no-op menu item no longer shows. This also covers a database
   livestream with no item, which resolves to `null` today.
4. **The resolver runs once per render, not in the handler.** `FullPlayerScreen` computes
   `const queueMutationTarget = useMemo(() => resolveQueueMutationTarget(activeTarget),
   [activeTarget]);` next to `addToPlaylistTarget`. `handleMarkAsPlayed` and the More sheet both
   read it.
5. **Plan 30's `markAddByRssAsPlayed` gains `completed`.** Its signature becomes
   `(resourceData: AddByRSSResourceData, medium: 'av' | 'music', completed = true)`. It passes
   `completed` to `queueRepository.markAsPlayed` in place of the literal `true`. The guard key
   stays `mark:add-by-rss:${hashId}`. Plan 30's callers pass two arguments and are unchanged.
6. **Gate, notices, and toggle state are shared.** The `queue_history_sync` gate, `isMarkingPlayed`,
   `isMarkedPlayed` (reset when `activeTarget` changes), and the three notice keys
   (`features.history.marked_as_played`, `marked_as_unplayed`, `mark_as_played_error`) apply to
   both branches unchanged. Only the write call branches.

## Files

| File                                             | Change                                     |
| ------------------------------------------------ | ------------------------------------------ |
| `src/components/player/fullPlayerRows.ts`        | Union target; Add by RSS case              |
| `src/components/player/fullPlayerRows.test.ts`   | New cases                                  |
| `src/hooks/useQueueMutations.ts`                 | `completed` on `markAddByRssAsPlayed`      |
| `src/components/player/FullPlayerMoreSheet.tsx`  | `canTogglePlayed` prop                     |
| `src/screens/player/FullPlayerScreen.tsx`        | Memoized target; branch the write          |
| `e2e/add-by-rss.yaml`                            | Mark as Played from the full player        |

`FullPlayerScreen.tsx` is large. Anchor on `handleMarkAsPlayed`, `addToPlaylistTarget`, and the
`<FullPlayerMoreSheet` element. Do not read it whole.

## Implementation

### `fullPlayerRows.ts`

Replace the type:

```typescript
export type FullPlayerQueueMutationTarget =
  | { idText: string; kind: QueueMutationKind; mediaType: QueueMutationMediaType }
  | { kind: 'add-by-rss'; medium: 'av' | 'music'; resourceData: AddByRSSResourceData };
```

`AddByRSSResourceData` is already imported for `FullPlayerAddToPlaylistTarget`. In
`resolveQueueMutationTarget`, case `'add-by-rss'`:

```typescript
case 'add-by-rss':
  return isAddByRssLivestreamResourceData(target.resourceData)
    ? null
    : {
        kind: 'add-by-rss',
        medium: addToPlaylistMediumFromChannel(target),
        resourceData: target.resourceData,
      };
```

Import `isAddByRssLivestreamResourceData` from `../../lib/addByRss/resourceData`.

### `useQueueMutations.ts`

Apply decision 5 to `markAddByRssAsPlayed`. The `useCallback` deps do not change.

### `FullPlayerMoreSheet.tsx`

Add `canTogglePlayed: boolean;` to `FullPlayerMoreSheetProps` (alphabetical, after
`canToggleSubscription`) and to the destructured props. Wrap the `mark-played` item the way the
`subscription` item is wrapped:

```typescript
...(canTogglePlayed
  ? [
      {
        key: 'mark-played',
        // … the existing disabled, label, onPress, testID …
      },
    ]
  : []),
```

Add `canTogglePlayed` to the `useMemo` deps.

### `FullPlayerScreen.tsx`

- Under `const addToPlaylistTarget = resolveAddToPlaylistTarget(activeTarget);`, add the memoized
  `queueMutationTarget` (decision 4).
- `const { markAsPlayed } = useQueueMutations();` becomes
  `const { markAddByRssAsPlayed, markAsPlayed } = useQueueMutations();`.
- `handleMarkAsPlayed`: drop the `resolveQueueMutationTarget(activeTarget)` call. Use
  `const target = queueMutationTarget;`. Replace the `markAsPlayed(...)` call with:

```typescript
const marked =
  target.kind === 'add-by-rss'
    ? await markAddByRssAsPlayed(target.resourceData, target.medium, nextCompleted)
    : await markAsPlayed(target.idText, target.kind, target.mediaType, nextCompleted);
```

  In the deps, replace `activeTarget` with `queueMutationTarget` and add `markAddByRssAsPlayed`.
  The rest of the handler stays as it is.
- `<FullPlayerMoreSheet`: add `canTogglePlayed={queueMutationTarget !== null}`.

## Tests

**`fullPlayerRows.test.ts`** (existing, already in `vitest.config.ts`). Add
`it('resolves queue mutation targets for Add by RSS', …)`. Import `resolveQueueMutationTarget`
and `MediumEnum`:

- An Add by RSS target with `{ feed_url, guid, title }` and no `medium_id` →
  `{ kind: 'add-by-rss', medium: 'av', resourceData }` (the same object).
- `medium_id: MediumEnum.Music` → `medium: 'music'`.
- Resource data with `liveItem: {}` → `null`.
- One database case stays covered: an `item-music` target →
  `{ idText, kind: 'item', mediaType: 'tracks' }`.

**Maestro `e2e/add-by-rss.yaml`.** Plan 51 opens the full player after the
`assert-add-by-rss-now-playing.js` script and waits for `full-player-title-link`. Insert after
that wait and before plan 51's `tapOn: full-player-title-link`:

```yaml
# Mark as Played works for an Add by RSS episode: the next open offers Mark as Unplayed, which
# the player shows only after the history write succeeds.
- tapOn:
    id: full-player-more
- extendedWaitUntil:
    visible:
      id: full-player-more-mark-played
      text: "Mark as Played"
    timeout: ${TIMEOUT_FASTER}
- tapOn:
    id: full-player-more-mark-played
- tapOn:
    id: full-player-more
- extendedWaitUntil:
    visible:
      id: full-player-more-mark-played
      text: "Mark as Unplayed"
    timeout: ${TIMEOUT_SLOW}
- takeScreenshot: add-by-rss-full-player-marked-played
- tapOn:
    id: full-player-more-sheet-cancel
- assertNotVisible:
    id: full-player-more-sheet
```

`MoreMenu` closes itself before it runs an item's `onPress`, so the second tap on
`full-player-more` reopens the sheet. The labels are the en-US catalog values of
`features.history.mark_as_played` and `mark_as_unplayed`. `player-screen.yaml` uses the same
`full-player-more`, `full-player-more-mark-played`, and `full-player-more-sheet-cancel` ids. If
plan 51's wait step is not in the file, insert directly after the `runScript` block, preceded by
`- tapOn: { id: mini-player }` and a `full-player-screen` wait.

## Release scratchpad

```markdown
## Mobile full player marks Add by RSS episodes played

- Surfaces: mobile
- Change: Mark as Played and Mark as Unplayed in the full player's More menu now work for
  episodes and tracks added by RSS. They write to the account's podcast or music history as the
  item's medium decides. Before, the menu item did nothing for those items. The More menu no
  longer shows Mark as Played for items that cannot be marked, such as livestreams.
- Who notices: signed-in listeners playing feeds added by RSS on the phone
- Operator steps: none
```
