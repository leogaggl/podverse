# Execution order

Context and the review table: [00-SUMMARY.md](./00-SUMMARY.md). Prompts:
[COPY-PASTA.md](./COPY-PASTA.md).

Before 01, the operator fills the **Decision** column in `00-SUMMARY.md`. Neither prompt changes
a row left blank.

| Phase | Prompt | Parallel | Why this order |
| --- | --- | --- | --- |
| 1 | 01 | No | Scopes rules and adds the index. 02's pointers name rules by their final scope. |
| 2 | 02 | No | Dedupes `.cursorrules` and `AGENTS.md`, then closes the set. |

## File ownership

| Prompt | Owns |
| --- | --- |
| 01 | `.cursor/rules/*.mdc` rows marked in the review table, new `.cursor/rules/rule-index.mdc`, new mobile terminals rule split from `vscode-terminals-commands.mdc`, `.cursor/rules/CURSOR-RULES.md` |
| 02 | `.cursorrules`, `AGENTS.md`, the set's archive |

Guidance-only changes: no code, no release-notes scratchpad entry.

## Model choices

| Prompt | Model | Reasoning | Why |
| --- | --- | --- | --- |
| 01 | Cursor Grok 4.7 | high | Frontmatter and text moves against an explicit table |
| 02 | Cursor Grok 4.7 | high | Text dedupe; must not drop guidance no rule carries |
