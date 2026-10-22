**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 40 — Playwright coverage for scrolling player titles

Playwright screenshot coverage for a title long enough to overflow the player bar, the segment strip above that bar, the full-size player, and the embed player. The spec asserts `data-marquee-layout` on the test ids from plans 12, 20, 21, and 30. It does not time the scroll.

`apps/web/e2e/media-player-foundation.spec.ts` drives a harness. It never mounts `MediaPlayerInfoDesktop`, `MediaPlayerInfoMobile`, or `MediaPlayerInfoModal`. Do not add marquee assertions there. Follow `apps/web/e2e/media-player-modal-video.spec.ts` for login, play, the modal, and artwork metrics. Follow `apps/web/e2e/media-player-seek-after-video.spec.ts` for the visible progress slider, and `apps/web/e2e/embed-routes.spec.ts` for `/embed/episode/...` plus `?player=` and `?t=`.

## Rows

R14, R24, R25

## Runs after

12, 20, 21, 30

## Files

tools/web/seed-e2e.mjs
apps/web/e2e/helpers/seedConstants.ts
apps/web/e2e/helpers/mediaPlayerAssertions.ts
apps/web/e2e/media-player-marquee.spec.ts
makefiles/local/e2e-spec-order-web.txt

`tools/web/seed-e2e.mjs` is large. Search for the anchors below and edit those spots. Do not rewrite the file.

Do not edit player components, `packages/ui`, the marquee constants, catalog files, or any existing spec. Plan 21 already updates `apps/web/e2e/media-player-floating-video-default.spec.ts`; do not edit it again. Do not edit `apps/web/e2e/helpers/embedAssertions.ts` or the embed specs. Short seeded titles stay one shown copy (`fit`), so `getByRole({ name })` in the current player specs keeps matching. The title helper change below is what keeps `getByText` callers working.

## Seed

Two episodes on the existing podcast channel (`E2E_PODCAST_CHANNEL_ID_TEXT`, title `E2E Podcast Seed Channel`). Both are older than the long-notes episode so newest-first lists keep their row-0 episode. Neither is added to a queue. Do not add a third episode. The embed routes use these same two items: `/embed/episode/${id}` already plays a normal podcast item (the share-builder spec opens `E2E_PODCAST_ITEM_RESUME_P_POS_ID_TEXT` that way).

The chapter episode gets two chapters so a drag can change the strip title. One chapter that covers the whole file cannot: `getMediaPlayerInfoResolution` keeps a pinned chapter when the playhead is outside every `[start, end)` until a media `timeupdate` clears it, so a drag to second 0 does not by itself hide the strip. A second chapter gives `selectItemChapterForTime` a different match from `mpCurrentTime` during the drag.

`id_text` lengths (9–15):

| Constant | Value | Length |
| --- | --- | --- |
| `E2E_PODCAST_ITEM_MARQUEE_TITLE_ID_TEXT` | `e2ePodMarqTi01` | 14 |
| `E2E_PODCAST_ITEM_MARQUEE_CHAPTER_ID_TEXT` | `e2ePodMarqCh01` | 14 |
| `E2E_PODCAST_ITEM_MARQUEE_CHAPTER_ROW_ID_TEXT` | `e2eChapMarq01` | 13 |
| `E2E_PODCAST_ITEM_MARQUEE_CHAPTER_TWO_ROW_ID_TEXT` | `e2eChapMarq02` | 13 |

Titles, duplicated as the same expressions in `tools/web/seed-e2e.mjs` and `apps/web/e2e/helpers/seedConstants.ts`:

