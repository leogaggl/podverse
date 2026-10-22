# 21 — Add by RSS channel detail section chips

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

Rows: R40. Mobile only. Runs after `20-add-by-rss-detail-shell.md`, which created the section
resolver, `AddByRssSectionPaneProps`, and the Episodes / Tracks section.

## What the device can support

The parity source is the podcast chip set in `screens/podcast/podcastSections.ts` (Episodes,
Downloaded, About, Clips, Official Clips, Podroll, Funding, People) and, for music feeds, the
album screen (Tracks, About, Funding, People). An Add by RSS feed lives only on the device: its
parsed bundle (`AddByRSSMappedFeed`) carries the description, website, funding, and people, and
auto-downloads use the feed URL as the download's channel id.

| Chip       | Offered                      | Source on the device                                 |
| ---------- | ---------------------------- | ---------------------------------------------------- |
| Episodes   | podcast feeds                | plan 20                                              |
| Tracks     | music feeds                  | plan 20                                              |
| Downloaded | podcast feeds, always        | `downloadsRepository.listCompleteByChannel(feedUrl)` |
| About      | always                       | `mappedFeed.channel.description`, `.about`, feed URL |
| Funding    | `channel.funding.length > 0` | `mappedFeed.channel.funding`                         |
| People     | `channel.people.length > 0`  | `mappedFeed.channel.people`                          |

Not offered, recorded in the screen's doc comment as intentional divergences:

- **Clips** and **Official Clips**: both are server rows keyed to a server item id.
- **Podroll**: `reqPodrollGetForChannel` resolves remote items against server channels.
- **Boosts** (web-only tab): mobile podcast detail has no Boosts chip either.

Chips come from the parsed bundle already on the device, so they render on first paint and need
no `sectionChromeCache` entry (**mobile-section-chrome-cache** covers server-derived chips).

## Locked decisions

1. **Order.** Podcast feeds: Episodes, Downloaded, About, Funding, People. Music feeds: Tracks,
   About, Funding, People (no Downloaded, matching the album screen).
2. **Resolver.** `resolveAddByRssSections` in `screens/home/addByRss/addByRssDetailSections.ts`
   takes `{ hasFunding: boolean; hasPeople: boolean; isMusicFeed: boolean }` and returns the order
   above. When `mappedFeed` is null (not parsed yet) both flags are false.
3. **Initial section.** New pure `resolveAddByRssInitialSection({ isMusicFeed, offline })` in the
   same file: `downloaded` when `offline` and not music, otherwise `addByRssItemsTab(isMusicFeed)`.
   The screen calls it with `isOfflineModeEnabled()` wherever plan 20 reset the section on a feed
   change. When `useOfflineMode().enabled` turns true while the screen is open and `downloaded`
   is offered, select `downloaded`; turning it off leaves the section alone
   (**mobile-offline-mode**).
4. **About.** Widen `ChannelAboutSectionProps.channel` in
   `components/content/ChannelAboutSection.tsx` from `DTOChannel | null` to
   `(ChannelAboutSource & { id?: number | string | null }) | null`. `DTOChannel` still satisfies
   it, so podcast, album, and artist callers do not change. The component keeps
   `resetKey={channel?.id ?? null}`. Add by RSS passes `buildAddByRssAboutSource(detail)`.
5. **Funding and People.** Reuse `FundingLinksSection` and `PeoplePane` unchanged. Parsed entries
   have no ids, so the adapters number them from 1 in feed order.
6. **Downloaded rows.** The rows are the Episodes rows whose download id has a complete download,
   rendered with the same `AddByRssEpisodeRow` and playback as Episodes, in Episodes' `recent`
   order. A complete download whose item is no longer in the parsed feed is left out here; it still
   shows in Library → Downloads.
7. **Download id.** Today the id is built inline in `downloads/autoDownloadEvaluate.ts`
   (`mappedAddByRssItemToDto`). Extract it so detail rows and auto-download cannot drift:

