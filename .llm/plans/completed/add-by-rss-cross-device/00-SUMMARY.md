# Add by RSS across devices — summary

Order and file ownership: [00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md). Prompts:
[COPY-PASTA.md](./COPY-PASTA.md).

## What the operator saw on alpha

1. Mobile added a Muse AI feed by RSS and played an episode. Web, signed in as the same user, did
   not show that episode as now-playing.
2. The web Add by RSS podcast page showed only the feed URL until a parse was forced from that
   page's settings.
3. After the parse, the show and episode artwork did not load on web.
4. The placeholder artwork (headphones) sat off-center in some places.
5. Pressing play on an Add by RSS episode on web did nothing visible, then the player switched to
   Podcasting 2.0 episode 275.

Test feed: `https://muse.ai/podcasts/feed/1436380979549988/19c5707c-f653-4917-ae84-e0ff2215e1c2`

## Root causes

1. **Mobile never records Add by RSS playback.** `writePlaybackEvent` in
   `apps/mobile/src/playback/PlaybackProvider.tsx` returns early for `add-by-rss`, and
   `nowPlayingResourceFromTarget` in `playbackEventSource.ts` returns null for it (deferred in
   detail doc 745). The server's now-playing row stayed on episode 275. The history API returns
   `list_position <= 0`, so that row also shows in History.
2. **Web replaces an Add by RSS item with the server queue head.** Hydration records episode 275 as
   this tab's item in `playbackHandoffState.ts`. `usePlayAddByRSS` never updates that record.
   `shouldLoadQueueResource` in `useMediaPlayerControllerQueueHeadLoading.ts` reads the stale id,
   sees it equal the server head, returns true, and `dispatchLoad` loads episode 275 even while
   audio plays.
3. **The same episode has a different id on every device.** `add_by_rss_hash_id` is the MD5 of
   `{ channel_id_text, guid }`, and `channel_id_text` is a random id each device creates for its
   local copy of the feed. Web cannot match a mobile row, or the reverse.
4. **Muse AI blocks cross-origin loads at the redirect.** `cover.png` and every `ep-*.mp3` answer
   with a 302 carrying `Cross-Origin-Resource-Policy: same-origin`. Browsers enforce that on
   `<img>` and `<audio>` from any other site: in Chrome from another origin, the image fails and
   the audio fails with media error 4. The final `cdn.fbsbx.com` URL (signed, expires in about
   36 hours) sends `cross-origin` and loads directly: 1600×1600 cover, 276 s of audio. Native
   players and our server ignore the header, which is why mobile works.
5. **Web never parses on its own outside the list page.** The list page enqueues a first parse for
   follows with no cache (`enqueueFollowsWithoutCache` in `AddByRSSListClient.tsx`). The detail
   page and app load do not, and nothing refreshes stale feeds. The follow row keeps
   `title = feed URL`, `image_url = null`, because the worker never fills them in.
6. **Web shows no playback errors.** Media `error` events surface only for credential-protected
   Add by RSS feeds, as a toast. `play()` rejections are swallowed. `MediaPlayerContext` has no
   error state.
7. **Placeholder centering depends on `display: flex`.** Callers pass classes that set
   `display: block` or `none` for responsive variants (`PodcastHeaderImage`, `ListEpisodeRow`,
   `CommonItemHeader`, `ListClipRow`, and others). On the placeholder wrapper in
   `packages/ui/src/components/image/Image/Image.tsx`, that overrides the flex centering.

## Locked decisions

1. **Reconciliation never swaps items under local playback.** This tab's identity comes from what
   the player has loaded. While audio plays, a different server head is never loaded
   automatically.
2. **Error UX matches mobile.** The failed item stays loaded. The play button becomes an error
   icon on the mini and full player. Pressing it opens a modal: title, reason sentence, a details
   line, **Try Again**, **Open Media Link** (web only, when a media URL is known), and **Cancel**.
   The error is announced to screen readers. No toast and no auto-advance. Mobile already has the
   dialog; it gets no UI change in this set.
3. **One episode, one id on every device.** The hash input becomes `{ feed_url, guid }`, or
   `{ feed_url, enclosure_url }` when there is no guid. `feed_url` is the canonical follow URL
   (`canonicalAddByRSSFeedUrl`, userinfo removed). A payload without `feed_url` keeps the legacy
   `{ channel_id_text, ... }` input.
4. **Migration 0020 rehashes rows that carry `feed_url`.** It adds a SQL function that reproduces
   the JavaScript hash. A DB-backed test proves parity. Duplicates are removed before rehashing.
   Rows without `feed_url` keep their legacy hash, and web matches both forms for its own feeds.
5. **No audio relay.** A web server route follows the redirect chain, validates every hop for SSRF,
   and returns the final URL only when that host allows cross-origin loads. The player and `Image`
   call it once after a failure. Bytes never pass through our servers.
6. **Credentials stay on the device.** The resolver never receives or forwards credentials and
   rejects URLs with userinfo. `feed_url` in resource data never carries `user:pass@`.
7. **Web refreshes Add by RSS feeds in the background**, the way mobile does on each foreground
   (`createAddByRssRefreshJob` in `apps/mobile/src/sync/syncJobs.ts`): only when
   `evaluateFeatureAccess('add_by_rss_refresh', ...)` allows it, on app load and when the tab
   becomes visible, at most once every 30 minutes per account. It reuses `runAddByRSSParseAll`, so
   ETag and hash maps keep unchanged feeds cheap. A feed with no parse yet is parsed on first
   sight for any signed-in user, as the list page already does.
8. **The worker keeps the follow row's title and image current** after each successful parse, so
   every device has real names before its own parse finishes.

## What users see afterward

- Playing an Add by RSS episode on the phone, then opening web: the mini player shows that
  episode at the phone's position. The title, artwork, and notes come from the stored resource
  data, then update in place once this browser parses the feed.
- Muse AI artwork and audio work on web.
- A file that still cannot play stays in the player with an error icon. The modal explains why
  and offers Try Again and Open Media Link.
- The Add by RSS list and pages show real titles and artwork right away, and refresh on their own.
- The placeholder artwork is centered everywhere.

## Out of scope

- Relaying audio bytes through our servers. Revisit only if a host blocks browsers at the final
  CDN hop too.
- Asking Muse AI to change their header. Worth reporting; we cannot depend on it.
- Rehashing web rows written before this set (they carry no `feed_url`).
- Mobile error UI changes. Mobile's dialog already covers the reasons it can hit.
