**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# Remove unused shared-UI aliases

Two exports in `@podverse/ui` exist only under an older name. Nothing in the repo imports them except the files that define and re-export them.

- `TableOfContentsItem` is `TableOfContentsLinkItem`. The component takes `sections: TableOfContentsSection[]`. Keep `TableOfContents`, `TableOfContentsLinkItem`, `TableOfContentsSection`, and `TableOfContentsProps`.
- `CompactNumericInputRow` is `CompactFieldRow`, and `CompactNumericInputRowProps` is `CompactFieldRowProps`. Keep `CompactFieldRow` and `CompactFieldRowProps`.

## Rows

R23, R30

## Runs after

none

## Files

- packages/ui/src/components/navigation/TableOfContents/TableOfContents.tsx
- packages/ui/src/components/navigation/TableOfContents/index.ts
- packages/ui/src/components/form/CompactFieldRow/CompactFieldRow.tsx
- packages/ui/src/components/form/CompactFieldRow/CompactFieldRow.test.tsx
- packages/ui/src/index.ts

## What to change

Delete `TableOfContentsItem` and its `@deprecated` comment. Drop it from `TableOfContents/index.ts` and from the type export list in `packages/ui/src/index.ts` (the `TableOfContents` block near the `Tabs` exports).

Delete `CompactNumericInputRow` and `CompactNumericInputRowProps` and the `@deprecated` comment. Drop both from the value export and the type export in `packages/ui/src/index.ts` (the `CompactFieldRow` block). Delete the test `exposes CompactNumericInputRow as an alias` and its import. Leave the other `CompactFieldRow` tests.

Do not rename `CompactFieldRow` or change its props.

## Tests

The deleted alias test is the only test change. No Playwright spec. The components' rendered behavior does not change.

## Release scratchpad

none
