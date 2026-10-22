# 36 — Add by RSS episode page: Chapters and Transcript chips

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

Rows: R55 (the Add by RSS episode page also has Chapters and Transcript). Mobile, plus an E2E-only
API fixture.

Runs after `32-item-detail-header.md`, `33-add-by-rss-episode-detail.md` (the screen this
extends), `34-add-by-rss-item-rows.md` (the row tap this flow uses), and
`35-add-by-rss-chapters-transcript-data.md` (the loader and chip rule).

## Locked decisions

1. **Parity source** is the podcast episode page (`src/screens/episode/EpisodeDetailScreen.tsx`):
   same labels (`EPISODE_TAB_LABEL_KEYS`), same empty keys (`info.chapter.no_chapters`,
   `info.transcript.no_transcript`), same error key (`errors.generic`) with Retry, same Offline
   Mode message (`OFFLINE_UNAVAILABLE_MESSAGE_KEY`), the same chapter row, and the transcript as
   plain text. Chapter rows are not pressable, as on the episode page.
2. **One chapter row.** Move the episode page's private `EpisodeChapterRow` to
   `src/components/content/ItemChapterRow.tsx` as `ItemChapterRow`, with a required `testID`
   prop. Both screens render it.
3. **Chips** come from plan 35's `resolveAddByRssEpisodeTabs`, so Chapters and Transcript show
   only when the parsed item links them, in the episode page's order.
4. **Loading.** One request per visit, sent the first time Chapters or Transcript is selected;
   the answer fills both chips. Nothing is cached past the visit (plan 35, decision 4).
5. **Signed out** (`useAuth().status === 'anonymous'`): the two chips show the login call to
   action (`authentication.login_required`, button `authentication.login`), because the endpoint
   needs an account. While status is `'unknown'` they show the loading spinner.
6. **Offline Mode** on, with nothing loaded this visit: the Offline Mode message. Sections loaded
   before Offline Mode was turned on stay visible.
7. **Device proof** is a new Maestro flow, `e2e/add-by-rss-episode-sections.yaml`, on a new
   E2E-only parse fixture. The existing fixtures stay unchanged, because web specs and other
   mobile flows play their items.

## Files

| File                                                               | Change                  |
| ------------------------------------------------------------------ | ----------------------- |
| `apps/mobile/src/components/content/ItemChapterRow.tsx`            | New                     |
| `apps/mobile/src/components/content/index.ts`                      | Export it               |
| `apps/mobile/src/screens/episode/EpisodeDetailScreen.tsx`          | Use it                  |
| `apps/mobile/src/screens/home/addByRss/useAddByRssItemSections.ts` | New hook                |
| `apps/mobile/src/screens/home/AddByRssEpisodeDetailScreen.tsx`     | Chips, panes, list rows |
| `apps/api/src/controllers/account/accountAddByRSSParse.ts`         | E2E sections fixture    |
| `apps/mobile/e2e/add-by-rss-episode-sections.yaml`                 | New flow                |
| `scripts/mobile/e2e-test.sh`                                       | Register the flow       |
| `apps/mobile/e2e/README.md`                                        | List the flow           |
| `docs/features/ADD-BY-RSS.md`                                      | List the flow           |
| `.cursor/skills/mobile-test-economics/SKILL.md`                    | Discovery row           |

## Implementation

### `ItemChapterRow.tsx` and the episode page

```typescript
export type ItemChapterRowProps = {
  chapter: DTOItemChapter;
  fallbackImageUrl: string | null;
  showImages: boolean;
  testID: string;
};

/** One chapter on an episode page: artwork when the section has any, title, and time range. */
export function ItemChapterRow({ … }: ItemChapterRowProps) { … }
```

- Body: `EpisodeDetailScreen`'s `EpisodeChapterRow` unchanged, except `testID={testID}` and the
  imports become relative to `components/content/` (`./ChapterListRow`).
- `index.ts`: add `export { ItemChapterRow } from './ItemChapterRow';` and
  `export type { ItemChapterRowProps } from './ItemChapterRow';` after the `ChapterListRow` lines.
  Plan 32 also edits this file; keep its `ItemDetailHeader` export.
