**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# Share links read EXPO_PUBLIC_MOBILE_WEB_BASE_URL only

`make local_env_setup` writes the public web origin to `EXPO_PUBLIC_MOBILE_WEB_BASE_URL` from `BRAND_DOMAIN`. `getMobilePublicWebBaseUrlFromEnv` and `app.config.ts` still fall back to `WEB_BASE_URL` when that key is unset. The fallback is an older env name. A current local env and EAS env use the `EXPO_PUBLIC_` key. Remove the fallback.

## Rows

R10, R19

## Runs after

none

## Files

- apps/mobile/src/config/env.ts
- apps/mobile/src/config/publicWebBaseUrl.test.ts
- apps/mobile/vitest.config.ts
- apps/mobile/app.config.ts
- apps/mobile/.env.example

## Tests

Add `publicWebBaseUrl.test.ts` and register it in `vitest.config.ts` `test.include`, beside `src/config/customApiUrl.test.ts`. No Maestro flow. This is an env read.

## Release scratchpad

Do not edit `release-notes/scratchpad.md` in this prompt. The set's last prompt appends this entry:

```markdown
## Mobile web origin is one env key

- Surfaces: mobile
- Change: share links and universal links read `EXPO_PUBLIC_MOBILE_WEB_BASE_URL` only.
  `WEB_BASE_URL` is not a fallback. Unset still means no https host.
- Who notices: a local or EAS environment that set only `WEB_BASE_URL`
- Operator steps: set `EXPO_PUBLIC_MOBILE_WEB_BASE_URL`. `make local_env_setup` already writes it
  from `BRAND_DOMAIN`
```

## Code

`getMobilePublicWebBaseUrlFromEnv` returns `normalizeBaseUrl` of `EXPO_PUBLIC_MOBILE_WEB_BASE_URL`, or null when that value is unset. Delete the `WEB_BASE_URL` read and the local named `legacy`. The doc comment names only `EXPO_PUBLIC_MOBILE_WEB_BASE_URL`, and says null when it is unset.

`app.config.ts` `universalLinkHost` uses `EXPO_PUBLIC_MOBILE_WEB_BASE_URL` only. Delete the `WEB_BASE_URL` line.

In `apps/mobile/.env.example`, delete the comment line `When unset, also reads WEB_BASE_URL. If both are unset, this build has no https host.` Replace it with: when this key is unset, the build has no https host. Do not edit `apps/mobile/.env`.

## Test

`env.ts` imports `react-native`. Mock it before importing the function:

```typescript
vi.mock('react-native', () => {
  return { Platform: { OS: 'ios' } };
});
```

Cover three cases, saving and restoring `process.env`:

- `EXPO_PUBLIC_MOBILE_WEB_BASE_URL=https://example.com/` returns `https://example.com`.
- Only `WEB_BASE_URL=https://example.com` returns null.
- Both unset returns null.

## Leave in place

- Default deep-link schemes `podverse-next` and `podverse`. `podverse` is the v4 scheme alias. Do not remove it.
- Do not edit `.cursor/rules/mobile-deep-links-and-prod-cutover.mdc`. Another area owns that file. It still says an unset public URL also checks `WEB_BASE_URL`. That sentence is noted for the owner.
