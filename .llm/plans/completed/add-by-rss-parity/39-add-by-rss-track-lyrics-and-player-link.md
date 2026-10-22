# 39 — Add by RSS track page: Lyrics, player title link, and device proof

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

Rows: R65 (Lyrics on the track page, and the flow proving Go to Track and the page), and R44 for
an Add by RSS track (the full-player title opens the track page under the feed). Mobile, plus an
E2E-only API fixture.

Runs after `36-add-by-rss-episode-chapters-transcript.md` (`useAddByRssItemSections`, the
fixture map), `38-add-by-rss-track-detail.md` (the screen), `34-add-by-rss-item-rows.md` (Go to
Track on the Library's Tracks chip, which the flow uses), and
`51-player-add-by-rss-episode-link.md` (the `add-by-rss-episode` kind and item key this extends).
Never in one phase with 33, 38, 50, or 51 (`navigation/index.tsx`, `fullPlayerContentLink.ts`),
36 (`accountAddByRSSParse.ts`, `e2e-test.sh`), or any plan editing `fullPlayerContentLink.ts`.

## Locked decisions

1. **Lyrics chip.** The track page's transcript chip (`TRACK_TABS` key `transcript`, label
   `info.transcript.lyrics`) shows when the parsed item links a transcript, between Summary and
   People, the track page's order. No Chapters chip: the track page has none.
2. **Lyrics states** are plan 36's, from the same hook: one request per visit on first selection,
   the login call to action when signed out, the spinner while auth is `'unknown'`, the Offline
   Mode message when nothing loaded, Retry on error, `info.transcript.no_transcript` when empty,
   and the text otherwise.
3. **Player title.** An Add by RSS music item this device can find links to
   `AddByRssTrackDetail` on Home, under `AddByRssPodcastDetail`, as plan 51 does for episodes.
   New kind `'add-by-rss-track'`; accessible name `media.music.track`. A livestream title stays
   plain text. This replaces plan 51's "music stays plain text" branch.
4. **Device proof** is a new flow, `e2e/add-by-rss-track.yaml`, on a new E2E-only music fixture.
   Existing fixtures stay unchanged.

## Files

| File                                                              | Change               |
| ----------------------------------------------------------------- | -------------------- |
| `apps/mobile/src/screens/home/addByRss/addByRssTrackTabs.ts`      | New: chip rule       |
| `apps/mobile/src/screens/home/addByRss/addByRssTrackTabs.test.ts` | New                  |
| `apps/mobile/vitest.config.ts`                                    | Include it           |
| `apps/mobile/src/screens/home/AddByRssTrackDetailScreen.tsx`      | Lyrics chip and pane |
| `apps/mobile/src/screens/player/fullPlayerContentLink.ts`         | `add-by-rss-track`   |
| `apps/mobile/src/screens/player/fullPlayerContentLink.test.ts`    | Music cases          |
| `apps/mobile/src/navigation/index.tsx`                            | Route the new kind   |
| `apps/api/src/controllers/account/accountAddByRSSParse.ts`        | E2E music fixture    |
| `apps/mobile/e2e/add-by-rss-track.yaml`                           | New flow             |
| `scripts/mobile/e2e-test.sh`                                      | Register the flow    |
| `apps/mobile/e2e/README.md`                                       | List the flow        |
| `docs/features/ADD-BY-RSS.md`                                     | List the flow        |
| `.cursor/skills/mobile-test-economics/SKILL.md`                   | Discovery row        |

Large files: Grep the anchor and read that window. `navigation/index.tsx`: `add-by-rss-episode`.

## Implementation

### `addByRssTrackTabs.ts`

