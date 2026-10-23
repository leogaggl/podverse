**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 50 — Banner notification kinds, defaults, and device prefs

Which notifications may show a mobile banner, and the device-local switches that choose. No UI.
Plan 51 paints the card. Plan 52 reads these prefs from Notification settings. Plan 53 presents
a notification only when this module says so.

Other work is landing in the tree. Before editing, confirm these still exist:

- `DTOAccountNotification` in `packages/helpers/src/dtos/account/accountNotification.ts`
  (`category`, `title`, `body`, `payload`).
- `NotificationCategoryEnum` in `packages/helpers/src/lib/notificationCategory.ts`.
- `htmlToPlainTextPreview` exported from `@podverse/helpers/html`.
- The AsyncStorage mock pattern in `apps/mobile/src/prefs/homeListPrefs.test.ts`.

## Rows

R14, R16, R32

## Runs after

none

## Files

apps/mobile/src/notifications/bannerNotificationPolicy.ts
apps/mobile/src/notifications/bannerNotificationPolicy.test.ts
apps/mobile/src/prefs/bannerNotificationPrefs.ts
apps/mobile/src/prefs/bannerNotificationPrefs.test.ts
apps/mobile/vitest.config.ts

## Reuses

- `NotificationCategoryEnum` for the category on `DTOAccountNotification`. Parser rows store the
  message type on `payload.type` (`new-episode`, `new-track`, `livestream-started`, …). The
  account type `new-item` is the switch the operator named, not that payload string.
- Device prefs stay in AsyncStorage (`downloadPrefs.ts`, `homeListPrefs.ts`). Do not add a key to
  `prefsStore.ts`. These switches are not per-podcast defaults, so there is no apply-to-existing
  dialog.

## Kinds and defaults

```typescript
export const BANNER_NOTIFICATION_KINDS = [
  'new-item',
  'livestream-started',
  'livestream-scheduled',
  'product-update',
  'maintenance',
  'terms-of-service',
  'general',
] as const;

export type BannerNotificationKind = (typeof BANNER_NOTIFICATION_KINDS)[number];

export const DEFAULT_BANNER_NOTIFICATION_ENABLED: Record<BannerNotificationKind, boolean> = {
  'new-item': true,
  'livestream-started': true,
  'livestream-scheduled': false,
  'product-update': false,
  maintenance: false,
  'terms-of-service': false,
  general: false,
};
```

On by default: New Item (`new-item`) and Livestream Started. Off by default: Livestream Scheduled
and the admin categories. A missing stored key uses that default, so an install with no saved
value matches this table (R16).

Label keys, so Settings and this list cannot drift. The strings already exist in the consumer
catalog. Do not add copies.

```typescript
export const BANNER_NOTIFICATION_KIND_LABEL_KEY: Record<BannerNotificationKind, string> = {
  'new-item': 'settings.notifications.new_item',
  'livestream-started': 'settings.notifications.livestream_started',
  'livestream-scheduled': 'settings.notifications.livestream_scheduled',
  'product-update': 'settings.notifications.category_product_update',
  maintenance: 'settings.notifications.category_maintenance',
  'terms-of-service': 'settings.notifications.category_terms_of_service',
  general: 'settings.notifications.category_general',
};
```

## Matching a notification to a kind

```typescript
export type BannerNotificationSource = {
  category: NotificationCategoryValues;
  payload: Record<string, unknown> | null;
};

export function bannerKindForNotification(
  notification: BannerNotificationSource
): BannerNotificationKind | null;

export function shouldShowBannerNotification(
  notification: BannerNotificationSource,
  enabled: Readonly<Record<BannerNotificationKind, boolean>>
): boolean;
```

Import `NotificationCategoryEnum` as a value and `NotificationCategoryValues` with `import type`,
both from `@podverse/helpers`, the same way `MoreSettingsNotificationsScreen` does.

Read the payload message from `payload.type`, then `payload.messageType`. A non-empty trimmed
string counts. Anything else is no message type.

`bannerKindForNotification`, exhaustive on `NotificationCategoryEnum`, no default arm:

- `new-content` → `'new-item'`, whatever the payload message type is (`new-episode`, `new-track`,
  `new-album`, `new-video`, `new`, and the rest).
- `livestream` → `'livestream-started'` or `'livestream-scheduled'` when the payload message type
  is exactly that string. Any other livestream payload, including a missing type, returns null.
  No banner.
- `product-update` → `'product-update'`
- `maintenance` → `'maintenance'`
- `terms-of-service` → `'terms-of-service'`
- `general` → `'general'`

If TypeScript does not treat the union as exhaustive, a trailing `return null` after the switch
is allowed. That path shows no banner.

`shouldShowBannerNotification` is false when the kind is null, and otherwise `enabled[kind]`.

