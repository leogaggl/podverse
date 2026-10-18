# COPY-PASTA — mobile player, lists, and settings chrome

Parked until the operator pastes a prompt. Scope and file ownership:
[00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).

Phases are sequential. Wait for every agent in a phase to finish before starting the next phase.
Inside a phase, paste each prompt into its own agent and run them at the same time.

Do not run tests during agent work. Do not commit.

## Model mix

| Prompt | Phase | Model | Reasoning | Why |
| --- | --- | --- | --- | --- |
| 01 Player bar | 1, with the other phase 1 prompts | Opus 5.5 | high | Seek hold and playback rate share the native session |
| 02 List and mini player | 1, with the other phase 1 prompts | Cursor Grok 4.7 | high | Specified type and spacing |
| 04 Segment marquee | 1, with the other phase 1 prompts | Cursor Grok 4.7 | high | One component, already specified |
| 05 Image viewer | 1, with the other phase 1 prompts | Cursor Grok 4.7 | high | Navigation follows an existing screen |
| 06 Artist and hairlines | 1, with the other phase 1 prompts | Cursor Grok 4.7 | high | Chip order and row borders |
| 07 Downloads swipe | 1, with the other phase 1 prompts | Cursor Grok 4.7 | extra high | A progress tick fights the swipeable |
| 03 People chip and player title links | 2, with 08, after phase 1 | Cursor Grok 4.7 | high | Mobile and web chip plus player links, after the screens it edits |
| 08 Settings chrome | 2, with 03, after phase 1 | Cursor Grok 4.7 | extra high | Many settings screens, one specified standard |
| 09 Remember the standards | 3, alone, after phase 2 | Cursor Grok 4.7 | high | Rule rewrite against landed code |

## Phase 1 — six agents at once

Start all six. Wait until all six are done.

- [x] **01 — Player bar**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/completed/mobile-og-chrome/01-player-bar.md

Follow the ownership and agent rules in .llm/plans/completed/mobile-og-chrome/00-EXECUTION-ORDER.md.
Do not edit files owned by prompts 02, 03, 04, 05, 06, 07, or 08.
Do not run tests during agent work. Do not commit.
```

- [x] **02 — List and mini player**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/completed/mobile-og-chrome/02-list-and-mini-player.md

Follow the ownership and agent rules in .llm/plans/completed/mobile-og-chrome/00-EXECUTION-ORDER.md.
Do not edit files owned by prompts 01, 03, 04, 05, 06, 07, or 08.
Do not run tests during agent work. Do not commit.
```

- [x] **04 — Segment marquee**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/completed/mobile-og-chrome/04-segment-marquee.md

Follow the ownership and agent rules in .llm/plans/completed/mobile-og-chrome/00-EXECUTION-ORDER.md.
Edit NowPlayingSegmentBar only.
Do not run tests during agent work. Do not commit.
```

- [x] **05 — Image viewer**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/completed/mobile-og-chrome/05-image-viewer.md

Follow the ownership and agent rules in .llm/plans/completed/mobile-og-chrome/00-EXECUTION-ORDER.md.
Do not edit player-screen.yaml or HeaderBarAction.
Do not run tests during agent work. Do not commit.
```

- [x] **06 — Artist and hairlines**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/completed/mobile-og-chrome/06-artist-and-hairlines.md

Follow the ownership and agent rules in .llm/plans/completed/mobile-og-chrome/00-EXECUTION-ORDER.md.
Do not add a People chip. Do not edit the ListRow primitive.
Do not run tests during agent work. Do not commit.
```

- [x] **07 — Downloads swipe**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/completed/mobile-og-chrome/07-downloads-swipe.md

Follow the ownership and agent rules in .llm/plans/completed/mobile-og-chrome/00-EXECUTION-ORDER.md.
Do not change the queue swipe contract. Do not edit the settings Downloads card.
Do not run tests during agent work. Do not commit.
```

## Phase 2 — two agents at once

Start these only after all six phase 1 prompts are done. Run both at the same time. Wait until both are done.

- [x] **03 — People chip and player title links**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/completed/mobile-og-chrome/03-people-chip.md

Phase 1 is done. Follow the ownership and agent rules in .llm/plans/completed/mobile-og-chrome/00-EXECUTION-ORDER.md.
Keep the Tracks chip, album hairlines, the music Clips filter, the image viewer route, and the optional segment band.
Do not run tests during agent work. Do not commit.
```

- [x] **08 — Settings chrome**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/completed/mobile-og-chrome/08-settings-chrome.md

Phase 1 is done. Follow the ownership and agent rules in .llm/plans/completed/mobile-og-chrome/00-EXECUTION-ORDER.md.
Do not revert ListRow type or the list-art constants from prompt 02.
Do not run tests during agent work. Do not commit.
```

## Phase 3 — one agent

Start this only after both phase 2 prompts are done.

- [x] **09 — Remember the standards** (last prompt)

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/completed/mobile-og-chrome/09-abcremember.md

Phases 1 and 2 are done. This is the last prompt in the set.
Rewrite the Cursor guidance listed in that file so it matches the landed code.
Append the scratchpad entries. Do not re-implement the features.
Do not run tests during agent work. End with every operator command in that file.
Do not commit.
```
