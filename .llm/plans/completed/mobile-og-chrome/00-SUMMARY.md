# Mobile player, lists, and settings chrome

Deferred from the player-bar session on 2026-10-17. The set has landed, and Cursor guidance
matches the app.

Make the next-gen mobile player and list chrome closer to the original app, and apply the same type, spacing, and row rules on the screens called out in that session. Web changes only where People must match.

## What lands

- Progress bar: a horizontal drag seeks, a vertical swipe scrolls, and the bar gains a thumb, gold chapter dots, and a pulsing band.
- Player type and controls grow inside the existing rows. The item title and the chapter name each go up one step on the type ramp. Position and duration stay at the one step already set for them. Sky-blue text uses `tokens.text.link`.
- An item with no chapters and no clip drops the empty band under the art and gives that height to the image.
- Music keeps shuffle and repeat beside sleep and More, plays at 1x, and has no Clips chip and no create-clip action. Audio and video keep the last chosen speed.
- Chapter skip holds the seek so the previous title and art do not flash.
- List art is 78. Mini-player art is 60. Home show rows put the date on top and the download count on the bottom, including zero, with no "Latest episode" prefix. Browse podcasts and albums use the author on that bottom line.
- Chips above a list use the Browse gap.
- People is its own chip, not About or Summary body. Show More collapses later. Portraits use the list-art constant.
- Tapping the item title or channel name on the full player opens that screen, when the app has one.
- Add by RSS: music-medium items follow the music rules and queue. Shows have no download count. Protected artwork keeps its headers in the image viewer without putting them in route params. Add by RSS has no People chip and no item-title link.
- The chapter strip above the mini player marquees.
- The full-size image viewer slides up and dismisses from the top.
- Option rows match menu rows. Settings type, card gaps, notification groups, the downloads storage card, FAQ accordions, Popularity Tracking, the error log, and the Terms of Service date follow one standard.
- Artist chips are Albums, Tracks, About. Album and podroll lists draw the content-list hairline.
- An in-progress download row reveals Remove the way Home reveals Unsubscribe.
- After the code lands, one pass rewrites Cursor guidance that still describes the old behavior.

## Files

| File | Phase | Runs with |
| --- | --- | --- |
| [01-player-bar.md](./01-player-bar.md) | 1 | 02, 04, 05, 06, 07 |
| [02-list-and-mini-player.md](./02-list-and-mini-player.md) | 1 | 01, 04, 05, 06, 07 |
| [04-segment-marquee.md](./04-segment-marquee.md) | 1 | 01, 02, 05, 06, 07 |
| [05-image-viewer.md](./05-image-viewer.md) | 1 | 01, 02, 04, 06, 07 |
| [06-artist-and-hairlines.md](./06-artist-and-hairlines.md) | 1 | 01, 02, 04, 05, 07 |
| [07-downloads-swipe.md](./07-downloads-swipe.md) | 1 | 01, 02, 04, 05, 06 |
| [03-people-chip.md](./03-people-chip.md) (People chip and player title links) | 2 | 08, after phase 1 |
| [08-settings-chrome.md](./08-settings-chrome.md) | 2 | 03, after phase 1 |
| [09-abcremember.md](./09-abcremember.md) | 3 | alone, after phase 2 |

Prompts: [COPY-PASTA.md](./COPY-PASTA.md). Order and file ownership: [00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).
