# 07 — Downloads swipe reveal

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

Home reveals Unsubscribe by translating the row and leaving the action beside it. Library → Downloads uses the same `SwipeActionRow`, but an in-progress row does not stay slid, and the progress line paints across Remove.

`LibraryDownloadRow` in `apps/mobile/src/screens/library/LibraryDownloadsScreen.tsx` calls `useItemDownload` with progress on, so every byte re-renders the swipeable. Home's row does not.

Move that subscription into a leaf under the sliding content. The leaf renders the progress track. The row shell re-renders when the list record changes status, not on every byte. The track cannot paint outside the sliding row: clip that row. Remove stays the full height of the row, beside the translated content.

Do not change the queue swipe contract. Do not add an inline Remove button. Do not edit `MoreSettingsDownloadsScreen.tsx`. Do not edit `.cursor/` files.

Prefer the fix in the download row. Add `overflow: 'hidden'` on the sliding content inside `SwipeActionRow` only if the track still paints into the action after the leaf split, and do not change that component's gesture props.

## Operator check

Do not run tests during implementation. On Library → Downloads, swipe an in-progress row and confirm Remove matches the Home reveal: the row stays slid, and the progress line stops at the row edge.
