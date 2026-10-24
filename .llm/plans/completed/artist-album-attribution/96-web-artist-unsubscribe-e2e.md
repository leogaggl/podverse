**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 96 — Playwright: the unsubscribe-from-artist dialog on web

One spec with two tests: a directory artist (Cancel, Artist Only, Artist and Albums, and no
dialog when no album is followed) and an Add by RSS artist (the dialog counts the followed
directory album, not the listed album the member never followed, and Artist and Albums ends
both follows).

## Rows

R8, R55, R56, R57, R58, R59

## Runs after

13, 78, 92, 93

Plan 13 seeds the verified directory artist and album. Plan 78 adds the Add by RSS artist
fixtures and `helpers/addByRSSArtist.ts`.

## Files

apps/web/e2e/helpers/channelFollows.ts
apps/web/e2e/helpers/addByRSSArtist.ts
apps/web/e2e/add-by-rss-artist-albums.spec.ts
apps/web/e2e/artist-unsubscribe-albums-prompt.spec.ts
makefiles/local/e2e-spec-order-web.txt

## Reuses

- `loginSeedUser`, `unfollowFeedOnServer`, `stubAddByRSSParse`, `stubAddByRSSParseAll`, and
  `E2E_API_BASE_URL` from `helpers/addByRSSCredentials.ts`; `stubAddByRSSParseStatusForRequest`
  from `helpers/addByRSSArtist.ts` (plan 78).
- `E2E_MUSIC_CHANNEL_ID_TEXT` (`e2eMusicChnl01`, "E2E Music Artist") and
  `E2E_MUSIC_ALBUM_ID_TEXT` (`e2eMusicAlbm01`) from `helpers/seedConstants.ts`. Plan 11's seed
  makes the album a verified album of the artist.
- `capturePageLoad` / `captureVerifiedElement` from `helpers/stepScreenshots.ts`
  (**e2e-screenshot-verified-element**).

## Decisions this plan fixes

- **The Add by RSS test follows the directory album, not the Add by RSS album.** Following the
  listed Add by RSS album would need a second stubbed parse, and `stubAddByRSSParse` hands out
  request ids from one shared prefix, so two stubs collide. The directory album is followed with
  one API call, and the never-followed listed album then proves it is not counted (R59).
- **Fixtures move, not copy.** Plan 78's artist and album constants and payloads move from its
  spec into `helpers/addByRSSArtist.ts` and both specs import them.
- Follow state is set through the API and cleaned up in `afterEach`, best effort, so a failed run
  leaves the seeded account as it found it.

## `helpers/channelFollows.ts` (new)

```typescript
export async function followChannelOnServer(page: Page, channelIdText: string): Promise<void>;
/** Best-effort cleanup. */
export async function unfollowChannelOnServer(page: Page, channelIdText: string): Promise<void>;
```

`page.request.post(\`${E2E_API_BASE_URL}/account/follow/channel\`, { data: { channel_id_text } })`
with `expect(response.ok(), await response.text()).toBeTruthy()`; the unfollow posts to
`/account/unfollow/channel` and ignores the result, like `unfollowFeedOnServer`.

## `helpers/addByRSSArtist.ts` and `add-by-rss-artist-albums.spec.ts`

Move `ARTIST_FEED_URL`, `ARTIST_GUID`, `ARTIST_TITLE`, `ALBUM_FEED_URL`, `ALBUM_GUID`,
`ALBUM_TITLE`, `TRACK_TITLE`, `ALBUM_REQUEST_ID`, the four `DIRECTORY_*` constants,
`ARTIST_FEED`, `ALBUM_FEED`, and `ARTIST_LISTED_FEEDS` from the spec into the helper as named
exports, with their doc comments. The spec imports them; its tests are otherwise unchanged.

## `artist-unsubscribe-albums-prompt.spec.ts` (new)

`test.describe('Unsubscribe from an artist that has followed albums', …)`. Locators:

- `headerButton(page, name)` = `page.getByRole('button', { name, exact: true }).first()` (the
  header renders desktop and tablet views; the visible one is first in the page's E2E viewport.
  If not, scope to the visible header the way existing artist specs do).
- `dialog(page, artistTitle)` = `page.getByRole('dialog', { name: \`Unsubscribe from ${artistTitle}?\` })`.

### Test 1 — directory artist

"When a member who follows a directory artist and its verified album unsubscribes, the dialog
asks about the album, and each choice does what it says."

`afterEach` (for the describe): `unfollowChannelOnServer` for the artist and the album,
`unfollowFeedOnServer` for plan 78's `ARTIST_FEED_URL`.

Setup: `loginSeedUser(page)`, `followChannelOnServer` for `E2E_MUSIC_CHANNEL_ID_TEXT` and
`E2E_MUSIC_ALBUM_ID_TEXT`.

Steps:

1. **The dialog names the artist and the album count.** `page.goto(\`/artist/${E2E_MUSIC_CHANNEL_ID_TEXT}\`)`;
   click `Unsubscribe`; expect `dialog(page, 'E2E Music Artist')` visible with text
   `You also follow 1 album by this artist.` and buttons `Cancel`, `Artist Only`,
   `Artist and Albums`. `captureVerifiedElement` on the dialog.
2. **Cancel keeps both follows.** Click `Cancel`; the dialog has count 0; the header button reads
   `Unsubscribe`.
3. **Artist Only keeps the album.** Click `Unsubscribe`, then `Artist Only`; expect the header
   button `Subscribe`. `page.goto(\`/album/${E2E_MUSIC_ALBUM_ID_TEXT}\`)`; expect its header button
   `Unsubscribe`.
4. **Artist and Albums ends both.** Back on the artist page, click `Subscribe` and wait for
   `Unsubscribe`; click it, then `Artist and Albums`; expect `Subscribe`. On the album page,
   expect `Subscribe`.
5. **No followed album, no dialog.** On the artist page, click `Subscribe`, then `Unsubscribe`;
   expect `Subscribe` with no dialog (`dialog(...)` count 0).

### Test 2 — Add by RSS artist

"When a member unsubscribes from an Add by RSS artist that lists a directory album they follow,
the dialog counts that album only, and Artist and Albums ends both follows."

`test.setTimeout(60_000)` with plan 78's comment (add, a stubbed parse, and several page loads).

Setup: `loginSeedUser`; `followChannelOnServer(page, E2E_MUSIC_ALBUM_ID_TEXT)`; the three stubs
exactly as plan 78's test registers them.

Steps:

1. **Add the artist.** As plan 78's step 1; keep `artistPath`.
2. **The artist lists both albums.** `page.goto(\`${artistPath}?type=albums\`)`; expect the
   `ALBUM_TITLE` link and the `/album/${E2E_MUSIC_ALBUM_ID_TEXT}` link (timeout 15_000).
3. **The dialog counts the followed album only.** Click `Unsubscribe`; expect
   `dialog(page, ARTIST_TITLE)` with `You also follow 1 album by this artist.`
   `captureVerifiedElement` on the dialog.
4. **Artist and Albums ends both follows.** Click `Artist and Albums`; expect the header button
   `Subscribe`. `page.goto(\`/album/${E2E_MUSIC_ALBUM_ID_TEXT}\`)`; expect `Subscribe`.

If a locator does not match the rendered page, read the component and use its actual accessible
name; add no test ids to product code.

## `makefiles/local/e2e-spec-order-web.txt`

Insert `apps/web/e2e/artist-unsubscribe-albums-prompt.spec.ts` directly after
`apps/web/e2e/add-by-rss-artist-albums.spec.ts` (plan 78's line).

## Must stay true

- Only test 2 raises the 10 s default timeout, with the comment.
- No seed changes. Stubs answer only their own feed URL or request id.

## Tests

This plan is the test.

## Release scratchpad

none
