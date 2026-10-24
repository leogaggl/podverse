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

- Command: `npm run mobile:e2e:test -- --platform ios api-health` (same preflight for every
  API-backed area in this step)
- Assertion: runner exit 1 before Maestro: `cannot reseed while an unmanaged mobile E2E API is
  listening on :4230`. `alternate-enclosure` did reach Maestro and failed
  `id: e2e-session-authenticated is visible` because `POST /auth/mobile/token` returned 401
  after `make mobile_e2e_deps` recreated the empty test database.
- What I tried: Confirmed Metro is this checkout's `npm run mobile:dev:e2e` on `:8081`. API
  health on `:4230` is `fixturesEnabled: true`, but the process cwd is
  `/Users/mitcheldowney/repos/pv/podverse` (`develop`, pid 86576, that checkout's
  `.artifacts/mobile-e2e-api/api.pid`). This checkout has no managed pid file. Did not stop
  that process. Test-assets on `:2111` is the same other checkout and its fixture health
  check passed.
- Competing explanations: none for the reseed refusal. The 401 is the empty database, not a
  login-screen defect.
- Operator decision: In the `podverse` checkout, run `npm run mobile:e2e:api:stop`. In this
  checkout, **Mobile E2E API**: `npm run mobile:e2e:api:bg`, then
  `npm run mobile:e2e:api:health` (`fixturesEnabled: true`). Resume this step. Leave `:2111`
  unless a playback flow needs this tree's fixtures.
