# 02 — Center the placeholder artwork everywhere

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

## Summary

The headphones placeholder sits off-center wherever a caller's class changes `display` on the
placeholder wrapper. Move the centering to an element callers cannot reach, give both shared
image components the same placeholder scale, and prove centering with a screenshot spec. Runs in
parallel with 01. Do not touch web hooks, the API, or mobile.

## Why it breaks

`packages/ui/src/components/image/Image/Image.tsx`, placeholder branch (around line 114):

```tsx
<div
  className={classNames(
    styles.placeholderOuter,
    isFluidGridSlot && styles.placeholderOuterFluid,
    className
  )}
  ...
>
  <NextImage src={placeholderSrc} width={placeholderWidth} height={placeholderHeight} ... />
</div>
```

`.placeholderOuter` in `Image.module.scss` centers with `display: flex`. The caller's `className`
lands on the same element. Responsive variants set `display: block` or `none` to show one size per
breakpoint, which drops the flex centering. Known callers that do this (check each):

- `apps/web/src/styles/components/Common/Media/Podcast/PodcastHeaderImage.module.scss`
  (`.mobile`, `.tablet`, `.desktop`)
- `apps/web/src/styles/components/Common/List/Podcasts/Episodes/ListEpisodeRow.module.scss`
  (`.image`, `.imageMobile`)
- `apps/web/src/styles/components/Common/Item/CommonItemHeader.module.scss`
- `apps/web/src/styles/components/List/Clips/ListClipRow.module.scss`
- The `ListItemChapterRow`, `ListItemSoundbiteRow`, and `ListLiveItemRow` styles
- The parallel `Media/Podcast/...` and `List/...` SCSS trees with the same class names

Find the full list with
`rg -n "display:\s*(block|none|inline)" apps/web/src/styles apps/management-web/src` and keep the
ones whose class reaches an `Image` `className`.

## Changes

### `Image` placeholder

- Keep the outer element as it is: caller `className`, size, border, and `placeholderOuterFluid`.
  The caller still controls visibility and layout.
- Add an inner element, `.placeholderInner`, that fills the outer box and centers the placeholder
  on both axes. Use `display: grid; place-items: center` or flex; it must not depend on the outer
  element's `display`.
- It must work in all three layouts the component supports: fixed width and height, fixed width
  with auto height (`omitFixedHeight`), and the fluid grid slot (`isFluidGridSlot`, width 100%
  with a caller `aspect-ratio`). In the auto height case the inner box may size to the image.
- Remove the centering declarations from `.placeholderOuter` once the inner element owns them.
- No caller SCSS changes should be needed. If a caller sets something on the placeholder image
  itself, fix that caller.

### `ImageNonReact` placeholder

`packages/ui/src/components/image/ImageNonReact/ImageNonReact.tsx` (player and embed artwork)
draws the placeholder at 100% with `object-fit: contain`. Draw it at the same scale `Image` uses
(80% of the box: `(width * 2) / 2.5`), centered on both axes, so the mini player, full player, and
lists match. Keep the loading overlay and fallback order unchanged.

### Unit tests

`packages/ui/src/components/image/Image/Image.test.tsx`:

- The caller `className` is on the outer element; the placeholder image is inside the inner
  centering element.
- The fluid grid slot keeps `placeholderOuterFluid`.

Add an `ImageNonReact` test if one exists for the fallback; otherwise one small test that the
exhausted state renders the scaled placeholder class.

## Screenshot spec

New `apps/web/e2e/image-placeholder-centering.spec.ts`. Top-level `describe`: "Placeholder
artwork centering".

- Force the placeholder by aborting remote artwork requests with `page.route` (match the image
  proxy path and the seeded artwork hosts), so no seed change is needed.
- Visit a podcast page (header and episode rows), an episode page (item header), and a page with
  clip rows. Check mobile (390 px), tablet (820 px), and desktop (1280 px) widths.
- For each visible placeholder, compare the bounding box center of the placeholder image with its
  wrapper's center. They match within 1 px on both axes.
- Take one screenshot per page and width for the report.

Stay within the 10 s budget per test; split pages into separate tests.

## Scratchpad entry

```markdown
## Placeholder artwork is centered everywhere

- Surfaces: web, management-web (shared `Image` and `ImageNonReact` in packages/ui)
- Change: The headphones placeholder is centered on both axes in headers, list rows, and the
  player at every screen width, and the player uses the same placeholder size as lists.
- Who notices: anyone viewing a show or episode without artwork
- Operator steps: none
```

## Done when

- [ ] `Image` centers the placeholder in an inner element; caller classes stay on the outer one
- [ ] `ImageNonReact` placeholder uses the same scale and is centered
- [ ] Unit tests updated; screenshot spec added
- [ ] Scratchpad entry appended

## Operator verification

**Root**

```bash
npm run test -w packages/ui
make e2e_test_web_report_spec SPEC=e2e/image-placeholder-centering.spec.ts,e2e/header-image-lightbox.spec.ts,e2e/header-image-livestream.spec.ts
open .artifacts/e2e-reports/latest/index.html
```
