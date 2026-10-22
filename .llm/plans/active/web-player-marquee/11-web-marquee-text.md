**Cursor model:** Opus 5.5 · **Reasoning:** high

# 11 — Web `MarqueeText` in `@podverse/ui`, plus the player turn groups

A single-line label for web that scrolls when its string is wider than its box, mirroring
mobile's `apps/mobile/src/components/primitives/MarqueeText.tsx`. It uses the shared math and turn
registry from `@podverse/helpers/marquee` (plan 10). This plan also defines the turn group and turn
order identifiers that plans 12–39 pass in. Nothing renders the component until plans 12–39.

## Rows

R1, R2, R4, R5, R6, R16, R22

## Runs after

10

## Files

packages/ui/src/components/layout/MarqueeText/MarqueeText.tsx
packages/ui/src/components/layout/MarqueeText/MarqueeText.module.scss
packages/ui/src/components/layout/MarqueeText/MarqueeText.test.tsx
packages/ui/src/components/layout/MarqueeText/index.ts
packages/ui/src/hooks/useMarqueeTurn.ts
packages/ui/src/hooks/usePrefersReducedMotion.ts
packages/ui/src/index.ts
apps/web/src/constants/mediaPlayerMarquee.ts

## R1 — web has no marquee today

Confirmed at planning time: no marquee component or scrolling text exists in `apps/web/src`,
`apps/management-web/src`, or `packages/ui/src`. The only "marquee" string is a `.hasMarquee`
class in `MediaPlayerVideoPortalFloating.module.scss` and
`MediaPlayerLiveStreamVideoPortalFloating.module.scss`. It offsets the floating video by a "top
section" height, no TSX references it, and it is unrelated to scrolling text. Leave it alone.

## R2 — where a marquee fits on web

| Place | Today | In this set |
| --- | --- | --- |
| Player bar, desktop (`MediaPlayerInfoDesktop`) title and subtitle | `line-clamp(2)` | Yes, plans 20–29 |
| Player bar, mobile web (`MediaPlayerInfoMobile`) title and subtitle | `line-clamp(1)` | Yes, plans 20–29 |
| Player bar segment strip (chapter, clip, or soundbite title above both bars) | does not exist yet | Yes, plans 20–29 add it |
| Full-size player (`MediaPlayerInfoModal`) item title, channel title, subsection title | wraps | Yes, plans 30–39 |
| Embed player `EmbedSegmentInfoBar` segment title (beside its time range) | one-line ellipsis | Yes, plan 12. It is the closest match to mobile's `NowPlayingSegmentBar`. |
| Embed player `EmbedPlayerInfo` `.title` and `.channelTitle` | one-line ellipsis | Yes, plan 12 |
| `MediaHeaderMini` detail-page header title and subtitle | one-line ellipsis | No. Page chrome, not player chrome; mobile does not scroll detail headers. |
| List rows (episodes, clips, chapters, playlists, live items) | ellipsis or clamp | No. Mobile does not scroll list rows, and a moving label per row costs once per row. |

## Placement

Per `.cursor/rules/prefer-shared-ui-web-management.mdc`, a generic, string-free display primitive
goes in `packages/ui`, not `apps/web`. It sits beside its closest relative, `EllipsisText`, under
`packages/ui/src/components/layout/`. Turn group names are product decisions, so they live in
`apps/web`; the component types `turnGroup` as `string`.

## Component contract

```ts
export type MarqueeTextProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  /** Where the label sits when it fits. A scrolling label always rests on its first word at the left edge, after any `restInset`. */
  align?: 'center' | 'left'; // default 'left'
  children: string;
  /**
   * Space before the first word while the label rests, as a CSS length (a spacing token, such as
   * `var(--spacing-lg)`). The space travels with the scrolling copy, so the glyphs still leave at
   * the clip edge. The overflow check counts it. A centered label that fits ignores it.
   */
  restInset?: string; // default: no inset
  /** Labels in the same group scroll one at a time and hand off after each pass. Ungrouped labels loop on their own. */
  turnGroup?: string;
  /** Position in the group's rotation. Lower goes first. Default 0. */
  turnOrder?: number;
};
```

- `children` is a plain string (R6). The component knows nothing about artists, albums, links, or
  where the string came from. Callers keep their link or button **around** it.
- Root element is a `<span>` styled `display: block`, and every descendant is a `<span>`, so it is
  valid inside the player bar's `<button>` and inside `Link`'s `<a>`.
