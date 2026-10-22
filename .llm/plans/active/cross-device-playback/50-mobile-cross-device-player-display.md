**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 50 — Mobile player display model for another device's playback

One pure module decides what the phone's player shows: its own playback, or the playback of
another device on the account. A hooks module exposes those answers to the mini player, the full
player, the device menu, the failure notices, and list rows (plans 51–56). This plan also adds
every catalog key area E uses, so later plans only read keys.

Nothing here renders. Nothing here sends a command; plan 34 routes controls.

Before editing, confirm these exist and export the names used below. If any is missing, stop and
report:

- `apps/mobile/src/playback/crossDevice/crossDevicePlaybackStore.ts` (plan 30):
  `getCrossDevicePlaybackView`, `subscribeCrossDevicePlaybackView`,
  `getCrossDevicePlaybackPositionSeconds`, `subscribeCrossDevicePlaybackPositionClock`, and the
  `CrossDevicePlaybackView` and `CrossDevicePlaybackTransferFailureReason` types.
- `packages/helpers/src/lib/crossDevicePlayback.ts` (plan 11): `buildPlaybackDeviceList`,
  `shouldShowPlaybackDeviceSwitch`, `getPlaybackRemoteControls`, and the
  `PlaybackDeviceListEntry` and `PlaybackRemoteControls` types.
- `packages/helpers/src/lib/accountPlaybackStream.ts` (plan 10): `DTOPlaybackResourceSummary`,
  `DTOPlaybackResourceRef`, `DTOPlaybackDevice`, and `PlaybackStatus`.
- The consumer catalogs have `settings.account.sessions.client_type_web` and
  `settings.account.sessions.client_type_mobile` (auth-sessions plan 32). When they are missing,
  add those two keys here with the same values that plan lists (`Web Browser`, `Mobile App`, and
  its `es`, `fr`, `el-GR` text), and say so in the final message.

## Rows

R7, R40, R59, R67

## Runs after

30

## Files

apps/mobile/src/playback/crossDevice/crossDevicePlayerDisplay.ts
apps/mobile/src/playback/crossDevice/crossDevicePlayerDisplay.test.ts
apps/mobile/src/playback/crossDevice/useCrossDevicePlayerDisplay.ts
apps/mobile/vitest.config.ts
packages/i18n-catalog/consumer/originals/en-US.json
packages/i18n-catalog/consumer/originals/es.json
packages/i18n-catalog/consumer/originals/fr.json
packages/i18n-catalog/consumer/originals/el-GR.json

## Decisions this plan fixes

- **When the phone shows another device (R7).** The player shows the remote state when the store's
  `availability === 'ready'`, `role === 'remote'`, `state.resource !== null`, and no clip authoring
  hold is on. That matches plan 34's routing rule, so whatever is drawn is what the controls drive.
  In every other case the phone shows its own player exactly as today, including a local item that
  plan 32 left loaded and paused when another device took over.
- **A remote role with no item** (another device plays something that has no shared reference)
  shows the local player. It does not show an empty remote player.
- **Paused, starting, and stopped (R59).** A paused remote state shows "Paused on {device}" with the
  position frozen. `loading` shows "Starting on {device}" and a busy play button. A release clears
  the active device (plan 12), the role becomes `idle`, and the local player returns; plan 35 loads
  the shared item paused when there is one. A device that vanishes stays as "Playing on {device}"
  until presence expires (about 50 s, area A); nothing here shortens that.
- **This phone's stream is down (R59).** `unavailable` shows the local player. The phone does not
  keep drawing a remote state it can no longer verify.
- **Signed out and non-members (R67).** `availability` is `off` (plan 31), so the display is always
  local and the device control is never shown. Nothing in area E checks auth or membership itself.
- **Device names (R40).** A device is named by its session's `device_label`; with no label, by its
  client type through `settings.account.sessions.client_type_web` / `client_type_mobile`. When
  `sameLabelNumber` is set, the name gets a number: "iPhone · iOS (2)". When the active device is
  not in the device list (a stale list), the name is "Another Device".
- **Status copy is sentence case.** "Playing on {device}" is a status line, not a label
  (**ui-copy-casing**). Titles and buttons are title case.

## `crossDevicePlayerDisplay.ts` (pure)

Imports: the plan 10 and 11 subpaths (`@podverse/helpers/accountPlaybackStream`,
`@podverse/helpers/crossDevicePlayback`), `../playbackTransport` for `PlaybackTransportState`, and
the store's types from `./crossDevicePlaybackStore` (type-only). No React, no React Native.

