---
name: abcreleasenotes
description: Turn release-notes/scratchpad.md entries into the GitHub, store, and web release notes for the current version, then empty the scratchpad. Use when the operator says abcreleasenotes, or before a staging sync or a mobile store build when the scratchpad has entries.
---

# abcreleasenotes

The scratchpad is the raw record; release notes are what a reader of each audience gets. This
skill decides, for every scratchpad entry, which notes it belongs in, writes those notes, and
empties the scratchpad in the same change.

How entries get into the scratchpad: **release-notes-scratchpad** rule.

## Files

The formal version is the root `package.json` version with any `-suffix` removed (`5.5.3`).

| File | Audience | Limits | Required by |
| --- | --- | --- | --- |
| `release-notes/scratchpad.md` | Agents | — | Must exist and be blank for the staging sync and store builds |
| `release-notes/X.Y.Z.md` | GitHub release (developers, self-hosters, operators) | At most six bullets | Staging sync, preflight, main sync |
| `release-notes/mobile/X.Y.Z.md` | App Store and Play (regular users) | At most four bullets, 500 characters | Store build and submit |
| `release-notes/web/X.Y.Z.md` | Web users | At most six bullets | Nothing yet; the web app does not display it |

Optional store overrides `release-notes/mobile/X.Y.Z.ios.md` and `.android.md` follow
**release-notes-suggest**.

Each version file is updated in place across every staging cut and store build of that version.
It already holds what earlier cuts shipped. Add to it; do not start a new file for a staging tag.

## Steps

1. **Read the scratchpad.** If it is blank and the operator did not ask for a draft, report that
   there is nothing to convert and stop.
2. **Check each entry against the code** when an entry is vague. Read the diff or the commit it
   names. Never write a note the change does not support.
3. **Sort each entry** into one or more destinations, or none:
   - **Store notes:** a mobile app user would notice or benefit. Plain words, benefit first.
   - **Web notes:** a web user would notice or benefit. Plain words, benefit first.
   - **GitHub notes:** everything a store or web note says, plus server behavior, API contract
     changes, and operator steps (env vars, migrations, GitOps keys). Short operator notes.
   - **None:** tests, refactors with no behavior change, tooling, CI, docs, abcmemory, plans, and
     internal config nobody running the software must act on.
4. **Write the notes.** Merge with the bullets already in each version file. Combine related
   bullets, lead with what that audience cares about most, and stay inside the limits above.
   When a file would go over its limit, drop the least important bullet rather than cramming.
   Remove a bullet an entry now contradicts (a later fix replaced it).
5. **Empty the scratchpad** to zero bytes. Do not leave a heading, a comment, or a placeholder.
6. **Report** in one short list: each entry and where it went, or that it was dropped and why.
   Then give the operator the commit (fish-safe; **operator-only-git-operations**):

```bash
git add release-notes
git commit -m 'Write release notes for X.Y.Z from the release scratchpad.'
git push
```

The commit belongs on the branch the release is cut from (`develop` for a staging sync). The
staging sync checks the scratchpad on `develop`, not on a feature branch.

## Drafting without a scratchpad

When the scratchpad is blank but the operator asks for notes (or work landed before the
scratchpad existed), draft from the commits since the last staging tag of this version, or since
the last formal tag when there is none:

```bash
LAST_TAG="$(git tag --list --sort=-v:refname | rg '^[0-9]+\.[0-9]+\.[0-9]+(-staging\.[0-9]+)?$' | head -1)"
git log --no-merges --format='%h %s' "$LAST_TAG"..HEAD
```

Treat each commit as a scratchpad entry and run steps 2 to 6.

## Don't

- Don't paste scratchpad text verbatim. It is more detailed than any audience needs.
- Don't put internals, ticket numbers, or plan names in store or web notes.
- Don't put the GitHub file into a store, or the store file into GitHub, unless they are
  intentionally the same.
- Don't run the staging sync, a store build, or `git commit` yourself.
