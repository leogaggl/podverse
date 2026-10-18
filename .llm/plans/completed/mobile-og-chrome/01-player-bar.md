# 01 — Player bar, music controls, and chapter skip

**Cursor model:** Opus 5.5 · **Reasoning:** high

Owns the full player and the playback session. Read [00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md) before editing. Do not touch files listed there as owned by another prompt.

The fixed player region still shrinks artwork before it moves the section chips. Header icons are not this prompt. Sizes below stay inside the current row heights except the title block and the progress block, which grow and take the space from the artwork.

## Seek gesture

In `apps/mobile/src/components/player/FullPlayerScrubber.tsx` a finger down seeks immediately, including a vertical swipe over the hit target.

- Start the seek in `onStart`, after the pan activates.
- `activeOffsetX` about 24pt so a small drift does not seek.
- `failOffsetY` about 16pt so a vertical swipe fails the pan and the player scroll view scrolls.
- A stationary tap still seeks. The long-press chapter tooltip stays.
- Keep the gesture object in `useMemo`.

## Bar look

Same scrubber:

- White 12pt thumb on the playhead.
- Chapter marks become 4pt circles in `#ffc107`, centered on the track. Boundaries only, from `getChapterBoundaryRatios`. No mark at 0 or 1.
- Replace the flat in-track tint with a band behind the track over the current chapter, clip, or official clip. About 32pt tall. Loop between `#74A8DC` at about 60% opacity and `#ffc107` at about 60% opacity, 2 seconds each way. Reduce Motion holds the blue frame. `useReduceMotion` already exists.
- Played fill stays the theme accent. The thumb, dots, and pulse stay this palette on every theme.

## Type and controls

- The item title (episode, track, clip, livestream, or Add by RSS) is 22. Raise it one step on the type ramp, to display: 28, line height 34. It stays primary. The same style covers every item kind.
- The chapter or clip name in `FullPlayerSegmentBand.tsx` is 18. Raise it one step, to title: 22, line height 28. It stays primary.
- Channel title in `FullPlayerScreen.tsx`: 15 to 17, still semibold, color `tokens.text.link`.
- Chapter or clip clock: 13 to 15, `tokens.text.link`.
- Position and duration stay the one step already set here: 12 to 14, `tokens.text.link`. Do not raise them again. Raise `FULL_PLAYER_PROGRESS_BLOCK_HEIGHT` only enough for those 14pt clocks.
- `FULL_PLAYER_TITLE_BLOCK_HEIGHT` goes from 48 to 60, so the 34pt title line, the 2pt gap, and the 24pt channel line all fit. `FULL_PLAYER_SEGMENT_BAND_HEIGHT` goes from 56 to 64, so the 28pt name, the 8pt gap, and the 21pt clock fit. Both increases come out of the artwork. The chips stay on the fold. When the band is omitted, the layout drops the 64pt band, not 56.
- Playback speed label: 16 to 20, and only while audio or video is playing. Utility row stays 48pt.
- Transport glyphs and jump marks: 30 to 34. Play circle: 64 to 68. Utility moon and More: 26 to 30. Transport row stays 72. Utility row stays 48.

## No chapter or clip

`fullPlayerLayout.ts` always reserves `FULL_PLAYER_SEGMENT_BAND_HEIGHT` plus the seam above it. On a track or episode with no chapters and no clip, that is an empty hole. After the type change that constant is 64.

When the item has no chapters and the target is not a clip, official clip, or chapter, drop the band and one region gap, and give that height to the artwork. The square still respects the phone and tablet caps. One seam remains between the art and the progress bar. The chips stay on the fold.

Keep the band when `itemHasChapters` is true, the loaded chapter list is non-empty, or the target is a clip, official clip, or chapter. A chapter that starts mid-episode still fades into space that is already there. An item that does not claim chapters does not wait on the chapter request.

Update the layout test that expects the band to be reserved on every layout. Add the case that omits it.

