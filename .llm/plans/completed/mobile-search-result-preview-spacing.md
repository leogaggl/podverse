# Mobile search-result preview: breathing room and type

Saved for implementation. No code has been changed for this work.

The screen is the Podcast Index result that is not in the directory yet:
`PodcastIndexFeedPreviewScreen` (`SearchResultDetail`), testIDs
`search-result-detail-screen` and `pi-feed-preview-helper`.

## Goal

Give the stacked cover, title, author, and description room between them. Make the title,
author, description, and the directory explainer one step larger on the existing type ramp.
Center the explainer's info icon on its text when the sentence wraps, and draw that icon one
step larger with the type.

Leave list rows, channel headers, forms, and the other `HelperNote` screens on their current
spacing and type. The new values are there for the next screen that stacks a large cover over
a title, a byline, and a full description.

Do not run this in parallel with `mobile-stacked-form-actions` prompt 01. Both edit
`.cursor/rules/mobile-screen-layout.mdc`, in different sections.

## What is tight today

`PodcastIndexFeedPreviewScreen` puts cover, title, author, and description in one column with
`gap: tokens.spacing.sm` (4). That is the list-row line gap. It is the wrong distance under a
160pt cover and between a title and a paragraph.

Type on that screen is raw `fontSize` with no line height:

| Line | Today | Nearest ramp role |
| ---- | ----- | ----------------- |
| Title | 22 / 700 | `typography.title` (22 / 700 / 28) |
| Author | 15 | `typography.body` (15 / 400 / 21) |
| Description | 14 | Off the ramp (between `label` 13 and `body` 15) |
| Directory explainer | `typography.caption` (12 / 400 / 16) | Already on the ramp |
| Adding / error lines | 14 | Off the ramp |

`HelperNote` lays the icon and the sentence out with `alignItems: 'flex-start'` and an 18pt
icon. A wrapped sentence keeps the icon on the first line's top.

## Standards already in the app

Reuse these. Do not retune them in this work.

| Pattern | Where | Distance |
| ------- | ----- | -------- |
| Page gutter under the title bar | `screenBodyInsets` | `spacing.lg` (16) top and sides |
| List-row line stack | column `gap` | `spacing.sm` (4) |
| List-row art to text | `listRowArtworkGap` | `spacing.base` (12) |
| Channel header (78pt art beside the title) | `ChannelHeader` | art gap `spacing.lg`; subtitle `spacing.xs`; description `spacing.sm` |
| Chip row, filter, form actions | helpers in `screenLayout.ts` | named per seam |
| Type | `apps/mobile/src/theme/typography.ts` | display 28, title 22, heading 18, prose 17, subheading 16, body 15, label 13, caption 12 |

`mobile-screen-layout` already says two seams that should feel alike share one token, and a
column `gap` is right when every seam in that column is the same relationship. Cover to title,
title to author, and author to description are three relationships, so this screen stops using
one `gap`.

Web's Podcast Index feed page (`PodcastIndexFeedInfo.module.scss`) already uses separate
margins under the image, title, and author. Do not port those rem values or change web. Mobile
keeps its own ramp and spacing helpers.

## New helpers

Add these to `apps/mobile/src/theme/screenLayout.ts`, next to the other named seams. Each
returns one spacing token. No new numbers.

| Helper | Returns | dp | Seam |
| ------ | ------- | -- | ---- |
| `PREVIEW_IDENTITY_ARTWORK_EDGE` | `160` | 160 | Cover edge. Same size as today, named so the style and `decodeEdge` share it. |
| `previewIdentityArtworkGap` | `spacing.lg` | 16 | Cover to title. A 160pt cover is a block, not a text line. |
| `previewIdentityBylineGap` | `spacing.base` | 12 | Title to author. Related lines, with room once the title grows. |
| `previewIdentityDescriptionGap` | `spacing.xl` | 20 | Author (or title, when there is no author) to the description paragraph. Widest of the three, because this is the seam that reads as crushed. |

Apply them as `marginTop` on the title, author, and description. Do not put them in one column
`gap`. A missing author or description then adds no empty band.

The scroll column that holds the identity block, the explainer, and the Add button keeps
`gap: spacing.lg`. That seam is between blocks, and it is already the page's section distance.

