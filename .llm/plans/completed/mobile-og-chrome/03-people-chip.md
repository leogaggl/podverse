# 03 — People chip and player title links

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

Run only after phase 1. Prompt 01 has already edited `FullPlayerScreen.tsx`. Prompt 05 has already edited `navigation/index.tsx`. Prompt 06 has already edited `ArtistDetailScreen.tsx` and `AlbumDetailScreen.tsx`. Add the People chip and the player title links without removing Tracks, album hairlines, the music Clips filter, the image viewer route, or the optional segment band.

## Chip

People leave About and Summary. The chip appears only when that channel or item has people, near the end of the row.

- Podcast, album, artist: after Funding, before Settings.
- Episode, track, full player: after Funding. Those screens have no Settings chip.
- Artist order after this prompt: Albums, Tracks, About, then the later chips, with People after Funding and before Settings when people exist. Tracks stays even when the track list is empty.
- Same on web tabs. Desktop pages that hide About in the side column (`hideDesktop`) hide the People tab the same way and show people as their own block in that column, not inside About.

Remove people from `ChannelAboutSection.tsx`, the `ItemSummaryPeople` call sites, web `ContentAbout.tsx`, and `CoreEpisodeSummary.tsx`. Reuse the existing people rows in the new pane.

Cache `hasPeople` on the section-chrome flags so the chip can paint before the detail request returns.

Add by RSS has no People chip. The mobile Add by RSS detail screen has no chips, and the web Add by RSS pages (`apps/web/src/app/add-by-rss/**`) pass only `description` to `ContentAbout` and `CoreEpisodeSummary`. After people move out, those components still accept a description alone, and the Add by RSS About and Summary tabs render the same as they do today. Do not add persons parsing to Add by RSS in this prompt.

## Show More and portraits

With people out of the pane, raise `DESCRIPTION_PROSE_COLLAPSE_LENGTH` from 360 to 720. Channel About and item Summary share that constant.

`AboutPersonRow.tsx` uses 48 for the portrait. Use `LIST_ROW_ARTWORK_SIZE` instead. Do not change the constant's value. The name stays subheading. The role uses body, the same size as other row subtitles.

## Player title links

On the full player, tapping the item title or the channel name opens that screen in the app. The full player is a root card above the tabs, so close it, then push the screen on the tab that was focused under the player. If that tab's stack does not register the route, use the Home stack. Add an `onOpenContent` callback beside `onOpenQueue` on the `FullPlayer` route in `navigation/index.tsx`, the same way that callback is wired.

| Target | Title opens | Channel opens |
| --- | --- | --- |
| Episode, video, chapter, official clip | `EpisodeDetail` for the item | `PodcastDetail` |
| Clip | `ClipDetail` for the clip | `PodcastDetail` |
| Track | `TrackDetail` | `AlbumDetail` or `ArtistDetail`, from the channel medium |
| Livestream with an item | The screen a livestream row opens today. Not a link if there is none. | `PodcastDetail` |
| Add by RSS | Not a link. There is no Add by RSS item screen. | `AddByRssPodcastDetail` with the local feed's `idText` |

Use the existing param builders (`buildPodcastDetailParams`, `buildAlbumDetailParams`, `buildArtistDetailParams`, `buildTrackDetailParams`).

For Add by RSS, `resourceData.channel_id_text` is the feed `idText` on the device that built it. A queue row synced from another device can carry another device's id, so look up `addByRssRepository.getFeedByIdText` first, then `getFeedByUrl(resourceData.feed_url)`. When neither finds a local feed, the channel name is not a link. `AddByRssPodcastDetail` is on the Home and Library stacks only.

The title block has `pointerEvents="none"` today. Give the title and the channel name their own press targets inside the 60pt block from prompt 01. The block does not grow. The marquee keeps scrolling. Each link has `accessibilityRole="link"` and an accessible name that says what opens. Text that is not a link stays plain text, with no press feedback. Test ids: `full-player-title-link` and `full-player-channel-link`.

Add a Maestro step to `player-screen.yaml` that taps the channel name and asserts the channel screen is visible. Targeted insertion only.

## Rules this prompt edits

Update only these `.cursor/` files:

- `about-summary-web-mobile-alignment.mdc` — people are a chip, not About or Summary body. Description and the other About or Summary fields stay.
- `abcmemory-vocabulary.mdc` — the About and Summary definitions no longer say those sections include people.
- `mobile-section-chrome-cache.mdc` — `hasPeople` is part of the cached flags.

Do not edit other `.cursor/` files. Do not edit `release-notes/scratchpad.md`.

## Operator check

Do not run these during implementation.

```bash
npm run mobile:e2e:test -- player-screen
make e2e_test_web_report_spec SPEC=e2e/about-summary-people.spec.ts
open .artifacts/e2e-reports/latest/index.html
```

Mobile E2E Metro and a Mobile E2E device must already be up for the Maestro command.
