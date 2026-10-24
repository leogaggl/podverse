**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 81 — Web player sends counted listens; profile and playlist opens use the open route

The web player stops posting a channel, clip, and item stat on every load. Instead, one shared
listen session tracker (plan 80) measures media seconds heard in `NonLiveMediaOrchestrator`, and
its reports go to `POST /stats/listen` (plan 32) only after the counted-listen rule is met. Profile
and playlist page opens move to `POST /stats/open`. Every report needs a signed-in account whose
Popularity Tracking decision allows it; logged-out and declined listeners send nothing.

Web reporting is best-effort: a failed report is not retried. The next report of the same session
(completion, or 60 more seconds heard) repeats the full state, and the server keeps the larger
`seconds_heard`.

## Rows

R34, R71

## Runs after

32, 80

## Files

- `apps/web/src/utils/statsTracking/statsTracking.ts`
- `apps/web/src/utils/statsTracking/statsTracking.test.ts` (new)
- `apps/web/src/lib/playback/index.ts`
- `apps/web/src/components/MediaPlayer/Controller/NonLiveMediaOrchestrator.tsx`
- `apps/web/src/components/MediaPlayer/Controller/__tests__/NonLiveMediaOrchestrator.listenSession.test.tsx` (new)
- `apps/web/src/components/MediaPlayer/MEDIA-PLAYER-DECISION-MATRIX.md`
- `apps/web/src/components/StatsTracking/StatsPageViewTrackers.tsx`
- `apps/web/src/app/profile/[id_text]/ProfilePageClient.tsx`

`apps/web/src/contexts/Account.tsx` is not edited: it keeps calling
`syncListenStatsGateFromAccount` and `syncPopularityTrackingVersion`, which keep their names and
signatures.

## Decisions this plan carries

- **One tracker for the page.** `NonLiveMediaOrchestrator` mounts more than once (video plus a
  hidden audio instance in `NonLiveMediaMount.tsx`, and the embed mounts), but one item plays at a
  time. A module-level tracker in `statsTracking.ts` serves every instance, so a move between the
  audio and video elements with a `'continue'` directive keeps the session.
- **No retry on web.** The main alternative, a `localStorage` outbox like mobile's, buys little: a
  web listener is online while playing, and later reports repeat the session's full state.
- **Opens stay web-only and popularity-only**, as the operator answered. Own-profile and logged-out
  opens are skipped on the client; the server also answers `own_content` for an own playlist.
- **The client listen id** comes from `crypto.getRandomValues` formatted as a v4 uuid, because
  `crypto.randomUUID` is missing outside secure contexts (a dev server reached by LAN address).

## `apps/web/src/lib/playback/index.ts`

Add `createListenSessionTracker` and `listenSessionTargetForClip` to the value re-export list, and
`ListenSessionDirective`, `ListenSessionReport`, `ListenSessionTarget`, `ListenSessionTracker` to
the type re-export list, from `@podverse/playback-core`.

## `apps/web/src/utils/statsTracking/statsTracking.ts` — rewrite

Keep `accountForListenStatsGate`, `currentPopularityTrackingVersion`,
`syncListenStatsGateFromAccount`, and `syncPopularityTrackingVersion` as they are. Remove
`shouldSkipListenStatsForLoggedInAccount`, `fireStatsRequest` (it built the request before
checking the gate, so a declined listener still sent it), and the five `trackStats*` exports.
Add:

```typescript
import type { StatsListenRequestBody } from '@podverse/helpers-requests';
import { reqStatsListen, reqStatsOpen } from '@podverse/helpers-requests';

import type { ListenSessionReport, ListenSessionTracker } from '../../lib/playback';
import { createListenSessionTracker } from '../../lib/playback';

/** True when a signed-in account's Popularity Tracking decision allows reports. */
function canSendPopularityReports(): boolean {
  if (accountForListenStatsGate === null) {
    return false;
  }
  return isPopularityTrackingAllowed(
    accountForListenStatsGate.account_settings,
    currentPopularityTrackingVersion
  );
}

/** Random v4 uuid; works outside secure contexts, where `crypto.randomUUID` is missing. */
export function createClientListenId(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Sends one listen report. Failures are ignored; the session's next report repeats its state. */
export function reportListen(report: ListenSessionReport): void {
  if (!canSendPopularityReports()) {
    return;
  }
  const body: StatsListenRequestBody = {
    client_listen_id: report.clientListenId,
    seconds_heard: report.secondsHeard,
    completed: report.completed,
    ...(report.target.kind === 'clip'
      ? { clip_id_text: report.target.idText }
      : { item_id_text: report.target.idText }),
  };
  void reqStatsListen(getApiRequestService(), body).catch(() => {});
}

/** The page's listen session, shared by every mounted media orchestrator. */
export const webListenSession: ListenSessionTracker = createListenSessionTracker({
  now: () => Date.now(),
  createClientListenId,
  onReport: reportListen,
});

export function trackStatsProfileOpen(
  viewerAccountId: number | null | undefined,
  viewedAccountId: number,
  accountIdText: string
): void {
  if (viewerAccountId === undefined || viewerAccountId === null) {
    return;
  }
  if (viewerAccountId === viewedAccountId || !canSendPopularityReports()) {
    return;
  }
  void reqStatsOpen(getApiRequestService(), { account_id_text: accountIdText }).catch(() => {});
}

export function trackStatsPlaylistOpen(playlistIdText: string): void {
  if (!canSendPopularityReports()) {
    return;
  }
  void reqStatsOpen(getApiRequestService(), { playlist_id_text: playlistIdText }).catch(() => {});
}
```

