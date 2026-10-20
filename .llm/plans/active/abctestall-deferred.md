# abctestall deferred

Recorded during the 2026-10-19 sweep after the web Playwright report. These specs failed once.
The cause was not clear enough to change the product or the assertion.

## Web Playwright `npm run test:e2e -w @podverse/web`

Command: the web half of `make e2e_test_report` (rerun after the edge instrumentation build was fixed). 186 passed, 17 failed, 1 did not run. The credentials, blocked-host, and embed-routes specs were fixed and rerun green. The embed list time-range assertion matches the catalog string `{hhmmssStart} - {hhmmssEnd}`.

### Queue row for an Add by RSS episode is missing

- Command: `e2e/media-player-addbyrss-no-swap.spec.ts` “Playing the Add by RSS episode from the queue loads it into the player”
- Error: `locator.click` timed out waiting for `main` button “E2E Add-by-RSS Without Medium” on `/queues?medium=av`
- Tried: read the spec. The click never resolved to an element.
- Competing explanations: the `medium=av` filter hides an item with no medium; the queue row never posted; the accessible name is not the episode title.
- Decide: whether that fixture belongs on the av queue, and what the row’s accessible name is.

### Clip editor click never completes

- Command: `e2e/clip-editor-modal.spec.ts` “When the Create clip modal is open on a video episode…”
- Error: click on `media-player-clip-button` timed out after the button was visible, enabled, and stable
- Tried: read the Playwright call log only
- Competing explanations: another layer received the click; the 10s test timeout fired during a later action
- Decide: rerun once in isolation and, if it fails, inspect what covers the button

### Oldest sort does not put the expected episode first

- Command: `e2e/detail-sort-persistence.spec.ts` “Choosing Oldest turns the list around”
- Error: first episode link was `/episode/e2ePodLongNt01`, expected `/episode/e2ePodChap0001`
- Tried: read the assertion
- Competing explanations: seed publish dates no longer make the chapter episode oldest; the sort request did not apply
- Decide: which seeded episode is actually oldest, then whether the list or the test is wrong

### Playback did not start or advance

These failed while other playback specs in the same run passed (resume, foundation, anonymous restore, cross-device). No single change was isolated.

- `e2e/media-player-chapter-seek.spec.ts` — playhead did not reach the next chapter; fullscreen chapter link did not appear (`currentTime` predicate timed out)
- `e2e/media-player-hls-vod-start.spec.ts` — audio `currentTime` stayed 0
- `e2e/media-player-livestream-to-podcast-transition.spec.ts` — pause control did not respond after the transition
- `e2e/media-player-music-playback.spec.ts` — ended track did not load the next track at 0 (two tests)
- `e2e/media-player-music-queue-restore.spec.ts` — explicit Play during empty-player adoption did not keep the clicked episode
- `e2e/media-player-space-shortcut.spec.ts` — `button[data-media-player-playing="true"]` never appeared (three tests)

The server logged `Media URL resolution failed { host: 'localhost:3000' }` during nearby specs. That may be unrelated image resolution.

- Decide: rerun this group once. If it fails again, check whether those fixtures are loaded through `localhost:3000` and enter the playback error state.

### Removed-content row is not on Advanced settings

- Command: `e2e/removed-content-log.spec.ts` “A signed-in user can open Advanced and read the removed-content row”
- Error: paragraph “E2E Archived Show is no longer in the directory. Your follow ended.” was not found
- Tried: confirmed the seed still inserts a `left_directory` row for that title
- Competing explanations: the settings page does not render that row; the accessible name is split across elements; the seeded follow is not on the e2e user
- Decide: open Advanced as the seeded user and compare the row text with the assertion

## iOS Maestro API-backed flows were not run

Mobile Metro on port 8081 is the operator's `npm run mobile:dev` (pid 20284, parent terminal fish). That bundle does not set `EXPO_PUBLIC_MOBILE_E2E=1`. Starting Mobile E2E Metro would need that process stopped, and this sweep does not stop an operator-owned Metro.

UI-only flows ran on that Metro and passed: `hello-world`, `locale-switch-home-smoke`, `settings-select`, `error-log`, `custom-api`.

The iPhone 17 Pro E2E simulator is booted and `com.podverse.app.next` is installed. The iPad Pro 13-inch (M4) E2E simulator is booted and the app is installed there too. Mobile E2E API on `:4230` reports `fixturesEnabled: true`. Test-assets is listening on `:2111`.

- Command: every iOS area in `apps/mobile/e2e/HOW-TO-RUN.md` § Complete area list except the five UI-only flows above, plus `show-notes`, `removed-content-log`, `perf-browse-chip-switch`, and `tablet`
- Error: not executed
- Tried: confirmed the Metro parent command is `npm run mobile:dev`. `ps eww` does not show `EXPO_PUBLIC_*`, so the runner's UI-only guard would not stop an API-backed flow; the app would load the non-E2E bundle
- Competing explanations: none. The bundle flag is required for quick login, the playback row, and Value-for-Value
- Decide: stop Mobile Metro, start `npm run mobile:dev:e2e` in Mobile E2E Metro, reload the E2E app, then run the remaining iOS flows one at a time
