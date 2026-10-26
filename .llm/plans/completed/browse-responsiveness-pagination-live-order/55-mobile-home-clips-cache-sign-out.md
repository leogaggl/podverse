**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 55 — Sign-out clears the saved Home clips list

## Rows

R18

## Runs after

38, 50

Plan 38 adds `homeClipsCacheWriteGeneration`, `readSnapshot`, `extendFromAccount`, and the session
generation guard on `refreshFromAccount`, and it defines `homeLivestreamsCacheRepository.clear`
(increment the write generation, then delete the kv row). This plan copies that `clear` onto the
clips repository. One sentence in plan 38 now states that the livestreams increment happens before
the first `await`. Plan 50 adds `homeClipsRefreshGeneration` and the `'replaced' | 'stale'`
result on `refreshFromAccount`, and it extends `homeClipsCacheRepository.test.ts`. This plan edits
that repository and that test after both.

## What happens today

`homeClipsCacheRepository` (`apps/mobile/src/data/repositories/homeClipsCacheRepository.ts`) stores
the subscribed clips snapshot under the kv key `home.clips.subscribed`. It has `listPayload`,
`replacePayload`, and `refreshFromAccount`. It has no `clear`.

`clearSession` in `apps/mobile/src/auth/AuthProvider.tsx` already deletes account data before it
sets `status` to `anonymous`: the account snapshot, the queue, playlists, and
`homeLivestreamsCacheRepository.clear()` for `home.livestreams.subscribed`. It does not call the
clips repository. Every session end (`user_logout`, `session_expired`, `reset`) goes through
`clearSession`, and a switch from one account to another calls it first
(**mobile-account-scoped-data**).

The clips snapshot is account data. It is the previous account's subscribed clips. The next person
on the phone can read it from SQLite after sign-out, including after the app restarts, until a
later sync replaces the key.

## Settled behavior

- **R18.** Sign-out deletes `home.clips.subscribed` the same way it deletes
  `home.livestreams.subscribed`.
- **`clear()` matches plan 38's livestreams `clear()`.** First line:
  `homeClipsCacheWriteGeneration += 1`. Then `await initializeDatabase()`, then delete the kv row
  for `HOME_CLIPS_CACHE_KEY`. Delete the row. An empty `{ items: [] }` payload is a different
  stored value; the livestreams path removes the row, and a missing row already reads as `[]`.
- **The bump is what drops a page that started before sign-out.** `extendFromAccount` (plan 38)
  captured the write generation before its request. After `clear()` the generations differ, so it
  returns `'stale'` and does not write. `clearSession` also calls `advanceAuthSessionGeneration()`
  before any `await`, and plan 50's `refreshFromAccount` returns `'stale'` without writing when
  that generation changed. Leave `homeClipsRefreshGeneration` to that check.
- **One call site.** `clearSession`, inside the existing `try` that already calls
  `homeLivestreamsCacheRepository.clear()`, immediately after that call. The same `catch` logs a
  failure. There is no second clear in `SyncProvider`'s `status === 'anonymous'` effect: that
  effect resets in-memory stores, and this snapshot lives in SQLite.
- **Home keeps its current reload rules.** `HomeScreen` does not re-read when `status` changes,
  for Clips or for Livestreams. The next read of Clips (`loadFeed`) sees an empty snapshot.
  `pendingClipsRefetchRef` (plan 50) stays until that read, which clears it when `status` is not
  `authenticated`. Leave `HomeScreen.tsx`, `homeListPrefs.ts`, `syncJobs.ts`, and
  `apps/mobile/e2e/home.yaml` unchanged.

## Changes

### 1. `apps/mobile/src/data/repositories/homeClipsCacheRepository.ts`

Add `clear` beside `replacePayload`, copying plan 38's livestreams `clear` with the clips names:

