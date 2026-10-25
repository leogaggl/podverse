**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 26 — Web: the Switch or Continue prompt yields to live control

The handoff prompt ("Switch" to the server's now-playing item, or "Continue" with the local one) is
raised by `useMediaPlayerControllerQueueHeadLoading` when the server queue's head differs from a
paused local item. Live control (plans 22–25) now covers the case where both devices are
connected. R55 asks that the prompt still cover the other device being offline or the app having
just opened, and that the two never both appear.

The rule, by this tab's cross-device role (plan 21):

| Role and availability | Queue head adopt (empty player, paused, no write) | Prompt |
| --- | --- | --- |
| `remote` | no | no; an open prompt closes |
| `active` | as today | no; an open prompt closes |
| `idle`, availability `pending` | as today | held (not raised) |
| `idle`, availability `off`, `unavailable`, or `ready` | as today | as today |

- **Other device offline:** its presence expired, so no device is active and this tab is `idle`
  with availability `ready`; the prompt behaves as today.
- **App just opened:** availability is `pending` until the first check-in answers, or for at most
  5 s (plan 22 then marks it `unavailable`). The empty player still adopts the queue head paused,
  so first paint is not delayed; only the prompt waits. When availability settles and the role is
  `idle`, the effect re-runs and raises the prompt if it still applies. When it settles to
  `remote`, plan 22 clears the player and no prompt appears.
- **Never both:** live control exists only in the `remote` role, and the prompt only in a settled
  `idle` role.

Before editing, confirm plan 22 has landed (`useCrossDevicePlaybackSnapshot` reads the store
without the provider). If not, stop and report.

## Rows

R55

## Runs after

22

## Files

apps/web/src/hooks/useMediaPlayerControllerQueueHeadLoading.ts
apps/web/src/hooks/__tests__/useMediaPlayerControllerQueueHeadLoading.test.tsx

## Edits in `useMediaPlayerControllerQueueHeadLoading.ts`

1. Near the other hook reads at the top of `useMediaPlayerControllerQueueHeadLoading` (line 141 on):

   ```typescript
   const crossDeviceRole = useCrossDevicePlaybackSnapshot((snapshot) => snapshot.role);
   const crossDeviceAvailability = useCrossDevicePlaybackSnapshot((snapshot) => snapshot.availability);
   ```

1. In `shouldLoadQueueResource` (near line 383), immediately before `setPlaybackHandoffPrompt({`
   (near line 432), return false without raising the prompt when
   `crossDeviceRole !== 'idle' || crossDeviceAvailability === 'pending'`. Every earlier return
   stays, so an empty player still returns true and adopts.

1. In the queue head effect (near line 718), first statement:

   ```typescript
   if (crossDeviceRole === 'remote') {
     return;
   }
   ```

   Add `crossDeviceRole` and `crossDeviceAvailability` to its dependency list (near line 812).

1. In the auto-queue row effect (near line 822), return at the start when
   `crossDevicePlaybackStore.getSnapshot().role === 'remote'` (read at run time; this effect's
   dependency list stays `[autoQueueActiveRow]`).

1. New effect: when `crossDeviceRole` becomes `'remote'` or `'active'` and `playbackHandoffPrompt`
   is not null, `setPlaybackHandoffPrompt(null)`. No now-playing write, no handoff record write,
   and no dismissed-key write, so the prompt may return if the tab is idle again later.

1. New effect: when `crossDeviceRole` becomes `'remote'`, set
   `queueHeadAdoptedWithoutListenRef.current = null` and `queueHeadAdoptInFlightRef.current =
   false`. Plan 22 clears the player in that role; when the tab returns to `idle` (the other device
   released or left), the empty player adopts the queue head paused again instead of staying
   empty.

## Must stay true

- With cross-device playback `off` (logged out, embed) or `unavailable` (no membership, stream
  down), the prompt and adopt behave exactly as today.
- A `remote` tab never loads a queue item and never shows the prompt, so the plan 22 clear and
  this adopt cannot loop.
- First paint never waits on a check-in.

## Tests

Extend `useMediaPlayerControllerQueueHeadLoading.test.tsx` (drive `crossDevicePlaybackStore`
through `reset`, `applyPresenceResponse`, and `applyStreamEvent`; `reset({ accountId: null,
enabled: false })` in `afterEach`):

- Role `remote` (another session active): an empty player does not adopt the queue head and no
  prompt is raised.
- Availability `pending` with a paused local item and a newer, different server head: no prompt.
  After the store becomes `ready` with no active device (`idle`), the prompt appears.
- An open prompt closes, with no now-playing write, when the role turns `remote`.
- Availability `off`: existing prompt cases still pass unchanged.

## Release scratchpad

```markdown
## Switch or Continue prompt defers to live control

- Surfaces: web
- Change: The prompt offering to switch to the item another device last played no longer appears
  while that device is connected and playing; the player shows live control instead. It still
  appears when the other device is offline or has stopped, after this tab learns that (at most
  about 5 s after opening). An open prompt closes if another device starts playing or this tab
  starts playing.
- Who notices: members who move between devices
- Operator steps: none
```
