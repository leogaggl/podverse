# 08 — Settings chrome

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

Run only after phase 1. Prompt 02 has already set `ListRow` titles to 19 and subtitles to body, and has changed list-art constants in `screenLayout.ts`. Do not revert those. Add the two helpers below without rewriting the rest of that file.

Do not edit `.cursor/` files. Do not edit `release-notes/scratchpad.md`. Do not edit `LibraryDownloadsScreen.tsx`.

## Type floor

Caption (12) and raw 13pt labels are too small wherever someone is reading a sentence. Help, warnings, meter labels, option-list headings, and menu-row subtitles move to `typography.body` (15). Titles that are already 16 or larger stay.

A count can stay smaller. A sentence under a title does not. Feed status lines are sentences with a date in them, so they use body too: "Last Parsed: {date}", the failed-parse line, and "never fully parsed".

Sweep:

- `SettingsSwitchRow` description and `SettingsRowDescription`
- `SettingsOptionNavRow` description (13)
- `OptionListGroup` heading (13)
- `MoreSettingsNotificationsScreen.tsx` (12 and 13)
- `MoreSettingsDownloadsScreen.tsx` meter label and descriptions
- `MoreSettingsPlaybackScreen.tsx`
- `PodcastSettingsScreen.tsx` and the feed notice in `ChannelSettingsPane.tsx`
- `MoreOpmlScreen.tsx` descriptions (14) and result lines (12)
- Add by RSS: `AddByRssAddScreen.tsx` credential intro (caption) and notice (13), `AddByRssCredentialsScreen.tsx` feed URL line (13), and the notice in `AddByRssRootScreen.tsx` (13)

`ListRow` subtitle is already body after prompt 02. Leave it.

Error log intro, timestamps, and notes, and the detail screen's labels, timestamp, and notes, move to body (15). Detail field values keep monospace at that same size. The comment on `MoreErrorLogScreen.tsx` that calls the list plain and dense does not keep the type small.

On the error log, the gap under Clear is `spacing.md` (8) and the gap above Share All is `formActionsTopGap` (32). Make the gap under Clear the same `formActionsTopGap`. The Failed badge uses `alignSelf: 'flex-start'`. Pass `alignSelf: 'center'` on that badge so it lines up with the title and timestamp. The detail screen gets the same gap under its action buttons and the same centered outcome badge. Do not change the Badge component's default label size.

On Terms of Service, the "Valid since …" line in `MoreTermsOfServiceScreen.tsx` has no size of its own and is secondary gray. Give it `typography.heading` (18) and `tokens.text.link`. Do not change the settings-menu subtitle that uses the same catalog key.

## Card gaps

Add two helpers in `screenLayout.ts`:

- `settingsCardGap` returns `spacing['2xl']` (24), the space between settings cards.
- `settingsCardInnerGap` returns `spacing.lg` (16), one column gap inside a card from the heading to the description to the button. A missing description leaves no stray margin.

OPML, Downloads, Playback, Notifications, podcast settings, and the channel settings pane use `settingsCardGap` between cards. Screens that pack a heading, description, and button use `settingsCardInnerGap`. The feed card is one of those: the space between "Last Parsed" and Check Feed is 16, not the current 8.

## Notification groups

The category groups on Settings → Notifications are bordered boxes inside a bordered card. Remove the inner border, radius, and padding. Separate the groups with a hairline (`StyleSheet.hairlineWidth`, the border token). No line above the first group. `spacing.lg` above the line matches `spacing.lg` below it. The hairline runs the width of the card. Labels and switches keep the card's own horizontal padding.

## Option rows

`OptionListGroup` rows are `paddingVertical` `spacing.md` (8), a 16pt label, and an 18pt text check. Change this component once. Labels use the same title size as `ListRow` (19). Vertical padding is `spacing.lg`. The check is an Ionicons checkmark at `LIST_ROW_ACTION_ICON_SIZE` (26), in the primary button color. The heading uses body (15), from the type floor above. `SortSelectRow` and every `OptionListScreen` pick this up.

## Downloads storage card

Settings → Downloads replaces a short `ListLoading` spinner with the storage meters, so the content below jumps. The storage block keeps the loaded-meter height from the first paint. A spinner sits in the center until `breakdown` is set, then the meters replace it without the card growing or shrinking. Do not use the short `ListLoading` row for this wait.

## Switch row

`SettingsSwitchRow` is the only label-and-switch row. Its title uses the menu title size (19). Downloads, Notifications, Playback, the offline-mode header, and Popularity Tracking all use it. Do not leave a raw `Text` or a `ListRow` with a switch in the trailing slot for those rows.

## Popularity Tracking

Above the switch, one sentence. Suggested copy, to edit before it is catalogued:

"Help surface the shows people listen to most. Your listens can count toward those rankings without your name attached."

Sentence case. New keys in every catalog locale under `packages/i18n-catalog/consumer/originals/` (`en-US`, `es`, `fr`, `el-GR`). Do not edit `overrides/`.

Below the switch, More Info starts collapsed. Use `misc.more_info` / `misc.hide_info`. Opening it shows the existing how-it-works agreement. It is not a bordered box inside another bordered box. Turning the switch on still asks for the yes or no choice before the preference is saved.

## FAQ

`MoreFaqScreen` renders the managed-copy slug `faq` as one open article. Each level-1 heading is an accordion title, collapsed. The blocks until the next level-1 heading are the answer, using `CopyMarkdown`'s paragraph and list rendering. Space the accordions with `settingsCardGap`. Loading and error stay. Do not change the web FAQ page. Do not use the accordion subtitle.

## Operator check

Do not run these during implementation.

```bash
npm --prefix apps/mobile run test -- src/screens/more
npm run mobile:e2e:test -- settings-select
```

Mobile E2E Metro and a Mobile E2E device must already be up for the Maestro command.
