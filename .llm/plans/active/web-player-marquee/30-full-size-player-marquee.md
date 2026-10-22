**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 30 — Full-size player lines scroll with `MarqueeText`

The web full-size player (`MediaPlayerInfoModal`, inside `MediaPlayerModal`) shows three text
lines: the item title, the channel title, and the subsection title (chapter, clip, or soundbite)
above its time range. Each one becomes a `MarqueeText` from `@podverse/ui` (plan 11), so a long
string shows on one line and scrolls when it overflows, in the `fullPlayer` turn group. Links stay
around the scrolling text.

## Rows

R10, R11, R12, R13

## Runs after

11

## Files

apps/web/src/components/MediaPlayer/Modal/MediaPlayerInfoModal.tsx
apps/web/src/styles/components/MediaPlayer/Modal/MediaPlayerInfoModal.module.scss

## What is true today (checked at planning time)

- All three lines already sit on one line. In `MediaPlayerInfoModal.module.scss`,
  `.itemTitle > button`, `.channelTitle > button`, and `.subtitle > button` each
  `@include line-clamp(1)`. A long string ends in an ellipsis. Nothing wraps to two lines, so this
  plan replaces the ellipsis with scrolling. It does not change how many lines there are.
- `ClickableTitle` renders `<div className={className}><Link onClick={…}>{children || title ||
  tMisc('untitled')}</Link></div>`. `Link` from `apps/web/src/components/Link/Link.tsx` has no
  `href` here, so the shared `Link` renders a `<button type="button">`. The typography (font size,
  weight, `!important` color) is on the `… > button` selectors, and the global reset in
  `packages/ui/src/styles/globals/_elements.scss` gives buttons `padding: 0` and
  `font-size: inherit`.
- No caller passes `children` to `ClickableTitle`. All three callers pass `title`.
- The plain channel title (no `channelLinkUrl`) is
  `<div className={styles.channelTitle}>{String(infoResolution.channelTitle)}</div>` with no
  button.
- The modal unmounts its content while closed (`Modal` returns nothing when `isOpen` is false), so
  the `fullPlayer` group only has members while the full-size player is open.
- Existing specs find these lines by role and name (`modal.getByRole('button', { name: TITLE })`,
  some with `exact: true`) in `media-player-modal-video.spec.ts` and
  `media-player-alt-enclosure-load.spec.ts`. Plan 11 exposes exactly one copy to assistive
  technology, so the button's accessible name stays the plain title and those specs keep passing.

## R13 — swap in place

- Do not change `getMediaPlayerInfoResolution`, the order of the lines, `titleSection` /
  `subtitleSection` structure, `titleRef` / `subtitleRef`, the video branch, or the artwork code.
- The only structural edit is inside `ClickableTitle` and the plain channel `div`: the string they
  render becomes a `MarqueeText`. This keeps the diff small for the `artist-album-attribution`
  branch, which adds an artist line to this file.

## Component edits (`MediaPlayerInfoModal.tsx`)

1. Imports:
   - Change `import { ImageNonReact, LoadingSpinner } from '@podverse/ui';` to
     `import { ImageNonReact, LoadingSpinner, MarqueeText } from '@podverse/ui';`.
   - Add
     `import { MEDIA_PLAYER_MARQUEE_TURN_GROUP, MEDIA_PLAYER_MARQUEE_TURN_ORDER } from '../../../constants/mediaPlayerMarquee';`
     next to the other `../../../` imports, in the order ESLint's import rule expects
     (`npm run lint:fix` settles it).
1. `ClickableTitle`:
   - Remove the unused `children` prop from its props type and destructuring. `MarqueeText` takes a
     plain string, and no caller passes `children`.
   - Add two required props: `testId: string` and `turnOrder: number`.
   - Render:

     ```tsx
     <div className={className || ''}>
       <Link onClick={handleOnClick}>
         <MarqueeText
           align="center"
           data-testid={testId}
           turnGroup={MEDIA_PLAYER_MARQUEE_TURN_GROUP.fullPlayer}
           turnOrder={turnOrder}
         >
           {title || tMisc('untitled')}
         </MarqueeText>
       </Link>
     </div>
     ```

   - Pass no `className` to `MarqueeText`. The typography stays on the `… > button` selectors so the
     button keeps its color, and the span inherits font and color from it.
1. Callers of `ClickableTitle`:

   | Line | `testId` | `turnOrder` |
   | --- | --- | --- |
   | item title (`styles.itemTitle`) | `media-player-modal-title` | `MEDIA_PLAYER_MARQUEE_TURN_ORDER.fullPlayer.title` |
   | linked channel title (`styles.channelTitle`) | `media-player-modal-channel-title` | `MEDIA_PLAYER_MARQUEE_TURN_ORDER.fullPlayer.channel` |
   | subsection title (`styles.subtitle`) | `media-player-modal-subsection-title` | `MEDIA_PLAYER_MARQUEE_TURN_ORDER.fullPlayer.subsection` |

1. Plain channel title: keep the outer `<div className={styles.channelTitle}>` and put the string in
   a `MarqueeText` inside it, with `align="center"`, `data-testid="media-player-modal-channel-title"`,
   the `fullPlayer` group, and the `MEDIA_PLAYER_MARQUEE_TURN_ORDER.fullPlayer.channel` order. Replace `String(infoResolution.channelTitle)`
   with `infoResolution.channelTitle`. In that branch it is already a non-empty `string` (the
   ternary checks it), so no conversion or assertion is needed. If TypeScript does not narrow it
   there, keep `String(...)`.