- `className`, `style`, `data-testid`, and other span attributes spread onto the root. Callers put
  their typography (font size, weight, color) on the root through `className`. The caller's class
  must not set `line-clamp`, `-webkit-box`, `overflow`, `text-overflow`, or `white-space`; plans
  12–39 remove those from the classes they pass. `MarqueeText` owns truncation and scrolling.
- The root sets `data-marquee-layout` to `measuring`, `fit`, or `scroll`, so Playwright (plans
  40–49) can assert overflow without timing the animation.
- `restInset` ports mobile's prop of the same name (`apps/mobile/src/components/primitives/MarqueeText.tsx`).
  Mobile passes a number in dp; web takes a CSS length so a caller passes a spacing token and the
  inset follows the root font size, as every web spacing value does. Mobile's one caller shows the
  intended use: `NowPlayingSegmentBar` clips its label full-bleed (no horizontal padding on the
  strip) and, with no leading icon, passes `align="center"` and `restInset={spacing.lg}`, so the
  resting first word sits one gutter in from the strip edge and the moving glyphs leave at the
  edge itself. With a leading icon it passes `align="left"` and no inset: the icon's own margin
  and the row gap keep the label clear of it, and the clip edge is beside the icon.

## Behavior (parity with mobile, R4)

Use these from `@podverse/helpers/marquee`: `MARQUEE_EDGE_HOLD_MS`, `marqueeScrollDurationMs`,
`resolveMarqueeLayout`, `stabilizeMeasuredWidth`, `createMarqueeTurnRegistry`.

1. **Scroll only on overflow:** `resolveMarqueeLayout({ contentWidth, viewportWidth, reduceMotion,
   restInset: 0 })`. Scrolls only when the natural width exceeds the box by more than 1 px. With a
   `restInset`, the hidden measurer carries the inset as `padding-inline-start`, so
   `contentWidth` is inset plus text and the comparison matches mobile's (text against the box
   minus the inset) without converting the CSS length to pixels. Always pass `restInset: 0` to the
   helper for that reason.
2. **Rest, then a constant-speed pass:** each pass waits `MARQUEE_EDGE_HOLD_MS` (2500 ms) with the
   first word visible, then travels linearly for `marqueeScrollDurationMs(distance)` (28 px/s).
3. **Seamless loop:** while scrolling, a second copy sits after a seam whose width is
   `var(--spacing-2xl)` (24 px at the default root size, the same value as mobile's
   `spacing['2xl']`). The pass travels `distance` = the second copy's `offsetLeft` minus the first
   copy's `offsetLeft` within the track, so the gap comes from CSS and is not repeated as a
   number, and a rest inset before the first copy is not counted. At the end of a pass the second
   copy sits exactly where the first started; reset the offset to 0.
4. **Rest inset (`restInset`):** in `scroll`, the track starts with an `aria-hidden` spacer span
   (`flex: 0 0 auto`, inline `style={{ width: restInset }}`) before the first copy, so the first
   word rests one inset in from the clip edge and the spacer moves away with the pass. In `fit`
   and `measuring` with `align="left"`, the visible copy gets inline
   `style={{ paddingInlineStart: restInset }}` and `box-sizing: border-box`, so a fitting label
   rests at the same place a scrolling one does and the padding cannot push it past the box. A
   centered label in `fit` or `measuring` gets no inset, as on mobile. No inset when the prop is
   unset.
5. **Ungrouped** labels start the next pass right away (rest, travel, repeat). **Grouped** labels
   reset to 0 after a pass and call `finish()`, handing the turn to the next overflowing label in
   `turnOrder` (ties go to the label that joined first, wrapping around).
6. **A new string starts fresh:** the inner label is keyed on `children`, as on mobile. A new title
   remounts it: new measurement, offset 0, a new group member (new `useId`), and any running
   animation cancelled.
7. **Reduced motion:** when `(prefers-reduced-motion: reduce)` matches, the label never scrolls and
   truncates with an ellipsis instead. It follows live changes to the media query.
8. **Pause on hover:** while the pointer is over the label, a running pass pauses
   (`Animation.pause()`), and it resumes on leave (`play()`). The label keeps the turn while
   paused. This is a web addition, kept at the first review (D3).
9. **No blank first paint:** the server render and the `measuring` state show one visible copy
   with ellipsis truncation, and `align` applies. Do not hide the text while measuring, unlike
   mobile's opacity 0; on web that would blank the title on every SSR page load and every title
   change. Moving from `measuring` or `fit` to `scroll` keeps a left-aligned label's first word
   where it was, rest inset included (item 4).
