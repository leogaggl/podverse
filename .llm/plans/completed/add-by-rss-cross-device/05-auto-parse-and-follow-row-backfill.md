# 05 — Real names right away, parsing without asking

**Cursor model:** Codex 5.3 · **Reasoning:** high

## Summary

A feed added on mobile shows up on web as its bare URL, and stays that way until someone forces a
parse. Make the worker keep the follow row's title and image current, make web parse on its own
(first sight, the detail page, and a background refresh like mobile's), and update open pages in
place when a parse lands. Runs in parallel with 04. Do not edit `apps/mobile`, the catalog, the
seed, or the player.

## Worker fills the follow row

`apps/workers/src/commands/mq/rss/runAddByRSSParser.ts`: on `result.status === 'parsed'` (around
line 139) the worker writes the parse cache and calls `updateRequiresCredentials`. Add one more
step after it:

- New method on `AccountFollowingAddByRSSChannelService`
  (`packages/orm/src/services/account/accountFollowingAddByRSSChannel.ts`),
  `setFeedMetadata(account_id, feed_url, { title, image_url })`, shaped like
  `setRequiresCredentials`: one `update({ account_id, feed_url }, ...)`, a no-op when the account
  does not follow the feed.
- Title and image come from `result.parsedFeed` with the same selection rules parser-mapping uses
  for the channel title and artwork. Find that code and call it, or extract a small shared
  function into parser-mapping; do not write a third copy (**reuse-beyond-components**).
- Skip empty values; never overwrite a real title with an empty one. Trim to the column length
  in the entity.
- Never store a URL with userinfo in `image_url`. Drop the value if it has one.
- Wrap the call like `updateRequiresCredentials`: a failure is logged and does not fail the parse.
- `not_modified` changes nothing.

Unit test in `apps/workers`: parsed sets title and image; empty title leaves the old one;
`not_modified` and failures do not call the method.

## Web: one change event for a feed

New `apps/web/src/utils/addByRSS/feedChangedEvent.ts`:

- `emitAddByRSSFeedChanged(feedUrl)` dispatches a `window` `CustomEvent` with the canonical feed
  URL.
- `onAddByRSSFeedChanged(handler)` returns an unsubscribe function.
- Hook `useAddByRSSFeedChanged(feedUrl | null, handler)` in `apps/web/src/hooks/`.

Emit from the single place that writes a parse result to IndexedDB (`applyAddByRSSParseStatus` in
`apps/web/src/utils/addByRSS/actions.ts`) and from the follow sync when a stub's title or image
changes. 06 uses this event to update the player in place.

## Web: first parse anywhere

`AddByRSSListClient.tsx` has `feedNeedsFirstParse` and `enqueueFollowsWithoutCache` (around lines
97-155) with a module-level `uncachedFollowParses` set. Move both to
`apps/web/src/utils/addByRSS/firstParse.ts`, keeping the set at module scope so every caller
shares it. Accept an optional feed URL list so one page can ask for one feed. The list page calls
the moved code with no behavior change.

Also move the follow-to-stub sync the list uses (`syncFeeds`, stubs with
`title: channel.title ?? channel.feed_url`) into `apps/web/src/utils/addByRSS/` if it is not
already there, and update an existing stub's `title` and `imageUrl` from the server follow when
the stub has no parse yet. That is how the worker's backfill reaches a browser that has not
parsed.

## Web: detail page

`apps/web/src/components/AddByRSS/Detail/AddByRSSDetailClient.tsx` loads the record with
`getAddByRSSFeedByIdText`. When the record needs a first parse:

- Show the stub at once: title and artwork from the follow row, the episode list's existing
  processing state (reuse the list page's processing copy; add no keys).
- Start the first parse for that feed through `firstParse.ts`.
- Subscribe with `useAddByRSSFeedChanged` and re-read the record when it fires, so episodes
  appear in place without a reload.

## Web: background refresh

New `apps/web/src/utils/addByRSS/backgroundRefresh.ts` and a small client component mounted once
under the signed-in providers in `apps/web/src/providers/`. It mirrors mobile's
`createAddByRssRefreshJob` in `apps/mobile/src/sync/syncJobs.ts`:

1. Signed in only. Run on mount and when `document.visibilityState` becomes `visible`.
2. At most once every 30 minutes per account. Store the last start time in `localStorage` under a
   per-account key, written before the work starts, so two tabs do not both run.
3. Sync follows into IndexedDB stubs (the moved sync).
4. First-parse any feed that has never been parsed, under the same rule the list page uses.
5. If `evaluateFeatureAccess('add_by_rss_refresh', deriveMembershipState(account)).allowed`
   (from `@podverse/helpers`), call `runAddByRSSParseAll` (`apps/web/src/utils/addByRSS/parseAll.ts`)
   for the remaining feeds. It sends ETag and hash maps, so unchanged feeds cost a 304.
6. Status updates go through `applyAddByRSSParseStatus`, which emits the change event.
7. Errors are logged once per session per feed and never shown as toasts. The list page's manual
   Check for Updates keeps working as it does today.

Unit tests next to the new modules: throttle (second call inside 30 minutes does nothing; a
different account runs), membership denied skips `runAddByRSSParseAll` but still first-parses,
and the shared set prevents a second first parse for the same feed.

## E2E

New `apps/web/e2e/add-by-rss-auto-parse.spec.ts`. Mock parse and status with the existing helpers
in `apps/web/e2e/helpers/addByRSSCredentials.ts`. Top-level `describe`: "Add by RSS parses on its
own".

1. Fresh browser context, sign in, open the seeded Add by RSS feed's page directly. The header
   shows the follow row's title (not the URL) before the parse completes.
2. Episodes appear without pressing anything.
3. Load the home page. One parse-all request is sent; reload within the same session and no
   second one is sent.

## Scratchpad entry

```markdown
## Add by RSS feeds show real names and refresh on their own

- Surfaces: workers, web, orm
- Change: After each parse, the server saves the feed's title and artwork on the follow, so other
  devices show real names before they parse. Web parses a newly seen feed on its own, including
  when its page is opened directly, and refreshes followed feeds in the background for members
  (at most every 30 minutes). Pages update in place when a parse finishes.
- Who notices: anyone who adds a feed on one device and opens another
- Operator steps: none
```

## Done when

- [ ] Worker writes follow title and image after a parse
- [ ] Change event emitted from the parse write and the stub sync
- [ ] First parse shared by the list and detail pages
- [ ] Background refresh mounted, throttled, membership-checked
- [ ] Unit tests, E2E spec, scratchpad entry

## Operator verification

**Root**

```bash
npm run build:packages
npm run test -w apps/workers
npm run test -w apps/web
npm run build -w apps/workers
make e2e_test_web_report_spec SPEC=e2e/add-by-rss-auto-parse.spec.ts,e2e/add-by-rss-credentials-add.spec.ts,e2e/add-by-rss-credentials-partial-row.spec.ts
open .artifacts/e2e-reports/latest/index.html
```
