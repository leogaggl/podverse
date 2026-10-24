**Cursor model:** Opus 5.5 · **Reasoning:** high

# 70 — Consent lifecycle: a confirmed opt-out deletes listening data; an involuntary stop pauses it

Popularity Tracking stays optional (R4). When the listener says No, in Settings or at the
agreement prompt, the same request deletes their pseudonymous listener id. The cascades plan 10
defines then remove their listen events, open events, Taste Profile rows, and Hidden From Taste
Profile rows. The deletion happens right away (R19, R36), and anonymous daily and range totals stay
(R37). When tracking stops without the listener choosing it, because a membership lapsed or a new
explanation version is waiting, nothing is deleted. The data is paused and resumes when tracking
turns back on (R38).

This plan changes the server and the shared decision helper. Area I builds the confirmation dialog
on top of it; this plan adds no UI.

## Rows

R4, R19, R36, R37, R38

## Runs after

10, 11

## Files

- `packages/orm/src/services/stats/listenerIdentity/listenerLock.ts` (new, unless a zone helper that takes the listener lock already exists; see § Listener lock)
- `packages/orm/src/services/stats/listenerIdentity/listeningDataDeletion.ts` (new)
- `packages/orm/src/services/account/accountSettings/accountSettingsListenStats.ts`
- `packages/orm/src/index.ts`
- `packages/helpers/src/lib/popularityTracking.ts`
- `packages/helpers/src/lib/popularityTracking.test.ts`
- `apps/api/openapi.yml` (description of `PATCH /account-settings/listen-stats` only)
- `docs/features/POPULARITY-TRACKING.md` (fill the consent lifecycle section plan 10 created)
- `apps/api/src/test/popularity-tracking-opt-out.integration.test.ts` (new)

## What stays as it is

- `apps/api/src/controllers/account/accountSettings/accountSettingsListenStats.ts` and its route:
  same path, same body `{ accepted: boolean }`, same response fields. `DTOAccount` does not
  change.
- `apps/api/src/lib/legal/listenStats.ts` (`assertListenStatsAllowed`): area C owns it.
- Defaults: a new account starts undecided (`listen_stats_accepted = null`,
  `allow_listen_stats = false` in `AccountService.ensureAccountSettings`). Writes need the
  `trackStats` capability plus a Yes on the current version. That is R4: tracking is opt-in and
  optional. This plan answers R4 by keeping it so and by stating it in the doc.
- No API request asks for a confirmation flag. The confirmation is a client dialog (area I).
  Every caller of `PATCH /account-settings/listen-stats` with `accepted: false` today is a person
  answering No: web `SettingsListenStats.tsx` and `PopularityAgreementGate.tsx`, and mobile
  `MoreSettingsPopularityTrackingScreen.tsx` and `TermsAcceptanceProvider.tsx` through
  `syncAllowListenStatsToAccountSettings`. Nothing on the server sets `listen_stats_accepted` to
  false (checked: only `AccountSettingsListenStatsService.update` and account creation write it).

## Listener lock

Plan 10 fixes the lock every writer of a listener's rows takes:
`pg_advisory_xact_lock(hashtextextended('popularity_listen:' || <listener_id>::text, 0))`.

Before creating anything, search `packages/orm/src/services/stats/listenerIdentity/` for
`popularity_listen:`. Area C's write path may already have added a helper. If one exists, use it
and skip `listenerLock.ts`. Otherwise create
`packages/orm/src/services/stats/listenerIdentity/listenerLock.ts`:

```typescript
/** Serializes every write to one listener's events, taste rows, and hidden rows; see docs/features/POPULARITY-TRACKING.md. */
export async function lockListenerForWrite(manager: EntityManager, listenerId: string): Promise<void>;
```

It runs `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))` with
`` `popularity_listen:${listenerId}` ``. The string must equal the SQL concatenation above, so
every caller gets the same key. It is zone-internal: not exported from the ORM index.

