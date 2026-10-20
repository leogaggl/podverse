# 01 — Scope domain rules and add the rule index

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

## Summary

Apply the rows of the review table in `00-SUMMARY.md` whose **Decision** is `approve` or a
written change. Skip rows that are blank or `keep`. If every row is blank, stop and tell the
operator the table has not been reviewed yet.

## Before

Record the starting size:

```bash
python3 .cursor/skills/abcagentoptimize/transcript_metrics.py --root .
```

## Scope a rule

For each approved row in the first table:

1. Set `alwaysApply: false` and add the globs from the row, or the operator's change, as a YAML
   list of double-quoted strings, matching the frontmatter style of
   `.cursor/rules/large-file-reading.mdc`.
2. Confirm each glob matches at least one tracked file:
   `rg --files -g '<glob>' | head -3`. Replace a glob that matches nothing with the closest one
   that does, and note the change in your final message.
3. Leave the rule body unchanged, except for wording that only makes sense always-on ("in every
   response"). Keep its `description` and make sure it names the trigger.

## Trim a rule that stays always-on

For each approved row in the second table:

- **vscode-terminals-commands.** Create `.cursor/rules/vscode-terminals-mobile.mdc` with globs
  `apps/mobile/**` and `scripts/mobile/**`. Move the mobile tab map, the CarPlay / device log
  streaming section, and the Expo CLI section there unchanged. The always-on file keeps the
  rule to name a tab, "How to present", the non-mobile tabs line, and one line pointing at the
  new rule for mobile tabs.
- **commands-from-monorepo-root.** Keep the opening rule, Do/Don't, the root-only list, and the
  root-only vs workspace table. Move the worked examples and the EAS paragraph into the
  `build-order` skill (examples) and the new mobile terminals rule (EAS). Nothing is deleted,
  only moved.
- **end-with-targeted-make-report-verify.** Keep items 0–4 and the preferred commands. Remove
  sentences that repeat `response-ending-make-verify` word for word and point to that skill.

## Rule index

Create `.cursor/rules/rule-index.mdc`, always-on, under 1,500 bytes:

```markdown
---
description: Scoped rules to open before answering when no matching file is in context
alwaysApply: true
---

# Scoped rule index

These rules load when their files are read. Open the rule first when the task matches but no
file of theirs is in context.

- Store build or submit steps, EAS, store identity → `mobile-store-builds-on-demand`,
  `mobile-next-store-identity`
- ...one line per scoped rule or group...
```

Every rule scoped in this prompt appears in exactly one line. Write each trigger as the task the
operator would ask for, not the file path.

## Index and pointers

- Update `.cursor/rules/CURSOR-RULES.md` if it lists always-on rules.
- Search `.cursor/skills/**` and `.cursorrules` for wording that calls a scoped rule
  "always-applied" and correct it.

## After

Run the metrics command again and put both sizes in your final message.

## Done when

- [x] Every approved row applied; blank and `keep` rows untouched
- [x] Every glob matches at least one file
- [x] `rule-index.mdc` names every scoped rule
- [x] Mobile terminals split, commands trim, verify trim (when approved)
- [x] Before and after sizes reported
- [x] `01-scope-domain-rules.md` moved to `.llm/plans/completed/always-on-rule-trim/`

## Operator verification

**Root**

```bash
npm run prettier:check
git diff --stat .cursor/rules
```
