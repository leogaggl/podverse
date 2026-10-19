# 01 — Description ingest helpers

**Cursor model:** Codex 5.3 · **Reasoning:** high

## Summary

Add pure functions to `@podverse/helpers`. They turn any feed description into stored HTML
that is ready to render, a plain preview, and truncation facts. No I/O and no database access.
Parser (04), backfill (04), management (05), and clients (07, 08) all call them.

Decisions: [00-SUMMARY.md](./00-SUMMARY.md) items 1–4 and 9. Do not edit DTOs (03 owns them),
parser-mapping (04), or any renderer.

## Shared grammar — `packages/helpers/src/lib/descriptionDocument.ts`

The allowlist, aliases, void tags, drop-contents tags, link-href check, and tokenizer stay in
this file, so ingest and render cannot drift. Keep `readDescriptionDocument` behavior exactly as
it is (strict).

1. Split `parseTokensToRich` into one builder with `mode: 'strict' | 'lenient'`. Strict keeps
   every current throw.
2. Lenient mode:
  - Frames still open at end of input close in order.
  - A close tag with no matching open frame is ignored.
  - A close tag that matches a frame lower in the stack closes every frame above it
    (`<p><strong>a</p>`).
  - Opening `p` while a `p` is open closes the first. Opening `li` while an `li` is the
    innermost list item closes it.
  - An unterminated tag at the end of input (`<a href="https://ex`) is dropped.
  - An unclosed `script` or `style` drops everything to the end of input.
  - Links whose href fails `isAllowedLinkHref` unwrap to their text, the same as strict.
  - Remove empty containers after building: `p`, `li`, headings, and lists with no visible
    text, and `strong`/`em`/`u`/`a` with no text.
  - Collapse runs of more than two `br` to two. Drop `br` at the start and end of a block.
3. Export `buildDescriptionTree(input, mode)` returning `DescriptionNode[]`. In strict mode it
   throws.
4. Export `serializeDescriptionNodes(nodes)`. Lowercase canonical tags, `href` as the only
   attribute, double-quoted. Escape `&`, `<`, `>` in text and `&`, `"` in attributes. Add no
   whitespace between blocks.
5. Export `descriptionNodesToPlainText(nodes, blockSeparator)`. Use it for preview and
   visible-length counting.

Invariant, asserted in tests: for any input whose lenient tree is non-empty,
`readDescriptionDocument(serializeDescriptionNodes(tree)).rich` is not null. Its plain text
matches the tree's plain text.

## Limits — new `packages/helpers/src/lib/descriptionLimits.ts`

```ts
export enum DescriptionLengthTierEnum {
  Standard = 'standard',
  Extended = 'extended',
  Maximum = 'maximum',
}

export const DESCRIPTION_LENGTH_TIERS: Record<
  DescriptionLengthTierEnum,
  { visibleMax: number; storedMax: number }
> = {
  [DescriptionLengthTierEnum.Standard]: { visibleMax: 10_000, storedMax: 30_000 },
  [DescriptionLengthTierEnum.Extended]: { visibleMax: 25_000, storedMax: 75_000 },
  [DescriptionLengthTierEnum.Maximum]: { visibleMax: 50_000, storedMax: 150_000 },
};
```

Also export:

- `DEFAULT_DESCRIPTION_LENGTH_TIER = DescriptionLengthTierEnum.Standard`
- `DESCRIPTION_STORED_MAX_CEILING = 150_000`, with a one-line comment that the database
  `CHECK` on `item_description.value` and `channel_description.value` uses the same number.
- `DESCRIPTION_PREVIEW_MAX_LENGTH = 400`
- `isDescriptionLengthTier(value: unknown): value is DescriptionLengthTierEnum`
- `resolveDescriptionLengthTier(override: string | null | undefined)`: an unknown or null value
  returns the default.
- `suggestDescriptionLengthTier(longestSourceLength: number | null)`: the smallest tier whose
  `visibleMax` is at least the length. Null input gives null. A length over `maximum` gives
  null, which the UI reads as "Exceeds Maximum".

## Ingest — new `packages/helpers/src/lib/descriptionIngest.ts`

```ts
export type PreparedDescription = {
  value: string;
  preview: string;
  is_truncated: boolean;
  source_length: number;
};

export function prepareDescriptionForStorage(
  input: string | null | undefined,
  tier: DescriptionLengthTierEnum
): PreparedDescription | null;

export function pickItemDescriptionSource(parts: {
  content?: string;
  descriptionRaw?: string;
  description?: string;
  summary?: string;
}): string | null;

export function pickChannelDescriptionSource(parts: {
  descriptionRaw?: string;
  description?: string;
}): string | null;
```

Field names are snake_case so 04 can spread the result into the entity update.

