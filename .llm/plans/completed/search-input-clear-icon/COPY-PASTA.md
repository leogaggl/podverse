# Clear X in search and filter inputs — COPY-PASTA

How to use:

1. Select **Cursor model** and **Reasoning** in the Cursor UI (the line above each fence).
1. Copy the fenced block only, paste, and the agent runs it.
1. Tick the box when that prompt is done.

Request and settled review answers (D1–D6): [00-REQUEST.md](./00-REQUEST.md). Ledger and
decisions: [00-SUMMARY.md](./00-SUMMARY.md). Order and file ownership:
[00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).

**Optional — run the set unattended (Root tab, in this worktree):**
`./scripts/abcplan/run.sh run search-input-clear-icon`. It runs one fresh agent per prompt on that
prompt's model, stops at the first blocker, and resumes with
`./scripts/abcplan/run.sh run search-input-clear-icon --resume 'Your answer.'`. The script passes
`--parallel`, but each phase here holds one prompt, so the prompts run one after the other.

**Optional — one chat runs the whole set:** paste
`Orchestrate .llm/plans/active/search-input-clear-icon/ with .cursor/prompts/plan-orchestrator.md.`
(Cursor Grok 4.7 · medium). It stops at the first blocker. Use the prompts below instead when
you want to read each result before the next prompt starts.

Phases run in order.

| Phase | Prompts | Model and reasoning | Why |
| --- | --- | --- | --- |
| 1 | 10 | Cursor Grok 4.7 extra high | Shared `@podverse/ui` contract (`TextInput` clear button, required `TableFilterBar` props, `clearSearch` timing) every web and management table uses |
| 2 | 20 | Cursor Grok 4.7 high | Pattern-following mobile UI with a precise plan; also closes the set |

Fast stays off.

If a prompt stalls or makes the same mistake twice, rerun it one reasoning level higher (after
extra high, **Codex 5.3 · high**), and record the change on the prompt here.

## Phase 1

- [x] **10 — In-field clear X for web and management-web search and filter inputs**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/search-input-clear-icon/10-web-input-clear-x.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D1: new Clear Search and
Clear Filter labels; D2: the management filter clears at once; D3: Find Feed gets no X; D5: the
X keeps the field focused).
misc.clear_search and misc.clear_filter in the shared catalog layer, and TextInput's clearButton,
are what prompt 20 builds on; keep the key paths exactly as the plan states. Catalog originals
take targeted insertions and removals only. Do not edit overrides and do not run
npm run i18n:compile. Do not edit apps/mobile or the consumer catalog.
Do not run tests. Append the plan's release scratchpad entry to release-notes/scratchpad.md.
When the plan is done, move 10-web-input-clear-x.md to
.llm/plans/completed/search-input-clear-icon/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 2

- [x] **20 — X inside mobile search and list filter fields; then close the set**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/search-input-clear-icon/20-mobile-search-filter-clear.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D1: the shared Clear
Search and Clear Filter labels; D4: 18pt icon, 44pt touch area, same pill height; D5: the X
refocuses the field; D6: clearing Search drops the search in progress).
Build on prompt 10's shared keys misc.clear_search and misc.clear_filter; only read them. If the
key paths differ from your plan, use .artifacts/plan-runner/search-input-clear-icon/10.md. Do not
edit packages/ui, apps/web, apps/management-web, or the shared, management, or mobile catalogs.
The consumer catalog originals take the two targeted key removals your plan names only. Do not
edit overrides and do not run npm run i18n:compile.
Edit the guidance files with targeted replacements only.
Do not run tests. Append the plan's release scratchpad entry to release-notes/scratchpad.md
after prompt 10's entry.

Then close the set. Move 20-mobile-search-filter-clear.md to
.llm/plans/completed/search-input-clear-icon/ and confirm 10-web-input-clear-x.md is there.
Move 00-REQUEST.md, 00-SUMMARY.md, 00-EXECUTION-ORDER.md, and COPY-PASTA.md there, and remove
the empty active directory.

End with the cumulative verification for the whole set, assuming no earlier prompt was tested.
One fenced bash block per tab, fish-safe, labeled with the tab name, all run in the
../podverse_feature_search_input_clear_icon worktree. Tell the operator that Docker must be
running for the web reports, and that for the Mobile Maestro block Mobile E2E Metro, Mobile E2E
API, and Mobile E2E iOS or Mobile E2E Android must be running from the worktree. Do not put
leave-running commands in the blocks. Tell the operator that npm run i18n:compile rewrites the
shared, management, and consumer override files, and that those changes are committed with the
set. No dependency changed, so there is no lockfile step. Add any spec or unit test the set
created that the list below misses (check git status).

Root:
npm run i18n:compile
npm run i18n:validate
npm run build:packages
npm run lint
npm run type-check
npm run test -w packages/ui
make e2e_test_report_scoped WEB_SPEC=e2e/podcasts-subscribed-filter.spec.ts,e2e/search-page.spec.ts MGMT_SPEC=e2e/workers-page.spec.ts
open .artifacts/e2e-reports/latest/index.html

Mobile Maestro:
npm run mobile:e2e:test -- home,search,subscriptions-anonymous
open .artifacts/mobile-e2e-reports/latest/failures.json
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
```
