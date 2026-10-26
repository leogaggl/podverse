# Livestream status badge in the duration slot — execution order

Prompts and models: [COPY-PASTA.md](COPY-PASTA.md). Request and settled review answers:
[00-REQUEST.md](00-REQUEST.md). Ledger and areas: [00-SUMMARY.md](00-SUMMARY.md).

Phases run one after another. Prompts inside one phase run at once and own disjoint files. Every
implementation prompt shares its phase with another, so none writes `release-notes/scratchpad.md`;
each puts its entry in its final message under "Release notes entry", and Close appends them all.

## Where it runs

The whole set runs in this worktree, `../podverse_feature_livestream_row_status_slot`, on branch
`feature/livestream-row-status-slot`. Final messages land in
`.artifacts/plan-runner/livestream-row-status-slot/`.

## Dependency graph

From each plan's `## Runs after`:

| Plan | Runs after |
| --- | --- |
| 10 web livestream rows: status slot test ids and position check | none |
| 11 embed list row: Live badge before the date | none |
| 20 mobile livestream item rows: status badge in the play band | none |
| 21 mobile livestream rows inside a channel: date from the start time | none |
| 22 mobile channel livestream rows: only Live can start from the list | 21 |
| 23 mobile album livestreams use the podcast livestream row | 21 |
| 30 a liveItem without a status is not saved | none |
| Close: release entries, archive, cumulative verification | 10, 11, 20, 21, 22, 23, 30 |

## Shared files that set the order

- **`apps/mobile/src/lib/rows/liveItemRows.ts`, its test, and
  `apps/mobile/src/screens/podcast/sections/PodcastEpisodesSection.tsx`:** 21 adds the start-time
  parameter to `toChannelLiveRow` and the start-date fallback; 22 then adds `playable` to the same
  function and rewrites two doc comments 21 touched. 22 runs after 21.
- **`apps/mobile/src/screens/album/AlbumDetailScreen.tsx`:** 21 passes the start time to
  `toChannelLiveRow` in `toTrackRows`; 23 then moves that mapping into `albumTrackRows.ts` and
  renders album livestreams on the episode row. 23 runs after 21.
- **`HomeFeedRow.tsx` and `MediaRowActions.tsx`:** 20 only. 22 and 23 render through
  `HomeFeedRow` with its existing props and edit neither. They run in Phase 2, after 20, so the
  album livestream row shows 20's band and badge as soon as 23 lands.
- **`release-notes/scratchpad.md`:** plan 11 lists it in `## Files`. No implementation prompt
  writes it; Close appends every entry.
- **i18n catalogs:** no plan adds a key. The status labels already exist.
- **Maestro flows** (`home.yaml`, `browse.yaml`, `add-by-rss-livestream.yaml`): 20 only.
- **Parser live-item mapping** (`packages/parser-mapping` `compatLiveItemsDtos`,
  `packages/parser` `handleParsedLiveItems`): 30 only. No other prompt edits those files.

## Phases

### Phase 1 — web rows, embed row, mobile badge slot, mobile start date, parser status (5 prompts at once)

- **10** owns `apps/web/src/components/List/LiveItem/ListLiveItemRow.tsx`,
  `apps/web/src/components/AddByRSS/Livestream/AddByRSSLivestreamRow.tsx`,
  `apps/web/src/styles/components/Common/List/LiveItem/ListLiveItemRow.module.scss`, and
  `apps/web/e2e/media-list-chips.spec.ts`.
- **11** owns `apps/web/src/components/embed/EmbedListRow.tsx`,
  `apps/web/src/styles/components/embed/EmbedListRow.module.scss`, and
  `apps/web/src/components/embed/__tests__/EmbedListRow.test.tsx`.
- **20** owns `apps/mobile/src/screens/home/homeFeedRowLiveStatus.ts` and its test,
  `apps/mobile/src/screens/home/HomeFeedRow.tsx`,
  `apps/mobile/src/components/player/MediaRowActions.tsx`,
  `apps/mobile/src/screens/home/homeFeedData.ts`, `.cursor/rules/mobile-screen-layout.mdc`,
  `.cursor/skills/mobile-reusable-components/SKILL.md`, and the Maestro flows
  `apps/mobile/e2e/add-by-rss-livestream.yaml`, `browse.yaml`, and `home.yaml`.
- **21** owns `apps/mobile/src/lib/rows/liveItemRows.ts` and its test,
  `apps/mobile/src/lib/addByRss/liveRows.ts` and its test,
  `apps/mobile/src/screens/podcast/sections/PodcastEpisodesSection.tsx`, and
  `apps/mobile/src/screens/album/AlbumDetailScreen.tsx`.
- **30** owns `packages/parser-mapping/src/compat/partytime/liveItem.ts` and its test,
  `packages/parser/src/lib/rss/liveItem/liveItem.ts`, and
  `packages/parser/src/lib/rss/liveItem/liveItemArchive.ts` and its test.

### Phase 2 — mobile playability and album livestreams (2 prompts at once)

- **22** owns `apps/mobile/src/lib/rows/liveItemRows.ts` and its test, and
  `apps/mobile/src/screens/podcast/sections/PodcastEpisodesSection.tsx` (comments only).
- **23** owns `apps/mobile/src/screens/album/albumTrackRows.ts` and its test (both new), and
  `apps/mobile/src/screens/album/AlbumDetailScreen.tsx`.

### Phase 3 — Close

- **Close**, alone. Appends the release entries, archives the set, and carries the cumulative
  verification. Changes no product code.

## Release entries collected by Close

From `.artifacts/plan-runner/livestream-row-status-slot/<NN>.md`, in this order: 11, 20, 21, 22,
23, 30. Plan 10 has no entry (the visible order already ships; it adds test ids and a position
check).

## Open before the run

None. E1–E3 are settled in `00-REQUEST.md` § Review of the second-pass choices.