```typescript
// apps/mobile/src/lib/addByRss/downloadIdText.ts
export const addByRssDownloadItemIdText = (
  feedUrl: string,
  item: { guid?: string | null; guid_enclosure_url?: string | null },
  index: number
): string => `${feedUrl}::${item.guid ?? item.guid_enclosure_url ?? String(index)}`;
```

   `mappedAddByRssItemToDto` calls it with `itemBundle.item`. No other behavior in that file
   changes.
8. **Filter.** `downloaded` is filterable like Episodes: `isAddByRssFilterableSection` returns true
   for `episodes`, `tracks`, and `downloaded`. Sort stays Episodes / Tracks only.

## Files

Paths are under `apps/mobile/`.

| File                                                       | Change                         |
| ---------------------------------------------------------- | ------------------------------ |
| `src/screens/home/addByRss/addByRssDetailSections.ts`      | Resolver input, initial tab    |
| `src/screens/home/addByRss/addByRssDetailSections.test.ts` | Cases                          |
| `src/screens/home/addByRssHomeDetailData.ts`               | Adapters, `downloadItemIdText` |
| `src/screens/home/addByRssHomeDetailData.test.ts`          | Adapter cases                  |
| `src/lib/addByRss/downloadIdText.ts`                       | New                            |
| `src/lib/addByRss/downloadIdText.test.ts`                  | New                            |
| `vitest.config.ts`                                         | Include the new test           |
| `src/downloads/autoDownloadEvaluate.ts`                    | Use the helper                 |
| `src/components/content/ChannelAboutSection.tsx`           | Widen `channel` prop           |
| `src/screens/home/addByRss/AddByRssAboutSection.tsx`       | New                            |
| `src/screens/home/addByRss/AddByRssFundingSection.tsx`     | New                            |
| `src/screens/home/addByRss/AddByRssPeopleSection.tsx`      | New                            |
| `src/screens/home/addByRss/AddByRssDownloadedSection.tsx`  | New                            |
| `src/screens/home/AddByRssHomeDetailScreen.tsx`            | Wire sections, offline tab     |
| `e2e/add-by-rss.yaml`                                      | About chip step                |

## Implementation

### `addByRssHomeDetailData.ts`

- `AddByRssHomeEpisode` gains `downloadItemIdText: string`, set in `buildAddByRssHomeDetailData`
  with `addByRssDownloadItemIdText(feed.feedUrl, itemBundle.item, itemIndex)`. The row `id` stays
  `${feed.idText}-${guid ?? index}`; it is the row key and testID suffix, not a download id.
- `AddByRssHomeDetailData` gains `about: ChannelAboutSource & { id: string }`,
  `fundings: AboutFundingLink[]`, and `people: AboutPerson[]` (types from
  `components/content`; import `ChannelAboutSource` from
  `components/content/channelAboutCells`). Build them in `buildAddByRssHomeDetailData`:

```typescript
about: {
  channel_about: { website_link_url: mappedFeed?.channel.about?.website_link_url ?? null },
  channel_description: mappedFeed?.channel.description ?? null,
  feed: { url: feed.feedUrl },
  id: feed.idText,
},
fundings: (mappedFeed?.channel.funding ?? []).map((funding, index) => ({
  id: index + 1,
  title: funding.title ?? null,
  url: funding.url,
})),
people: (mappedFeed?.channel.people ?? []).map((person, index) => ({
  href: person.href ?? null,
  id: index + 1,
  img: person.img ?? null,
  name: person.name,
  role: person.role ?? null,
})),
```

  The bundle fields (`about`, `description`, `funding`, `people`) are declared on
  `ParsedRSSFeedCompatBundle` in `packages/parser-mapping/src/compat/partytime/compatFull.ts`;
  read the element types there for the exact nullability. Skip funding entries with an empty
  `url` and people with an empty `name`, then number what remains.
- `screens/rss/addByRssLibraryFeedData.ts` keeps working: it only reads `episodeRows`.

### Section components

Each mirrors its podcast counterpart in `screens/podcast/sections/` and takes
`AddByRssSectionPaneProps`:

- `AddByRssAboutSection`: `<ChannelAboutSection channel={detail.about} isChannelLoading={false}
  listHeader={listHeader} testIDPrefix="add-by-rss-home" />`.
- `AddByRssFundingSection`: `<FundingLinksSection fundings={detail.fundings} isLoading={false}
  listHeader={listHeader} testIDPrefix="add-by-rss-home" />`.
