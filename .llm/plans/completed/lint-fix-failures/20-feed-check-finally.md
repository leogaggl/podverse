**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 20 — Clear the feed-check spinner without returning from finally

`checkFeed` in `useAddByRssFeedCheck` returns from its `finally` when the screen has unmounted. ESLint `no-unsafe-finally` reports that return (`useAddByRssFeedCheck.ts` 131:11, `Unsafe usage of ReturnStatement`). A `return` in `finally` replaces whatever the `try` or `catch` was about to finish with, including a thrown error. Invert the condition so the same statements run only while the hook is still mounted, and do not `return`, `throw`, `break`, or `continue` from `finally`.

## Rows

R2

## Runs after

none

## Files

apps/mobile/src/screens/home/addByRss/useAddByRssFeedCheck.ts

Read only, do not edit:

- `apps/mobile/src/screens/home/AddByRssHomeDetailScreen.tsx` (`useAddByRssFeedCheck`, pull refresh calls `checkFeed('pull')`)
- `apps/mobile/src/screens/home/addByRss/AddByRssSettingsPane.tsx` (interactive check calls `checkFeed('interactive')`)

The public return stays `{ checkFeed, isChecking, noticeKey }`. Do not change callers.

## The finally block

Replace the body of the `finally` inside `checkFeed` (the block that starts at `isBusyRef.current = false`) with this, and nothing else in the file:

```typescript
      } finally {
        isBusyRef.current = false;
        if (isMountedRef.current) {
          setIsChecking(false);
          if (feedUrlRef.current === feedUrl) {
            await onChecked();
          }
        }
      }
```

Keep this order. `isBusyRef` is cleared on every exit, including when the component has unmounted and when `feedUrl` has changed. `setIsChecking(false)` runs only while mounted, including when the feed URL changed during the request. `onChecked` runs only while mounted and only when `feedUrlRef` still names the feed this call started with. The early `return`s in `try` and `catch` stay; they skip notice updates and still fall through to this `finally`.

Do not add a comment about the lint rule or about a previous `return`.

## Tests

No new test. The hook has no unit test, and this edit does not change a branch: the unmounted path still skips `setIsChecking` and `onChecked`, and the feed-URL change path still clears the spinner and skips `onChecked`. A hook test would mock parse, membership, and auth only to restate that structure. No Maestro flow (**mobile-test-economics**): nothing on screen changes.

## Release scratchpad

none
