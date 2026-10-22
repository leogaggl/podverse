# 50 — Player item title opens the channel, then the item

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

Rows: R44 (directory items), R45. Mobile only. Web player links stay as they are.

Add by RSS titles stay unlinked here. Plan 51 gives an Add by RSS episode the same stack.
This plan does not need plan 33's route. Do not run it in the same phase as plan 51 (same
files) or plan 40 (the tab-stack rule).

Parity source: `parseHomeContentStackPath` in `src/navigation/notificationStack.ts` builds
Home root, then the podcast, then the episode. Copy that order. Do not call the function: it
parses Home paths only.

## Answers

**R44.** The item title calls `openFullPlayerContent` with one screen and `initial: false`, so
the tab root sits under the item and the channel does not. The destination becomes the tab
root, then the channel, then the item. Back from the item opens the channel. Back from the
channel opens the tab root.

**R45.** The channel title still calls `openFullPlayerContent` for one screen. Home versus
Browse stays `playerContentStack`. A follow is
`getChannelActionChrome(channelIdText)?.isSubscribed === true` inside `openLinkedContent`
(`FullPlayerScreen.tsx`). A finished download is not part of that check. The request's
"subscribed to and downloaded" is this follow check. Do not add a download check.

## Locked decisions

1. **Three routes, replacing that tab's stack:** `[tab root, channel, item]`, focused on the
   item. Earlier screens on that tab are dropped. Other tabs stay. `navigation.navigate` to
   `MainTabs`. Do not `CommonActions.reset` the root. Replacing the root screen tears the
   Android tree down; `resolveMobileDeepLinkAction` navigates for that reason.
2. **The screen the title already opens stays the item route.** Insert the channel under it:

   | Playing | Item route | Channel under it |
   | --- | --- | --- |
   | Episode, chapter, soundbite, video, livestream with an item | `EpisodeDetail` | `PodcastDetail` |
   | Clip | `ClipDetail` | `PodcastDetail` |
   | Track | `TrackDetail` | `AlbumDetail` or `ArtistDetail`, from `resolveFullPlayerChannelLink` |

3. **One stack for the pair**, `playerContentStack({ isSubscribed, kind: item.kind })`. The
   channel press keeps passing the channel's kind. For every pair above, both kinds pick the
   same stack. Home on More still uses `MoreOverflowHome` with `initial: false`, so More's
   root stays underneath. Browse uses `MoreOverflowBrowse` the same way.
4. **No channel link means today's one-screen open.** Do not invent a channel.
5. **Preview params** go through `buildPodcastDetailParams`, `buildAlbumDetailParams`,
   `buildArtistDetailParams`, and `buildTrackDetailParams`. Episode and clip routes stay
   `{ episodeId }` and `{ clipId }`. No new catalog keys.

## Files

Paths under `apps/mobile/` unless noted. `FullPlayerScreen.tsx` and `navigation/index.tsx` are
large: Grep the anchor and read that window. Do not read either file straight through.

| File | Anchor | Change |
| --- | --- | --- |
| `src/screens/player/fullPlayerContentLink.ts` | `playerContentStack` | `playerItemStackRoutes` |
| `src/screens/player/fullPlayerContentLink.test.ts` | `playerContentStack` describe | Route-order cases. Not in the Vitest include list today |
| `vitest.config.ts` | `fullPlayerLayout.test.ts` | Include the content-link test beside it |
| `src/screens/player/FullPlayerScreen.tsx` | `openLinkedContent`, `full-player-title-link` | Item press passes both targets |
| `src/navigation/index.tsx` | `openFullPlayerContent`, `onOpenContent` | `openFullPlayerItem` |
| `.cursor/rules/mobile-tab-stack-isolation.mdc` | the full-player bullet | Item title stacks the channel under the item |
| `e2e/player-screen.yaml` | close steps after the channel-link round trip | Back stack |

## Implementation

### Route list

In `fullPlayerContentLink.ts`:

```typescript
export type PlayerStackRoute = {
  name: string;
  params?: object;
};

/** Tab root, then the channel, then the item. The item is the focused route. */
export const playerItemStackRoutes = (
  rootName: string,
  channel: PlayerStackRoute,
  item: PlayerStackRoute
): PlayerStackRoute[] => {
  return [{ name: rootName }, channel, item];
};
```

### `FullPlayerScreen.tsx`

Add `onOpenItem: (request: FullPlayerItemOpenRequest) => void` beside `onOpenContent`.

```typescript
export type FullPlayerItemOpenRequest = {
  channel: FullPlayerContentTarget;
  item: FullPlayerContentTarget;
  stack: PlayerContentStack;
};
```

