---
name: abcagentoptimize
description: Review how agent work on plans is going and recommend changes that make it faster without lowering quality. Use when the operator runs /abcagentoptimize or says abcagentoptimize.
---

# `abcagentoptimize`

The goal is shorter plan work at the same quality. Speed comes from fewer tool calls, fewer
operator round trips, and less context per request — never from skipping verification, tests a
plan requires, or the model tier a prompt names.

## Inputs

- **Speed-up log** — `agent-optimize/LOG.md` in the operator's personal agent store (path in
  the session's agent-store list). Agents append ideas there during normal work
  (**abcmemory-vocabulary**). Create the file if it is missing.
- **Active trials** — the log's **Trials** section says which plan sets used which trial.
- **Transcript metrics** — run the script from the repo root. Pass `--since` with the last run's
  date and one `--root` per folder open in the window:

```bash
python3 .cursor/skills/abcagentoptimize/transcript_metrics.py --since 2026-10-19 --root . --root ../metaboost --json
```

The script counts plan turns (queries that start from `.llm/plans/active/`), tool calls,
same-turn re-reads, how often agents ran checks, debug round trips (pasted terminal output plus
debug or fix), and the always-on guidance size per root. Turns whose prompt names
`plan-self-check` or `plan-orchestrator` are reported separately so trials can be compared.
Subagent transcripts are included, so orchestrated prompts count as plan turns.

## What to compare

| Metric                        | Lower is better because                                 |
| ----------------------------- | ------------------------------------------------------- |
| Tool calls per plan turn      | Each call is a model round trip                         |
| Same-turn re-reads            | Usually context pressure or paging through a large file |
| Reads/searches per edit       | Exploration the plan could have answered                |
| Debug turns per plan turn     | Each is an operator run, paste, and wait                |
| Always-on bytes in the window | Sent with every request in that window                  |
| Top guidance reads            | A skill read every turn may belong inline in the prompt |

A trial is working when its plan turns show fewer debug round trips afterward without a jump in
regressions the operator reports.

## Output

A short ranked list. For each item: the change, significance (high, medium, low), the main
trade-off, and yes / trial / no. Ask with AskQuestion only where the operator's goals decide it.
Prefer removing or scoping guidance over adding it. Say plainly when a past trial should end.

## After the operator picks

Apply chosen guidance changes through the **abcremember** process. Then append a dated **Run**
entry to the log: the metrics JSON, decisions made, and trials started or ended. Remove log ideas
that were applied or rejected so the next run starts from open items.

## Levers already known

- **Window scope** — a multi-root window loads every root's always-on rules. Plan work in a
  window with only the repo it changes.
- **Self-check trial** — [plan-self-check](/.cursor/prompts/plan-self-check.md) lets a prompt run
  scoped type-check and unit tests before handing back.
- **Orchestrator trial** — [plan-orchestrator](/.cursor/prompts/plan-orchestrator.md) runs a
  sequential set as subagents in one chat.
- **Plan runner** — the sibling `plan-runner` repo runs a whole COPY-PASTA set with the Cursor
  SDK, one agent per prompt on that prompt's model, and stops at the first blocker
  (**copy-pasta-recommend-model** § Plan runner).
- **Verification once per set** — intermediate prompts carry no operator test commands; the
  operator tests after the last prompt (**response-ending-make-verify** § Plan sets).
- **Large files** — **large-file-reading** sends agents to Grep instead of paging.
- **Reasoning depth** — each Cursor Grok 4.7 prompt runs at the lowest reasoning that reliably
  completes it, with Fast off (**copy-pasta-recommend-model** § Reasoning). A prompt that needed
  a rerun one level up is a signal its kind of work is under-leveled.
- **Test sweeps** — **abctestall**, **abcsmoketest**, and **abctestdeferred** run under
  plan-runner through `scripts/abctest/run.sh`, one fresh agent per tier or per deferred group.
- **Large requests** — **abcplan** plans and implements under plan-runner through
  `scripts/abcplan/run.sh`, so no single chat holds the whole request. Both runs pass
  `--parallel`: planning areas run in waves, and implementation phases hold only prompts that
  edit disjoint files.
- **Decision review** — the abcplan Review step collects planner decisions once, before Close, so
  the set is not reassembled for each correction.
- **Scoped planning reads** — planning steps grep `## Notes for later prompts` and read full
  messages and plans only for their named dependencies.
- **Fixed plan sections** — `## Rows`, `## Runs after`, `## Files`, `## Tests`, and
  `## Release scratchpad` let Close grep instead of rereading every plan.
- **One change per plan** — replaced the 300-line limit, so plans are not trimmed or split only
  to fit a length.
- **Always-on size** — scope domain rules to globs or descriptions; keep an index of triggers.
  `AGENTS.md` stays under 8 KB, with lookups in `docs/development/AGENTS-REFERENCE.md`; vocabulary
  entries stay at one or two lines, with domain terms in **domain-terms**.