- `AddByRssPeopleSection`: `<PeoplePane isLoading={false} listHeader={listHeader}
  people={detail.people} testIDPrefix="add-by-rss-home" />`.
- `AddByRssDownloadedSection`: follows `PodcastDownloadedSection`'s load / subscribe / refresh
  shape:
  - `loadDownloads(source)` reads `downloadsRepository.listCompleteByChannel(detail.feed.feedUrl)`
    into a `Set` of `itemIdText`, then keeps
    `sortAddByRssHomeEpisodes(detail.episodeRows, 'recent')` rows whose `downloadItemIdText` is in
    the set. Errors set `errorKey` to `errors.generic`.
  - Subscribe to `downloadStore` and reload on change, as podcast does.
  - Filter by `matchesTitleFilter(row.title, filterTerm)`.
  - Rows render with `AddByRssEpisodeRow` and the same playback hook and `visitLastSeenAtMs` as the
    Episodes section. To share the row wiring, export a `useAddByRssEpisodeRowRenderer` hook from
    `AddByRssEpisodesSection.tsx` that returns `{ noticeKey, renderRow }` given `detail`,
    `isMusicFeed`, and `visitLastSeenAtMs`, and use it in both sections. Keep plan 20's testIDs for
    Episodes; Downloaded rows use the same row testIDs (a row is on one list at a time).
  - `PodcastSectionList` with `emptyMessageKey="features.download.empty"`,
    `testID="add-by-rss-home-downloaded-list"`, `statusTestIDPrefix="add-by-rss-home-downloaded"`,
    `onRefresh` calling the pane's `onRefresh` then `loadDownloads('refresh')`.

### Screen

- Resolve sections with
  `resolveAddByRssSections({ hasFunding: detail.fundings.length > 0, hasPeople:
  detail.people.length > 0, isMusicFeed })`.
- Map every tab in the section component record: `about`, `downloaded`, `funding`, `people` to the
  new components; `episodes` and `tracks` to `AddByRssEpisodesSection`.
- Pass the title filter `listHeader` for any section where `isAddByRssFilterableSection` is true;
  pass `null` otherwise.
- If the selected section is no longer offered after a reload (for example funding disappeared),
  fall back to `addByRssItemsTab(isMusicFeed)`.
- Extend the screen doc comment with the divergence list above.

## Tests

- `downloadIdText.test.ts`: guid wins, then `guid_enclosure_url`, then the index.
- `addByRssHomeDetailData.test.ts`: `downloadItemIdText` matches the helper for a row with a guid
  and a row with neither guid; `about` carries description, website, and feed URL; funding and
  people number from 1 and drop empty entries; a feed with no mapped bundle yields empty funding
  and people and an About source with only the feed URL.
- `addByRssDetailSections.test.ts`: podcast order with and without funding / people, music order
  (no Downloaded), `resolveAddByRssInitialSection` for offline on/off and music/podcast,
  `downloaded` filterable but not sortable.

Maestro `apps/mobile/e2e/add-by-rss.yaml`, after plan 20's sort chip assert, open About and come
back so the later play step still finds the episode list:

```yaml
- tapOn:
    id: add-by-rss-home-section-about
- assertVisible:
    id: add-by-rss-home-section-downloaded
- tapOn:
    id: add-by-rss-home-section-episodes
```

Do not assert About body text (the fixture feed's description is not under test). No Playwright
spec. No API test.

## Release scratchpad

```markdown
## Mobile Add by RSS detail gains Downloaded, About, Funding, and People chips

- Surfaces: mobile
- Change: The Add by RSS channel page shows the same section chips as a podcast page where the
  feed supports them. Podcast feeds get Episodes, Downloaded, About, and, when the feed lists
  them, Funding and People. Music feeds get Tracks, About, Funding, and People. About shows the
  feed's description with its RSS and website links. With Offline Mode on, a podcast feed opens
  on Downloaded. Clips, Podroll, and Boosts are not offered, because they need the feed to be in
  the Podverse catalog.
- Who notices: anyone who opens a feed they added by RSS on the phone
- Operator steps: none
```