Page padding becomes `screenBodyInsets` plus `paddingBottom: spacing.lg`. That matches today's
`padding: spacing.lg` and stops this screen from inventing its gutter.

Pass `decodeEdge={PREVIEW_IDENTITY_ARTWORK_EDGE}` on the cover (`mobile-image-loading`).

## Type on this screen

Spread ramp roles. Do not add font sizes.

Regular text steps along the regular roles (`body` to `prose`). Titles step along the title
roles (`title` to `display`). `subheading` is only 1pt above `body` and switches to semibold,
so it is not the step for the author.

| Line | Role | Size |
| ---- | ---- | ---- |
| Title | `typography.display` | 28 / 700 / 34 |
| Author | `typography.prose`, secondary color | 17 / 400 / 24 |
| Description | `typography.prose`, primary color | 17 / 400 / 24 |
| Directory explainer | `typography.body` via `HelperNote` `scale="reading"` | 15 / 400 / 21 |
| Adding, error, and notice lines | `typography.body` | 15 / 400 / 21 |

Author and description share `prose`. Secondary versus primary color keeps the byline quieter
than the paragraph. Description moves 14 to 17 because 14 is off the ramp and the paragraph
was the line called out as too small; the step above `body` is `prose`.

The adding / error / notice lines are snapped onto `body` so this stylesheet has no raw
`fontSize`. They are not a requested enlargement.

Do not change the ramp in `typography.ts`.

## Helper note

`HelperNote` stays the shared explainer (tertiary fill, leading info icon). Two scales:

| `scale` | Type | Icon constant | Who |
| ------- | ---- | ------------- | --- |
| `'compact'` (default) | `typography.caption` | `HELPER_NOTE_ICON_SIZE` = 18 | Add by RSS instructions, E2E playback intro |
| `'reading'` | `typography.body` | `HELPER_NOTE_READING_ICON_SIZE` = 22 | This preview only |

22 is the next icon size already used for a header action glyph (`HeaderBarAction` default).
Do not invent 20 or 24.

The row uses `alignItems: 'center'` on both scales, so a wrapped sentence centers the icon on
the text block. A one-line note stays centered on its line box.

The preview passes `scale="reading"`. Add by RSS and `MoreE2ePlaybackScreen` omit the prop and
keep caption type and the 18pt icon.

While editing `HelperNote`, group it for VoiceOver and TalkBack: `accessible` on the note,
`accessibilityRole="text"`, and the icon `accessible={false}` with
`importantForAccessibility="no"`. The message is the accessible name. The icon is decorative.

## Rule

Add a short **Stacked preview identity** section to
`.cursor/rules/mobile-screen-layout.mdc`, after the list-row section. State the three helpers,
the artwork constant, and the type roles above. Say list rows stay on `spacing.sm` and
`ChannelHeader` stays the side-by-side header. Say a future screen that stacks a large cover,
a title, a byline, and a full description uses these helpers. Do not require existing screens
to migrate.

No comment in product code should point at this plan.

## Files

1. `apps/mobile/src/theme/screenLayout.ts` — constants and the three gap helpers.
2. `apps/mobile/src/components/feedback/HelperNote.tsx` — `scale`, centered icon, a11y.
3. `apps/mobile/src/screens/search/PodcastIndexFeedPreviewScreen.tsx` — gaps, type, `scale`.
4. `.cursor/rules/mobile-screen-layout.mdc` — the short section.

No catalog, API, web, or E2E flow edits. `search-unparsed.yaml` already screenshots this
screen; the shot is the check that the button is still on screen and the icon sits mid-text
when the directory sentence wraps.

## Out of scope

- `ChannelHeader`, `HomeFeedRow`, `ListRow`, form screens, and the type ramp.
- Add by RSS and the E2E playback intro, beyond the shared icon centering.
- Artwork size (stays 160).
- Copy. The directory sentence stays `features.search.not_available_yet`.
- Web `PodcastIndexFeedInfo`.

## Verify

**Mobile E2E Metro**, **Mobile E2E API**, and **Mobile E2E iOS** / **Mobile E2E Android** must
already be up. Run this from **Mobile Maestro**:

```bash
npm run mobile:e2e:test -- search-unparsed
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
```