- `EpisodeDetailScreen.tsx`: delete `EpisodeChapterRow`; `renderItem` renders `<ItemChapterRow
  chapter={row.chapter} fallbackImageUrl={chapterFallbackImageUrl}
  showImages={chapterListShowsImages} testID="episode-detail-chapter-row" />`. Import
  `ItemChapterRow` from `../../components/content` and drop imports left unused
  (`ChapterListRow`, `resolveChapterRowArtwork`; `formatHHMMSS` stays for soundbite rows).

### `useAddByRssItemSections.ts`

```typescript
/**
 * Chapters and transcript for the Add by RSS item on screen, fetched once per visit the first time
 * `enabled` turns true. Errors stay until `retry`; a new item clears both.
 */
export function useAddByRssItemSections(input: {
  enabled: boolean;
  feedUrl: string | null;
  itemBundle: AddByRSSMappedFeed['items'][number] | null;
  itemIdText: string | null;
}): {
  errorKey: 'errors.generic' | null;
  retry: () => void;
  sections: AddByRssItemSections | null;
};
```

- State `sections` and `errorKey`; refs `inFlightRef` (boolean) and `requestIdRef` (number).
- `useEffect` on `input.itemIdText`: bump `requestIdRef`, clear `inFlightRef`, `setSections(null)`,
  `setErrorKey(null)`.
- `useEffect` on `enabled`, `errorKey`, `feedUrl`, `itemBundle`, `itemIdText`, `sections`, and the
  four auth values: return early unless `enabled`, `sections === null`, `errorKey === null`,
  `!inFlightRef.current`, and all three inputs are non-null. Then set `inFlightRef.current = true`,
  capture `const requestId = ++requestIdRef.current`, and call
  `segmentsRepository.getAddByRssChaptersAndTranscript({ accessToken, clearSession, refreshToken,
  setTokens }, { feedUrl, itemBundle, itemIdText })` (auth values from `useAuth()`, as
  `useNowPlayingChapters` builds the context). On resolve, when `requestId ===
  requestIdRef.current`, `setSections`. On reject, when current, `setErrorKey('errors.generic')`.
  In `finally`, when current, `inFlightRef.current = false`.
- `retry`: `useCallback(() => setErrorKey(null), [])`; the effect then loads again.

### `AddByRssEpisodeDetailScreen.tsx`

Plan 33 built this screen. Changes:

- `tab` state becomes `AddByRssEpisodeTab` (plan 35), default `'summary'`.
- `sectionUrls = useMemo(() => (episode === null ? null :
  addByRssItemSectionUrls(episode.itemBundle)), [episode])`.
- `tabs = useMemo(() => resolveAddByRssEpisodeTabs({ hasChapters: sectionUrls?.chaptersFeedUrl
  !== undefined, hasPeople: people.length > 0, hasTranscript: sectionUrls?.transcriptUrl !==
  undefined }), [people.length, sectionUrls])`. Watch the optional chain: with `sectionUrls ===
  null`, `null?.x !== undefined` is `false`, which is the intended result.
- Chips map `tabs` with plan 33's `key`, `label`, and `testID` shape. Replace plan 33's People
  fallback with `const activeTab = tabs.includes(tab) ? tab : 'summary';` and use `activeTab`
  everywhere the screen reads the tab.
- New hooks: `const { status } = useAuth();`, `const { onRequestLogin } = useAuthPrompt();`
  (`src/auth/AuthPromptContext`), `const { enabled: offlineModeEnabled } = useOfflineMode();`.
- `const isSectionTab = activeTab === 'chapters' || activeTab === 'transcript';`
- `const { errorKey: sectionsErrorKey, retry: retrySections, sections } =
  useAddByRssItemSections({ enabled: isSectionTab && status === 'authenticated' &&
  !offlineModeEnabled, feedUrl: feed?.feedUrl ?? null, itemBundle: episode?.itemBundle ?? null,
  itemIdText: episode?.id ?? null });`
- `chapterRows = activeTab === 'chapters' && sections !== null ? sections.chapters : []`, memoized.
  `chapterListShowsImages = chapterSectionHasImages(chapterRows)` (`@podverse/helpers`).
