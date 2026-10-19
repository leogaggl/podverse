# 01 — Rest before every marquee pass

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

Order and rules: [00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).

## Problem

`MarqueeText` waits `MARQUEE_EDGE_HOLD_MS` once, then `runRevolution` restarts itself straight
away. After the first pass, the label never rests. Continuous motion in persistent chrome is the
main thing that makes a marquee distracting, and the reader gets no moment on the first words.

## Files (3)

| File                                                      | Change                                   |
| --------------------------------------------------------- | ---------------------------------------- |
| `apps/mobile/src/lib/text/marqueeScroll.ts`               | Hold constant value and doc comment      |
| `apps/mobile/src/components/primitives/MarqueeText.tsx`   | Hold before every pass                   |
| `apps/mobile/src/lib/text/marqueeScroll.test.ts`          | No change expected (see below)           |

## 1. `marqueeScroll.ts`

Replace:

```typescript
/** Pause with the start of the label visible before the loop starts. */
export const MARQUEE_EDGE_HOLD_MS = 1600;
```

With:

```typescript
/** Rest with the first word visible before every pass, so the label is readable between passes. */
export const MARQUEE_EDGE_HOLD_MS = 2500;
```

Leave `MARQUEE_SPEED_DP_PER_SECOND`, `MARQUEE_LOOP_GAP`, and every function unchanged.

## 2. `MarqueeText.tsx`

Change the animation effect so that each pass is a hold followed by a scroll, and the loop goes
back to the hold:

```typescript
useEffect(() => {
  offset.setValue(0);
  if (!scrolls) {
    return;
  }
  const distance = marqueeLoopDistance(contentWidth);
  let cancelled = false;
  let animation: Animated.CompositeAnimation | undefined;

  const runPass = () => {
    if (cancelled) {
      return;
    }
    offset.setValue(0);
    animation = Animated.sequence([
      Animated.delay(MARQUEE_EDGE_HOLD_MS),
      Animated.timing(offset, {
        duration: marqueeScrollDurationMs(distance),
        easing: Easing.linear,
        toValue: -distance,
        useNativeDriver: true,
      }),
    ]);
    animation.start(({ finished }) => {
      if (finished) {
        runPass();
      }
    });
  };

  runPass();

  return () => {
    cancelled = true;
    animation?.stop();
    offset.setValue(0);
  };
  // `children` restarts from the first word when the now-playing label changes.
}, [children, contentWidth, offset, scrolls]);
```

The `offset.setValue(0)` at the start of `runPass` cannot be seen. At `-distance`, the second
copy sits exactly where the first one started, so resetting to `0` paints the same pixels.

Update the component doc comment. Replace the sentence that begins "Overflowing labels hold on
the first word, then travel at a constant speed…" with:

```text
Overflowing labels rest on the first word before every pass, then travel at a constant speed
with a second copy parked after a seam gap so the wrap is a continuation, not a snap.
```

Keep the rest of that comment and the whole render tree as they are.

## 3. Tests

`marqueeScroll.test.ts` does not assert the hold value, so no test change is required. Do not add
a test that pins `2500`; it would only repeat the constant.

## Done when

- Every pass of an overflowing label starts at rest on its first word for 2.5 s.
- Short labels, Reduce Motion, and text changes behave the same as before.
- Tick prompt 01 in COPY-PASTA.md and move this file to
  `.llm/plans/completed/mobile-marquee-turns/`.

No scratchpad entry in this prompt. Prompt 02 writes one entry for both changes.