`prepareDescriptionForStorage` steps:

1. Blank input returns null.
2. Input with no tag-like `<[A-Za-z/]` is plain text. Normalize `\r\n`. A blank line starts a
   new `p`; a single line break becomes `br`. Escape before building.
3. Build the lenient tree. An empty tree returns null.
4. `source_length` is the plain-text length of the whole tree, with blocks separated by one
   newline. Use JS string length; it never undercounts Postgres `char_length`.
5. Truncate (below) to the tier's `visibleMax`.
6. Serialize. While the result exceeds `storedMax`, drop the last kept block. This handles
   markup-heavy notes.
7. `preview` is the plain text of the kept tree with whitespace collapsed to single spaces. Cap
   it at `DESCRIPTION_PREVIEW_MAX_LENGTH` and cut at the last whitespace, with no ellipsis
   (same style as `htmlToPlainTextPreview`).
8. `is_truncated` is true when step 5 or 6 removed anything.

Truncation rules:

- Walk blocks in order and keep each block whose visible length fits the remaining budget.
- A list that does not fit is entered. Keep its leading `li` that fit, then stop.
- When nothing has been kept yet and the first block is too long, cut inside it at the last
  word boundary within budget, and append `…` as a text node.
- Never end on a heading. Drop trailing headings after the cut.
- Stop at the first block that does not fit. Do not skip ahead to a shorter later block.

Idempotence: `prepareDescriptionForStorage(once.value, tier)` returns the same `value` and
`preview` as `once` when `once` was not truncated. The backfill and every reparse rely on this.

Source pickers return the first part with visible text after trimming. Item order is `content`,
`descriptionRaw`, `description`, `summary`. Channel order is `descriptionRaw`, `description`.
Visible text means `htmlToPlainText(part).trim() !== ''`.

## Preview read — new `packages/helpers/src/lib/descriptionPreview.ts`

```ts
type DescriptionPreviewSource =
  | { preview?: string | null; value?: string | null; is_truncated?: boolean }
  | null
  | undefined;

export function getDescriptionPreviewText(description: DescriptionPreviewSource): string;
export function isDescriptionTruncated(description: DescriptionPreviewSource): boolean;
```

`getDescriptionPreviewText` returns `preview` when it is a non-empty string. Otherwise it
returns `htmlToPlainTextPreview(value, DESCRIPTION_PREVIEW_MAX_LENGTH)` when there is a value,
or `''`. The fallback covers payloads stored on phones before `preview` existed. Keep the type
structural so this file does not import the DTOs.

Export all new names from `packages/helpers/src/index.ts`.

## Tests

`packages/helpers/src/lib/descriptionIngest.test.ts`, and add lenient-mode cases to the
existing `descriptionDocument` tests if that file exists. Write synthetic fixtures inline. Do
not paste real show notes.

1. Podcasting 2.0-style notes: headings, bold labels, and a 60-item link list, about 12,000
   visible characters. Standard cuts at an `li` boundary. The output parses rich, and
   `is_truncated` is true.
2. Valid notes sliced at 2,500 raw characters in the middle of an `href`. The output parses
   rich, and the dangling tag is gone.
3. Implicit closes: `<p>a<p>b`, `<ul><li>a<li>b</ul>`, `<p><strong>a</p>`.
4. Stray `</div></p>` at the start and middle are ignored.
5. `script` and `style` contents are dropped, including an unclosed `script`.
6. `javascript:` and `data:` hrefs unwrap. `mailto:` and `https:` stay.
7. Plain text with blank lines and single line breaks becomes `p` and `br`.
8. Entities (`&amp;`, `&nbsp;`, `&#8217;`) decode in `preview` and are escaped exactly once in
   `value`. Idempotence holds.
9. A first paragraph longer than the budget is cut at a word boundary and ends with `…`.
10. 100,000 empty `<b></b>` pairs are removed, and the stored length stays within the cap.
11. The same input under each tier. `suggestDescriptionLengthTier` boundaries: 10,000 is
    standard, 10,001 is extended, and 50,001 gives null.
12. Source pickers: `content` wins, whitespace-only `content` falls through, and `summary` comes
    last.
13. `getDescriptionPreviewText` returns the preview when present and falls back to the value.

Follow **unit-test-design-no-overgranularity**. One `describe` per exported function is
enough.

## Scratchpad

No entry. Nothing ships behavior until 04 calls these functions.

## Done when

- `readDescriptionDocument` output is unchanged for every existing test.
- The invariant and idempotence tests pass.
- No `as` assertions outside `as const`. No `any`.
- Code comments must not cite this plan or any plan number (**comments-future-forward**).

## Operator verification

**Root**

```bash
npm run test -w packages/helpers
npm run build -w packages/helpers
```