`mobile-player-fixed-region.mdc` and `mobile-playback` `SKILL.md` say the band is reserved unconditionally and that a fixed-region row is never removed. Change those two sentences so the band is reserved for an item that has chapters or a clip, and omitted when the item has neither. Do not edit any other `.cursor/` file.

## Music

`item-music` does not use the audio/video inner transport slots or the speed control.

- Move shuffle and repeat out of `FullPlayerTransportRow.tsx`. Put them in `FullPlayerUtilityRow.tsx` as sleep, shuffle, repeat, More. Audio and video stay sleep, speed, More. The utility row stays 48pt.
- Music transport stays previous, play, next. The two inner slots stay empty so play remains centered. Jump back and jump forward stay on audio and video.
- Do not render the speed control for music. The engine rate is 1 whenever the target is `item-music`.
- In `PlaybackProvider.tsx`, remember the last audio/video rate separately from the rate sent to the bridge. Default is 1. `setRate` stores the audio/video rate. Starting music applies 1 and does not clear the stored rate. Starting audio or video later applies the stored rate. `useMediaPlayerResourceUpdate` must receive that effective rate, not the stored rate, while music is loading.
- The full player chip list hides Clips when the target is `item-music`. `resolveEpisodeTabs` still always includes Clips on episode detail. A remembered Clips tab falls back to Summary. Hide the header create-clip action for music.

## Add by RSS

An Add by RSS target (`kind: 'add-by-rss'`) carries `resourceData` instead of a channel and item.

- Music: an Add by RSS item whose `resourceData.medium_id` is a music medium follows every music rule above: 1x, no speed control, shuffle and repeat beside sleep and More, and no create-clip action. Today `resolveEngineAudioProfile` in `engineAudioProfile.ts` returns `spoken` for every Add by RSS target, so those items also take the audio/video queue (`queueMediumFromTarget` in `mediaEngineSourceMeta.ts`). Have that helper read `resourceData.medium_id` with the same music and video medium sets it uses for channels, so the engine profile, queue medium, rate, and controls all agree. Replace the `kind === 'item-music'` check in `FullPlayerScreen.tsx` with one predicate that answers music for both kinds. An Add by RSS item with no medium stays spoken. Update the comment that says Add by RSS is always spoken, and add a unit case for a music-medium Add by RSS target.
- Segment band: `useNowPlayingChapters` loads nothing for Add by RSS, and the target is never a clip, so the band is omitted and the art grows. Do not add chapter loading for Add by RSS.
- Chapter skip: there are no in-memory chapters for Add by RSS, so previous and next keep the queue path.
- The scrubber draws no chapter dots and no band for Add by RSS, because there is no chapter or clip range.

## Chapter skip

Previous or next seeks, then a native progress sample or `reconcileFromNative` on `ready` / `playing` writes the pre-seek position back. Title and chapter art follow that position.

`seekTo` already sets the position immediately. Hold it: ignore native progress and reconcile samples that are still far from the pending seek, and clear the hold once a sample lands near it or about 1.5 seconds pass. `isDownloadHandoffProgressLanded` is the existing pattern for a similar hold.

`skipToPrevious` also waits on a queue-history read before seeking, even for a chapter seek. Seek from the chapters already in memory first. Load the previous queue item only when the action is the previous episode.

## Out of scope

List art, mini player, header icon default, People, the image viewer, artist chips, Downloads swipe, and settings screens. Tapping the title or channel to open a screen is prompt 03, because it edits `navigation/index.tsx` after prompt 05. Leave the title block's 60pt height and layout so 03 can add the press targets inside it.

## Operator check

Do not run these during implementation.

```bash
npm --prefix apps/mobile run test -- src/screens/player/fullPlayerLayout.test.ts
npm run mobile:e2e:test -- player-screen
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
```

Mobile Maestro needs Mobile E2E Metro, Mobile E2E iOS or Mobile E2E Android, and Mobile E2E API already up. Do not start those from this command.