## Zone service — `listenerIdentity/listeningDataDeletion.ts`

```typescript
export class ListeningDataDeletionService {
  async deleteForAccount(account_id: number, manager: EntityManager): Promise<boolean>;
}
```

- Lives in the listener identity zone (plan 12). It takes an `account_id`, returns a boolean, and
  never returns a listener id. Export it from `packages/orm/src/index.ts` beside the other
  `services/stats/` exports.
- It requires the caller's transaction manager (no default). Deleting outside the consent update
  would let the two disagree.
- Steps: `StatsListenerService.findListenerId(account_id, manager)`. When null, return false.
  Otherwise call `lockListenerForWrite(manager, listenerId)`, then
  `StatsListenerService.deleteForAccount(account_id, manager)`, and return its result.
- The doc comment says what the cascade removes (listen events, open events, taste rows, hidden
  rows) and that daily and range totals have no listener column and stay.

## Consent update — `AccountSettingsListenStatsService.update`

Today it reads through the read data source and saves through the read-write one, with no
transaction. Rewrite `update` so one read-write transaction does everything:

1. `AppDataSourceReadWrite.transaction(async (manager) => { … })`.
1. Load the settings row with `manager.getRepository(AccountSettings).findOne({ where: { account_id }, lock: { mode: 'pessimistic_write' } })`.
   Throw the existing `'AccountSettings not found for account'` error when it is missing.
1. Set the four fields exactly as today (`listen_stats_accepted`, `listen_stats_agreement_version`,
   `listen_stats_decided_at`, `allow_listen_stats`) and save through the same manager.
1. When `dto.accepted === false`, call
   `new ListeningDataDeletionService().deleteForAccount(dto.account_id, manager)`.
1. Return the saved row (same return type as today).

`getDecision` and `isListenStatsAllowed` are unchanged.

A No while the listener is already opted out, or has never had a listener id, deletes nothing and
still records the decision. A Yes never deletes, including a Yes to a new explanation version
after a pause. The same listener id carries on, so the paused Taste Profile resumes (R38).

### Why the row lock matters (contract for the write path)

The row lock on `account_settings` closes a race where a listen arrives while the opt-out
commits. Without it, a write that passed the consent check just before the opt-out could create a
fresh listener id just after it. The contract, which the doc states and area C's write path
follows:

- Inside its transaction, before `getOrCreateListenerId`, the listen and open write path re-reads
  consent with `SELECT listen_stats_accepted, listen_stats_agreement_version FROM account_settings WHERE account_id = $1 FOR SHARE`.
  It stops without writing when `isPopularityTrackingAllowed` is false for the current version.
- `FOR SHARE` waits for the opt-out's `pessimistic_write` lock, so it reads the No after the
  opt-out commits. If the write locked first, the opt-out's update waits for it, and the cascade
  then removes what it wrote.

This plan does not edit the write path. If area C's plan does not already include this re-read,
that is a Close or Review item (see the final message of the planning step).

## Shared decision helper — `packages/helpers/src/lib/popularityTracking.ts`

Area I shows the deletion warning on web and on mobile, in Settings and at the agreement prompt
when the listener had said Yes before. Put the "does saying No now delete data" decision in the
shared helper so the two clients cannot drift (**reuse-beyond-components**):

```typescript
/** True when answering No now would delete stored listening data, so the client confirms first. */
export function isPopularityTrackingOptOutDestructive(
  decision: PopularityTrackingDecision | null | undefined
): boolean;
```

It returns true exactly when `decision?.listen_stats_accepted === true`, whatever the version.
That covers both "allowed" and "stale acceptance". A paused profile is still stored, and a No at
the prompt for a new version deletes it. Undecided and already-opted-out return false.

## OpenAPI — `apps/api/openapi.yml`

