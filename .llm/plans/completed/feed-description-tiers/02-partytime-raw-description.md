# 02 — Partytime raw description

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

## Summary

Partytime collapses line breaks and repeated spaces in `<description>` (`sanitizeNewLines`,
`sanitizeMultipleSpaces`). Plain-text show notes lose their paragraphs before Podverse sees
them. Add an additive `descriptionRaw` field that keeps the source text's whitespace. Do not
change `description`; other consumers depend on it.

This prompt works in the Partytime repo: `/Users/mitcheldowney/repos/pv/partytime`. Do not edit
the Podverse repo. Follow that repo's `AGENTS.md`. Do not run `npm publish`, `git push`, or the
release script.

The field name `descriptionRaw` is locked. Podverse 04 reads it.

## Item — `src/parser/item.ts`

Add `getDescriptionRaw(item)`. It returns `{ descriptionRaw }` with the text of the first
`<description>` node that has a value (`firstWithValue(item.description)` then `getText`).
Trim leading and trailing whitespace only. Return `undefined` when empty. Spread it in
`handleItem` next to `getDescription`.

`descriptionRaw` comes from `<description>` only. `content` (`content:encoded`) and `summary`
are already exposed raw.

## Feed — `src/parser/feed.ts`

Add `getDescriptionRaw(feed)`, which follows the same fallback chain as the existing
`getDescription(feed)`: `<description>`, then `itunes:summary`, then subtitle /
`itunes:subtitle`. Each step uses raw text, trimmed only. Spread `...getDescriptionRaw(feed)`
in `handleFeed`.

## Types — `src/parser/types.ts`

- `Episode.descriptionRaw?: string`, with a doc comment: the `<description>` text with its
  original line breaks. Prefer `description` unless you need whitespace.
- `BasicFeed.descriptionRaw?: string`, with the same comment and the fallback chain.

## Tests

In `src/parser/__test__/item.test.ts` and `feed.test.ts`, add one fixture with a multi-line
plain-text `<description>` (blank line between paragraphs, single line breaks inside). Also add
one fixture with HTML inside CDATA. Assert:

- `description` is unchanged (still collapsed).
- `descriptionRaw` keeps the line breaks.
- `descriptionRaw` is absent when the feed has no `<description>`.
- Feed fallback: `itunes:summary` only, with line breaks, gives `descriptionRaw` with breaks.

Use the existing fixture helpers in `src/parser/__test__/helpers.ts`.

## Release notes

Write `release-notes/5.2.0.md` in the Partytime repo, in the same shape as `5.1.0.md`:

```markdown
## 5.2.0

### Added

- `descriptionRaw` on items and on the feed: the description text with its original line
  breaks and spacing. `description` is unchanged and still collapses whitespace.
```

## Done when

- `description` output is byte-identical for every existing test.
- Lint passes on touched files (operator runs it).

## Operator verification

From the Partytime repo root:

```bash
npm test
```

## Operator release, then the Podverse bump (before phase 3 deploys)

Partytime: run from the Partytime repo root on `develop`, after `npm whoami` succeeds. Commit
first, then release. The script needs the release-notes file above.

```bash
git add src/parser/item.ts src/parser/feed.ts src/parser/types.ts src/parser/__test__ release-notes/5.2.0.md
git commit -m 'Add descriptionRaw to items and feed.'
./scripts/publish/release.sh 5.2.0
```

Podverse: **Root** tab, from the Podverse repo root.

```bash
npm install podverse-partytime@^5.2.0 -w packages/parser
./scripts/development/update-lockfile-linux.sh
```

The lockfile script deletes every `node_modules` tree. When it finishes, run this in **Root**:

```bash
rm -rf node_modules && npm install
```

And this in **Mobile**:

```bash
npm run mobile:install
```