```typescript
export type CrossDevicePlayerDisplay =
  | { kind: 'local' }
  | {
      kind: 'remote';
      resource: DTOPlaybackResourceSummary;
      status: PlaybackStatus;
      transportState: PlaybackTransportState;
      isLive: boolean;
      durationSeconds: number | null;
      rate: number;
      /** The active device's list entry; null when it is not in the device list. */
      activeDevice: PlaybackDeviceListEntry | null;
      controls: PlaybackRemoteControls;
    };

export const LOCAL_PLAYER_DISPLAY: CrossDevicePlayerDisplay;

export function resolveCrossDevicePlayerDisplay(params: {
  view: CrossDevicePlaybackView;
  isAuthoringHold: boolean;
}): CrossDevicePlayerDisplay;

/** Row media id of a shared resource, comparable with `playbackTargetRowMediaId`. */
export function playbackResourceRefRowMediaId(ref: DTOPlaybackResourceRef): string;

/** Remote row state with no authoring-hold input; rows never read the session context. */
export function selectRemoteRowMediaId(view: CrossDevicePlaybackView): string | null;
export function selectRemoteRowIsPlaying(view: CrossDevicePlaybackView): boolean;

export function selectPlaybackDeviceSwitchVisible(view: CrossDevicePlaybackView): boolean;
export function selectPlaybackDeviceEntries(view: CrossDevicePlaybackView): PlaybackDeviceListEntry[];
/** Shared state that a take-over could move: a non-null state with a resource. */
export function selectCanTransferPlayback(view: CrossDevicePlaybackView): boolean;

export function remotePlaybackTransportState(status: PlaybackStatus): PlaybackTransportState;
export function remotePlaybackStatusLabelKey(status: PlaybackStatus):
  | 'media_player.devices.playing_on'
  | 'media_player.devices.paused_on'
  | 'media_player.devices.starting_on';

export type PlaybackDeviceLabelKey =
  | 'settings.account.sessions.client_type_web'
  | 'settings.account.sessions.client_type_mobile'
  | 'media_player.devices.same_label_number'
  | 'media_player.devices.another_device';
export type PlaybackDeviceLabelTranslate = (
  key: PlaybackDeviceLabelKey,
  values?: Record<string, string | number>
) => string;

export function formatPlaybackDeviceLabel(
  entry: PlaybackDeviceListEntry | null,
  translate: PlaybackDeviceLabelTranslate
): string;

export function transferFailureMessageKey(reason: CrossDevicePlaybackTransferFailureReason):
  | 'media_player.devices.transfer_failed_load_failed'
  | 'media_player.devices.transfer_failed_autoplay_blocked'
  | 'media_player.devices.transfer_failed_timeout'
  | 'media_player.devices.transfer_failed_not_connected'
  | 'media_player.devices.transfer_failed_send_failed';
```

Rules:

- `resolveCrossDevicePlayerDisplay` returns `LOCAL_PLAYER_DISPLAY` (one frozen object, so callers can
  compare by identity) unless the rule in "When the phone shows another device" holds. For remote:
  `isLive = state.is_live`, `durationSeconds = state.duration_seconds`, `rate = state.rate`,
  `transportState = remotePlaybackTransportState(state.status)`,
  `controls = getPlaybackRemoteControls({ isLive })`, and `activeDevice` is the entry of
  `selectPlaybackDeviceEntries(view)` with `isActive`, or null.
- `playbackResourceRefRowMediaId`: exhaustive `switch` on `ref.kind` with no `default`: `item` →
  `item_id_text`, `clip` → `clip_id_text`, `soundbite` → `item_soundbite_id_text`, `add_by_rss` →
  `add_by_rss_hash_id`. These are the same ids `playbackTargetRowMediaId`
  (`apps/mobile/src/lib/playback/buildPlaybackTarget.ts`) returns for those target kinds.
- `selectRemoteRowMediaId`: the same availability, role, and resource checks as the resolver
  (without the hold), then `playbackResourceRefRowMediaId(state.resource.ref)`; else null.
- `selectRemoteRowIsPlaying`: true only when `selectRemoteRowMediaId` is non-null and
  `state.status !== 'paused'` (a starting remote counts as playing, so the row offers Pause).
- `selectPlaybackDeviceSwitchVisible`: `availability === 'ready'`, `devices !== null`, and
  `shouldShowPlaybackDeviceSwitch(devices.devices)`.
- `selectPlaybackDeviceEntries`: `buildPlaybackDeviceList({ devices: devices?.devices ?? [],
  thisSessionIdText, activeSessionIdText })` over the view.
- `remotePlaybackTransportState`: `playing` → `'playing'`, `paused` → `'paused'`, `loading` →
  `'loading'`. Exhaustive `switch`, no `default`.
