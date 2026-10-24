**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# Embed builder accepts only the type values it writes

`buildEmbedBuilderUrlPath` writes `type` as `compact` or `responsive`, and turns the list on with `list=1`. It does not write `audio`, `video`, `audio-list`, `video-list`, `compact-list`, or `responsive-list`.

`normalizeEmbedBuilderType` still accepts those values, and `parseListEnabledFromTypeValue` turns the list on for the combined ones. `composeEmbedBuilderType` has no callers. `EMBED_BUILDER_TYPES` and `EmbedBuilderType` are exported from `apps/web/src/lib/embed/index.ts` and have no other importers.

`playlist_item` is current. The builder still writes it. Do not remove that parameter.

`EmbedBuilderTypeSourceParams` is a different type. Keep it and everything in `embedBuilderTypes.ts` from `EMBED_BUILDER_LIST_CONTENT_TYPES` downward.

## Rows

R23, R30

## Runs after

none

## Files

- apps/web/src/lib/embed/embedBuilderTypes.ts
- apps/web/src/lib/embed/parseEmbedBuilderQueryParams.ts
- apps/web/src/lib/embed/index.ts
- apps/web/src/lib/embed/__tests__/parseEmbedBuilderQueryParams.test.ts
- apps/web/src/lib/embed/__tests__/buildEmbedUrlFromBuilderParams.test.ts
- apps/web/src/lib/embed/embedLayoutTokens.ts
- apps/web/e2e/helpers/embedAssertions.ts

## Builder type query

Delete from `embedBuilderTypes.ts`: the deprecated block on `EMBED_BUILDER_TYPES`, `EmbedBuilderType`, `EMBED_BUILDER_TYPE_LEGACY_ALIASES`, `normalizeEmbedBuilderType`, `decomposeEmbedBuilderType`, and `composeEmbedBuilderType`.

In `parseEmbedBuilderQueryParams.ts`:

- `type` is `compact` or `responsive`. Anything else, including the values deleted above, uses the existing default `compact`. Compare with `===`. Do not use `as`.
- List on/off comes only from the `list` parameter (`parseEmbedListEnabled`). Delete `parseListEnabledFromTypeValue`. When `list` is absent, `listEnabled` is false.
- Keep `prefer` as the media preference. `audio` and `video` remain valid `prefer` values. They are not valid `type` values.

Stop exporting `EMBED_BUILDER_TYPES` and `EmbedBuilderType` from `index.ts`.

In `parseEmbedBuilderQueryParams.test.ts`:

- Delete `accepts legacy audio type aliases`.
- Add one test: `type` of `audio`, `video`, `audio-list`, `video-list`, `compact-list`, and `responsive-list` each parse as `playerSize: 'compact'` and `listEnabled: false`.
- Rename `maps playlist_item to playlistItem for legacy list type alias`. Its input uses `type: 'compact'` and `list: '1'` (not `audio-list`). It still expects `playlistItem: 'item-1'` and `listEnabled: true`.

In `buildEmbedUrlFromBuilderParams.test.ts`, rename `builds podcast list paths for compact-list type` to `builds podcast list paths when the list is enabled`. The assertion already passes `listEnabled: true`. Do not change the expected path.

## Unused embed aliases

These names have no importers. Delete them and their `@deprecated` comments. Do not replace call sites; there are none.

- `EMBED_PANEL_SECTION_GAP_PX` in `embedLayoutTokens.ts`. Keep `EMBED_PLAYER_INFO_CONTROLS_GAP_PX`.
- In `embedAssertions.ts`: `EMBED_SINGLE_SHELL_VIDEO_HEIGHT`, `EMBED_LIST_SHELL_VIDEO_HEIGHT`, `EMBED_LIST_SHELL_VIDEO_HEIGHT_WITH_SELECTOR`, `expectEmbedVideoStage`, `expectEmbedVideoElement`, `expectEmbedVideoCenterArt`. Keep the `EMBED_*_RESPONSIVE_*` constants and `expectEmbedResponsiveStage`, `expectEmbedResponsiveVideoElement`, `expectEmbedResponsiveCenterArt`.

## Tests

The unit updates above. No new Playwright spec. Current builder URLs stay on `embed-share-builder.spec.ts` and the other embed specs, which use `type=compact|responsive` and `list`.

## Release scratchpad

```markdown
## Embed builder ignores older type query values

- Surfaces: web
- Change: `/embed/builder` reads `type` as `compact` or `responsive` only. `audio`, `video`, `audio-list`, `video-list`, `compact-list`, and `responsive-list` no longer select a player size or turn the list on. List on/off is the `list` parameter. The builder still writes `type=compact|responsive` and `list=1`.
- Who notices: anyone opening a builder URL saved with those older `type` values
- Operator steps: none
```