- `FillList`: `data={chapterRows}`, `keyExtractor={(chapter) => chapter.id_text}` (module-level
  function), `renderItem` renders `ItemChapterRow` with `fallbackImageUrl={episode.imageUrl}`,
  `showImages={chapterListShowsImages}`, `testID="add-by-rss-episode-detail-chapter-row"`;
  `extraData={`${activeTab}:${sections === null ? 'none' : 'loaded'}`}`; `testID` is
  `'add-by-rss-episode-detail-chapter-list'` on Chapters, else `'add-by-rss-episode-detail-list'`.
- `ListFooterComponent` keeps plan 33's Summary and People branches. Before them, when
  `isSectionTab`, return the first that applies:
  1. `offlineModeEnabled && sections === null` → `ListEmpty
     messageKey={OFFLINE_UNAVAILABLE_MESSAGE_KEY}
     testID="add-by-rss-episode-detail-offline-unavailable"`.
  2. `status === 'anonymous'` → `CallToActionSection actionLabelKey="authentication.login"
     messageKey="authentication.login_required" onAction={onRequestLogin}
     testID="add-by-rss-episode-detail-auth-required"`.
  3. `sectionsErrorKey !== null` → `ListError messageKey={sectionsErrorKey}
     onRetry={retrySections} testID={`add-by-rss-episode-detail-tab-error-${activeTab}`}`.
  4. `sections === null` → `LoadingSection
     testID={`add-by-rss-episode-detail-tab-loading-${activeTab}`}`.
  5. Transcript: `sections.transcriptText === ''` → `ListEmpty
     messageKey="info.transcript.no_transcript"
     testID="add-by-rss-episode-detail-tab-empty-transcript"`; else `<Text
     style={styles.transcript} testID="add-by-rss-episode-detail-tab-transcript-content">`.
  6. Chapters with `chapterRows.length === 0` → `ListEmpty messageKey="info.chapter.no_chapters"
     testID="add-by-rss-episode-detail-tab-empty-chapters"`; else `null` (rows are list data).
- `styles.transcript`: `{ ...typography.body, color: themeStyles.textPrimary.color }`, the
  episode page's value.
- Doc comment: drop Chapters and Transcript from anything that calls them absent. Add: Chapters
  and Transcript show when the parsed item links them; the API fetches them once per visit, they
  need a signed-in account, and Offline Mode shows its message until they have loaded.

Imports: `CallToActionSection` from `../../components/state/CallToActionSection`, `ListEmpty`,
`OFFLINE_UNAVAILABLE_MESSAGE_KEY` from `../../lib/offlineModeViews`, `useOfflineMode` from
`../../prefs/offlineMode`, and the plan 35 exports. Match the import style already in the file.

### `accountAddByRSSParse.ts` (E2E fixtures only)

- Add to `E2eParsedFeedFixture`: `chaptersUrl?: string;` and `transcriptUrl?: string;`.
- New constants beside the default fixture:
  - `E2E_ADD_BY_RSS_SECTIONS_FEED_URL = 'https://e2e-seed-addbyrss.example/podcast-sections.xml'`
  - `E2E_ADD_BY_RSS_SECTIONS_PARSED_FEED`: channel title `'E2E Add-by-RSS Sections Channel'`,
    item title `'E2E Add-by-RSS Sections Episode'`, guid
    `'https://e2e-seed-addbyrss.example/item-guid/sections'`, the default fixture's `link`,
    images, enclosure, duration, and `pubDate`, plus
    `chaptersUrl: 'http://localhost:2111/chapters/chapters-feed-podcast-1-item-0.json'` and
    `transcriptUrl: 'http://localhost:2111/transcripts/transcript-feed-podcast-1-item-0-0.vtt'`
    (both served by `tools/test-assets`).
- `buildE2eParsedFeedPayload`: pick the fixture from a `Record<string, E2eParsedFeedFixture>`
  keyed by the test-assets and sections URLs, falling back to `E2E_DEFAULT_PARSED_FEED`. Add to
  the item, only when set: `podcastChapters: { url: source.chaptersUrl, type:
  'application/json+chapters' }` and `podcastTranscripts: [{ url: source.transcriptUrl, type:
  'text/vtt', language: 'en', rel: 'captions' }]` (the partytime fields
  `packages/parser-mapping/src/compat/partytime/item.ts` reads).
- One-line doc comment on the new fixture: a feed whose item links chapters and a transcript, for
  the mobile episode sections flow. The fixture path stays behind `config.e2e.fixturesEnabled`.

### `e2e/add-by-rss-episode-sections.yaml`

