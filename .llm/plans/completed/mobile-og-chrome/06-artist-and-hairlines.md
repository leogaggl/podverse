# 06 — Artist chips and content-list hairlines

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

## Artist chips

`ArtistDetailScreen.tsx` always shows Albums, then adds Tracks only after a track row exists, so the chips read Albums, About.

Tracks is always between them: Albums, Tracks, About, then Podroll, Funding, and Settings when those apply. An empty track list already has an empty state. Do not wait on the track request to insert the chip. Albums stays first for the same reason it is always offered today.

Do not add or remove a People chip. Prompt 03 does that after this prompt.

## Hairlines

Artist album rows are a bare `ListRow`, so they load with no divider. Tracks already use `HomeFeedRow`, which draws a top hairline.

Give album rows that same line: `StyleSheet.hairlineWidth` and the border token, including the first row, and no line under the last row. An empty list draws nothing. Match `PlaylistListRow`, which wraps `ListRow` in a view that paints the top border.

The same line is missing on artist podroll, album podroll, and podcast podroll. Those rows get it too. Chapter, playlist, and profile rows already have it.

Do not put the hairline on the `ListRow` primitive. Settings and menu cards use that primitive and keep a line between rows, with no top line on the first row inside the card.

## Out of scope

People, player files, `screenLayout.ts`, and `.cursor/` files.

## Operator check

Do not run tests during implementation. Open an artist with no tracks and confirm Albums, Tracks, About. Open Albums and confirm a line between rows.