- `formatPlaybackDeviceLabel`: null → `translate('media_player.devices.another_device')`. Else base =
  trimmed `device_label` when non-empty, otherwise the client-type key (exhaustive `switch` on
  `client_type`, no `default`). With `sameLabelNumber !== null`, return
  `translate('media_player.devices.same_label_number', { device: base, number: sameLabelNumber })`;
  else the base.
- `transferFailureMessageKey`: exhaustive `switch` over the five reasons, no `default`.

## `useCrossDevicePlayerDisplay.ts`

React hooks over the store. Each `useSyncExternalStore` snapshot is either the store's view (its
identity only changes on a change) or a primitive, so list rows re-render only when their answer
changes (**mobile-row-render-cost**).

```typescript
export function useCrossDevicePlaybackView(): CrossDevicePlaybackView;
/** Mini player and full player. Reads `isAuthoringHold` from `usePlaybackSession()`. */
export function useCrossDevicePlayerDisplay(): CrossDevicePlayerDisplay;
/** Whole-second estimate of the remote position; null when live or unknown. */
export function useRemotePlaybackPositionSeconds(): number | null;
export function usePlaybackDeviceSwitchVisible(): boolean;
/** Rows: the active media id and whether it plays, from the other device when it is active. */
export function usePlaybackRowDisplay(): {
  activeMediaId: string | null;
  isPlaying: boolean;
  isRemote: boolean;
};
/** Binds `formatPlaybackDeviceLabel` to `useTranslation().t`. */
export function usePlaybackDeviceLabel(): (entry: PlaybackDeviceListEntry | null) => string;
```

- `useCrossDevicePlaybackView`: `useSyncExternalStore(subscribeCrossDevicePlaybackView,
  getCrossDevicePlaybackView, getCrossDevicePlaybackView)`.
- `useCrossDevicePlayerDisplay`: the view plus `usePlaybackSession().isAuthoringHold`, then
  `useMemo(() => resolveCrossDevicePlayerDisplay({ view, isAuthoringHold }), [view,
  isAuthoringHold])`.
- `useRemotePlaybackPositionSeconds`: `useSyncExternalStore(subscribeCrossDevicePlaybackPositionClock,
  () => wholeSeconds(getCrossDevicePlaybackPositionSeconds(Date.now())), same)`, where
  `wholeSeconds` floors a number and keeps null. The snapshot is a primitive, so a paused state does
  not re-render.
- `usePlaybackDeviceSwitchVisible`: `useSyncExternalStore` with
  `() => selectPlaybackDeviceSwitchVisible(getCrossDevicePlaybackView())`.
- `usePlaybackRowDisplay`: reads `usePlaybackRow().activeTarget` and `usePlaybackIsPlaying()` from
  `../PlaybackProvider`, plus two `useSyncExternalStore` calls with `selectRemoteRowMediaId` and
  `selectRemoteRowIsPlaying`. When the remote id is non-null, return `{ activeMediaId: remoteId,
  isPlaying: remoteIsPlaying, isRemote: true }`; else `{ activeMediaId: activeTarget === null ? null
  : playbackTargetRowMediaId(activeTarget), isPlaying, isRemote: false }`. Rows ignore the
  authoring hold: the Make Clip screen covers every list while the hold is on.
- `usePlaybackDeviceLabel`: `useTranslation()`; return a `useCallback` that calls
  `formatPlaybackDeviceLabel(entry, (key, values) => t(key, values))`.

## Catalog keys

Add one object `devices` inside the consumer catalog's existing `media_player` object, in all four
originals, after `handoff`. Values use the catalog's existing `{name}` placeholders. Use a straight
apostrophe in `en-US`, as the surrounding English strings do.