```typescript
export function resolveBannerNotificationEnabled(
  stored: Partial<Record<BannerNotificationKind, boolean>> | null
): Record<BannerNotificationKind, boolean>;
```

Start from `DEFAULT_BANNER_NOTIFICATION_ENABLED`. For each kind, if `stored[kind]` is a boolean,
use it. Ignore every other value. Return a new object.

## Summary text

Plan 53 passes this to the card. One line of title, and one line of body when there is one.
No category label and no relative time.

```typescript
export function bannerNotificationCopy(notification: {
  title: string;
  body: string | null;
}): { title: string; body: string | null } | null;
```

- Run `htmlToPlainTextPreview` from `@podverse/helpers/html` on `body` with max 140 characters.
  Collapse whitespace, trim, and treat `''` as no body.
- Collapse whitespace and trim `title`.
- When the title is empty and the body is not, the title is the body and the body is null.
- When both are empty, return null. Plan 53 does not present that notification.

## Prefs (`bannerNotificationPrefs.ts`)

Device-local. Kept across sign-out. Not account data: do not clear them from `clearSession` or
from the `status === 'anonymous'` effect. A comment in the file says that.

```typescript
export const BANNER_NOTIFICATION_PREFS_KEY = 'notifications.banner_kinds';

export function getBannerNotificationEnabled(): Record<BannerNotificationKind, boolean>;
export function isBannerNotificationPrefsHydrated(): boolean;
export function subscribeBannerNotificationPrefs(listener: () => void): () => void;
export function hydrateBannerNotificationPrefs(): Promise<void>;
export function setBannerNotificationEnabled(
  kind: BannerNotificationKind,
  enabled: boolean
): Promise<void>;
```

- Storage value is a JSON object. `JSON.parse` inside try; a throw, a non-object, or an array
  resolves to the defaults.
- `getBannerNotificationEnabled` returns a copy of the memory cache, or a copy of the defaults
  when the cache is still empty. Callers cannot mutate the cache.
- `isBannerNotificationPrefsHydrated` is false until the first `hydrateBannerNotificationPrefs`
  settles, including one that discards its read because a `set` won the race. A `set` before
  hydrate also marks the prefs hydrated, because the cache is then the user's value.
- `hydrateBannerNotificationPrefs` reads the key and fills the cache, then notifies listeners.
  A `set` that happened while that read was in flight wins: bump a generation on every `set`
  and on the start of `hydrate`, and ignore a read whose generation is no longer current.
  That ignored read does not notify again. The `set` already did.
- `setBannerNotificationEnabled` updates the cache and notifies listeners before the
  `AsyncStorage.setItem` write. The stored object is the full seven-key map.
- A listener that throws is caught and logged with `console.warn`. One listener cannot break
  the others.
- No React in this file. No React Native besides AsyncStorage.

## Tests

`bannerNotificationPolicy.test.ts` (no mocks):

- `new-content` with payload `{ type: 'new-episode' }` is kind `new-item` and shows when that
  switch is on.
- `new-content` with `payload: null` is still `new-item`.
- `livestream` with `type: 'livestream-started'` and `type: 'livestream-scheduled'` map to those
  kinds. `type: 'other'`, a missing type, and `payload: null` return null and do not show.
- Each admin category maps to its kind and is hidden when that switch is off.
- Defaults: `new-item` and `livestream-started` true; the other five false.
- `resolveBannerNotificationEnabled(null)` equals the defaults. A stored `{ 'new-item': false,
  'livestream-scheduled': true, extra: true }` flips those two and ignores `extra`.
- Copy: a title and an HTML body become a trimmed title and plain body. An empty title with a
  body becomes that body as the title. Whitespace-only title and null body return null.

Build objects with the fields the function takes. No `as`.

`bannerNotificationPrefs.test.ts`: mock AsyncStorage the way `homeListPrefs.test.ts` does.
Reset the module cache between tests (`vi.resetModules()` plus a fresh import, or a test-only
reset if the module already exposes one — prefer `vi.resetModules()` so production code stays
free of a test hook).

- Empty storage hydrates to the defaults.
- Set `livestream-scheduled` to true, hydrate again in a new import after the mock kept the
  value, and read true for that kind and the defaults for the rest.
- A stored string that is not JSON hydrates to the defaults.
- A `set` during an in-flight hydrate is still the value after that hydrate settles. Hold the
  `getItem` promise, call `set`, then resolve `getItem` with an older payload.

`apps/mobile/vitest.config.ts`: add two include entries, and name both modules in the header
comment's covered-modules list. Do not rewrite the array.

- `src/prefs/bannerNotificationPrefs.test.ts`
- `src/notifications/bannerNotification*.test.ts`

The glob is what collects plan 51's queue test and plan 53's store test. Leave it as a glob.

## Release scratchpad

none