Put that type in `fullPlayerContentLink.ts` next to `FullPlayerOpenRequest`.

Keep the `isSubscribed` expression already in `openLinkedContent`. Channel press still calls
`onOpenContent` with `playerContentStack({ isSubscribed, kind: channelLink.kind })`. Title
press: when `channelLink === null`, `onOpenContent` with the item, as today. Otherwise
`onOpenItem` with `channel: channelLink`, `item: titleLink`, and
`playerContentStack({ isSubscribed, kind: titleLink.kind })`.

### `navigation/index.tsx`

`openFullPlayerItem(navigation, request, visibleTabIds)`:

1. Channel route from `request.channel`. `podcast`, `album`, and `artist` use the matching
   `build*DetailParams` with `idText`, `imageUrl`, and `name`. Any other kind, including
   `add-by-rss`: call `openFullPlayerContent` with the item and return. Plan 51 adds the Add
   by RSS case in front of that fallback.
2. Item route. `episode` → `{ name: 'EpisodeDetail', params: { episodeId } }`. `clip` →
   `{ name: 'ClipDetail', params: { clipId } }`. `track` → `buildTrackDetailParams` on
   `TrackDetail`. Any other kind: `openFullPlayerContent` and return.
3. Root name: `HOME_STACK_ROUTES.HomeRoot` or `BROWSE_STACK_ROUTES.BrowseRoot`.
4. `routes = playerItemStackRoutes(rootName, channelRoute, itemRoute)`.
5. Same Home / Browse / More split as `openFullPlayerContent`, with this params object
   instead of one screen:

```typescript
const stackParams = { state: { index: routes.length - 1, routes } };
```

   Home visible: `{ params: stackParams, screen: 'Home' }`. Home on More uses
   `initial: false`, `params: stackParams`, and `screen: MORE_STACK_ROUTES.MoreOverflowHome`,
   nested under `screen: 'More'`. Browse uses `'Browse'` and `MoreOverflowBrowse`.

Wire `onOpenItem` beside `onOpenContent` on `FullPlayerScreen` (Grep `onOpenContent`).

If the typed `navigate` rejects `routes`, one assertion on that array at this call, with a
comment that the switch above built each route. Do not assert anywhere else.

### Rule

Replace only the full-player bullet in `mobile-tab-stack-isolation.mdc`. Plan 40 edits a
different bullet; leave that edit in place.

```markdown
- The full player's item title and channel title are the exception. A directory follow opens on
  Home. Content this device does not follow opens on Browse. Add by RSS is a follow, so those
  links open Home's add-by-rss detail. The item title opens the channel page and then the item
  page on that same stack, so Back from the item returns to the channel. The channel title opens
  the channel page only. A flow that starts in Search, Library, or Browse still pushes on that
  tab's own stack.
```

## Tests

Add `'src/screens/player/fullPlayerContentLink.test.ts'` to `vitest.config.ts` beside
`fullPlayerLayout.test.ts`. Without that line the file does not run.

Call `playerItemStackRoutes` with root `'HomeRoot'`, a `PodcastDetail` route whose params
are `{ podcastId: 'show-1' }`, and an `EpisodeDetail` route whose params are
`{ episodeId: 'ep-1' }`. The result is the root (no params), then the podcast, then the
episode. One more case uses `'BrowseRoot'`.

`e2e/player-screen.yaml`. After the channel-link round trip has reopened
`full-player-screen`, and before the close `runFlow`:

```yaml
- tapOn:
    id: full-player-title-link
- extendedWaitUntil:
    visible:
      id: episode-detail-screen
    timeout: ${TIMEOUT_FAST}
- tapOn:
    id: stack-header-back
- extendedWaitUntil:
    visible:
      id: podcast-detail-screen
    timeout: ${TIMEOUT_FAST}
- tapOn:
    id: stack-header-back
- extendedWaitUntil:
    visible:
      id: mini-player
    timeout: ${TIMEOUT_FAST}
- tapOn:
    id: mini-player
- extendedWaitUntil:
    visible:
      id: full-player-screen
    timeout: ${TIMEOUT_SLOW}
```

`TIMEOUT_FAST` because this flow already showed both screens. `TIMEOUT_SLOW` matches the
reopen already in this file. The close steps still need the full player.

## Release scratchpad

```markdown
## Player item title opens the channel first

- Surfaces: mobile
- Change: Tapping the item title on the full player opens that item's channel and then the
  item, so Back returns to the channel. The channel title still opens only the channel, on
  Home when this device follows the show and on Browse when it does not.
- Who notices: anyone who taps the item title in the full player
- Operator steps: none
```
