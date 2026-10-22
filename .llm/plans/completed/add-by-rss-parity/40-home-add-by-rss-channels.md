# 40 — Home lists Add by RSS channels

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

Rows: R1, R2. Mobile only. Web Home is area F (plans 60–69).

Runs after plan 10 (the row layout). It shares `HomeScreen.tsx` with plans 41 and 43; run 40, 41,
42, and 43 in that order, never together.

## Answers

**R1 — why Add by RSS feeds are missing on Home.** It is on purpose, not a sync bug.
`fetchHomeFeedRows` in `src/screens/home/homeFeedData.ts` reads the channel chips with
`subscriptionsRepository.list({ filter: 'directory', kind, sort })`, and its comment says "Add by
RSS feeds live on the Add by RSS library screen". The Episodes and Tracks chips also read
directory follows only. The rule `.cursor/rules/mobile-tab-stack-isolation.mdc` (§ Add-by-RSS
surface ownership) says "Do **not** merge add-by-RSS follows into Home", and
`docs/features/ADD-BY-RSS.md` says "Home lists directory follows only". `HomeScreen` already
routes a podcast row with `source === 'addByRss'` to `AddByRssPodcastDetail`, but no such row
ever reaches it.

**R2 — the dedicated screen.** My Library → Add by RSS (`src/screens/rss/AddByRssRootScreen.tsx`)
already lists only Add by RSS feeds: `fetchAddByRssLibraryFeed` reads channel chips with
`filter: 'addByRss'` and item chips from Add by RSS feeds only. It stays as it is. No code change
for R2.

## Locked decisions

1. **Channel chips merge both sources.** Podcasts, Artists, and Albums list directory follows and
   Add by RSS follows together, through the existing merge in `subscriptionsRepository.list`
   (`filter: 'all'`). Sort is the chip's sort; Add by RSS follows have no listen-count rank, so
   under Popularity they sort after ranked rows (`compareSubscribedByPopularity`, unchanged).
2. **Ready feeds only.** Home passes `credentials: 'ready'`. A feed waiting on a username and
   password stays off Home; the Add by RSS library's "Needs username and password" section is the
   only place it shows (**add-by-rss-client-held-credentials**).
3. **Row tap.** An Add by RSS row on any channel chip opens the Home stack's
   `AddByRssPodcastDetail` with `feedIdText: row.sourceId ?? row.id`. That screen already serves
   podcast, artist, and album feeds. A directory row keeps its current target.
4. **Swipe.** Home's existing `SwipeActionRow` already passes `source: row.source ?? 'directory'`
   to `subscriptionsRepository.unsubscribe`, which removes an Add by RSS feed locally and unfollows
   it on the account. No change; an Add by RSS row gets the same Unsubscribe swipe.
5. **Item chips** (Episodes, Tracks) are plan 41. This plan changes channel chips only.
6. **Guidance follows the code.** The rule, the feature doc, and the comment that say Home lists
   directory follows only are rewritten in this plan.

## Files

| File                                                | Change                                   |
| --------------------------------------------------- | ---------------------------------------- |
| `apps/mobile/src/screens/home/homeFeedData.ts`      | Channel chips read both sources          |
| `apps/mobile/src/screens/home/HomeScreen.tsx`       | Add by RSS artist/album rows open detail |
| `apps/mobile/src/screens/home/homeFeedData.test.ts` | Channel-chip expectation                 |
| `apps/mobile/e2e/add-by-rss.yaml`                   | New feed shows on Home                   |
| `.cursor/rules/mobile-tab-stack-isolation.mdc`      | Home includes Add by RSS                 |
| `docs/features/ADD-BY-RSS.md`                       | Mobile Home sentence                     |
| `release-notes/scratchpad.md`                       | Entry                                    |

## Implementation

### `homeFeedData.ts`

Anchor: the `if (mediaType === 'podcasts' || mediaType === 'artists' || mediaType === 'albums')`
branch of `fetchHomeFeedRows`.

- Replace the `list` call with:

```typescript
const subscribed = await subscriptionsRepository.list({
  credentials: 'ready',
  filter: 'all',
  kind,
  sort,
});
```

- Replace the branch comment with:

```typescript
// Channel chips list directory and Add by RSS follows together. Kind splits podcasts / artists /
// albums so a music follow never appears under Podcasts and the reverse. Feeds waiting on a
// username and password stay off Home; the Add by RSS library lists them. Popularity ranks
// arrive from the sync queue; this path never waits on the network to paint.
```

