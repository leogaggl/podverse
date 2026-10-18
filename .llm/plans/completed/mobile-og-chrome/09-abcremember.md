# 09 — Remember the standards

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

Run only after phase 2. The product code from prompts 01 through 08 is already landed. This prompt rewrites Cursor guidance that still describes the old behavior, then appends scratchpad entries. Do not re-implement the features. If a rule and the code disagree, change the rule to match the code.

Update a file that already owns the topic. Do not add a second copy of the same rule.

## Rules

- People are a chip, not About or Summary body. Prompt 03 already edits `about-summary-web-mobile-alignment.mdc`, the About and Summary section of `abcmemory-vocabulary.mdc`, and `mobile-section-chrome-cache.mdc`. Remove any sentence those edits left behind.
- List art is 78. The in-row text gap is `spacing.base`. The padding around a row hairline is `spacing.lg`. `mobile-screen-layout.mdc` and `mobile-reusable-components` `SKILL.md` still say 60 and `spacing.sm`. The header note that treats 78 as the reason a channel header gap is wider needs a rewrite now that list art is also 78.
- Chips above a list use `listChipRowBottomGap`, including an `OptionChipGroup` placed above a list. The rule currently gives that seam to `SectionChipRow` only.
- The full-size image viewer is a slide-up root screen. `mobile-screen-layout.mdc`, `mobile-reusable-components` `SKILL.md`, and `mobile-react-native.mdc` still describe `ImageViewerModal` as the viewer.
- Readable sentences and menu subtitles use body, including feed status lines such as "Last Parsed". Caption stays for a count or the agreement date under an accordion title. The Terms of Service "Valid since" line is heading size in `tokens.text.link`.
- A label beside a switch is `SettingsSwitchRow` at the menu title size. A settings card does not contain a bordered box. Groups inside a card separate with a hairline that has equal space above and below, and no extra horizontal inset. Settings cards use `settingsCardGap` between them and `settingsCardInnerGap` from a heading to its description to its button. Option rows match menu rows. Header icons use the shared 26pt default.
- Sky-blue clocks, channel lines, and list dates use `tokens.text.link`. The full-player item title is display (28) and the chapter or clip name is title (22). Position and duration stay at 14. A Home show row is date, title, then "{count} downloaded" (including zero). A Browse podcast or album row is date, title, then the author. The date has no "Latest episode" prefix. Episode, clip, and track rows stay show name, title, date.
- The chapter or clip band under the full-player art is reserved only when the item has chapters or the target is a clip. Prompt 01 already edits `mobile-player-fixed-region.mdc` and `mobile-playback` `SKILL.md`. Remove any sentence that still says the band is always reserved.
- Music transport is previous, play, next. Shuffle and repeat sit with sleep and More. Music always plays at 1x, and the last audio/video speed returns when that kind of item plays again. The music player has no Clips chip and no create-clip action. An Add by RSS item from a music-medium feed is music for every one of these rules, including the music queue and engine profile.
- The full player's item title and channel name open their screens. Add by RSS opens the local feed screen from the channel name, and its title is not a link.
- Add by RSS show rows have no download count. The image viewer never receives an `Authorization` value in route params; it resolves Add by RSS artwork headers from the feed URL.
- Artist chips are Albums, Tracks, About, with Tracks present even when the list is empty. Content lists use the top hairline, including artist albums and podroll rows. Settings cards do not.
- A download progress tick updates the bar inside the sliding row. It does not relayout the swipe reveal, and the bar does not paint into the revealed action.

A seek hold that the code now keeps does not need its own rule.

## Scratchpad

Append one entry per shipped change to `release-notes/scratchpad.md`, at the end. Do not edit another change's entry. Cover the player bar, list and mini-player chrome, People, the image viewer, artist chips and hairlines, the Downloads reveal, and the settings chrome. Name the surface, what changed, and who would notice. Leave out secrets.

This is the last prompt. Assume the earlier prompts were implemented and not verified. End with every operator command below.

## Operator check

Do not run these during implementation.

**Mobile** (one-shots). Mobile E2E Metro, Mobile E2E API, and Mobile E2E iOS or Mobile E2E Android must already be up. Do not start them here.

```bash
npm --prefix apps/mobile run test -- src/screens/player/fullPlayerLayout.test.ts
npm --prefix apps/mobile run test -- src/screens/more
npm run mobile:e2e:test -- player-screen
npm run mobile:e2e:test -- search-unparsed
npm run mobile:e2e:test -- settings-select
open .artifacts/mobile-e2e-reports/latest/failures.json
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
```

**Root** web screenshot report:

```bash
make e2e_test_web_report_spec SPEC=e2e/about-summary-people.spec.ts
open .artifacts/e2e-reports/latest/index.html
```