```typescript
import type { TrackTab } from '../../../prefs/detailListPrefs';
import { TRACK_TABS } from '../../../prefs/detailListPrefs';

/** The track-page chips an Add by RSS item can have; Funding needs catalog data. */
export type AddByRssTrackTab = Extract<TrackTab, 'people' | 'summary' | 'transcript'>;

/** Chips for one Add by RSS track, in the track page's order. Summary is always first. */
export const resolveAddByRssTrackTabs = (input: {
  hasPeople: boolean;
  hasTranscript: boolean;
}): AddByRssTrackTab[] => { … };
```

Same shape as plan 35's `resolveAddByRssEpisodeTabs`: a private type guard, then
`TRACK_TABS.filter(isAddByRssTrackTab).filter(…)` keeping `summary` always, `transcript` when
`hasTranscript`, `people` when `hasPeople`. `TRACK_TABS` is already exported.

### `AddByRssTrackDetailScreen.tsx`

Plan 38 built this screen. Changes, matching plan 36's episode-page changes:

- `tab` state becomes `AddByRssTrackTab`, default `'summary'`.
- `sectionUrls = useMemo(() => (track === null ? null :
  addByRssItemSectionUrls(track.itemBundle)), [track])` (plan 35).
- `tabs = useMemo(() => resolveAddByRssTrackTabs({ hasPeople: people.length > 0, hasTranscript:
  sectionUrls?.transcriptUrl !== undefined }), [people.length, sectionUrls])`. Chips map `tabs`
  with plan 38's `key`, `label`, and `testID` shape; `activeTab` falls back to Summary as before.
- Hooks: `useAuth().status`, `useAuthPrompt().onRequestLogin`, `useOfflineMode().enabled`
  (imports as in plan 36).
- `const { errorKey: lyricsErrorKey, retry: retryLyrics, sections } = useAddByRssItemSections({
  enabled: activeTab === 'transcript' && status === 'authenticated' && !offlineModeEnabled,
  feedUrl: feed?.feedUrl ?? null, itemBundle: track?.itemBundle ?? null, itemIdText: track?.id ??
  null });`
- `ListFooterComponent`: when `activeTab === 'transcript'`, the first that applies:
  1. `offlineModeEnabled && sections === null` → `ListEmpty
     messageKey={OFFLINE_UNAVAILABLE_MESSAGE_KEY}
     testID="add-by-rss-track-detail-offline-unavailable"`.
  2. `status === 'anonymous'` → `CallToActionSection actionLabelKey="authentication.login"
     messageKey="authentication.login_required" onAction={onRequestLogin}
     testID="add-by-rss-track-detail-auth-required"`.
  3. `lyricsErrorKey !== null` → `ListError messageKey={lyricsErrorKey} onRetry={retryLyrics}
     testID="add-by-rss-track-detail-tab-error-transcript"`.
  4. `sections === null` → `LoadingSection testID="add-by-rss-track-detail-tab-loading-transcript"`.
  5. `sections.transcriptText === ''` → `ListEmpty messageKey="info.transcript.no_transcript"
     testID="add-by-rss-track-detail-tab-empty-transcript"`; else `<Text style={styles.transcript}
     testID="add-by-rss-track-detail-tab-transcript-content">`.
  Summary and People keep plan 38's branches.
- `styles.transcript`: `{ ...typography.body, color: themeStyles.textPrimary.color }`, the
  track page's value.
- Doc comment: add that Lyrics shows when the parsed item links a transcript, loads through the
  API once per visit, needs a signed-in account, and shows the Offline Mode message until loaded.

### `fullPlayerContentLink.ts`

- `FullPlayerContentTarget['kind']` gains `'add-by-rss-track'`. `itemKey` is set for both Add by
  RSS item kinds; extend its doc comment.
