# Publisher medium default and namespace proposal draft — copy-pasta

## Execution rules

Phases run in order. Phase 2 starts only after phase 1 has finished. Each phase has one prompt.

| Prompt | Model | Reasoning | Why |
| --- | --- | --- | --- |
| 01 | Cursor Grok 4.7 | medium | One-branch change in one file plus a new unit test file |
| 02 | Cursor Grok 4.7 | medium | Docs and guidance with fixed text; archives the set |

## How to use

1. In the Cursor UI, select the prompt's model and reasoning, paste its fence, and wait for it to
   finish before the next phase.
2. After prompt 02, run the verification it ends with.

**Optional — run the set unattended (Root tab):**
`./scripts/abcplan/run.sh run publisher-medium-and-namespace-draft`. It stops at the first
blocker; resume with `--resume 'Your answer.'`.

**Optional — one chat runs the whole set:** paste
`Orchestrate .llm/plans/active/publisher-medium-and-namespace-draft/ with .cursor/prompts/plan-orchestrator.md.`
(Cursor Grok 4.7 · medium). It stops at the first blocker. Use the prompts below instead when
you want to read each result before the next prompt starts.

## Phase 1

- [x] **01 — Publisher medium default**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/publisher-medium-and-namespace-draft/01-publisher-medium-default.md

Only the maxCount === 0 branch changes. Remote items without a medium still do not count in
mixed feeds. Append the plan's release scratchpad entry. Do not run tests. End without a
verification block; report what changed and anything prompt 02 needs.
```

## Phase 2

- [x] **02 — Namespace proposal folder, draft, and rule**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/publisher-medium-and-namespace-draft/02-podcast-namespace-publisher-draft.md

Write the three new files with the plan's text and add the one rule-index.mdc bullet as a
targeted insertion. Then archive the set per .cursor/skills/plan-completion/SKILL.md: move
.llm/plans/active/publisher-medium-and-namespace-draft/ to .llm/plans/completed/.

Do not run tests. This is the last prompt in the set: end with this cumulative verification for
the operator, labeled Root, in one fenced bash block:

npm run build -w packages/parser-mapping
npm run test -w packages/parser-mapping
npm run test -w apps/workers
npx prettier --check docs/proposals/podcast-namespace packages/parser-mapping/src/compat/partytime/publisher.ts packages/parser-mapping/src/compat/partytime/publisher.test.ts
```
