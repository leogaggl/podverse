**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 11 — Shared `Image`: remote artwork always loads lazily and decodes asynchronously

## Rows

R2, R3

## Runs after

none

## Files

packages/ui/src/components/image/Image/Image.tsx
packages/ui/src/components/image/Image/Image.test.tsx

## Tests

- Unit (Vitest, `packages/ui`): two new cases in
  `packages/ui/src/components/image/Image/Image.test.tsx` (§ Tests detail below).

## Release scratchpad

none. The rendered attributes match what `next/image` 16.4 already emits by default; this makes
them part of the shared component's contract so a dependency change cannot drop them.

## What the code does today (answers R2 and R3)

The operator's answer for R3 is client only: images lazy-load and decode asynchronously in
fixed-size slots, so they cannot block input or shift layout. No proxy or resize, and no GIF
stills. Research shows the web app already does this for every Browse list:

- **Lazy loading and async decode.** Every list row and grid tile renders artwork through
  `SkeletonFlashImage` or `ImagesPerView` (both wrap `Image` in
  `packages/ui/src/components/image/`). `Image` renders `next/image`. In Next.js 16.4,
  `getImgProps` (`node_modules/next/dist/shared/lib/get-img-props.js`) defaults
  `decoding = 'async'` and sets `loading="lazy"` unless `priority` or `preload` is set. In
  `apps/web` and `packages/ui`, only the brand logos (`NavBarBrand`, `SideBarBrand`) pass
  `priority`. `ImagesPerView` mounts a desktop and a mobile image; the hidden one has
  `display: none`, so a lazy image there is never fetched.
- **Fixed-size slots.** Every remote artwork caller passes both `width` and `height`; only the
  local brand logos leave out `height`. Rows reserve the box through the `width` and `height`
  attributes plus `object-fit: cover` (`ListEpisodeRow.module.scss` `.image` / `.imageMobile`).
  Grid tiles use `width: 100%`, `aspect-ratio: 1 / 1`, and `object-fit: cover`
  (`ListGridNode.module.scss` `.image`). An oversized or odd-ratio file, GIF included, fills
  its box and cannot resize it.
- **Placeholder in the slot.** `SkeletonFlashImage` tints the box with `--border-color-opaque`
  until the file loads.

So the slow chip (plan 10) is not caused by images. This plan only makes the lazy-and-async
contract explicit in `Image`, where today it depends on a `next/image` default.

## What changes

In `packages/ui/src/components/image/Image/Image.tsx`, on the remote `<NextImage key=…
src={finalSrc} …>` at the end of the component (not the placeholder branch, which renders the
app's local placeholder asset):

```tsx
loading={priority === true ? undefined : 'lazy'}
decoding="async"
```

`next/image` throws when `priority` and `loading="lazy"` are both set, which is why `loading` is
left out when `priority` is true.

Extend the JSDoc on the `priority` prop in `ImageProps` to say: without it, the image loads lazily
and decodes asynchronously, so remote artwork never holds up input or the frame that paints it.
Set it only for above-the-fold branding. Keep it to two lines, describing the behavior as it
stands (**comments-future-forward**).

Not in this plan:

- `fetchPriority="low"` on list artwork. Remote artwork comes from third-party hosts on separate
  connections, so a priority hint does not arbitrate against the page's own server requests.
  Adding it would mean editing about thirty list callers for no measurable gain.
- Any server proxy, resize, or GIF-to-still conversion. The operator answer rules these out.
- `content-visibility` on list rows. Browsers already stop animating images that are off-screen.
  The rule would also change row geometry that E2E bounding-box checks rely on.

## Tests detail

In `packages/ui/src/components/image/Image/Image.test.tsx`, the `next/image` mock renders a plain
`<img>`. Extend its props type with `loading?: string`, `decoding?: string`, and
`priority?: boolean`. Forward them as `data-loading`, `data-decoding`, and
`data-priority={props.priority === true ? 'true' : 'false'}`. Do not spread unknown props onto
`<img>`; React warns about `priority`.

Add, after the `'uses raw URL when proxy is disabled'` case:

1. `'loads remote artwork lazily and decodes it asynchronously when priority is not set'`. Render
   `<Image alt="Episode" height={64} src="https://cdn.example.com/a.gif" width={64} />` with the
   default runtime. Expect `data-loading` to be `lazy` and `data-decoding` to be `async`.
1. `'does not ask for lazy loading when priority is set'`. Render the same with `priority`.
   Expect `data-priority` to be `true`, `data-loading` to be absent (`getAttribute` returns
   `null`), and `data-decoding` to be `async`.

The existing cases stay as they are.

## Done when

- The remote image `Image` renders always carries `decoding="async"`. It carries
  `loading="lazy"` whenever `priority` is not set.
- The two new unit cases pass with the existing ones.
