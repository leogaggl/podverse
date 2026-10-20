# 08 — Play and show media from hosts that block websites at a redirect

**Cursor model:** Codex 5.3 · **Reasoning:** high

## Summary

Muse AI answers every artwork and audio URL with a 302 that carries
`Cross-Origin-Resource-Policy: same-origin`, so browsers refuse the load. The final CDN URL sends
`cross-origin` and loads fine. Add a server route that follows the redirect chain and returns the
final URL, and have the player and shared image components ask it once after a failed load. No
media bytes pass through our servers. Depends on 02 (`Image` structure) and 07 (error state).

## Constraints

- The route returns a URL and a reason. It never returns media bytes.
- Every hop is checked for SSRF before it is requested, including DNS resolution.
- No credentials: reject URLs with userinfo, send no `Authorization`, and never call the route
  for an Add by RSS feed that has stored credentials.
- Rate-limited like `apps/web/src/app/api/proxy/route.ts`.

## `fetchWithTimeout` redirect option

`packages/helpers-backend/src/fetchWithTimeout.ts` options are `body, cache, headers, method,
timeoutMs, maxBodyBytes`. Add `redirect?: RequestRedirectMode` with a local
`type RequestRedirectMode = 'error' | 'follow' | 'manual'` (same pattern as the local
`RequestCache` type) and pass it to `fetch`. Default stays `follow`. Unit test it.

## Route

New `apps/web/src/app/api/resolve-media-url/route.ts`, `GET ?url=`.

1. `checkRateLimit(req)` from `apps/web/src/utils/proxy/`; 429 when limited.
2. Parse the URL. Reject userinfo with 400.
3. Validate each hop, the first included:
   - `validateProxyUrl(url)` (`apps/web/src/utils/proxy/urlValidator.ts`) for format and its
     localhost policy (allowed outside production or with `ALLOW_LOCALHOST_PROXY=true`).
   - Unless the hop is loopback allowed by that same policy, `validateOutboundFetchUrl` from
     `@podverse/helpers-requests/outbound-http-policy`, which resolves DNS and rejects
     non-unicast addresses.
4. Request with `fetchWithTimeout(hop, { method: 'HEAD', redirect: 'manual', timeoutMs:
   PROXY.TIMEOUT_MS, headers: { 'User-Agent': config.proxy.userAgent }, maxBodyBytes: 0 })`.
   If the host answers 405 or 501 to HEAD, retry that hop once as `GET` with `Range: bytes=0-0`
   and `maxBodyBytes: 0`.
5. A 3xx with `Location`: resolve it against the hop URL, validate (step 3), continue. At most 5
   redirects.
6. Respond `200` with JSON `{ url: string | null, reason, httpStatus? }`:
   - `resolved`: final 2xx/206, and its CORP is absent or `cross-origin`, and the final URL
     differs from the input. `url` is the final URL.
   - `same_url`: no redirect happened; resolving cannot help.
   - `blocked_final`: the final response's CORP is `same-origin` or `same-site`.
   - `http_error` with `httpStatus`: any hop returned 4xx or 5xx.
   - `too_many_redirects`, `invalid` (validation failed), `network` (timeout or connection
     error).
7. `Cache-Control: private, max-age=600`. Log unexpected failures once with the host only, never
   the full URL query (signed CDN URLs carry tokens).

Unit tests with `fetchWithTimeout` and DNS mocked: a two-hop chain resolves; a hop to a private
address is rejected; userinfo is rejected; six redirects stop; final CORP `same-origin` gives
`blocked_final`; 404 gives `http_error`; HEAD 405 falls back to ranged GET; the rate limit
returns 429.

## Client helper

New `apps/web/src/utils/media/resolveMediaUrl.ts`: calls the route with `request` from
`@podverse/helpers-requests` (no raw `fetch`), memoizes per input URL for 10 minutes, and
shares an in-flight promise for the same URL. Unit test the cache and dedupe.

## Player

In the error path from 07, before setting the error state:

- When the kind would be `host-blocked` (media error 4 or `NotSupportedError`), the URL is
  `http(s)` with no userinfo, the item is not a credentials-protected Add by RSS feed, and this
  item has not been resolved yet: call `resolveMediaUrl` once.
