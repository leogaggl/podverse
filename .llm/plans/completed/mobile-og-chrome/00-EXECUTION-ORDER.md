# Execution order — mobile player, lists, and settings chrome

Do not start this set until the operator pastes a prompt from [COPY-PASTA.md](./COPY-PASTA.md).

## Phases

Phase 1 finishes completely before phase 2 starts. Phase 2 finishes completely before phase 3 starts. Inside a phase, every prompt may run at the same time in its own agent.

### Phase 1 — six agents at once

- [01-player-bar.md](./01-player-bar.md) — scrub gesture, bar look, player type, optional segment band, music controls, chapter-skip hold
- [02-list-and-mini-player.md](./02-list-and-mini-player.md) — list art, row type, mini player, header icons, chip seam
- [04-segment-marquee.md](./04-segment-marquee.md) — chapter strip above the mini player
- [05-image-viewer.md](./05-image-viewer.md) — slide-up image viewer
- [06-artist-and-hairlines.md](./06-artist-and-hairlines.md) — artist chip order and content-list hairlines
- [07-downloads-swipe.md](./07-downloads-swipe.md) — Downloads Remove reveal

### Phase 2 — two agents at once, after phase 1

- [03-people-chip.md](./03-people-chip.md) — People chip on mobile and web, and the player title and channel links
- [08-settings-chrome.md](./08-settings-chrome.md) — settings type, spacing, notifications, storage card, FAQ, Popularity Tracking, error log, Terms date, option rows

### Phase 3 — one agent, after phase 2

- [09-abcremember.md](./09-abcremember.md) — rewrite Cursor guidance that still describes the old behavior, and append scratchpad entries

## Why later prompts wait

- 03 edits `FullPlayerScreen.tsx` after 01, `navigation/index.tsx` after 05, and `ArtistDetailScreen.tsx` plus `AlbumDetailScreen.tsx` after 06. It adds the People chip and the player title links without undoing music clips, the optional segment band, the image viewer route, the Tracks chip, or the hairlines.
- 08 edits `screenLayout.ts` and must not revert `ListRow` after 02. It adds settings gap helpers and does not change list-art constants.
- 09 is the only prompt that rewrites the shared `.cursor/` rules, except the files named in 01 and 03. It is also the only prompt that appends `release-notes/scratchpad.md`.

## Ownership

Two agents in the same phase must not edit the same file. Do not rewrite a whole shared file. Do not edit `release-notes/scratchpad.md` before 09.

| Prompt | Owns | Must not touch |
| --- | --- | --- |
| 01 | Player screen, scrubber, transport, utility, `PlaybackProvider` seek hold and rate, `fullPlayerLayout.ts`, `engineAudioProfile.ts`, `mediaEngineSourceMeta.ts` | `screenLayout.ts`, `HomeFeedRow`, `ListRow`, `NowPlayingSegmentBar`, image viewer, `navigation/index.tsx`, artist screens, `LibraryDownloadsScreen`, settings screens |
| 02 | `screenLayout.ts` list and mini-player constants, `HomeFeedRow`, `ListRow`, `homeRowMetadata.ts`, mini player, `HeaderBarAction`, Queue, History, and Search chip headers, boost sheet image | Player screen, `PlaybackProvider`, settings screens, `.cursor/` |
| 03 | About and Summary people, People chip, collapse length, portraits, player title links, the `FullPlayer` route callbacks in `navigation/index.tsx` | Tracks chip order, album hairlines, player transport, `screenLayout.ts` constants |
| 04 | `NowPlayingSegmentBar.tsx` | Mini player title scroller |
| 05 | Image viewer route in `navigation/index.tsx`, `CoverImage` open path, viewer header resolution | `player-screen.yaml`, `HeaderBarAction` default size |
| 06 | Artist chip order, album rows, podroll rows on artist, album, and podcast | People chip, `ListRow` primitive |
| 07 | `LibraryDownloadsScreen.tsx` progress inside the reveal | `SwipeActionRow` queue contract, settings Downloads card |
| 08 | Settings screens, Add by RSS add, credentials, and library notice text, `OptionListGroup`, `SettingsSwitchRow`, new gap helpers in `screenLayout.ts`, FAQ, error log, Terms date, Popularity Tracking copy | `ListRow` title and subtitle, list-art constants, player files |
| 09 | `.cursor/` rules and skills named in that file, scratchpad entries | Product behavior, unless a rule edit requires no code change |

## Rules for the executing agent

- Follow the numbered plan. The plan overrides a standing rule where it names the exception. Do not edit `.cursor/` files unless the plan lists them.
- Do not run tests, lint, or Maestro. End with the plan's operator commands.
- Do not commit, push, or open a pull request.
- Comments describe the code as it stands. Do not cite this plan, a prompt number, or a path under `.llm/plans/`.
- Append nothing to `release-notes/scratchpad.md` except prompt 09.
- Operator commands in the plan must parse in fish. Do not add a bash heredoc.