```ts
/** 215 characters. Wider than the full-size player title at a 1200px window. */
export const E2E_PODCAST_ITEM_MARQUEE_TITLE = 'E2E Marquee Overflow Title '.repeat(8).trim();

/** 207 characters. Wider than the player bar strip and the embed segment line at a 1200px window. */
export const E2E_PODCAST_ITEM_MARQUEE_CHAPTER_TITLE = 'E2E Marquee Chapter Title '.repeat(8).trim();

/** 23 characters. Fits the player bar strip at a 1200px window. */
export const E2E_PODCAST_ITEM_MARQUEE_CHAPTER_TWO_TITLE = 'E2E Marquee Chapter Two';

/** 27 characters. Fits the full-size player title and the player bar title at a 1200px window. */
export const E2E_PODCAST_ITEM_MARQUEE_CHAPTER_EPISODE_TITLE = 'E2E Marquee Chapter Episode';

export const E2E_PODCAST_ITEM_MARQUEE_CHAPTER_WEB_URL = 'https://example.com/e2e-marquee-chapter';

export const E2E_PODCAST_ITEM_MARQUEE_CHAPTER_TWO_WEB_URL =
  'https://example.com/e2e-marquee-chapter-two';
```

Place the seed-file copies next to `E2E_PODCAST_ITEM_LONG_NOTES_ID_TEXT`. Place the `seedConstants.ts` copies next to `E2E_PODCAST_ITEM_LONG_NOTES_LINK_URL`.

`insertPodcastItem` already sets a 60-second duration and the resume enclosure. Call it twice, after the long-notes item (the block that starts at `idText: E2E_PODCAST_ITEM_LONG_NOTES_ID_TEXT`):

1. Long title, no chapters. `pubDateOffsetSeconds: 21600` (6 hours). `guidSlug: 'marquee-title'`. `enclosureUrl: E2E_PODCAST_RESUME_ENCLOSURE_URL`. Title `E2E_PODCAST_ITEM_MARQUEE_TITLE`.
2. Short title plus two chapters. `pubDateOffsetSeconds: 25200` (7 hours). `guidSlug: 'marquee-chapter'`. Same enclosure. Title `E2E_PODCAST_ITEM_MARQUEE_CHAPTER_EPISODE_TITLE`.

The chapter item then gets the same four inserts as the chaptered episode (`item_chapters_feed`, `item_chapters_feed_log`, `item_chapters_object`, `item_chapter`). One chapters object. Two `item_chapter` rows in that object's insert, same columns as the chaptered episode's insert (`id_text`, `item_chapters_object_id`, `data_hash`, `start_time`, `end_time`, `title`, `web_url`, `table_of_contents`):

1. Long chapter. `id_text` `E2E_PODCAST_ITEM_MARQUEE_CHAPTER_ROW_ID_TEXT`. `data_hash` `'44444444444444444444444444444444'` (32 characters). `start_time` `E2E_CHAPTER_ONE_START_SECONDS` (1). `end_time` `30`. `title` `E2E_PODCAST_ITEM_MARQUEE_CHAPTER_TITLE`. `web_url` `E2E_PODCAST_ITEM_MARQUEE_CHAPTER_WEB_URL`. `table_of_contents` true.
2. Short chapter. `id_text` `E2E_PODCAST_ITEM_MARQUEE_CHAPTER_TWO_ROW_ID_TEXT`. `data_hash` `'55555555555555555555555555555555'` (32 characters). `start_time` `30`. `end_time` `E2E_PODCAST_ITEM_RESUME_DURATION_SECONDS` (60). `title` `E2E_PODCAST_ITEM_MARQUEE_CHAPTER_TWO_TITLE`. `web_url` `E2E_PODCAST_ITEM_MARQUEE_CHAPTER_TWO_WEB_URL`. `table_of_contents` true.

The ranges are `[1, 30)` and `[30, 60)`, so they do not overlap. `4444…` and `5555…` are not used in this seed file (the chaptered episode uses `1111…`, `2222…`, and filler hashes of thirty `3`s plus a two-digit suffix). Chapters-object title: `E2E_PODCAST_ITEM_MARQUEE_CHAPTER_EPISODE_TITLE`. Feed url: `https://e2e-seed-podcast.example/marquee-chapters.json`.