Header like `add-by-rss.yaml`: `appId`, `name: Add By RSS Episode Sections Flow`, a comment that
the fixture item links the test-assets chapters and transcript and the API fetches both, and
`# Needs flow_needs_e2e_api + flow_needs_test_assets.` Steps:

```yaml
- runFlow: shared/launch-and-connect.yaml
- runFlow: shared/login-seeded-user.yaml
- tapOn:
    id: tab-my-library
- tapOn:
    id: library-nav-add-by-rss
- tapOn:
    id: rss-add-button
- tapOn:
    id: rss-url-input
- inputText: https://e2e-seed-addbyrss.example/podcast-sections.xml
- tapOn:
    id: rss-add-submit
- extendedWaitUntil:
    visible:
      id: rss-root-screen
    timeout: ${TIMEOUT_SLOWER}
- tapOn:
    text: E2E Add-by-RSS Sections Channel
- extendedWaitUntil:
    visible:
      id: add-by-rss-home-detail-screen
    timeout: ${TIMEOUT_SLOW}
- tapOn:
    id: "home-feed-row-title-.*"
    text: E2E Add-by-RSS Sections Episode
- extendedWaitUntil:
    visible:
      id: add-by-rss-episode-detail-tab-chapters
    timeout: ${TIMEOUT_SLOW}
- assertVisible:
    id: add-by-rss-episode-detail-tab-transcript
- tapOn:
    id: add-by-rss-episode-detail-tab-chapters
- extendedWaitUntil:
    visible:
      id: add-by-rss-episode-detail-chapter-row
      text: ".*Pauci celer taceo.*"
    timeout: ${TIMEOUT_SLOWER}
- takeScreenshot: add-by-rss-episode-sections-chapters
- tapOn:
    id: add-by-rss-episode-detail-tab-transcript
- extendedWaitUntil:
    visible:
      id: add-by-rss-episode-detail-tab-transcript-content
      text: ".*Magni valetudo odio.*"
    timeout: ${TIMEOUT_FAST}
- takeScreenshot: add-by-rss-episode-sections-transcript
```

The quoted strings are the second chapter title in `chapters-feed-podcast-1-item-0.json` and the
first cue in `transcript-feed-podcast-1-item-0-0.vtt`. If the chapter row's title is a nested
text node that the `id` plus `text` match misses, assert `- assertVisible: "Pauci celer taceo."`
after waiting for the row id instead. No cleanup: `launch-and-connect` clears app state.

### Flow registration and lists

- `scripts/mobile/e2e-test.sh`: add `add-by-rss-episode-sections` after `add-by-rss-credentials`
  in both `flow_needs_e2e_api` and `flow_needs_test_assets`.
- `apps/mobile/e2e/README.md` "Current flows": add `add-by-rss-episode-sections` after
  `add-by-rss-credentials`.
- `docs/features/ADD-BY-RSS.md`, the **Mobile E2E** bullet: add
  `apps/mobile/e2e/add-by-rss-episode-sections.yaml` (an item's Chapters and Transcript).
- `.cursor/skills/mobile-test-economics/SKILL.md`, Discovery row: add `add-by-rss-episode-sections`
  after `add-by-rss`. Keep the table aligned.

## Tests

- Plan 35's unit tests cover the chip rule, request body, and mapping.
- Maestro `e2e/add-by-rss-episode-sections.yaml` proves the chips appear, the request reaches the
  API, and both bodies render.
- `EpisodeDetailScreen` keeps testID `episode-detail-chapter-row`; `e2e/player-screen.yaml` and
  any episode chapter asserts need no change.
- No hook test: `useAddByRssItemSections` is a React Native hook outside the vitest suite.

## Release scratchpad

```markdown
## Mobile Add by RSS episodes get Chapters and Transcript

- Surfaces: mobile
- Change: The Add by RSS episode page shows Chapters and Transcript chips when the feed item links
  a chapters file or a transcript. Choosing either loads both through the account API, using the
  feed's saved username and password only for files on the feed's own domain. Chapters list with
  artwork and time ranges, and the transcript shows as text, as on a podcast episode page. Both
  need a signed-in account, and Offline Mode shows its unavailable message until they load.
- Who notices: anyone who adds podcasts by RSS on the phone
- Operator steps: none
```