- `resolveFullPlayerTitleLink`, case `add-by-rss` (plan 51's branch): empty feed id or item key →
  `null` first; then `isMusicPlaybackTarget(target)` → `{ idText: feedIdText, imageUrl: null,
  itemKey, kind: 'add-by-rss-track', name }`; else plan 51's `add-by-rss-episode` result.
  Livestreams already have no item key (`addByRssEpisodeItemKey`), so they stay `null`.
- Doc comment: remove music from the "no item page" list; only livestreams remain.
- `fullPlayerOpenScreenLabelKey`: `add-by-rss-track` → `media.music.track`.
- `playerContentStack`: `add-by-rss-track` → Home, beside the other Add by RSS kinds.

Grep `apps/mobile/src` for `'add-by-rss-episode'`; add the track case beside every hit that
switches on the kind. `FullPlayerScreen.tsx` already resolves the item key for any item that is
not a livestream (plan 51); do not edit it.

### `navigation/index.tsx`

Beside each plan 51 `add-by-rss-episode` case:

- `homeContentParams`: `case 'add-by-rss-track'` → `{ initial: false, params: { feedIdText:
  request.idText, itemKey: request.itemKey ?? '' }, screen: 'AddByRssTrackDetail' }`.
- `catalogContentParams`: throw the same `Add by RSS content opens on Home.` error.
- `openFullPlayerItem`: item kind `add-by-rss-track` → `{ name: 'AddByRssTrackDetail', params: {
  feedIdText: item.idText, itemKey: item.itemKey ?? '' } }`.

### `accountAddByRSSParse.ts` (E2E fixtures only)

- `E2eParsedFeedFixture` gains `medium?: string;`. `buildE2eParsedFeedPayload` adds a top-level
  `medium: source.medium` only when set (partytime's field; `compatChannelDto` reads
  `parsedFeed.medium`, and `'music'` maps to `MediumEnum.Music`, so mobile stores `'albums'`).
- `E2E_ADD_BY_RSS_MUSIC_FEED_URL = 'https://e2e-seed-addbyrss.example/album.xml'` and
  `E2E_ADD_BY_RSS_MUSIC_PARSED_FEED`: channel title `'E2E Add-by-RSS Album'`, item title
  `'E2E Add-by-RSS Track'`, guid `'https://e2e-seed-addbyrss.example/item-guid/track'`,
  `medium: 'music'`, plan 36's `transcriptUrl`
  (`http://localhost:2111/transcripts/transcript-feed-podcast-1-item-0-0.vtt`), and the default
  fixture's `link`, images, enclosure, duration, and `pubDate`. No `chaptersUrl`.
- Add it to plan 36's fixture `Record`. One-line doc comment: a music album whose track links a
  transcript, for the mobile track flow.

### `e2e/add-by-rss-track.yaml`

Header like plan 36's flow: `appId`, `name: Add By RSS Track Flow`, a comment that the music
fixture lists under Tracks, opens the track page from More, shows Lyrics, plays on row tap, and
links from the full player; `# Needs flow_needs_e2e_api + flow_needs_test_assets.`

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
- inputText: https://e2e-seed-addbyrss.example/album.xml
- tapOn:
    id: rss-add-submit
- extendedWaitUntil:
    visible:
      id: rss-root-screen
    timeout: ${TIMEOUT_SLOWER}
- runFlow:
    file: shared/reveal-chip-row-trailing.yaml
    env:
      CHIP_ROW_ID: rss-media-type-selector
      TRAILING_ID: rss-media-type-tracks
- tapOn:
    id: rss-media-type-tracks
- extendedWaitUntil:
    visible:
      id: "home-feed-row-title-.*"
      text: E2E Add-by-RSS Track
    timeout: ${TIMEOUT_SLOW}
- tapOn:
    id: "home-row-more-.*"
- extendedWaitUntil:
    visible:
      id: "media-row-action-go-to-track.*"
    timeout: ${TIMEOUT_FASTER}
- takeScreenshot: add-by-rss-track-more-menu
- tapOn:
    id: "media-row-action-go-to-track.*"
- extendedWaitUntil:
    visible:
      id: add-by-rss-track-detail-screen
    timeout: ${TIMEOUT_SLOW}
- assertVisible:
    id: add-by-rss-track-detail-title
    text: E2E Add-by-RSS Track
- assertVisible:
    id: add-by-rss-track-detail-album-header
- assertVisible:
    id: add-by-rss-track-detail-summary
- tapOn:
    id: add-by-rss-track-detail-tab-transcript
- extendedWaitUntil:
    visible:
      id: add-by-rss-track-detail-tab-transcript-content
      text: ".*Magni valetudo odio.*"
    timeout: ${TIMEOUT_SLOWER}
- takeScreenshot: add-by-rss-track-detail-lyrics
- runFlow: shared/stack-back.yaml
# A track row tap plays; it does not open the page.
- tapOn:
    id: "home-feed-row-title-.*"
    text: E2E Add-by-RSS Track
- extendedWaitUntil:
    visible:
      id: playback-now-playing-title-e2e
      text: E2E Add-by-RSS Track
    timeout: ${TIMEOUT_SLOWEST}
- tapOn:
    id: mini-player
- extendedWaitUntil:
    visible:
      id: full-player-title-link
    timeout: ${TIMEOUT_FAST}
- tapOn:
    id: full-player-title-link
- extendedWaitUntil:
    visible:
      id: add-by-rss-track-detail-screen
    timeout: ${TIMEOUT_FAST}
- tapOn:
    id: stack-header-back
- extendedWaitUntil:
    visible:
      id: add-by-rss-home-detail-screen
    timeout: ${TIMEOUT_FAST}
- takeScreenshot: add-by-rss-track-player-back-to-feed
```

The Lyrics text is the first cue of the test-assets transcript plan 36 uses. The seeded account
follows only podcast feeds, so this album's track is the only Tracks row. No cleanup, as in plan
36's flow.

### Flow registration and lists

- `scripts/mobile/e2e-test.sh`: add `add-by-rss-track` after `add-by-rss-episode-sections` in
  both `flow_needs_e2e_api` and `flow_needs_test_assets`.
- `apps/mobile/e2e/README.md` "Current flows": add `add-by-rss-track` after
  `add-by-rss-episode-sections`.
- `docs/features/ADD-BY-RSS.md`, the **Mobile E2E** bullet: add
  `apps/mobile/e2e/add-by-rss-track.yaml` (a music feed's track page and Lyrics).
- `.cursor/skills/mobile-test-economics/SKILL.md`, Discovery row: add `add-by-rss-track` after
  `add-by-rss-episode-sections`. Keep the table aligned.

## Tests

- `addByRssTrackTabs.test.ts` (add `'src/screens/home/addByRss/addByRssTrackTabs.test.ts'` to
  `vitest.config.ts` after plan 35's `addByRssEpisodeTabs.test.ts` entry): both flags false →
  `['summary']`; both true → `['summary', 'transcript', 'people']`; people only →
  `['summary', 'people']`.
- `fullPlayerContentLink.test.ts`: plan 51's case "Music with a feed id and an item key → null"
  becomes → kind `add-by-rss-track` with that item key; Music with no item key → `null`;
  `fullPlayerOpenScreenLabelKey` for `add-by-rss-track` → `media.music.track`;
  `playerContentStack({ isSubscribed: false, kind: 'add-by-rss-track' })` → `'Home'`.
- Maestro `e2e/add-by-rss-track.yaml` proves plan 37's music type, plan 34's Go to Track and row
  play, plan 38's page, this plan's Lyrics, and the player link.

## Release scratchpad

```markdown
## Mobile Add by RSS tracks show Lyrics and open from the player

- Surfaces: mobile
- Change: The Add by RSS track page shows a Lyrics chip when the feed item links a transcript.
  It loads through the account API, needs a signed-in account, and shows the Offline Mode message
  until it loads. On the full player, tapping an Add by RSS track's title now opens the feed and
  then the track page, so Back returns to the feed.
- Who notices: anyone who plays music added by RSS on the phone
- Operator steps: none
```