No clip, no soundbite, no queue row. Do not seed a clip or an official clip for this spec. Plan 21's unit test covers those kinds. This spec covers the chapter form only.

Comments that would otherwise become false:

- The comment on `E2E_PODCAST_ITEM_LONG_NOTES_ID_TEXT` that calls that episode the oldest. Rewrite it: this episode is older than the ones newest-first lists put in row 0, and the marquee episodes are older than this one.
- The comment above the long-notes `insertPodcastItem` ("Oldest in the channel…"). Same fact.
- The subscription comment that lists items at 0, 1, 2, 3, and 4 hours. Add that the marquee episodes at 6 and 7 hours are caught up, like the episodes older than ninety minutes. `last_seen_at` stays `NOW() - INTERVAL '90 minutes'`. Do not change that timestamp.

Append both new item ids to the `console.log` that lists the podcast channel's items.

In `clearSeededPodcastQueueResources` (`mediaPlayerAssertions.ts`), add `E2E_PODCAST_ITEM_MARQUEE_TITLE_ID_TEXT` and `E2E_PODCAST_ITEM_MARQUEE_CHAPTER_ID_TEXT` to `itemIdTexts`, and import them from `./seedConstants`. No clip or soundbite ids. Do not add the chapter row ids.

## Title helper

`expectMediaPlayerTitleVisible` in `apps/web/e2e/helpers/mediaPlayerAssertions.ts` takes the first `getByText` match in `aside#media-player` and expects it to be visible. Plan 11's `MarqueeText` includes a measurer with `visibility: hidden` and `aria-hidden`, and plan 11 does not put that measurer after the shown copy. A leading measurer makes `.first()` hidden, and the helper fails for every bar title, including short ones.

Change the wait to a match Playwright treats as visible. Keep the function's arguments:

```ts
const titles = page.locator('aside#media-player').getByText(title, { exact: false });
await expect(titles.filter({ visible: true }).first()).toBeVisible({
  timeout: options?.timeout,
});
```

Extend the doc comment: both bar layouts are in the DOM, and the waited match is a visible one, because each marquee includes a visibility-hidden measurer that can sit earlier in the tree.

Do not change `expectMediaPlayerTitleAbsent`. Do not edit the specs that call the helper. `media-player-chapter-seek.spec.ts` (`Topic A`, `Intro`) and `media-player-clip-soundbite-end-pause.spec.ts` (clip and soundbite titles) still pass: the strip shows those short titles, `aria-hidden` does not remove them from Playwright's visible filter, and a `fit` label has one shown copy. A 1px clipped label does not count as visible, so the helper does not land on the strip's screen-reader phrase.

## Spec

New file `apps/web/e2e/media-player-marquee.spec.ts`.

