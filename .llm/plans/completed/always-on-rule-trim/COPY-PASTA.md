# Always-on rule trim — COPY-PASTA

How to use:

1. Fill the **Decision** column in [00-SUMMARY.md](./00-SUMMARY.md) first. Blank rows are not
   changed.
2. Select **Cursor model** and **Reasoning** in the Cursor UI (the line above each fence).
3. Copy the fenced block only, paste, and the agent runs it. Tick the box when it is done.

Work this set in a window with only podverse open, so the before and after sizes measure what
podverse loads on its own.

**Optional — one chat runs the whole set:** paste
`Orchestrate .llm/plans/active/always-on-rule-trim/ with .cursor/prompts/plan-orchestrator.md.`
(Cursor Grok 4.7 · medium). It stops at the first blocker. Use the prompts below instead when
you want to read 01's result before 02 starts.

## Model per prompt

| Prompt | Cursor model | Reasoning | Why this tier |
| --- | --- | --- | --- |
| 01 | Cursor Grok 4.7 | high | Frontmatter and text moves against an explicit table |
| 02 | Cursor Grok 4.7 | high | Text dedupe that must not drop guidance; closes the set |

## Phase 1

- [x] **01 — Scope domain rules and add the rule index**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/always-on-rule-trim/01-scope-domain-rules.md
Follow 00-EXECUTION-ORDER.md. Apply only review-table rows marked approve or changed.
Every scoped rule gets one line in rule-index.mdc. Move text; never delete guidance.
Guidance files only: no code, no scratchpad entry. End with the plan's operator commands.
When the plan is done, move 01-scope-domain-rules.md to
.llm/plans/completed/always-on-rule-trim/.
```

## Phase 2

Start only after 01 is done.

- [x] **02 — Dedupe `.cursorrules` and `AGENTS.md`, close the set**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/always-on-rule-trim/02-dedupe-root-guidance.md
Follow 00-EXECUTION-ORDER.md. Apply only root-file rows marked approve or changed.
Replace repeated text with the rule name and path; keep anything no rule carries.
Then close the set as the plan describes, log the sizes, and end with the cumulative
verification.
```
