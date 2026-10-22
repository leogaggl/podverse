# 94 — Full player: Add by RSS Summary, Chapters, Transcript, and People

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

Rows: R64 (Add by RSS chapters and transcript in the mobile full player), the screen half. Mobile
only.

Runs after plan 93 (`93-add-by-rss-now-playing-chapters.md`, the now-playing store), plan 36
(`36-add-by-rss-episode-chapters-transcript.md`, the pane states and the flow this extends),
plan 39 (`39-add-by-rss-track-lyrics-and-player-link.md`, `e2e/add-by-rss-track.yaml`), and the
other plans that edit `FullPlayerScreen.tsx`: 50, 51, 90, and 91. Never in one phase with them.

Today `hasSectionsForTarget` in `apps/mobile/src/screens/player/FullPlayerScreen.tsx` returns
`false` for every Add by RSS target, so the full player shows no chips or pane sheet at all.

## Locked decisions

1. **Parity source** is the full player for a directory episode: same chips row, pane sheet,
   labels (`EPISODE_TAB_LABEL_KEYS`), empty keys, Retry, Offline Mode message, chapter rows
   (`ChapterListRow`, pressable to seek), and transcript text. Test IDs are the full player's
   existing ones. Section chrome follows **mobile-player-fixed-region**.
2. **Chips** come from plan 35's `resolveAddByRssEpisodeTabs` on plan 93's source: Summary
   always, Chapters and Transcript when the parsed item links them, People when it lists people.
   No Clips, Official Clips, or Funding (they need catalog data). Music uses the same chips and
   labels, as the directory full player does for tracks.
3. **Sections** show for every Add by RSS item except a livestream, decided from the target alone,
   so the sheet is there from the first frame. Livestreams keep no sections.
4. **Segment band** is decided per item from the target: reserved when the resource data's parsed
   bundle links a chapters file, when the source links one, or when chapters have loaded. It never
   appears mid-play for an item that links chapters.
5. **Pane states** for Chapters and Transcript, in plan 36's order: Offline Mode with nothing
   loaded → the Offline Mode message; signed out → the login call to action; a failed load → the
   error with Retry; not loaded → the spinner; then the body. While the source is resolving, every
   pane shows the spinner (**mobile-pending-content-spinner**). Chapters usually arrive through
   plan 93's automatic load; choosing either chip starts the load when nothing has run.
6. **Summary** is the parsed item's description (`value`, else `preview`), with Show more and the
   item website link when truncated, as on the Add by RSS episode page. A time in it seeks the
   item, as a chapter row press does. The tab resets to Summary when a new Add by RSS item plays.

## Files

All paths are under `apps/mobile/` unless noted.

| File                                                 | Change                            |
| ---------------------------------------------------- | --------------------------------- |
| `src/screens/player/fullPlayerAddByRssPanes.ts`      | New pure helpers                  |
| `src/screens/player/fullPlayerAddByRssPanes.test.ts` | New                               |
| `src/screens/player/FullPlayerScreen.tsx`            | Chips, band, panes for Add by RSS |
| `vitest.config.ts`                                   | Include the new test              |
| `e2e/add-by-rss-episode-sections.yaml`               | Full player steps                 |
| `e2e/add-by-rss-track.yaml`                          | Full player Transcript step       |
| `docs/features/ADD-BY-RSS.md` (repo root)            | Flow bullet wording               |

`FullPlayerScreen.tsx` is large. Anchors: `const hasSectionsForTarget`, `const hasSections =`,
`} = useEpisodeSectionPanes({`, `const hasSegmentBand =`, `const playerTabs = useMemo`,
`const listRows = useMemo`, `const renderPaneFooter = useCallback`, and
`extraData={`${activeTab}`. Read a window around each; plans 50, 51, 90, and 91 moved lines.

## Implementation

### `fullPlayerAddByRssPanes.ts`

Pure (type-only imports from React Native files), so vitest loads it. One-line doc per export.

```typescript
export type FullPlayerAddByRssPaneState =
  | 'auth-required'
  | 'content'
  | 'error'
  | 'loading'
  | 'offline';