Suite title: `Media player marquee`. Seven tests, titles as complete sentences. Copy `loginSeedUser`, `DESKTOP_VIEWPORT` (`{ width: 1200, height: 900 }`), and the modal helpers from `media-player-modal-video.spec.ts`: `fullscreenModalLocator` (dialog name `Fullscreen Media Player`), `openFullscreenMediaPlayerModal` (click `#media-player`'s first button, then expect the dialog), and the play click scoped to `main` (`page.locator('main').getByRole('button', { name: 'Play' }).first()`). `beforeEach` logs in and calls `clearSeededPodcastQueueResources`. Each test sets its viewport before `goto`. Do not call `test.setTimeout`. Do not pass a per-assertion timeout. The 10-second default matches the modal spec.

`beforeEach` does not set `reducedMotion`. Playwright's default leaves `prefers-reduced-motion` unmatched, so an overflowing label scrolls.

Narrow viewport, only in the tests that name it: `{ width: 420, height: 900 }`. 420 is under the 991px breakpoint, so `.playerDesktop` is `display: none` and `.playerMobile` is shown. 1200 is over 992px, so the desktop bar is shown.

Every `goto` is followed by `toHaveURL` for that path (a regex is enough when the query string is also asserted via `toHaveURL` containing `player=responsive`, `player=compact`, or `t=2`) and by one visible destination element: the episode heading, or `embed-player-info`.

Locators:

| Line | Test id | Shown when |
| --- | --- | --- |
| Bar title, desktop | `media-player-bar-title-desktop` | viewport width ≥ 992 |
| Bar title, narrow | `media-player-bar-title-mobile` | viewport width ≤ 991 |
| Strip root, desktop | `media-player-segment-strip-desktop` | a segment is active and viewport width ≥ 992 |
| Strip root, narrow | `media-player-segment-strip-mobile` | a segment is active and viewport width ≤ 991 |
| Strip title | `media-player-segment-strip-title-desktop` / `-mobile` | with that strip; carries `data-marquee-layout` |
| Strip label | `media-player-segment-strip-label-desktop` / `-mobile` | with that strip; visually hidden |
| Strip icon | `media-player-segment-strip-icon-desktop` / `-mobile` | clips and official clips only |
| Modal item title | `media-player-modal-title` | modal open |
| Modal channel | `media-player-modal-channel-title` | modal open |
| Modal subsection | `media-player-modal-subsection-title` | modal open and a chapter is active |
| Embed title, stacked | `embed-title` | compact with no active chapter, and the responsive overlay |
| Embed title, toggle | `embed-title-toggle-title` | compact while a chapter is active |
| Embed channel | `embed-channel-title` | either embed layout |
| Embed segment title | `embed-segment-info-title` | responsive layout while a segment is active |

`data-marquee-layout` is on the `MarqueeText` root: `scroll`, `fit`, or `measuring`. A hidden bar measures width 0, and `resolveMarqueeLayout` stays `measuring` while the viewport width is 0, so it does not take a turn. Wait until the shown title has settled, then assert the hidden title.

When no segment is active the strip returns null. Both strip roots have count 0. That is not a hidden `measuring` node. When a segment is active, both strips are in the DOM and CSS hides one.

Assertions:

- Shown overflowing line: visible, `toHaveAttribute('data-marquee-layout', 'scroll')`.
- Shown line that fits: visible, `data-marquee-layout="fit"`.
- Hidden bar line, or the hidden strip's title while a segment is active: `toBeHidden()`, and `data-marquee-layout="measuring"` only after the shown line has left `measuring`.
- Strip label: `toHaveText` the exact English phrase. Do not use `toBeVisible` on it. The label is a 1px clip (`position: absolute; width: 1px; height: 1px; clip: rect(0, 0, 0, 0)`). The en-US catalog string is `Chapter: {title}`, so the text is `Chapter: ` plus the chapter title, with one space after the colon.
- Do not use `getByText` or `toHaveText` on a scrolling label's marquee root except `toContainText(title)` on the test id. A scrolling label renders a second copy with `aria-hidden`, so the element's text is the title twice and a plain text query finds two nodes. The accessible name of the bar button is one copy: `#media-player` `getByRole('button', { name: title, exact: true })` filtered to visible.
- Do not assert the bar's channel line (`media-player-bar-subtitle-desktop` / `-mobile`). `E2E Podcast Seed Channel` is about as wide as the desktop bar's text column, so fit versus scroll is not stable there. The modal channel line is nearly the window wide, so it is `fit`. The embed channel line at 1200px is also `fit`: the text column is the page width minus the 78px artwork and the controls, which is wider than that 24-character channel title. Assert the embed channel line.
- Do not wait on the animation, hover, or turn handoff. Plan 11's unit tests cover those. This spec only checks layout and the strings.
- Do not press Play on an embed page. `?t=2` puts the playhead inside the long chapter (`[1, 30)`) before playback, which is how `embed-routes.spec.ts` already selects a chapter.
- Episode heading: `getByRole('heading', { name: title, exact: true })` after `goto`. The detail header is not a marquee.
- The long chapter ends at 30 seconds. Do not wait for playback to reach 30 seconds. Assertions run as soon as the strip shows the long chapter.

Screenshots, from `./helpers/stepScreenshots`:

- Bar or strip: `capturePageLoad(page, testInfo, label, shownLocator)` so the shot centers that line.
- Modal: `actionAndCapture` around opening the modal, with the asserted title locator as `scrollToElement`.
- Embed: `capturePageLoad` centered on the line the test is checking.

Artwork, only in the first test, copied from the audio case in `media-player-modal-video.spec.ts`. Measure `[class*="titleSection"]`, `[class*="subtitleSection"]`, and `[class*="imageInner"]` inside `[class*="mediaPlayerModalContent"]`. Record height of the two sections and the image width and height for the short episode, then again for the long episode. The long episode's section heights and image side each match the short episode within 2 pixels. The long episode's image is square within 2 pixels and its height is greater than 350.

Visible progress slider, for the drag only:

```ts
page.locator('aside#media-player [role="slider"][aria-valuetext*=" of "]:visible').first()
```

Both bars mount a slider. The volume slider does not use that `aria-valuetext`. `boundingBox()` on the visible one is the drag target.

### 1. Long title on the desktop bar and in the full-size player

`When an episode title is wider than the player, the desktop bar and the full-size player scroll that line, the segment strip stays off, and the artwork stays the size it is for a short title.`

Viewport 1200×900.

1. Open `/episode/${E2E_PODCAST_ITEM_RESUME_P_POS_ID_TEXT}` (`e2ePodResume01`, heading `E2E Podcast Resume P > 0`). Play from `main`. Desktop bar title is `fit` and visible. Mobile bar title is hidden and `measuring`. Both segment-strip roots have count 0.
2. Open the modal. Modal title is `fit`. Modal channel is `fit` and contains `E2E_PODCAST_CHANNEL_TITLE`. Subsection test id has count 0. Record artwork metrics. Close with the `Close Modal` button and expect the dialog count to be 0.
3. Open `/episode/${E2E_PODCAST_ITEM_MARQUEE_TITLE_ID_TEXT}`. Heading is the long title, exact. Play from `main`. Desktop bar title is visible, `scroll`, and `toContainText` the long title. The visible player button's accessible name is that title, exact. Mobile bar title is hidden and `measuring`. Both segment-strip roots have count 0. `capturePageLoad` centered on the desktop bar title: `The desktop player bar scrolls a title wider than its line.`
4. Open the modal. Modal title is `scroll` and contains the long title. The dialog button name is that title, exact. Modal channel is `fit`. Subsection count is 0. Artwork matches the short episode as above. `actionAndCapture` centered on the modal title: `The full-size player scrolls a long episode title without changing the artwork size.`

### 2. Long title on the narrow bar

`When the window is narrow, the mobile player bar scrolls a long episode title, the desktop bar stays hidden, and the segment strip stays off.`

Viewport 420×900. Play the long-title episode. Mobile bar title is visible, `scroll`, and contains the long title. The visible player button's name is that title, exact. Desktop bar title is hidden and `measuring`. Both segment-strip roots have count 0. Do not open the modal. `capturePageLoad` centered on the mobile bar title: `The narrow player bar scrolls a title wider than its line.`

### 3. Reduced motion

`When reduced motion is on, a long episode title stays still in the player bar and the full-size player, and a long chapter title stays still on the segment strip.`

Viewport 1200×900. Before the first `goto`, `await page.emulateMedia({ reducedMotion: 'reduce' })`. Play the long-title episode. Desktop bar title is visible and `fit`, and contains the long title. Mobile bar title is hidden and `measuring`. Both segment-strip roots have count 0. Open the modal. Modal title is `fit` and contains the long title. `actionAndCapture` centered on the modal title: `With reduced motion, the full-size player keeps a long title still.` Close the modal.

Then open `/episode/${E2E_PODCAST_ITEM_MARQUEE_CHAPTER_ID_TEXT}` and play from `main`. Playing seeks to the first chapter at 1 second. Desktop bar title is visible, `fit`, and contains `E2E_PODCAST_ITEM_MARQUEE_CHAPTER_EPISODE_TITLE`. Desktop strip root is visible with `data-segment-kind="chapter"`. Its title is visible, `fit`, and contains the long chapter title. Its icon has count 0. Its label `toHaveText` `Chapter: ` plus the long chapter title. Mobile strip root is hidden, and its title is `measuring`. `capturePageLoad` centered on the desktop strip title: `With reduced motion, the segment strip keeps a long chapter title still.`

### 4. Long chapter on the desktop strip

`When a chapter title is wider than the player, the desktop segment strip scrolls it, the bar title stays the episode title, and dragging the progress bar into the next chapter changes the strip.`

Viewport 1200×900. Open `/episode/${E2E_PODCAST_ITEM_MARQUEE_CHAPTER_ID_TEXT}`. Heading is `E2E_PODCAST_ITEM_MARQUEE_CHAPTER_EPISODE_TITLE`, exact. Play from `main`. Playing seeks to 1 second, inside the long chapter.

Wait until the desktop strip title contains the long chapter title. Then:

- Desktop bar title is visible, `fit`, and contains the episode title. The visible player button's name is the episode title, exact. It is not the chapter title.
- Mobile bar title is hidden and `measuring`.
- Desktop strip root is visible with `data-segment-kind="chapter"`. Its title is `scroll` and contains the long chapter title. Its icon has count 0. Its label `toHaveText` `Chapter: ` plus the long chapter title.
- Mobile strip root is hidden, and its title is `measuring`.

`capturePageLoad` centered on the desktop strip title: `The player bar keeps the episode title and scrolls the active chapter on the strip above it.`

Open the modal. Modal item title is `fit` and contains the episode title. Modal channel is `fit`. Subsection title is `scroll` and contains the long chapter title. The dialog's `media-player-chapter-link` is visible and contains an `a` whose `href` is `E2E_PODCAST_ITEM_MARQUEE_CHAPTER_WEB_URL`. `actionAndCapture` centered on the subsection title: `The full-size player scrolls a long chapter title beside its link.` Close the modal.

Then drag the visible progress slider. Duration is 60. `mouse.move` to 10% of the bar (about 6 seconds, still the long chapter), `mouse.down`, then `mouse.move` to 75% (45 seconds, inside `[30, 60)`) with `{ steps: 8 }`, and assert before `mouse.up`:

- Desktop strip title contains `E2E_PODCAST_ITEM_MARQUEE_CHAPTER_TWO_TITLE`, is visible, and is `fit`.
- Desktop strip label `toHaveText` `Chapter: ` plus that short chapter title.
- `data-segment-kind` is still `chapter`.
- Desktop bar title still contains the episode title.

Then `mouse.up`. Hovering the bar is not this gesture: hover does not change `mpCurrentTime`. The drag does, on `mousedown` and on each `mousemove`.

### 5. Long chapter on the narrow strip

`When the window is narrow, the mobile segment strip scrolls a long chapter title and the bar title stays the episode title.`

Viewport 420×900. Open the chapter episode and play from `main`. Wait until the mobile strip title contains the long chapter title. Mobile bar title is visible, `fit`, and contains the episode title. The visible player button's name is the episode title, exact. Mobile strip root is visible with `data-segment-kind="chapter"`. Its title is `scroll` and contains the long chapter title. Its icon has count 0. Its label `toHaveText` `Chapter: ` plus the long chapter title. Desktop strip root is hidden, and its title is `measuring`. Desktop bar title is hidden and `measuring`. Do not open the modal and do not drag. `capturePageLoad` centered on the mobile strip title: `The narrow player bar scrolls the active chapter on the strip and keeps the episode title on the title line.`

### 6. Embed responsive layout

`When the embed player is the responsive layout, a long episode title scrolls, the channel line fits, and a long chapter title scrolls on the segment line while the title line stays the episode title.`

Viewport 1200×900. Do not press Play.

1. Open `/embed/episode/${E2E_PODCAST_ITEM_MARQUEE_TITLE_ID_TEXT}?player=responsive`. `embed-player-info` is visible. `embed-title` is visible, `scroll`, and contains the long episode title. `embed-channel-title` is visible, `fit`, and contains `E2E_PODCAST_CHANNEL_TITLE`. `embed-segment-info-title`, `embed-segment-info-bar`, and `embed-title-toggle` each have count 0.
2. Open `/embed/episode/${E2E_PODCAST_ITEM_MARQUEE_CHAPTER_ID_TEXT}?player=responsive&t=2`. `embed-title` is visible, `fit`, and contains the episode title. `embed-segment-info-bar` is visible. `embed-segment-info-title` is visible, `scroll`, and contains the long chapter title. `embed-channel-title` is `fit` and contains the channel title. `embed-title-toggle` has count 0. `capturePageLoad` centered on `embed-segment-info-title`: `The responsive embed player scrolls the active chapter on its segment line.`

The responsive overlays fade to `opacity: 0` while playing. These steps do not play, so the overlays stay shown. `toBeVisible` would still pass if they were only faded.

### 7. Embed compact layout

`When the embed player is the compact layout, a long chapter title scrolls on the title line inside the toggle, the channel line fits, and there is no segment strip.`

Viewport 1200×900. Open `/embed/episode/${E2E_PODCAST_ITEM_MARQUEE_CHAPTER_ID_TEXT}?player=compact&t=2`. `embed-player-info` is visible. `embed-title-toggle` is visible. `embed-title-toggle-title` is visible, `scroll`, and contains the long chapter title. `embed-channel-title` is visible, `fit`, and contains `E2E_PODCAST_CHANNEL_TITLE`. `embed-title` has count 0. `embed-segment-info-bar` and `embed-segment-info-title` each have count 0. `capturePageLoad` centered on `embed-title-toggle-title`: `The compact embed player scrolls a long chapter title on its title line.`

## Spec order

In `makefiles/local/e2e-spec-order-web.txt`, insert this line directly after `apps/web/e2e/media-player-space-shortcut.spec.ts`:

```text
apps/web/e2e/media-player-marquee.spec.ts
```

The file lists only an early slice of specs. Adding the line is the whole edit.

## What must stay true

- Existing player specs are unchanged. The title helper's visible filter is what keeps them passing.
- The long-title episode has no chapter, so both strip roots are absent and its bar line is the episode title.
- While the long chapter is active, the bar title line is the short episode title and the strip shows the chapter. The bar channel line is not asserted.
- A chapter strip has no icon, `data-segment-kind="chapter"`, and the label `Chapter: ` plus the chapter title.
- Dragging the visible progress bar from the long chapter into the short chapter changes the strip title before the pointer goes up. The bar title stays the episode title.
- A hidden bar variant stays `measuring` and does not scroll. An absent strip is count 0, not a hidden measuring node.
- Reduced motion keeps an overflowing line at `fit`, including the desktop strip's long chapter title.
- Title-section height, subtitle-section height, and the artwork square do not change between the short episode and the long episode.
- The embed responsive layout shows the episode title, a fitting channel line, and the long chapter on the segment line. The compact layout shows the long chapter on the toggle title and no segment line. Both use the two seeded episodes.

## Tests

- Playwright: `apps/web/e2e/media-player-marquee.spec.ts` (the seven tests above). No new unit test and no API test. Scroll, turns, and reduced motion are unit-tested on `MarqueeText` in plan 11. The strip's clip and official-clip kinds are unit-tested in plan 21.
- The set's last prompt runs `make e2e_test_web_report_spec SPEC=e2e/media-player-marquee.spec.ts`. That target reseeds, so this plan does not add a separate seed command.

## Release scratchpad

none