| Key | en-US | es | fr | el-GR |
| --- | --- | --- | --- | --- |
| `switch_device` | Switch Device | Cambiar dispositivo | Changer d’appareil | Αλλαγή συσκευής |
| `switch_device_pending` | Moving Playback to {device} | Moviendo la reproducción a {device} | Transfert de la lecture vers {device} | Μεταφορά αναπαραγωγής σε {device} |
| `sheet_title` | Play On | Reproducir en | Lire sur | Αναπαραγωγή σε |
| `this_device_entry` | {device} (This Device) | {device} (este dispositivo) | {device} (cet appareil) | {device} (αυτή η συσκευή) |
| `same_label_number` | {device} ({number}) | {device} ({number}) | {device} ({number}) | {device} ({number}) |
| `another_device` | Another Device | Otro dispositivo | Un autre appareil | Άλλη συσκευή |
| `playing_on` | Playing on {device} | Reproduciendo en {device} | Lecture sur {device} | Αναπαραγωγή σε {device} |
| `paused_on` | Paused on {device} | En pausa en {device} | En pause sur {device} | Σε παύση σε {device} |
| `starting_on` | Starting on {device} | Iniciando en {device} | Démarrage sur {device} | Έναρξη σε {device} |
| `transfer_failed_title` | Playback Didn't Start | La reproducción no se inició | La lecture n’a pas démarré | Η αναπαραγωγή δεν ξεκίνησε |
| `transfer_failed_load_failed` | {device} couldn't load this media. | {device} no pudo cargar este contenido. | {device} n’a pas pu charger ce média. | Η συσκευή {device} δεν μπόρεσε να φορτώσει αυτό το μέσο. |
| `transfer_failed_autoplay_blocked` | {device} needs a tap to start playback. Press Play there. | {device} necesita un toque para empezar a reproducir. Pulsa Reproducir allí. | {device} a besoin d’un appui pour lancer la lecture. Appuyez sur Lecture sur cet appareil. | Η συσκευή {device} χρειάζεται ένα πάτημα για να ξεκινήσει την αναπαραγωγή. Πατήστε Αναπαραγωγή εκεί. |
| `transfer_failed_timeout` | {device} didn't respond. Check that Podverse is open there. | {device} no respondió. Comprueba que Podverse esté abierto allí. | {device} n’a pas répondu. Vérifiez que Podverse y est ouvert. | Η συσκευή {device} δεν απάντησε. Ελέγξτε ότι το Podverse είναι ανοιχτό εκεί. |
| `transfer_failed_not_connected` | {device} is no longer connected. | {device} ya no está conectado. | {device} n’est plus connecté. | Η συσκευή {device} δεν είναι πλέον συνδεδεμένη. |
| `transfer_failed_send_failed` | Couldn't reach {device}. Try again. | No se pudo contactar con {device}. Inténtalo de nuevo. | Impossible de joindre {device}. Réessayez. | Δεν ήταν δυνατή η επικοινωνία με τη συσκευή {device}. Δοκιμάστε ξανά. |
| `command_failed_title` | Couldn't Control Playback | No se pudo controlar la reproducción | Impossible de contrôler la lecture | Δεν ήταν δυνατός ο έλεγχος της αναπαραγωγής |
| `command_failed_body` | The playing device didn't receive that. Try again. | El dispositivo que reproduce no lo recibió. Inténtalo de nuevo. | L’appareil en lecture ne l’a pas reçu. Réessayez. | Η συσκευή αναπαραγωγής δεν το έλαβε. Δοκιμάστε ξανά. |

When an area D plan already added a `media_player.devices` object with keys of the same meaning,
keep its keys, add only the ones above that are missing, and use its names in this plan's code.
Report every name you mapped in the final message so plans 51–57 use the same names.

Reused, not added: `media.livestream.live` (Live label), `misc.dismiss`, `misc.cancel`,
`settings.account.sessions.client_type_web` / `client_type_mobile`.

## `apps/mobile/vitest.config.ts`

Add `src/playback/crossDevice/crossDevicePlayerDisplay.test.ts` to `include` in alphabetical
position, and one header clause: "the cross-device player display — when the phone draws another
device's playback, device names, and failure copy
(`src/playback/crossDevice/crossDevicePlayerDisplay.ts`)".

## Tests

`crossDevicePlayerDisplay.test.ts` builds views with a small `makeView(overrides)` helper:

- Remote display only when ready, remote, with a resource, and no hold. Each of these alone gives
  local: `off`, `pending`, `unavailable`, `role: 'active'`, `role: 'idle'`, a null resource, and
  `isAuthoringHold: true`. Local returns the same `LOCAL_PLAYER_DISPLAY` object.
- A live remote state gives `controls.canSeek === false` and `controls.canSetRate === false`;
  `paused` maps to `'paused'` and `paused_on`, and `loading` maps to `'loading'` and `starting_on`.
- `activeDevice` is null when the active id is not in the device list.
- `playbackResourceRefRowMediaId` returns each kind's id; `selectRemoteRowMediaId` is null for a
  `pending` view; `selectRemoteRowIsPlaying` is true for `loading` and false for `paused`.
- `selectPlaybackDeviceSwitchVisible` is false with one device or when not ready, and true with two.
- `formatPlaybackDeviceLabel` (with a recording `translate`): a label is trimmed, a null label uses
  the client-type key, a same-label number wraps the base, and null gives `another_device`.
- `transferFailureMessageKey` returns a distinct key for each reason.

## Release scratchpad

none
