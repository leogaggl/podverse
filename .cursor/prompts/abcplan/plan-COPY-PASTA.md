# abcplan planning run {{SET}}

Started by `./scripts/abcplan/run.sh plan {{PLAN}}`, which copies this template into a fresh set
and runs it with plan-runner in parallel: one new agent per step, every pending step under the
first pending `##` heading at once. Every step follows the **abcplan** skill § Planning steps. Do
not paste these prompts into a chat.

The request is `.llm/plans/active/{{PLAN}}/00-REQUEST.md`. The steps write the plan set in
`.llm/plans/active/{{PLAN}}/`; step 01 adds the area waves below.

When a step stops with a question, the other steps under its heading still finish, and nothing
under the next heading starts. The question appears once they have all finished. Answer by
continuing that agent: `./scripts/abcplan/run.sh plan {{PLAN}} --resume 'Your answer.'`. Each
`--resume` goes to the oldest waiting step; a second question prints after the first step
finishes. `--clear` drops every waiting step, so use it only after finishing them by hand.

## Split

- [ ] **01 — Split the request into areas**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
You are step 01 of abcplan planning run {{SET}}. Follow .cursor/skills/abcplan/SKILL.md § Planning steps and
§ Split. The plan set is .llm/plans/active/{{PLAN}}/.

Read .llm/plans/active/{{PLAN}}/00-REQUEST.md in full. Look at the code only as far as grouping
the rows into areas and waves needs; the area steps do the detailed research.

Write .llm/plans/active/{{PLAN}}/00-SUMMARY.md with the requirement ledger, one list item per
row, and the areas. Then, in .llm/plans/active/{{SET}}/COPY-PASTA.md, replace the "Area plans"
heading with one "Area plans — wave N" heading per wave, above the "Review" heading, and insert
one step per area under its wave as § Split describes. Each step's prompt names the steps it
depends on. Do not tick any checkbox.

End your final message with the ledger row count, the waves with their areas, rows and models,
and the dependencies you chose.
```

## Area plans

## Review

- [ ] **Review — Planner decisions**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
You are the review step of abcplan planning run {{SET}}. Follow .cursor/skills/abcplan/SKILL.md § Planning
steps and § Decision review. The plan set is .llm/plans/active/{{PLAN}}/.

Grep the "## Decisions" section of every area step's final message in
.artifacts/plan-runner/{{SET}}/. Collect them into "## Decisions to review" in 00-SUMMARY.md.
If every list is "none", report DONE. Otherwise report
RUNNER-STATUS: BLOCKED — review planner decisions, with the list in your final message.

When the operator resumes you with answers, follow § Revising after operator review for the
first planning pass: answers under "### Review of the first planning pass" in 00-REQUEST.md, and
steps under "## Second pass after the first review" above the "Assemble" heading. Tick nothing.
```

## Assemble

- [ ] **Close — Assemble the plan set**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
You are the last step of abcplan planning run {{SET}}. Follow .cursor/skills/abcplan/SKILL.md § Planning steps
and § Assemble. The plan set is .llm/plans/active/{{PLAN}}/.

Read 00-REQUEST.md and 00-SUMMARY.md. Grep "## Rows", "## Runs after", and "## Files" from every
numbered plan, and open a full plan only to settle a file conflict, a missing row, or an ordering
question. Fill the ledger's Plan entries, then write COPY-PASTA.md and 00-EXECUTION-ORDER.md for
the set, with prompts sharing a phase only when their files are disjoint.

End with the phases, the open questions, and the command
./scripts/abcplan/run.sh run {{PLAN}}
```
