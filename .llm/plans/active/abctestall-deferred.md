# abctestall deferred

## Web notification stream replay header

- Command: `make e2e_test_web` (suite), then
  `npm run test:e2e -w @podverse/web -- e2e/notifications-inbox.spec.ts -g "replay from that notification"`
- Assertion: `requests[1].headers()['last-event-id']` is `"951"` in
  `apps/web/e2e/notifications-inbox.spec.ts` ("When the stream reconnects after a new
  notification, it asks the server to replay from that notification.")
- What I tried: Confirmed the second GET is the browser reconnect (`retry: 100`, about 110ms
  later, same URL, no preflight). `MessageEvent.lastEventId` on `notification.created` is
  `"951"`. `request.headers()` and `request.allHeaders()` inside `page.route` do not include
  `Last-Event-ID`. No product or test edit left in place.
- Competing explanations: Playwright's route runs before the network stack attaches
  `Last-Event-ID`, so the assertion cannot see a header the browser does send. Or this Chromium
  reconnects a cross-origin `EventSource` without the header, and replay is actually broken.
- Operator decision: Watch a real (not `route.fulfill`) reconnect and see whether the API
  receives `Last-Event-ID: 951`. If it does, assert replay another way. If it does not, the
  client should reopen the stream with `last_event_id` instead of leaving the browser to retry.

## iOS Maestro blocked on unmanaged API :4230

- Command: `npm run mobile:e2e:test -- --platform ios play-mini-player` (same preflight for
  every API-backed area). Earlier `api-health` / `alternate-enclosure` hits were this same
  refusal, from the other checkout.
- Assertion: runner exit 1 before Maestro: `cannot reseed while an unmanaged mobile E2E API is
  listening on :4230`. The flow did not start, so there is no Maestro assertion.
- What I tried: From `/Users/mitcheldowney/repos/pv/podverse`, `make mobile_e2e_deps` succeeded
  and `hello-world` passed. `:4230` health is `fixturesEnabled: true` and `/health/ready` is
  ok, but the listener is `podverse_combined` (cwd `apps/api`, pid 10259, that checkout's
  `.artifacts/mobile-e2e-api/api.pid`). This checkout has no `api.pid`. Did not stop that
  process. `:8081` is `npm run mobile:dev:e2e` from `podverse_combined`. `:2111` test-assets
  is the same checkout and the fixture range request returned 206. The deps step recreated
  `podverse_app_test` empty; seed did not run.
- Competing explanations: none for the reseed refusal. The listener is a healthy E2E API from
  the other checkout, which this checkout's runner cannot stop and restart around the seed.
- Operator decision: In `podverse_combined`, run `npm run mobile:e2e:api:stop`. In `podverse`,
  **Mobile E2E API**: `npm run mobile:e2e:api:bg`, then `npm run mobile:e2e:api:health`
  (`fixturesEnabled: true`). Leave `:8081` and `:2111` unless this tree's bundle or media
  fixtures are required.