The listen request body has no `listened_at`. The server stamps the time it receives the report.
Web already sends no listen time. Merge the import
lines with the file's existing `@podverse/helpers` imports (**type-imports-separate-line**). If
plan 32 named the request body type differently, use its name; if `reqStatsListen` or
`reqStatsOpen` is missing from `@podverse/helpers-requests`, stop and report.

## `NonLiveMediaOrchestrator.tsx`

Imports: drop `trackStatsChannel`, `trackStatsClip`, `trackStatsItem` (lines 62–66); import
`webListenSession` from `../../../utils/statsTracking/statsTracking`, and
`listenSessionTargetForClip` beside `clampNearEndSeconds` (line 41) and
`ListenSessionDirective` plus `ListenSessionTarget` beside the type import at line 40, both from
`../../../lib/playback`.

Add a module-level helper above the component:

```typescript
function listenSessionTargetFromPlayerState(state: {
  isAddByRSS: boolean;
  clip: DTOClip | null;
  item: DTOItem | null;
  soundbite: DTOItemSoundbite | null;
}): ListenSessionTarget | null {
  if (state.isAddByRSS) {
    return null;
  }
  if (state.clip !== null) {
    return listenSessionTargetForClip(state.clip);
  }
  const itemIdText = state.item?.id_text ?? state.soundbite?.item?.id_text ?? null;
  return itemIdText ? { kind: 'item', idText: itemIdText } : null;
}
```

Inside the component, one local function reads the refs:

```typescript
const loadListenSession = (directive: ListenSessionDirective, newDuration: number): void => {
  const isAddByRSS = Boolean(mpAddByRSSRef.current);
  webListenSession.load({
    directive: isAddByRSS ? 'none' : directive,
    target: listenSessionTargetFromPlayerState({
      isAddByRSS,
      clip: mpClipRef.current ?? null,
      item: mpItemRef.current ?? null,
      soundbite: mpItemSoundbiteRef.current ?? null,
    }),
    mediaDurationSeconds: Number.isFinite(newDuration) && newDuration > 0 ? newDuration : null,
  });
};
```

Wire the handlers (search by handler name; line numbers are from the current file):

- **`onLoadedMetadata`, staged branch** (about lines 533–550): replace everything after
  `setPendingPlaybackDecision?.(null);` up to the branch's `return;` with
  `loadListenSession(stagedDecision.listenSession, newDuration);` followed by `return;`. The
  `loggedInAccountRef` gate goes away here; reports are gated in `reportListen`.
- **`onLoadedMetadata`, fallback branch** (about lines 603–619): replace the stats block with
  `loadListenSession('start', newDuration);`. It no longer depends on `mpShouldPlayRef`; a paused
  load starts a session that counts nothing until playback runs.
- **`onTimeUpdate`**: right after the `if (!mediaRef.current) { return; }` guard, call
  `webListenSession.recordPosition({ positionSeconds: newCurrentTime, isPlaying: !mediaRef.current.paused, playbackRate: mediaRef.current.playbackRate });`.
  The clip-end and soundbite-end branches stay as they are; the tracker completes a clip session
  itself when a sample reaches the clip's end.
- **`onSeeked`**: right after the `if (!mediaRef.current) { return; }` guard and before the
  `suppressNextSeekEventRef` check, call `webListenSession.recordSeek();` so internal seeks also
  reset the baseline.
- **`onPause`**: right after the `if (!mediaRef.current || !mediaRef.current.paused) { return; }`
  guard, call `webListenSession.recordPause();`.
- **`onEnded`**: right after the `shouldAdvanceQueueAfterEnded` guard returns early, and before the
  `void (async () => {` block, call `webListenSession.recordCompleted();`.

If `loggedInAccountRef` (line 168) has no remaining reader after these edits, remove it and the
effect that fills it, and then `loggedInAccount` and the `useAccount` import if nothing else in the
file uses them; otherwise leave them.