`attachSubscriptionMetadataOrBare` already maps Add by RSS follows (`source`, `sourceId`) and joins
their live, unseen, and downloaded metadata by feed URL. Nothing else in this file changes here.

### `HomeScreen.tsx`

Anchor: `const handleRowPress = useCallback(`.

Replace the podcasts-only Add by RSS branch with one check at the top of the callback, before the
`selectedMediaType === 'podcasts'` branch:

```typescript
if (
  row.source === 'addByRss' &&
  (selectedMediaType === 'podcasts' ||
    selectedMediaType === 'artists' ||
    selectedMediaType === 'albums')
) {
  navigation.navigate(HOME_STACK_ROUTES.AddByRssPodcastDetail, {
    feedIdText: row.sourceId ?? row.id,
  });
  return;
}
```

Delete the `if (row.source === 'addByRss') { … }` block inside the podcasts branch. The podcasts,
artists, and albums branches keep their directory navigation. The dependency list is unchanged.

### `homeFeedData.test.ts`

This file is outside the `apps/mobile/vitest.config.ts` `include` list (it imports the SQLite
repositories), so it does not run. Keep it accurate anyway: in the test "requests directory
follows only for channel chips and item channel ids", change the channel-chip expectation to
`{ credentials: 'ready', filter: 'all', kind: 'podcasts', sort: 'alphabetical' }` and rename the
test to "requests every ready follow for channel chips and directory follows for item channel
ids". Plan 41 rewrites the item half of that test.

### `.cursor/rules/mobile-tab-stack-isolation.mdc`

§ Add-by-RSS surface ownership. Replace the bullet "Do **not** merge add-by-RSS follows into Home.
Home lists directory follows only." with:

```markdown
- Home lists directory follows and ready add-by-RSS follows together on every chip. A feed
  waiting on a username and password shows only in the Add by RSS library. An add-by-RSS row on
  Home opens Home's own `AddByRssPodcastDetail` (or `AddByRssEpisodeDetail` for an episode).
```

Keep the other bullets. The web bullet ("Web keeps add-by-RSS on its own sidebar library routes;
those pages stay separate from Home.") belongs to area F; leave it for that plan.

### `docs/features/ADD-BY-RSS.md`

In the first paragraph, replace "Home lists directory follows only." with "Mobile Home lists
those feeds beside directory follows, except feeds still waiting on a username and password." Leave
the following web sentence for area F.

### `e2e/add-by-rss.yaml`

Insert after `- takeScreenshot: add-by-rss-feed-listed` and before the
`- tapOn: text: E2E Add-by-RSS Channel` step:

```yaml
# Home lists Add by RSS follows beside directory follows, so the new feed is on its Podcasts chip.
- tapOn:
    id: tab-home
- assertVisible:
    id: home-screen
- runFlow:
    file: shared/restore-chip-row-start.yaml
    env:
      CHIP_ROW_ID: home-media-type-selector
- tapOn:
    id: home-media-type-podcasts
- extendedWaitUntil:
    visible:
      text: E2E Add-by-RSS Channel
      childOf:
        id: home-feed-list
    timeout: ${TIMEOUT_SLOW}
- takeScreenshot: add-by-rss-home-listed
- tapOn:
    id: tab-my-library
- assertVisible:
    id: rss-root-screen
```

Also update the flow's header comment: replace "the list is feeds only" with "the library lists
Add by RSS feeds only, and Home lists them too".

## Tests

- No new unit test: the change is one repository argument and one navigation branch. The merge
  and its popularity order are covered by `subscriptionsMerge.test.ts`.
- Maestro `e2e/add-by-rss.yaml` step above.
- `e2e/home.yaml` keeps passing: the seeded account's Add by RSS follow is a podcast feed, so the
  Artists, Albums, and Tracks empty states it asserts are unchanged, and its "seed" filter still
  finds `home-feed-row-e2ePodChnl001`.

## Release scratchpad

Append to `release-notes/scratchpad.md`:

```markdown
## Mobile Home lists Add by RSS podcasts, artists, and albums

- Surfaces: mobile
- Change: Home's Podcasts, Artists, and Albums chips list Add by RSS follows beside directory
  follows, sorted together. Feeds still waiting on a username and password stay in My Library →
  Add by RSS only. Tapping an Add by RSS row opens its channel page on the Home tab, and swiping
  it left unsubscribes, as for a directory follow. Grid view shows the same follows as tiles.
- Who notices: anyone who follows a feed by RSS URL; those shows now appear on Home
- Operator steps: none
```
