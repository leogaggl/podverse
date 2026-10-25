**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 11 — Add by RSS adjacent-row walk in `@podverse/playback-core`

Add by RSS items do not use the auto-queue buffer. Web walks a **list context**: the feed's item
ids in list order, plus the index of the item playing. Next steps to the newer neighbor, Previous
to the older one. The stepping and the context build are pure. Only the item lookups (IndexedDB on
web, SQLite on mobile) and livestream ordering differ by surface. This plan moves the pure part
into `@podverse/playback-core`, so mobile (area C) gets the same next and previous through the
feed as web, and area D can read the next N ids for the native window.

Parity source: `apps/web/src/hooks/useAddByRSSPlayNext.tsx`,
`apps/web/src/hooks/useAddByRSSPlayPrevious.tsx`,
`apps/web/src/utils/addByRSS/resolveListContextFromCurrentItem.ts`, and the
`AddByRSSListContextState` type in `apps/web/src/contexts/AddByRSSListContext.tsx`. This plan
edits only `packages/playback-core/**` (plus the release scratchpad). Web moves onto it in area B,
mobile in area C.

## Rows

R4, R22

## Runs after

10

## Files

packages/playback-core/src/addByRSSListWalk.ts
packages/playback-core/src/__tests__/addByRSSListWalk.test.ts
packages/playback-core/src/index.ts
packages/playback-core/package.json
packages/playback-core/PACKAGES-PLAYBACK-CORE.md
release-notes/scratchpad.md

## What stays per surface

- Reading items by id text and loading them into the player (`getAddByRSSItemByIdText`,
  `getAddByRSSLivestreamByIdText`, `playAddByRSS` on web; the SQLite repository and playback
  provider on mobile).
- Holding the list context (web `AddByRSSListContext` React context; mobile chooses its own home
  in area C).
- Livestream ordering. Web uses `selectChannelOrderedLiveItems`; mobile has
  `apps/mobile/src/lib/addByRss/liveRows.ts`. The caller passes already-ordered livestream ids.

## Contract (`src/addByRSSListWalk.ts`)

Names match web's so area B swaps imports without renames.

```typescript
export type AddByRSSListSortOrder = 'recent' | 'oldest';

export type AddByRSSListContextState = {
  feedIdText: string;
  itemIdTexts: string[];
  currentIndex: number;
  /** 'recent' = newest first (index 0 is newest); 'oldest' = oldest first. Absent means 'recent'. */
  sortOrder?: AddByRSSListSortOrder;
};

export type AddByRSSListEpisode = { idText: string; pubDateMs: number };

export type AddByRSSAdjacentDirection = 'next' | 'previous';

export type AddByRSSAdjacentStep =
  | { kind: 'none'; clearContext: boolean }
  | { kind: 'step'; idText: string; nextContext: AddByRSSListContextState | null };

export function orderAddByRSSEpisodeIdTexts(episodes: readonly AddByRSSListEpisode[], sortOrder: AddByRSSListSortOrder): string[];

export function buildAddByRSSListContext(params: {
  feedIdText: string;
  orderedIdTexts: readonly string[];
  currentIdText: string;
  sortOrder: AddByRSSListSortOrder;
}): AddByRSSListContextState | null;

export function resolveAddByRSSAdjacentStep(
  context: AddByRSSListContextState | null,
  direction: AddByRSSAdjacentDirection
): AddByRSSAdjacentStep;

export function selectAddByRSSAdjacentIdTexts(
  context: AddByRSSListContextState | null,
  direction: AddByRSSAdjacentDirection,
  limit: number
): string[];
```

## Behavior

All of it matches web as it stands.

- `orderAddByRSSEpisodeIdTexts`: copy the input, sort by `pubDateMs` descending for `'recent'` and
  ascending for `'oldest'`, return the id texts. Do not mutate the input. Mirrors the episode branch
  of `resolveAddByRSSListContextFromCurrentItem`.
- `buildAddByRSSListContext`: null when `orderedIdTexts` is empty or does not contain
  `currentIdText`. Otherwise `{ feedIdText, itemIdTexts: [...orderedIdTexts], currentIndex, sortOrder }`.
- Step offset: with `sortOrder` `'oldest'`, `next` is `+1` and `previous` is `-1`; with `'recent'`
  or absent, `next` is `-1` and `previous` is `+1`. So Next is always the newer neighbor and
  Previous the older one, whichever way the list is sorted.
- `resolveAddByRSSAdjacentStep`:
  1. Null context or empty `itemIdTexts`: `{ kind: 'none', clearContext: false }`.
  1. Target index out of range: `next` gives `{ kind: 'none', clearContext: true }`, `previous`
     gives `{ kind: 'none', clearContext: false }` (web clears the context at the newest end on
     Next only).
  1. The id at the target index is missing or an empty string: `{ kind: 'none', clearContext: false }`.
  1. Otherwise `{ kind: 'step', idText, nextContext }`. `nextContext` is null when the target is
     the last index in that direction (`next`: the newest end; `previous`: the oldest end).
     Otherwise it is `{ ...context, currentIndex: target, sortOrder: context.sortOrder ?? 'recent' }`.
- `selectAddByRSSAdjacentIdTexts`: up to `limit` ids walking from `currentIndex` in the step
  direction, stopping at the list end or at the first missing or empty id. `limit <= 0` or a null
  context gives `[]`. This is for area D's native window. It reads ahead and does not change any
  context.

Callers apply `nextContext` only after the item at `idText` actually loaded, as web does today.
When the lookup fails, they leave the context alone. On `clearContext: true` they set the context
to null.

## Constraints

- Pure TypeScript, no imports beyond what the types need (none from `@podverse/helpers` are
  required). Named exports, `===` only, no `as`, semicolons, single quotes, `.js` relative
  specifiers.
- `src/index.ts`: add one export block for this module after the block plan 10 added.
- `package.json` `exports`: add `./addByRSSListWalk` with `types` and `default` entries, matching
  the existing subpath entries.
- `PACKAGES-PLAYBACK-CORE.md` § What lives here: one bullet for the Add by RSS list walk, saying
  storage lookups and livestream ordering stay with each surface.

## Tests

`packages/playback-core/src/__tests__/addByRSSListWalk.test.ts` (Vitest):

- `orderAddByRSSEpisodeIdTexts` sorts newest first for `'recent'` and oldest first for `'oldest'`
  without mutating its input.
- `buildAddByRSSListContext` returns null for an empty list and for a missing current id, and the
  right `currentIndex` otherwise.
- `resolveAddByRSSAdjacentStep` for both sort orders: Next moves to the newer neighbor and
  Previous to the older one. The step onto the end index returns `nextContext: null`. Next past
  the newest end clears the context; Previous past the oldest end does not. A null context returns
  `none` without clearing.
- `selectAddByRSSAdjacentIdTexts` honors `limit`, stops at the list end, and returns `[]` for a null
  context.

## Release scratchpad

```markdown
## Shared Add by RSS next and previous walk in playback-core

- Surfaces: packages (`@podverse/playback-core`)
- Change: new exports for the Add by RSS list walk: build a feed list context from ordered item ids, order episodes by publish date, step to the newer (Next) or older (Previous) item with the same end-of-list rules web uses, and read the next N ids ahead. Storage lookups and livestream ordering stay with each client. Available from the package root and the `./addByRSSListWalk` subpath. No caller changes in this entry.
- Who notices: developers of web, mobile, and other clients; no user-visible change on its own
- Operator steps: none
```