Anchor: path `/account-settings/listen-stats:` (`operationId: apiPatchAccountSettingsListenStats`).
Replace only its `description` with:
"Record a Yes or No decision for the current popularity-tracking agreement version. A No also
deletes the account's pseudonymous listener id in the same request, which removes its listen
records, Taste Profile, and Hidden From Taste Profile list. Anonymous public totals stay."
Request and response schemas do not change.

## Doc — `docs/features/POPULARITY-TRACKING.md`

Fill the consent lifecycle section plan 10 created (find its heading; do not restructure the
doc). Present tense, no plan or step numbers (**comments-future-forward**). Cover:

- Tracking is opt-in. The decision states are undecided, allowed, opted out, and stale acceptance
  (`getPopularityTrackingChoice`). Writes need a Yes on the current version and the `trackStats`
  capability.
- A No deletes the listener id in the same transaction that records it. The cascades remove
  events, opens, taste rows, and hidden rows. Daily and range totals stay. Turning tracking on
  again creates a new listener id at the next counted listen, so recommendations start from
  scratch.
- A membership lapse, a removed `trackStats` override, or a new explanation version waiting for a
  Yes deletes nothing. Writes stop, the Taste Profile and hidden list stay, stored events still age
  out on retention, and a later Yes resumes with the same listener id. The Taste Profile endpoints
  keep working while paused, so a listener can still review and hide shows.
- Account deletion cascades the same way as an opt-out.
- The write-path consent re-read under `FOR SHARE` and the opt-out's row lock (the contract above).
- Clients confirm before a No whenever `isPopularityTrackingOptOutDestructive` is true.

## Tests

- `packages/helpers/src/lib/popularityTracking.test.ts`: `isPopularityTrackingOptOutDestructive`
  is true for accepted on the current version and on an old version, and false for null,
  undefined, undecided (`listen_stats_accepted: null`), and opted out.
- `apps/api/src/test/popularity-tracking-opt-out.integration.test.ts`, DB-backed. Follow
  `stats-guid-rotation.integration.test.ts` for the `@podverse/orm` mock, `startTestApp`, and
  seeding through `AccountService.create` and the read-write manager, and
  `add-by-rss-feed-identity.integration.test.ts` for `authHeaders` with a created account. Seed the
  new tables with raw SQL: test files are outside the separation guard. Read the current version
  from `config.popularityTracking.version` (`@api/config/index.js`); area B changes the value.
  Seed two accounts, A and B, each with a `stats_listener` row, a taste row, a hidden row, a
  listen event, and an open event, plus `stats_daily_channel` and `stats_daily_item` rows for the
  seeded channel and item. Cases:
  1. A says No (`PATCH /account-settings/listen-stats` `{ accepted: false }`): 200 with
     `listen_stats_accepted: false`. A's `stats_listener` row and all of A's taste, hidden, listen,
     and open rows are gone. B's rows are untouched, and the daily rows keep their counts (R37).
  1. An account with no `stats_listener` row says No: 200, and nothing else changes.
  1. A stale acceptance (accepted on an older version string) with stored rows says Yes: 200. The
     `stats_listener` row keeps the same `listener_id`, and the taste and hidden rows are unchanged
     (R38 resume).
  1. An allowed account says Yes again: nothing is deleted.

## Release scratchpad

```markdown
## Turning Popularity Tracking off deletes listening data right away

- Surfaces: api (`PATCH /account-settings/listen-stats`), helpers
- Change: answering No to Popularity Tracking, in Settings or at the agreement prompt, now deletes
  the account's pseudonymous listener id in the same request. That removes its stored listen and
  open records, Taste Profile, and Hidden From Taste Profile list. Anonymous public totals stay. A
  membership lapse or a new explanation version waiting for a Yes deletes nothing; the Taste
  Profile is paused and resumes with the same id after a Yes. New shared helper
  `isPopularityTrackingOptOutDestructive` tells clients when to confirm first.
- Who notices: Premium listeners who turn tracking off; their recommendations start from scratch
  if they turn it back on
- Operator steps: none
```
