# 02 — List rows, mini player, and header icons

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

Owns shared list and mini-player chrome. Read [00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md). Do not edit `.cursor/` files. Prompt 09 records the rule changes.

## List art and type

`LIST_ROW_ARTWORK_SIZE` in `apps/mobile/src/theme/screenLayout.ts` is 60. Change it to 78. Podcast, Queue, History, Downloads, chapter, and podroll rows already use the constant, so they grow with it. Do not edit `LibraryDownloadsScreen.tsx`. Episode and track header art stays 96. People portraits are prompt 03.

In `HomeFeedRow.tsx` and `ListRow.tsx`:

- Title 16 to 19, still primary.
- The show name above a title is caption (12). Move it to body (15). Episode, clip, and track rows keep that order: show name, title, date.
- `ListRow` subtitle moves from caption to body (15). Prompt 08 must not put it back.
- Duration beside Play: 14 to body (15).

## Home and Browse channel rows

Subscribed shows on Home, and podcasts and albums on Browse, use the same three lines as the original podcast list. Do not reorder episode, clip, track, Queue, or History rows.

Home podcasts, albums, and artists (`mapSubscribedChannelToRow`, subtitle is null, `metadata` is present):

- Top: the latest-episode date, and only the date. `formatDateAbbrev` already returns it (`Oct 14 2026`). Do not prefix it with "Latest episode" or the `subscriptions.row.latest_episode` catalog string ("Latest: {date}"). 14, bold, `tokens.text.link`.
- Middle: the show title, 19, primary.
- Bottom: `{count} downloaded` from `subscriptions.row.downloaded_count`, including zero. 14, secondary, not bold. Today the count is an overline and only when it is above zero.

Browse podcasts and albums (subtitle is the author, no download metadata):

- The same date on top and the same title.
- The author on the bottom line, in the same size and color as the download count. Omit that line when the author is empty. Do not show a download count on Browse.

Browse artists have no author. Put the date on top and the title under it, with no third line.

Add by RSS shows (`row.source === 'addByRss'`) on Home and on Library → Add by RSS use the same date and title. They have no download line, not even zero: Add by RSS episodes have no download path, so the count is always zero and means nothing. Do not reserve that line's height for them. Add by RSS episode and track rows keep show name, title, then date.

Before Home metadata arrives, reserve the bottom line's height so the title does not jump. Do not paint a zero that the count query has not returned yet. Once `metadata` is set, show the real count, including zero. Rewrite the `homeRowMetadata.ts` comment that says a zero count draws no line, so it says Add by RSS feeds are the shows with no count line.

The grid tile keeps its download badge only when the count is above zero.

`subscriptions-anonymous.yaml` asserts the download line is absent when nothing is downloaded. Change that assertion so the zero count is visible. Do not rewrite the rest of the flow. The date test id stays `home-feed-row-updated-*`. The count test id stays `home-feed-row-downloaded-*`. The author test id stays `home-feed-row-subtitle-*`.

`identityText` gap is `spacing.xs` (2). Change it to `spacing.base` (12). Row vertical padding is `listRowVerticalPadding(spacing.base)` (12). Change the padding around the hairline to `spacing.lg` (16) on both sides. The hairline stays, including on the first row. There is still no line under the last row.

The boost sheet image is 56. Use `LIST_ROW_ARTWORK_SIZE`.

## Mini player

In `MiniPlayer.tsx` and `MiniPlayerArtwork.tsx`:

- `MINI_PLAYER_ARTWORK_SIZE` 56 to 60.
- Episode title 15 to 19.
- Channel line 13 to 15, semibold, `tokens.text.link`.
- The bare play glyph is already 26. Leave it.

## Header icons

Default icon in `HeaderBarAction.tsx` is 22. Change it to 26. That is the size for every top-right header icon that does not pass its own size, including the Playlists create plus. The back glyph in `HeaderBarChrome.tsx` stays 28. The 44pt header row does not grow.

## Chips above a list

`SectionChipRow` already applies `listChipRowBottomGap` (`spacing.base`) as its own bottom padding. Home, Browse, and Playlists get that seam.

Queue and History put `OptionChipGroup` in the list header with top padding only, so the first row's hairline sits on the pills. Give those headers `paddingBottom: listChipRowBottomGap`. Search's medium chips sit above the results the same way. Do not add a second gap on a screen that already uses `SectionChipRow`. Form chips inside a card stay on form spacing.

## Out of scope

Player transport, scrubber, `PlaybackProvider`, settings cards, artist chip order, and `LibraryDownloadsScreen.tsx`.

## Operator check

Do not run these during implementation.

```bash
npm --prefix apps/mobile run test -- src/theme/screenLayout.test.ts
```

If that test file does not exist, skip it and say so. There is no separate Maestro area for this prompt.
