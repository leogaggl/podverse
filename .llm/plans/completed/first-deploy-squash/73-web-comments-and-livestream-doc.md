**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# Rewrite comments and the livestream section that describe an older v5 state

Comments follow `.cursor/rules/comments-future-forward.mdc`: say what the code does now. Do not narrate an older cookie, an older player, or a version step the code does not branch on.

Do not change behavior in this plan. Do not remove a function, a hash call, a CSS token, or a seed row. Plans 70–72 own the behavior removals and do not edit these files.

`tools/web/seed-e2e.mjs` is a large file. Edit only the comment named below. Do not read the file through.

## Rows

R14, R30

## Runs after

none

## Files

- apps/web/src/utils/addByRSS/storage.ts
- apps/web/src/utils/addByRSS/credentialStore.ts
- apps/web/src/utils/addByRSS/types.ts
- apps/web/src/utils/addByRSS/playFromQueueResource.ts
- apps/web/src/hooks/useMediaPlayerControllerQueueHeadLoading.ts
- apps/web/src/hooks/useLikesAddByRssBatch.ts
- apps/web/e2e/helpers/seedConstants.ts
- tools/web/seed-e2e.mjs
- apps/web/src/utils/localSettings/localSettings.sba.test.ts
- apps/web/src/utils/localSettings/localSettings.pmt.test.ts
- apps/web/src/utils/localSettings/localSettings.bae.test.ts
- apps/web/src/lib/embed/__tests__/buildEmbedIframeCode.test.ts
- packages/ui/src/styles/_variables-root.scss
- apps/web/src/components/MediaPlayer/MEDIA-PLAYER-DECISION-MATRIX.md

## Comments

`storage.ts`, the line above `DB_VERSION`:

- Today: "Bump when object stores change; prior local cache may be reset on upgrade."
- Write: "IndexedDB version of the add-by-rss cache. Opening it creates any object store that is missing."
- `DB_VERSION` stays `8`. Do not add a `deleteDatabase` call.
- On the live-items store, delete the trailing `(v6)` from the comment. Leave the `if (!db.objectStoreNames.contains(...))` checks.

`credentialStore.ts`, the file comment's second sentence ("Kept in its own database so the feed cache can be reset on upgrade..."):

- Write that credentials are in their own database, apart from the feed cache (`add-by-rss`).
- Keep the sentences about per-account storage and AES-GCM. `DB_VERSION` stays `1`.

`types.ts`, `mayHaveLivestreams`:

- Write: "Set once a stored parse has carried a live item; never cleared. Absent until then."

`playFromQueueResource.ts`, `getAddByRSSResourceDataFeedUrl`:

- Write: "The `feed_url` on resource data, or null when the payload has none."
- Keep the function.

`useMediaPlayerControllerQueueHeadLoading.ts`, `isLoadedPlaybackIdentity`:

- Write: "True when `identity` names the loaded item. A payload that includes `feed_url` is also named by the hash that omits `feed_url`."
- Keep the `getAddByRSSHashIdsForResourceData` call.

`useLikesAddByRssBatch.ts`, the comment on `useLikesAddByRssBatch`:

- Write: "A like stored under any hash `getAddByRSSHashIds` returns for the item counts."
- Keep the call.

`seedConstants.ts`, the comment above `E2E_ADD_BY_RSS_TEST_ASSETS_FEED_URL`:

- Write that the with-position row's hash is `{feed_url, guid}`, and the fresh row has no `feed_url`, so its hash is `{channel_id_text, guid}`.
- Do not change the constants or the `getAddByRSSHashId` calls.

`tools/web/seed-e2e.mjs`, the comment immediately above `function computeAddByRssHashSeed`:

- Same meaning as the seedConstants comment: `{feed_url, guid}` when the row has a canonical `feed_url`, otherwise `{channel_id_text, guid}`.
- Do not change `computeAddByRssHashSeed`.

`packages/ui/src/styles/_variables-root.scss`, the comment above `--header-padding`:

- Today: "compatibility aliases (kept for byte-equivalence with apps/web)".
- Write: "Header inset, and the gap between stacked form fields."
- Keep `--header-padding` and `--form-gap`. Both are used.

## Test titles

Assertions stay. Only the titles and the local variable names that say `legacy` change.

