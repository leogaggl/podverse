**Cursor model:** Cursor Grok 4.7 · **Reasoning:** low

# Debug panel subtitle does not cite a plan step

`PrimitivesDebugPanel` is a dev-only smoke for `ScreenHeader`, `Card`, `ListRow`, and `Button`. Its subtitle is `Track 9b.6 shared visual primitives scaffold`, which only names a plan step. The file comment above the component already says what the panel is.

## Rows

R26

## Runs after

none

## Files

- apps/mobile/src/debug/PrimitivesDebugPanel.tsx

## Tests

none. The panel is dev-only and is not in a Maestro flow. The subtitle is hardcoded debug chrome, not catalog copy.

## Release scratchpad

none

## Edit

Set the `ScreenHeader` `subtitle` to `Shared visual primitives`. Leave `title`, `testID`, and the file comment as they are. Do not add an i18n key.
