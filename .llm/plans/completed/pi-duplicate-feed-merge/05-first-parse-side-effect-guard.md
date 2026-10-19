# 05 — First-parse side-effect guard

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

## Summary

The first parse of a channel treats every episode as new. That sends one notification and an
auto-download push listing every episode. Skip both when the channel had no stored episodes.
A caller can also suppress side effects for episodes published before a timestamp, which is how
a merge reparse avoids waking listeners about the backlog.

Do not edit channel update, the CSV sync, or merge SQL. This prompt owns
[packages/parser/src/lib/rss/parser.ts](packages/parser/src/lib/rss/parser.ts) around the calls
at lines 417–423, plus the identifier result those calls consume.

## First parse

`handleParsedItems` in [packages/parser/src/lib/rss/item/item.ts](packages/parser/src/lib/rss/item/item.ts)
already loads existing items. Return `hadStoredItems: boolean` on that result
(`existingItems.length > 0` before any insert).

In `parseRSSFeedAndSaveToDatabase`, when `hadStoredItems` is false, do not call
`handleNewItemNotifications` or `handleNewItemAutoDownloadPushes`. Live-item notifications stay
as they are. Remote-item notifications stay as they are.

A later parse that finds a genuinely new episode still notifies, because `hadStoredItems` is
then true.

## Suppress backlog after a merge

Add an optional field on `ParseRSSFeedAndSaveToDatabaseOptions`:

```typescript
suppressNewItemSideEffectsPublishedBeforeMs?: number;
```

When set, remove from `newItemGuids` / `newItemGuidEnclosureUrls` any item whose `pub_date` is
null or earlier than that instant, before the two handlers run. Items published after the
instant still notify and still auto-download.

Look up `pub_date` with the existing item service methods those handlers already use. Do the
filter once, in one helper next to the call site, so the two handlers cannot drift.

Plan 04 passes this timestamp when it enqueues the post-repoint parse. This prompt only adds
the option and honors it. Do not enqueue merges here.

## Tests

Extend the parser tests that already stub `newItemGuids`:

- No stored items, several new guids → neither handler is called.
- Stored items exist, one new guid → both handlers are called (current behavior).
- Cutoff set, one item before it and one after → handlers receive only the later guid.

Do not assert on notification copy or push payloads beyond "called" / "not called".

## Done when

- A channel's first successful parse saves episodes and sends no new-episode notification and
  no auto-download push.
- The second parse of a new episode still does both.
- The cutoff option is on the public parse options type so plan 04 can set it without editing
  the parser again.

## Operator verification

**Root**

```bash
npm run test -w @podverse/parser
```