## `StatsPageViewTrackers.tsx` and `ProfilePageClient.tsx`

- `StatsPlaylistPageView` calls `trackStatsPlaylistOpen(props.playlistIdText)` in place of
  `trackStatsPlaylist`; keep its `loggedInAccount` check and effect dependencies.
- `ProfilePageClient.tsx` lines 12 and 36: import and call `trackStatsProfileOpen` with the same
  three arguments in place of `trackStatsAccountVisit`.

## `MEDIA-PLAYER-DECISION-MATRIX.md`

- Rows at lines 73, 74, 76, and 78: replace the `trackStats*` mentions with "starts a listen
  session (`webListenSession`)"; line 74 (soundbite) says the session counts toward the
  soundbite's item.
- Line 79 (add-by-RSS): say the listen session directive is `'none'`, so nothing is reported, and
  drop the stale `loggedInAccountRef` code quote.
- Side-effects table row at line 363: replace with a `webListenSession` row. `load` runs on
  `loadedmetadata` with the decision's `listenSession` (`'none'` for add-by-RSS); `timeupdate`,
  `seeked`, `pause`, and `ended` feed it. Reports go to `POST /stats/listen` once the
  counted-listen rule is met, and only for a signed-in account that allows Popularity Tracking.
  Source: `handleLoadedMetadata` and the media event handlers.

## Tests

- `apps/web/src/utils/statsTracking/statsTracking.test.ts` (new). Mock
  `@podverse/helpers-requests` (`reqStatsListen`, `reqStatsOpen` as `vi.fn` resolving
  `{ status: 201, data: { result: 'counted' } }`) and `../../factories/apiRequestService`. Build
  the account with `account_settings` that allow and that decline tracking against a version set
  through `syncPopularityTrackingVersion`. Cases:
  - `reportListen` sends nothing when no account is synced, and nothing when the decision does not
    allow tracking.
  - When allowed, an item report posts `{ item_id_text, client_listen_id, seconds_heard, completed }`
    with no `clip_id_text`. A clip report posts `clip_id_text` and no `item_id_text`. Neither
    body includes `listened_at`; that field is not on the request.
  - A rejected `reqStatsListen` produces no unhandled rejection.
  - `trackStatsProfileOpen` skips a logged-out viewer and the viewer's own profile, and otherwise
    posts `{ account_id_text }`; `trackStatsPlaylistOpen` posts `{ playlist_id_text }`; both skip
    a declined account.
  - `createClientListenId` matches the v4 uuid pattern and differs between calls.
- `NonLiveMediaOrchestrator.listenSession.test.tsx` (new). Render the orchestrator the way
  `NonLiveMediaOrchestrator.seekPolicy.test.tsx` does (`renderAV`, `installMediaElementFake`, the
  `useMediaPlayer` mock). Mock `../../../../utils/statsTracking/statsTracking` so
  `webListenSession` is an object of `vi.fn`s. Cases:
  - A staged `listenSession: 'start'` decision with an item calls `load` with
    `{ directive: 'start', target: { kind: 'item', idText: 'item-1' } }` and the media duration on
    `loadedmetadata`.
  - A clip passes the clip target with its start and end; a soundbite passes its item.
  - A staged `'continue'` decision passes `'continue'`; add-by-RSS passes `'none'`.
  - `timeupdate` calls `recordPosition` with the element's paused state and playback rate;
    `seeked` calls `recordSeek` (also for an internal seek); `pause` calls `recordPause`;
    `ended` calls `recordCompleted`.
- Existing orchestrator tests that rendered with a logged-in account and expected no stats calls
  keep passing without edits; if any asserted `trackStats*` calls, rewrite those assertions to the
  tracker calls above.

No Playwright spec: nothing on screen changes, the counting rule is covered in plan 80's unit
tests, and a real counted listen would need up to a minute of playback per run.

## Release scratchpad

```markdown
## Web player reports counted listens to Popularity Tracking

- Surfaces: web
- Change: the web player no longer posts a channel, clip, and item stat each time media loads.
  It measures media seconds actually heard (seeks and skipped time do not count) and sends one
  `POST /stats/listen` once a listen meets the counted-listen rule (60 seconds or 25% of the item,
  whichever comes first), with later updates on completion and for each further minute heard.
  Soundbites and chapters count toward their item; clips count toward the clip; Add by RSS and
  live items are not reported. Profile and playlist page opens use `POST /stats/open`. Only a
  signed-in account whose Popularity Tracking decision allows it sends anything.
- Who notices: listeners who allow Popularity Tracking (nothing visible); operators reading
  popularity data, which now reflects real listening instead of page loads
- Operator steps: deploy with the API that serves `/stats/listen` and `/stats/open`
```