/** Whether the item's stored parsed bundle links a chapters file, read without a lookup. */
export const addByRssResourceDataLinksChapters = (resourceData: AddByRSSResourceData): boolean => {
  const chaptersFeed = getOwnPropertyValue(resourceData.bundle, 'chaptersFeed');
  return getNonEmptyTrimmedStringProperty(chaptersFeed, 'url') !== null;
};
```

- Both guards come from `@podverse/helpers/guards`; `bundle` is `unknown`, so no cast.
- `resolveFullPlayerAddByRssPaneState(input: FullPlayerAddByRssPaneInput):
  FullPlayerAddByRssPaneState` and `shouldLoadFullPlayerAddByRssSections(input:
  FullPlayerAddByRssPaneInput): boolean`, where the exported input type is `{ activeTab:
  EpisodeTab; authStatus: AuthStatus; offlineModeEnabled: boolean; snapshot:
  AddByRssNowPlayingSectionsSnapshot }`.
- `addByRssPaneSummary(itemBundle: AddByRSSMappedFeed['items'][number] | null): { html: string |
  null; truncation: DescriptionTruncation | undefined }`.
- `resolveFullPlayerAddByRssPaneState`, first match: `sourceStatus` `'idle'` or `'resolving'` →
  `'loading'`; tab not `'chapters'` or `'transcript'` → `'content'`; `offlineModeEnabled &&
  sections === null` → `'offline'`; `authStatus === 'anonymous'` → `'auth-required'`;
  `sectionsStatus === 'error'` → `'error'`; `sections === null` → `'loading'`; else `'content'`.
  `'unknown'` auth falls to `'loading'`, as plan 36 does.
- `shouldLoadFullPlayerAddByRssSections`: tab is `'chapters'` or `'transcript'`, `authStatus ===
  'authenticated'`, `!offlineModeEnabled`, `sourceStatus === 'resolved'`, `sectionsStatus ===
  'idle'`, `snapshot.source !== null`, and `snapshot.source.sectionUrls !== null`.
- `addByRssPaneSummary`: `description = itemBundle?.description ?? null`; `html` is
  `description.value` when non-empty, else `description.preview` when non-empty, else `null`;
  `truncation` is `{ kind: 'item', linkUrl: itemBundle.about?.website_link_url ?? null }` when
  `description?.is_truncated === true`, else `undefined`.
- Type imports: `AuthStatus` (`../../auth/AuthProvider`), `DescriptionTruncation`
  (`../../components/content/DescriptionText`), `EpisodeTab` (`../../prefs/detailListPrefs`),
  `AddByRssNowPlayingSectionsSnapshot` (`../../playback/addByRssNowPlayingSectionsStore`),
  `AddByRSSResourceData` (`@podverse/helpers/dto`), `AddByRSSMappedFeed`
  (`@podverse/parser-mapping`).

### `FullPlayerScreen.tsx`

1. **`hasSectionsForTarget`**: the `add-by-rss` case returns
   `!isAddByRssLivestreamResourceData(target.resourceData)` (`../../lib/addByRss/resourceData`).
2. **Store and prompt**, right after `const hasSections =`:

   ```typescript
   const addByRssItemResourceData =
     activeTarget?.kind === 'add-by-rss' &&
     !isAddByRssLivestreamResourceData(activeTarget.resourceData)
       ? activeTarget.resourceData
       : null;
   const addByRssSections = useNowPlayingAddByRssSections(addByRssItemResourceData);
   const addByRssSource = addByRssSections.source;
   const { onRequestLogin } = useAuthPrompt();
   ```

   `useAuthPrompt` is from `../../auth/AuthPromptContext`.
3. **After the `useEpisodeSectionPanes` destructure:**
   - `addByRssPeople = useMemo(() => toAddByRssAboutPeople(addByRssSource?.itemBundle.people ??
     []), [addByRssSource])` (`toAddByRssAboutPeople` from `../home/addByRssHomeDetailData`,
     plan 33).
   - `addByRssTabs = useMemo(() => addByRssItemResourceData === null ? null :
     resolveAddByRssEpisodeTabs({ hasChapters: addByRssSource?.sectionUrls?.chaptersFeedUrl !==
     undefined, hasPeople: addByRssPeople.length > 0, hasTranscript:
     addByRssSource?.sectionUrls?.transcriptUrl !== undefined }), [addByRssItemResourceData,
     addByRssPeople.length, addByRssSource])` (`../home/addByRss/addByRssEpisodeTabs`, plan 35).
     With no source, both optional chains are `undefined`, so only Summary shows.
   - `addByRssPaneState = addByRssItemResourceData === null ? null :
     resolveFullPlayerAddByRssPaneState({ activeTab, authStatus: status, offlineModeEnabled,
     snapshot: addByRssSections })`.
   - `addByRssSummary = useMemo(() => addByRssPaneSummary(addByRssSource?.itemBundle ?? null),
     [addByRssSource])`.
   - `paneChapterRows`: `addByRssItemResourceData === null ? chapterRows : addByRssPaneState ===
     'content' ? (addByRssSections.sections?.chapters ?? EMPTY_CHAPTER_ROWS) :
     EMPTY_CHAPTER_ROWS`, with a module constant `const EMPTY_CHAPTER_ROWS: DTOItemChapter[] =
     [];`. `chapterListShowsImages` reads `paneChapterRows`. `playerChapters` keeps reading
     `chapterRows` then `chapters`; `chapters` already carries plan 93's Add by RSS list.
   - `paneTranscriptText = addByRssItemResourceData === null ? transcriptText :
     (addByRssSections.sections?.transcriptText ?? '')`.
   - `paneResetKey = addByRssSections.key ?? currentItemIdText`.
   - Effect on `addByRssSections.key` and `selectTab`: a non-null key →
     `selectTab(DEFAULT_EPISODE_TAB)`.
   - Effect: when `shouldLoadFullPlayerAddByRssSections({ activeTab, authStatus: status,
     offlineModeEnabled, snapshot: addByRssSections })`, `void
     nowPlayingAddByRssSections.load(authContext)`. Depend on those five values.
   - `retryAddByRssSections = useCallback(() => { void
     nowPlayingAddByRssSections.load(authContext); }, [authContext])`.
   - `handleAddByRssDescriptionClock = useCallback((seconds: number) => {
     seekTo(Math.max(0, seconds)); }, [seekTo])`.
   - `DEFAULT_EPISODE_TAB` joins the existing `../../prefs/detailListPrefs` value import. Store and
   hook come from `../../playback/nowPlayingAddByRssSections`.
4. **`hasSegmentBand`**: add two terms after `itemHasChapters(currentItem)`:
   `(addByRssItemResourceData !== null &&
   addByRssResourceDataLinksChapters(addByRssItemResourceData))` and
   `addByRssSource?.sectionUrls?.chaptersFeedUrl !== undefined`.
5. **`playerTabs`**: `addByRssTabs !== null` → `addByRssTabs`; else today's music filter. Depend
   on `addByRssTabs`. Extend the comment: Add by RSS items take their chips from the parsed item.
   The effect below it already moves `activeTab` onto a chip that exists.
6. **`listRows`**: the `chapters` case maps `paneChapterRows`; depend on it instead of
   `chapterRows`.
7. **`renderPaneFooter`**: put a new first branch in front of `if (isTabLoading)`, so the
   directory branches (loading, error, Offline Mode) run only for a directory item:

   ```typescript
   if (addByRssPaneState !== null) {
     if (addByRssPaneState === 'offline') { … }
     else if (addByRssPaneState === 'auth-required') { … }
     else if (addByRssPaneState === 'error') { … }
     else if (addByRssPaneState === 'loading') { … }
   } else if (isTabLoading) {
   ```

   - `'offline'` → today's Offline Mode `ListEmpty` block (`full-player-offline-unavailable`).
   - `'auth-required'` → `<View style={styles.pane}><View style={styles.column}>
     <CallToActionSection actionLabelKey="authentication.login"
     messageKey="authentication.login_required" onAction={onRequestLogin}
     testID="full-player-auth-required" /></View></View>`, importing `CallToActionSection` from
     `../../components/state/CallToActionSection`.
   - `'error'` → today's error block with `messageKey="errors.generic"` and
     `onRetry={retryAddByRssSections}` (`full-player-pane-error-${activeTab}`).
   - `'loading'` → `<LoadingSection testID={`full-player-pane-loading-${activeTab}`} />`.
   - `'content'` leaves `body` null, so the shared tab branches below draw the pane. They read
     the pane values: Summary `html={addByRssItemResourceData === null ?
     summaryHtml : addByRssSummary.html}`, `truncation` from `addByRssSummary.truncation` for Add
     by RSS (today's expression otherwise), `onDescriptionClock={addByRssItemResourceData === null
     ? onDescriptionClock : handleAddByRssDescriptionClock}`, `resetKey={paneResetKey}`. People
     `people={addByRssItemResourceData === null ? (currentItem?.item_persons ??
     []).map(toAboutPersonFromItem) : addByRssPeople}` and `isLoading={addByRssItemResourceData
     === null && currentItem === null}`. Transcript reads `paneTranscriptText`. The empty-chapters
     branch reads `paneChapterRows.length`.
   - Add every new value to the dependency list.
8. **Pane list**: `extraData={`${activeTab}-${isTabLoading}-${addByRssPaneState ?? 'none'}`}`.
9. Update the screen's doc comment if it says Add by RSS has no sections: Add by RSS items show
   Summary, Chapters, Transcript, and People from the parsed item.

### `e2e/add-by-rss-episode-sections.yaml`

After the `add-by-rss-episode-sections-transcript` screenshot, append:

```yaml
- tapOn:
    id: "home-row-play-.*"
- extendedWaitUntil:
    visible:
      id: mini-player
    timeout: ${TIMEOUT_SLOW}
- tapOn:
    id: mini-player
- extendedWaitUntil:
    visible:
      id: full-player-section-chapters
    timeout: ${TIMEOUT_SLOW}
- extendedWaitUntil:
    visible:
      id: full-player-segment-title
    timeout: ${TIMEOUT_SLOWER}
- tapOn:
    id: full-player-section-chapters
- extendedWaitUntil:
    visible:
      id: "full-player-chapter-row-.*"
    timeout: ${TIMEOUT_FAST}
- assertVisible: "Pauci celer taceo."
- takeScreenshot: add-by-rss-full-player-chapters
- tapOn:
    id: full-player-section-transcript
- extendedWaitUntil:
    visible:
      id: full-player-transcript-text
      text: ".*Magni valetudo odio.*"
    timeout: ${TIMEOUT_FAST}
- takeScreenshot: add-by-rss-full-player-transcript
```

The play control on the episode page is `ItemDetailHeader`'s `home-row-play-<id>` (plan 32), the
only one on that screen. `full-player-segment-title` proves the chapters reached the segment band
(the first chapter starts at 0). Extend the header comment: the flow also checks the full player.

### `e2e/add-by-rss-track.yaml`

Between the `full-player-title-link` wait and the `full-player-title-link` tap, insert:

```yaml
- tapOn:
    id: full-player-section-transcript
- extendedWaitUntil:
    visible:
      id: full-player-transcript-text
      text: ".*Magni valetudo odio.*"
    timeout: ${TIMEOUT_SLOWER}
```

The flow is signed in (plan 39's Lyrics step needs it), and the track links only a transcript, so
this proves the chip-select load.

### `docs/features/ADD-BY-RSS.md`

The **Mobile E2E** bullet's `add-by-rss-episode-sections.yaml` note becomes: an item's Chapters
and Transcript on the episode page and in the full player.

## Tests

- `fullPlayerAddByRssPanes.test.ts` (new; add it to `vitest.config.ts` before the
  `'src/screens/player/fullPlayerLayout.test.ts'` entry):
  - `addByRssResourceDataLinksChapters`: a bundle with `chaptersFeed.url` → `true`; no bundle, a
    `chaptersFeed` of `null`, or a blank URL → `false`.
  - `resolveFullPlayerAddByRssPaneState` with `it.each`: resolving source on Summary →
    `'loading'`; resolved Summary → `'content'`; Chapters with Offline Mode and no sections →
    `'offline'`; Offline Mode with loaded sections → `'content'`; anonymous → `'auth-required'`;
    error → `'error'`; unknown auth, nothing loaded → `'loading'`.
  - `shouldLoadFullPlayerAddByRssSections`: true on Transcript for a transcript-only source, idle,
    signed in, online; false on Summary, while loading, after an error, and in Offline Mode.
  - `addByRssPaneSummary`: `value` wins; an empty `value` falls to `preview`; `is_truncated`
    gives the website link; `null` bundle → `{ html: null, truncation: undefined }`.
- Maestro: the two flow edits above; `e2e/player-screen.yaml` (directory player) is unchanged.

## Release scratchpad

```markdown
## Mobile full player shows Add by RSS Summary, Chapters, and Transcript

- Surfaces: mobile
- Change: Playing an Add by RSS episode or track, the full player now has the same section chips
  as other episodes: Summary always, Chapters and Transcript when the feed item links them, and
  People when it lists people. Chapter rows seek when tapped, and a time in the Summary seeks
  too. Chapters and Transcript load through the account API, need a signed-in account (a login
  prompt shows otherwise), show Retry after a failure, and show the Offline Mode message until
  they have loaded. Livestreams still show no sections.
- Who notices: anyone who plays podcasts or music added by RSS on the phone
- Operator steps: none
```