- `resolved`: set the media element's source to the returned URL, keep the position and the
  playing state, and do not write the resolved URL into resource data or the server (it is
  signed and expires). If that load fails too, show the error.
- Otherwise map the reason: `blocked_final` → `host-blocked`; `http_error` 404 or 410 →
  `file-not-found`; other `http_error` → `host-http` with `httpStatus`; anything else →
  `host-blocked`. The detail line includes the reason.
- Track "already resolved" per loaded identity so Try Again starts fresh.

## Shared images

`packages/ui` cannot import web code. Add an optional `resolveBlockedImageUrl?: (url: string) =>
Promise<string | null>` to `ImageRuntimeProvider` (`packages/ui/src/components/image/ImageRuntime/`)
and pass it from `apps/web/src/providers/Providers.tsx`, backed by `resolveMediaUrl` (returns the
URL only for `resolved`).

- `Image` (`onLoadFailure` advances `attemptIndex` through `resolvedChain`) and `ImageNonReact`
  (`onImageError` advances `index`): when a remote source fails and the browser loaded it
  directly, call the resolver once for that source and try the returned URL before moving on.
  Then continue the chain and finally the placeholder.
- "Loaded directly" means neither the image proxy (`imageProxyEnabled && !skipProxy`) nor Next
  image optimization handled it. Those fetch on the server, where CORP does not apply, so the
  resolver must not run for them.
- Never resolve the placeholder or a same-origin path.

Unit tests in `packages/ui`: resolver called once after a direct failure; resolved URL rendered;
not called when proxied or optimized; placeholder after a null result.

## Test assets and E2E

- `tools/test-assets/src/constants.ts` and `asset-server.ts`: next to
  `REDIRECT_OTHER_HOST_PREFIX`, add two prefixes that 302 to the same path on the other loopback
  host (`otherLoopbackHost`): one sends `Cross-Origin-Resource-Policy: same-origin` on the 302
  only, the other also makes the final file response send `same-origin`.
- Web E2E server env (`buildE2eWebServers`, used by `apps/web/playwright.config.ts`): set
  `ALLOW_LOCALHOST_PROXY=true` if it is not already, so the route accepts the test-assets host.
- New `apps/web/e2e/media-player-blocked-host.spec.ts`. Top-level `describe`: "Media behind a
  blocking redirect". Post an Add by RSS now-playing row with `page.request` (as in 06) whose
  enclosure and artwork use the first prefix: artwork loads (`naturalWidth > 0`) and audio time
  advances after play. A second test uses the second prefix: the error button appears and the
  modal shows the `host_blocked` reason. If the E2E env proxies or optimizes images, assert
  artwork only where it loads directly, and say so in your final message.

## Scratchpad entry

```markdown
## Web plays and shows media from hosts that block websites at a redirect

- Surfaces: web, packages (helpers-backend, ui), test-assets
- Change: Some hosts (Muse AI) block browsers at a redirect even though the final file allows
  them. After a failed load, web asks a new server route for the final address and loads it
  directly. No audio passes through Podverse servers, every hop is SSRF-checked, and credentials
  are never sent. When the final host blocks too, the player explains it.
- Who notices: listeners of Muse AI feeds and similar hosts on web
- Operator steps: none; the route is rate-limited with the existing proxy limiter
```

## Done when

- [x] `fetchWithTimeout` `redirect` option
- [x] Route with per-hop SSRF and DNS checks, no bytes, rate limit, cache header
- [x] Client helper; player and both image components call it once
- [x] Test-assets prefixes, E2E env, unit tests, E2E spec, scratchpad entry

## Operator verification

**Root**

```bash
npm run build:packages
npm run test -w packages/helpers-backend
npm run test -w packages/ui
npm run test -w apps/web
npm run build -w tools/test-assets
make e2e_test_web_report_spec SPEC=e2e/media-player-blocked-host.spec.ts,e2e/media-player-playback-error.spec.ts,e2e/image-placeholder-centering.spec.ts
open .artifacts/e2e-reports/latest/index.html
```

After deploy, play the Muse AI test feed on alpha web. Artwork and audio should load.