- `localSettings.sba.test.ts`: "keeps a saved Library close from an older cookie and leaves other settings" becomes "keeps a saved Library close when the accordion object has other keys". The fixture still includes `podcasts`, `music`, and `addByRSS` beside `library: false`.
- `localSettings.pmt.test.ts`: "inherits the default pmt for cookies that predate the field" becomes "uses the default when the cookie omits pmt". Rename the `legacy` variable to `withoutPmt`.
- `localSettings.bae.test.ts`: the matching title becomes "uses the default when the cookie omits bae". Rename `legacy` to `withoutBae`.
- `buildEmbedIframeCode.test.ts`: "emits allow from EMBED_IFRAME_ALLOW and omits legacy encrypted-media" becomes "emits allow from EMBED_IFRAME_ALLOW". Keep both expects, including `not.toContain('encrypted-media')`.

## Livestream section of the decision matrix

`MEDIA-PLAYER-DECISION-MATRIX.md` §6 still describes video.js. The web app does not import video.js. Livestreams use `MediaElement` from `MediaPlayerControllerLiveStreamAV.tsx`.

Replace the prose from the heading `## Section 6 (REQUIRED) — Livestream baseline` through the fenced NOTES block that ends with "whenever mpItem changes, the video js needs to be disposed and recreated", stopping before `### 6b. Live-stream E2E specs`. Use this text. Do not mention video.js, a dispose step, or phase numbers.

```markdown
## Section 6 (REQUIRED) — Livestream baseline

Livestreams render the shared `MediaElement` from
`MediaPlayerControllerLiveStreamAV.tsx`. A progressive file sets `src`. An HLS
playlist is attached after mount, natively or with lazy `hls.js` when the
browser cannot play it. Each source mounts its own element, keyed by delivery
and URL (`LivestreamMediaElement`). Leaving a livestream unmounts that element,
so the next livestream starts from a fresh element. The source is the selected
labeled enclosure (`getSelectedLabeledItemEnclosureAndSource`). When
`mpItem.live_item` is absent, or the enclosure's media type does not match
this controller, the source is null and no element is mounted.

`MediaPlayerController` mounts `NonLiveMediaMount`,
`MediaPlayerControllerLiveStreamAudio`, and `MediaPlayerLiveStreamVideoWrapper`
together. The audio livestream shell is hidden. Video livestreams render
inside `MediaPlayerLiveStreamVideoWrapper` →
`MediaPlayerLivestreamVideoPortalFloating`.

### 6a. Live-stream behavior

| Trigger | What the code does |
| --- | --- |
| Initial play, audio live stream | Labeled enclosure selection, then `MediaElement` with `delivery` `file` or `hls`. The audio shell is hidden. |
| Initial play, video live stream | Same selection. The `<video>` is inside the floating portal wrapper, with `playsInline`. |
| Source fallback | Only the selected labeled source is passed. There is no walk to the next labeled enclosure. |
| Live to non-live | `mpItem.live_item` clears, the live source becomes null, and the live element unmounts. `NonLiveMediaMount` drives the non-live item. |
| Non-live to live | `mpItem.live_item` is set, `isNonLiveVideoPlaying` is false for that item, and the live controller mounts `MediaElement` for the matching media type. |
| Live stream end / disconnect | `LivestreamMediaElement` pauses the element when `mpIsPlaying` is false, and calls `play()` when it is true. This controller has no separate retry UI. |
| Reload while live is playing | `resolveKindAndIdText` in `anonymousPlaybackStorage.ts` stores `kind: 'item'` whenever `mpItem.id_text` is a string, including a livestream. It does not skip `live_item`. |
```

In `### 6b`, replace the sentence that starts "These specs gate Phase 4a/4b/4c" with: "These specs are the regression checks for livestream start, HLS playback, and live/non-live transitions."

Leave the spec list, §6c, and every section outside §6. The later "What Phase 2 must add" notes are unfinished player work (`clampNearEndSeconds.ts` is not in the tree). Do not edit them.

## Docs checked, no edit

These files do not cite an old migration, an older v5 schema, or an upgrade step. Do not edit them:

- `apps/web/AGENTS.md`, `apps/web/APPS-WEB.md`, `apps/web/ENV.md`
- `apps/management-web/AGENTS.md`, `apps/management-web/APPS-MANAGEMENT-WEB.md`, `apps/management-web/ENV.md`
- `packages/ui/PACKAGES-UI.md`
- `packages/i18n-catalog/README.md`

No catalog key is removed. Strings about upgrading membership are Premium copy.

## Tests

none. Titles and comments only. No new spec.

## Release scratchpad

none
