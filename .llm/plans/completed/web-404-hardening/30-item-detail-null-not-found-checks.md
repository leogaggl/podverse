**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# Item detail routes: drop entity-null `notFound()` checks

Re-check of the item detail pages. After plan 10 wraps the SEO fetchers, an unknown id
already becomes `notFound()` inside the fetcher. This plan deletes the page-body checks
that test the fetcher result for null, and leaves every other branch as it is.

Do not edit `apps/web/src/lib/seo/fetchers.ts`, `loadOrNotFound`, or
`apps/web/e2e/detail-route-not-found.spec.ts`. Do not call `loadOrNotFound` from a page.
The pages already await the wrapped fetchers.

## Rows

R18, R19, R20, R21, R22, R23, R24, R25, R29, R30, R31, R32

## Runs after

none

## Files

apps/web/src/app/clip/[clip_id]/page.tsx
apps/web/src/app/chapter/[item_chapter_id_text]/page.tsx
apps/web/src/app/official-clip/[item_soundbite_id]/page.tsx

## Re-check

Item detail `page.tsx` files under `apps/web/src/app`, excluding embed, Add by RSS, and
`/clip/edit` (area D). Each entity endpoint below answers 404 for a missing row
(`handleReturnDataOrNotFound` or `res.status(404)`), and the matching `req*` returns
`Promise<DTO…>` with no `| null`. A 404 throws. It does not return null. Plan 10 turns
that throw into `notFound()` inside the fetcher.

| Route | Page body | Edit |
| --- | --- | --- |
| `/episode/[item_id]` | `getItemForSeoPage`, then `getChannelForItemPage`. No null check. | none |
| `/track/[item_id]` | same as episode | none |
| `/podcast/livestream/[item_id]` | `getItemForSeoPage`, then `getChannelForSeoPage` | none |
| `/music/livestream/[item_id]` | same as the podcast livestream page | none |
| `/clip/[clip_id]` | `getClipForSeoPage`, then item, then channel, inside a try | remove three entity-null checks |
| `/chapter/[item_chapter_id_text]` | `getItemChapterForSeoPage`, then item, then channel | remove two entity-null checks |
| `/official-clip/[item_soundbite_id]` | `getItemSoundbiteForSeoPage`, then item, then channel | remove two entity-null checks |

No other dynamic item detail page exists in that set. Client components under those
folders render props the page already loaded. They do not await an API call.

### Leave these alone

- **`generateMetadata` on every route above.** Each one already try/catches. Episode and
  track return `buildNoindexMetadata()`. The others return `{}`, and the clip metadata
  function also returns noindex for a removed clip (`isRemovedClipHttpError`) or for a
  clip with no item. The catch receives the not-found signal and still returns that
  fallback. The page body is what renders Not Found (R30).
- **`permanentRedirectIfMerged`** at the top of the episode and track page and their
  metadata. It calls `reqIdentityResolve`. `POST /identity/resolve` answers 200 with an
  empty `items` list when the id is unknown (`channel-merge-redirect.integration.test.ts`
  sends `'missing-item'`). It does not 404. Do not wrap it in `loadOrNotFound`.
- **`enforceCanonicalItemRoute`** on episode and track, after the item and channel load.
  It redirects to the other medium's path. It is not a 404 mapping.
- **Livestream pages do not call `permanentRedirectIfMerged`.** Do not add it.
- **Merged item is HTTP 410, not 404.** `ItemController.getByIdOrIdText` calls
  `sendMergedInto`, which sends 410 and `{ merged_into }`. `loadOrNotFound` rethrows
  410. Do not catch that on the episode or track page.
- **Clip removed is HTTP 410 with `{ removed: true }`.** `isRemovedClipHttpError` in
  `apps/web/src/lib/clip/removedClip.ts`. The clip page catch returns
  `<RemovedClipPage kind="visitor" />` for that error and rethrows everything else,
  including the not-found signal. Keep the catch. Keep the visitor-header short-circuit
  (`CLIP_REMOVED_REQUEST_HEADER`) and the owner branch `isRemovedSource(ssrClip)`.
