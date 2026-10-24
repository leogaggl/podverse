**Cursor model:** Cursor Grok 4.7 · **Reasoning:** low

# Remove the unused getPrimaryQueue wrapper

`getPrimaryQueue` in `usePrimaryQueue.ts` only calls `selectPrimaryQueue` and exists so older callers in this repo keep compiling. Nothing imports it. The hook's `fetchPrimaryQueue` calls `queueRepository.getPrimaryQueue` and stays.

## Rows

R19, R26

## Runs after

none

## Files

- apps/mobile/src/hooks/usePrimaryQueue.ts

## Tests

none. No test imports `getPrimaryQueue`. The hook's behavior does not change.

## Release scratchpad

none

## Edit

Delete the function and its comment (`Re-exported for backward compatibility`). Delete the `selectPrimaryQueue` import from `../data`. Keep the `DTOQueue` type import. Keep `usePrimaryQueue`, `fetchPrimaryQueue`, `fetchQueueForMedium`, and `fetchActiveQueueListMedium`.

Do not edit `apps/mobile/src/data/repositories/queueRepository.ts`. `getPrimaryQueue` there is the repository method the hook calls.