```ts
/** Drop the subscribed clips snapshot. Sign-out calls this before the next account can read it. */
clear: async (): Promise<void> => {
  homeClipsCacheWriteGeneration += 1;
  await initializeDatabase();
  await getDb().delete(schema.kvMeta).where(eq(schema.kvMeta.key, HOME_CLIPS_CACHE_KEY));
},
```

`homeClipsCacheWriteGeneration` is the module-level `let` plan 38 adds. Increment that binding.
`replacePayload` and the extend write keep advancing it the way plan 38 says; `clear` advances it
too.

On the module comment, add this sentence after the existing lines: "It is account data: sign-out
drops the key so the next account on this phone does not see the previous account's clips." Leave
plan 38's `refreshFromAccount` comment as that plan left it. A comment in this file does not name
a plan.

### 2. `apps/mobile/src/auth/AuthProvider.tsx`

Import `homeClipsCacheRepository` from `'../data/repositories/homeClipsCacheRepository'`, on its
own line, next to the existing `homeLivestreamsCacheRepository` import. Import the module, the
same way that file already avoids the data barrel.

In `clearSession`, the comment above the account-data `try` names the subscribed livestreams page.
Name the subscribed clips snapshot in that same comment. Inside the `try`, after
`await homeLivestreamsCacheRepository.clear();`:

```ts
await homeClipsCacheRepository.clear();
```

### 3. `apps/mobile/src/data/README.md`

The `homeClipsCacheRepository` parenthetical in the repositories list says the last subscribed-clips
page is in `kv_meta` so Home Clips can paint without waiting on the network. Add to that
parenthetical: sign-out deletes the key, because the snapshot is account data.

## Files

apps/mobile/src/data/repositories/homeClipsCacheRepository.ts
apps/mobile/src/data/repositories/homeClipsCacheRepository.test.ts
apps/mobile/src/auth/AuthProvider.tsx
apps/mobile/src/data/README.md

## Tests

Extend `apps/mobile/src/data/repositories/homeClipsCacheRepository.test.ts` (plan 38 creates it;
plan 50 adds the refresh cases). Add a fake kv map and a `getDb` mock whose `insert`, `select`,
and `delete` chains read and write that map by the `value` field of the `eq` predicate. Mock
`drizzle-orm` in this file as `eq: (_column: unknown, value: unknown) => ({ value })`. Plan 38's
pure parse and append cases and plan 50's `replacePayload` spy do not call `eq`. Keep
`getAuthSessionGeneration` constant in the new cases.

`getDb`'s return type is the full Drizzle database. One assertion to that return type is the
escape hatch for the fake, with a short comment that the fake covers the chains this repository
calls.

Two cases:

- **`clear` removes the snapshot.** Seed `home.clips.subscribed` with a payload whose `items` hold
  one clip. `await homeClipsCacheRepository.clear()`. The map no longer has that key.
  `readSnapshot()` returns `{ items: [], window: null }`.
- **`clear` drops an extend that already started.** Seed a snapshot whose `window.hasMore` is
  true. `requestWithMobileAuthRefresh` returns a deferred promise (plan 50's harness). Start
  `extendFromAccount`, wait until the request mock has been called, then `await clear()`, then
  resolve the request with a second page. The result is `'stale'`. `readSnapshot()` is empty.
  The second page is absent. `replacePayload` was not called.

Leave plan 50's refresh cases as they are, including the case where a session-generation change
returns `'stale'` and writes nothing. No Maestro flow: the claim is the kv delete and the dropped
write, which this file holds. `apps/mobile/e2e/auth-logout.yaml` stays as it is.

## Release scratchpad

## Sign-out drops the saved Home clips list

- Surfaces: mobile
- Change: signing out deletes the Home Clips list saved on the phone (`home.clips.subscribed`),
  the same way it already deletes the saved Home Livestreams list. The next account on that phone
  starts with an empty saved Home Clips list. A page that was still loading when sign-out started
  is dropped.
- Who notices: someone who signs out, and the next person who signs in on the same phone
- Operator steps: none