- **Nested relation missing on a 200 body.** `DTOClip.item`, `DTOItemSoundbite.item`,
  and `DTOItemChapter.item_chapters_feed` (and its `item`) are optional. The clip and
  soundbite controllers can answer 200 without an item. The chapter controller answers
  404 when the parent item is missing, and the DTO still types the relation as optional.
  The page already treats that missing relation as not found. Keep those checks (R31,
  R32).
- **`getChannelForItemPage`** returns `item.channel` when the item carries one, and
  otherwise calls `getChannelForSeoPage`. Episode and track need no null check on the
  channel.

## Implementation

Edit only the default page function in each file. Do not change imports: `notFound` stays
in use on all three. Do not change `generateMetadata`.

### 1. `apps/web/src/app/clip/[clip_id]/page.tsx`

Replace the `try` body inside `ClipPage` so it is exactly this. The `catch` stays as it
is in the file today (410 removed → visitor page, otherwise `throw error`).

```tsx
  try {
    const ssrClip = await getClipForSeoPage(clip_id);

    if (isRemovedSource(ssrClip)) {
      return <RemovedClipPage kind="owner" clip={ssrClip} />;
    }

    if (!ssrClip.item) {
      return notFound();
    }

    const ssrItem = await getItemForSeoPage(ssrClip.item.id_text);
    const ssrChannel = await getChannelForSeoPage(ssrItem.channel_id);

    return <ClipPageClient ssrChannel={ssrChannel} ssrItem={ssrItem} ssrClip={ssrClip} />;
  }
```

Deleted: `if (!ssrClip)`, `if (!ssrItem)`, and `if (!ssrChannel)`.

### 2. `apps/web/src/app/chapter/[item_chapter_id_text]/page.tsx`

Replace the body of `ChapterPage` after `const { item_chapter_id_text } = await params;`
with:

```tsx
  const ssrItemChapter = await getItemChapterForSeoPage(item_chapter_id_text);

  if (!ssrItemChapter.item_chapters_feed?.item) {
    return notFound();
  }

  const ssrItem = await getItemForSeoPage(ssrItemChapter.item_chapters_feed.item.id_text);
  const ssrChannel = await getChannelForSeoPage(ssrItem.channel_id);

  return (
    <ChapterClient ssrChannel={ssrChannel} ssrItem={ssrItem} ssrItemChapter={ssrItemChapter} />
  );
```

Deleted: `if (!ssrItem)` and `if (!ssrChannel)`. The `item_chapters_feed?.item` check stays.
It narrows the optional relation before `id_text` is read.

### 3. `apps/web/src/app/official-clip/[item_soundbite_id]/page.tsx`

Replace the body of `OfficialClipPage` after
`const { item_soundbite_id } = await params;` with:

```tsx
  const ssrItemSoundbite = await getItemSoundbiteForSeoPage(item_soundbite_id);

  if (!ssrItemSoundbite.item) {
    return notFound();
  }

  const ssrItem = await getItemForSeoPage(ssrItemSoundbite.item.id_text);
  const ssrChannel = await getChannelForSeoPage(ssrItem.channel_id);

  return (
    <OfficialClipClient
      ssrChannel={ssrChannel}
      ssrItem={ssrItem}
      ssrItemSoundbite={ssrItemSoundbite}
    />
  );
```

Deleted: `if (!ssrItem)` and `if (!ssrChannel)`. The `if (!ssrItemSoundbite.item)` check stays.

## Tests

none. Plan 10's `apps/web/e2e/detail-route-not-found.spec.ts` already covers an unknown
episode id. These edits remove branches that cannot run after a throwing fetch. A visitor
cannot reach them, so they need no new spec. Do not add cases to that spec.

## Release scratchpad

none
