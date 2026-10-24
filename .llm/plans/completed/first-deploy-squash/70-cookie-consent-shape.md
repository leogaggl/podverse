**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# Cookie banner reads only the current consent shape

The local-settings cookie stores the banner choice as `cc` with `v: 2` and `choice` of `all`, `essential`, or `none`. `normalizeCookieConsentState` in `apps/web/src/lib/cookieConsent/cookieConsentPolicy.ts` also rewrites older shapes this app no longer writes: `features` becomes `essential`, an unversioned `essential` becomes `none`, and an unversioned `all` stays `all`. That rewrite exists only so a browser that saved a choice on an older v5 build keeps it. A first deploy has no such cookies to preserve.

`COOKIE_CONSENT_MODEL_VERSION` stays `2`. Writers in `setCookieConsent` (`localSettings.ts`) and `LocalSettings.tsx` keep writing `{ choice, at, v: 2 }`. Do not renumber the model to 1.

## Rows

R23, R30

## Runs after

none

## Files

- apps/web/src/lib/cookieConsent/cookieConsentPolicy.ts
- apps/web/src/lib/cookieConsent/cookieConsentPolicy.test.ts
- apps/web/src/utils/localSettings/localSettings.ts
- apps/web/src/utils/localSettings/localSettings.cc.test.ts

## What to change

`normalizeCookieConsentState` returns a state only when `at` is a non-empty string, `v === COOKIE_CONSENT_MODEL_VERSION`, and `choice` is `all`, `essential`, or `none`. Every other shape returns `undefined`, including `features`, a missing `v`, and any `v` other than 2.

Delete `normalizeCookieConsentChoice`, `LegacyCookieConsentChoice`, and `isLegacyCookieConsentChoice`. Nothing outside the policy test imports `normalizeCookieConsentChoice`.

In `localSettings.ts`, a consent object that is not the current shape must not invalidate the rest of the cookie. Today `isValidLocalSettings` rejects the whole cookie when `cc.choice` is outside `isStoredCookieConsentChoice`, and the catch path clears `local-settings`. Change that:

- `cc` may be missing, or a non-null object that is not an array. Any other `cc` still makes the cookie invalid.
- `parseCookieConsentState` calls `normalizeCookieConsentState` only for that object shape, and stores `undefined` when normalize returns `undefined`.
- Delete `isStoredCookieConsentChoice` and `isValidCookieConsentState`. They exist to accept `features` and then remap it.

Use a type guard for the object check. Do not add a new `as` assertion.

Leave every other local-settings field alone. Missing `pmt` or `bae` still fills from the defaults. A sidebar object that has keys besides `library` still contributes its `library` boolean.

## Tests

Update `cookieConsentPolicy.test.ts`:

- Keep the pass-through of current choices is not required once `normalizeCookieConsentChoice` is gone. Delete that describe block with the function.
- `normalizeCookieConsentState` keeps a `v: 2` state unchanged.
- `{ choice: 'features', at }`, `{ choice: 'essential', at }`, `{ choice: 'all', at }`, and `{ choice: 'essential', at, v: 1 }` each return `undefined`.

Add `localSettings.cc.test.ts` beside `localSettings.pmt.test.ts`, same cookie helpers. A cookie whose other fields are valid and whose `cc` is `{ choice: 'features', at: '2026-01-01T00:00:00.000Z' }` still returns those other fields (assert `uit`) and `cc` undefined. A `v: 2` `essential` choice round-trips. An unversioned `essential` leaves `cc` undefined and keeps `uit`.

No Playwright spec. The banner's current choices stay covered by existing web E2E. A spec that plants `features` would re-encode the shape this change stops reading.

## Release scratchpad

```markdown
## Web cookie banner ignores older consent cookies

- Surfaces: web
- Change: The local-settings cookie keeps a cookie-banner choice only when it is model version 2 (`all`, `essential`, or `none`). An older choice, including `features` and an unversioned `essential`, is ignored. The rest of the cookie (theme, sort, sidebar) stays. The banner shows until the visitor chooses again.
- Who notices: browsers that saved a consent choice before this version
- Operator steps: none
```