10. **One line, no layout shift:** the root's height is one line of the caller's line height, and
   its width fills its parent (`width: 100%; min-width: 0`). Plans 12–39 make sure the flex parents
   allow shrinking (`min-width: 0`).

## Implementation notes

- **Measurement.** A `ResizeObserver` on the root gives the box width (`clientWidth`), and one on a
  hidden measurer gives the natural width. The measurer is `aria-hidden`, absolutely positioned,
  `visibility: hidden`, `white-space: nowrap`, `width: max-content`, plus inline
  `style={{ paddingInlineStart: restInset }}` when `restInset` is set. Its box follows web-font loads
  and root font-size changes, so the observer catches those too. Pass both widths through
  `stabilizeMeasuredWidth`. When `ResizeObserver` is missing (jsdom, very old browsers), stay in
  `fit`.
- **Animation.** Use the Web Animations API on the track:
  `track.animate([{ transform: 'translateX(0)' }, { transform: `translateX(-${distance}px)` }],
  { delay: MARQUEE_EDGE_HOLD_MS, duration, easing: 'linear' })`. On `animation.finished`, guarded
  by a cancelled flag, reset and either loop or `finish()`. In cleanup, call `animation.cancel()`
  and swallow the rejected `finished` promise; it is not an error. When `track.animate` is not a
  function, stay in `fit`. Do not use CSS keyframes: the duration depends on measured width, and
  the hand-off needs the end-of-pass signal.
- **Accessibility.** Exactly one copy is exposed to assistive technology: the first copy in
  `scroll`, and the only copy otherwise. The rest-inset spacer, the second copy, the seam, and the
  measurer carry `aria-hidden="true"`. Add no role or label; the text is the content, and the caller's link or
  button supplies the accessible name.
- **Styles.** `MarqueeText.module.scss` reuses `ellipsisSingleLineChild` from
  `../../../styles/mixins/ellipsis` for the fit copy (as `EllipsisText.module.scss` does). Use
  `var(--spacing-2xl)` for the seam with no `var()` fallback
  (**css-custom-properties-no-var-fallbacks**). `will-change: transform` goes only on a track that
  is scrolling.
- **`packages/ui/src/hooks/usePrefersReducedMotion.ts`:** a `useSyncExternalStore` over
  `window.matchMedia('(prefers-reduced-motion: reduce)')`, with `change` listeners. The server
  snapshot is `false`. Guard `typeof window` and a missing `matchMedia`.
- **`packages/ui/src/hooks/useMarqueeTurn.ts`:** port `apps/mobile/src/hooks/useMarqueeTurn.ts`.
  The module owns the web process-wide registry, `const marqueeTurns =
  createMarqueeTurnRegistry()`, not exported. Pass `getServerSnapshot` to `useSyncExternalStore`:
  `null` for a grouped label, the ungrouped token for an ungrouped one. Leaving it out throws
  during the Next.js server render. `group` is `string | undefined`.
- **Exports.** Export `MarqueeText` and `MarqueeTextProps` from `packages/ui/src/index.ts`, next to
  the `EllipsisText` lines, through `components/layout/MarqueeText/index.ts`, which follows
  `EllipsisText/index.ts`. Do not export the two hooks; nothing outside the component needs them
  yet.
- Imports in `packages/ui` are extensionless (Tier C, **import-specifiers-tiered**). Import the
  helpers subpath as `@podverse/helpers/marquee`, not the barrel (**bundle-optimization**).
- No user-facing strings in the component (**shared-ui-i18n**).

## Turn groups and orders (R5, R22)

Each group has its own rotation, so each group gets its own order map. The player bar runs title,
then the segment strip, then the channel line. The full-size player runs title, channel,
subsection. The embed player runs title, segment, channel, as the player bar does.

Create `apps/web/src/constants/mediaPlayerMarquee.ts`:

```ts
/** Labels in one group scroll one at a time and hand off after each pass. */
export const MEDIA_PLAYER_MARQUEE_TURN_GROUP = {
  /**
   * Bottom player bar and the segment strip above it. Desktop and mobile web share it; the hidden
   * variant measures 0 and never takes a turn.
   */
  playerBar: 'player-bar',
  /** Full-size player modal. */
  fullPlayer: 'full-player',
  /** Embed player. Each embed is its own document, so two embeds on one page never share a rotation. */
  embedPlayer: 'embed-player',
} as const;

type MediaPlayerMarqueeTurnGroupKey = keyof typeof MEDIA_PLAYER_MARQUEE_TURN_GROUP;

/** Position of each line within its group's rotation. Lower goes first. */
export const MEDIA_PLAYER_MARQUEE_TURN_ORDER = {
  playerBar: { title: 0, segment: 1, channel: 2 },
  fullPlayer: { title: 0, channel: 1, subsection: 2 },
  embedPlayer: { title: 0, segment: 1, channel: 2 },
} as const satisfies Record<MediaPlayerMarqueeTurnGroupKey, Record<string, number>>;
```

The `satisfies` clause makes a new group without an order map a type error. A caller reads a
group and its order from the same key, for example
`turnGroup={MEDIA_PLAYER_MARQUEE_TURN_GROUP.playerBar}` with
`turnOrder={MEDIA_PLAYER_MARQUEE_TURN_ORDER.playerBar.segment}`.

How plans 12–39 use them (they only import; they do not edit this file):

| Surface | Line | Group | Order |
| --- | --- | --- | --- |
| Player bar (desktop and mobile web) | title (episode or track title) | `playerBar` | `playerBar.title` |
| Player bar segment strip (above both bars) | chapter, clip, or soundbite title | `playerBar` | `playerBar.segment` |
| Player bar (desktop and mobile web) | channel line (`channelTitle`) | `playerBar` | `playerBar.channel` |
| Full-size player | item title (inside its `Link`) | `fullPlayer` | `fullPlayer.title` |
| Full-size player | channel title (inside its `Link`, or plain) | `fullPlayer` | `fullPlayer.channel` |
| Full-size player | subsection title (chapter, clip, or soundbite, inside its `Link`) | `fullPlayer` | `fullPlayer.subsection` |
| Embed player (`EmbedPlayerInfo`) | title line | `embedPlayer` | `embedPlayer.title` |
| Embed player (`EmbedSegmentInfoBar`) | segment title | `embedPlayer` | `embedPlayer.segment` |
| Embed player (`EmbedPlayerInfo`) | channel line | `embedPlayer` | `embedPlayer.channel` |

Plans 20–29 own the player bar rows, plan 12 the embed rows, and plan 30 the full-size player
rows. Mobile's groups are `mini-player` and `full-player`; web says `player-bar` because that is
web's name for the bottom bar. The groups are per surface, so the shared string `full-player`
never meets mobile's.

## Tests

Unit (`packages/ui`, Vitest + jsdom + Testing Library):
`packages/ui/src/components/layout/MarqueeText/MarqueeText.test.tsx`. Stub `ResizeObserver`,
element widths, `window.matchMedia`, and `HTMLElement.prototype.animate` (returning an object with
a controllable `finished` promise, plus `cancel`, `pause`, and `play` spies). Behavior cases, not
one per line (**unit-test-design-no-overgranularity**):

- A label that fits renders one copy, `data-marquee-layout="fit"`, and never calls `animate`.
- An overflowing label renders `data-marquee-layout="scroll"`, exposes exactly one copy to
  assistive technology (the other is `aria-hidden`), and calls `animate` with `delay: 2500`,
  `easing: 'linear'`, and the duration from `marqueeScrollDurationMs`.
- Reduced motion keeps an overflowing label in `fit` with no `animate` call.
- Two overflowing labels in one group: only the lower `turnOrder` animates. When its `finished`
  resolves, the other animates.
- An ungrouped overflowing label animates again after `finished` resolves.
- Changing `children` cancels the running animation and measures again.
- Pointer enter pauses a running animation, and pointer leave plays it.
- `restInset`: stub the measurer so a label is wider than the box only once the inset padding is
  counted. It renders `scroll` with an `aria-hidden` spacer as the track's first child, and the
  `animate` distance is the second copy's `offsetLeft` minus the first copy's (stub both, with the
  first copy offset by the inset). The same string with no `restInset` renders `fit`. A
  left-aligned label that fits carries `padding-inline-start` on its visible copy; a centered one
  does not.
- `renderToString` of an overflowing label renders without throwing and shows the string in a
  non-`aria-hidden` element.

The registry and math are covered by plan 10's helpers tests. Playwright coverage is plans 40–49.

## Release scratchpad

none. Nothing renders the component until plans 12–39, which carry the user-visible entries.
