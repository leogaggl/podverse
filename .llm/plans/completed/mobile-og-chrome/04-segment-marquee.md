# 04 — Chapter strip marquee

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

`apps/mobile/src/components/player/NowPlayingSegmentBar.tsx` names the current chapter, clip, or official clip in a `Text` with `numberOfLines={1}`, so a long title ends in an ellipsis.

Replace that text with `MarqueeText`, the scroller the mini player title already uses. Put it in a `flex: 1` slot so the leading icon keeps its width. When there is no icon, pass `align="center"` so a short title stays centered and a long one still starts at the first word. Reduce Motion keeps the ellipsis, which is how `MarqueeText` already behaves. The strip's accessibility label stays the full title.

Do not edit the mini player. Do not edit `.cursor/` files. Test ids `now-playing-segment-bar` and `now-playing-segment-title` stay.

## Operator check

Do not run this during implementation. There is no separate Maestro flow for the strip. Confirm it on a long chapter title with the player open.