1. Leave the time range (`ReadableTimeRange` in `.timeRange`), `ChapterLinkButton`, and
   `MediaPlayerVtsOverrideLikeButton` as they are. The time range is a short clock string and keeps
   its one-line clamp.

The linked and plain channel titles share one test id because only one of them renders at a time.

## Style edits (`MediaPlayerInfoModal.module.scss`)

A `MarqueeText` root is `display: block; width: 100%; min-width: 0` (plan 11), so it can only
measure overflow when every box around it is allowed to be narrower than its text.

1. `.itemTitle > button`, `.channelTitle > button`, `.subtitle > button`:
   - Remove `@include line-clamp(1);` from each.
   - Add `max-width: 100%;` and `min-width: 0;` to each. The button is a flex item in its
     `display: flex; justify-content: center` wrapper; without `min-width: 0` its automatic minimum
     is the full nowrap text width and the line never overflows. The button still hugs a short
     title, so the clickable area stays the size of the text, as it is today.
   - Keep the font, weight, color, and `.channelTitle > button`'s `margin-top`.
1. `.subtitle`: add `max-width: 100%;`. It sits in `.subtitleCopy`, a column flex with
   `align-items: center`, where an item sizes to its content and would grow past the column for a
   long nowrap string.
1. `.subtitleCopy` already has `min-width: 0`, which lets it shrink beside `.chapterLink` in the
   `.subtitleSection` row. Keep it.
1. `.timeRange` keeps its `@include line-clamp(1)`, so the `lineClamp` `@use` stays.
1. Do not add `overflow`, `white-space`, or `text-overflow` here. `MarqueeText` owns truncation and
   scrolling.

## Artwork sizing (`useModalArtworkSquareSize`)

No change. The hook subtracts the measured heights of `.titleSection` and `.subtitleSection` from
the info column. Both bands keep their `min-height` reserves (`--media-modal-title-reserve`,
`--media-modal-subtitle-reserve`), and each line inside stays one line tall, as it is under
`line-clamp(1)` today. Plan 11 holds the label to one line of the caller's line height in every
layout state (`measuring`, `fit`, `scroll`), and scrolling moves the track with `transform`, which
does not resize anything the hook's `ResizeObserver` watches. The square side therefore does not
change when a title starts or stops scrolling. Plans 40–49 assert this with a long title.

Do not edit `useModalArtworkSquareSize.ts` or the comment above `.imageWrapper`.

## Behavior after this plan

- **Fits:** a short line renders centered and still, as today.
- **Overflows:** the line rests on its first word at the left edge for 2.5 s, scrolls at 28 px/s
  with a seamless loop, then hands the turn to the next overflowing line. The order is item title,
  then channel title, then subsection title. Only one of the three moves at a time.
- **Turn group:** the full-size player's group is separate from the player bar's, so the bar's
  labels behind the modal keep their own rotation.
- **New string:** a chapter change swaps `subsectionTitle`, and `MarqueeText` keys on the string,
  so the new chapter title starts fresh at its first word. A new item does the same for all three
  lines.
- **Reduced motion:** `prefers-reduced-motion: reduce` keeps every line still with an ellipsis,
  which matches today's look.
- **Hover:** hovering a scrolling line pauses it (plan 11).
- **Links (R12):** the title, linked channel, and subsection lines stay buttons. Clicking one
  closes the modal and navigates, as today. The marquee is inside the button and the button's
  accessible name is the line's text.
- **Video:** the title and subtitle bands render only once the video ratio is known, as today.

## Parity with mobile

Mobile's full player scrolls its title (`full-player`, order 0) and its segment title (order 1),
and both are centered. Its channel line uses `numberOfLines={1}` and does not scroll. Web also
scrolls the channel line because the operator settled that every text line in the full-size player
scrolls when it overflows (`00-REQUEST.md`, Operator answers). This is an intentional divergence.
Mobile does not change in this set.

## Tests

- No unit test. `MediaPlayerInfoModal` has no component test, and the scroll, turn, and
  reduced-motion behavior is unit-tested on `MarqueeText` in plan 11. This plan only wires strings,
  test ids, and group or order constants.
- Playwright coverage is in plans 40–49, through the test ids above:
  `media-player-modal-title`, `media-player-modal-channel-title`, and
  `media-player-modal-subsection-title`, each carrying `data-marquee-layout`.
- Existing specs that must keep passing unchanged: `apps/web/e2e/media-player-modal-video.spec.ts`
  (title by button name, artwork square and gap metrics),
  `apps/web/e2e/media-player-alt-enclosure-load.spec.ts` (title by button name with
  `exact: true`), and `apps/web/e2e/media-player-chapter-seek.spec.ts` (chapter link beside the
  chapter title). Do not edit them in this plan.

## Release scratchpad

```markdown
## Full-size player titles scroll instead of truncating

- Surfaces: web
- Change: in the full-size player, the item title, the channel title, and the chapter, clip, or
  soundbite title each stay on one line. A line too long for the space scrolls horizontally after
  a 2.5 second rest on its first word, then hands off to the next long line, one line at a time.
  Short lines stay still and centered. Hovering a scrolling line pauses it. With reduced motion
  turned on, long lines stay still and end in an ellipsis. The lines remain links.
- Who notices: web listeners with long episode, podcast, or chapter titles
- Operator steps: none
```
