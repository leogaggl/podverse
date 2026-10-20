# Plan orchestrator (trial)

The operator pastes one line:

```text
Orchestrate .llm/plans/active/<set>/ with .cursor/prompts/plan-orchestrator.md.
```

This chat runs the set's prompts as subagents, one fresh context each, and stops at the first
thing a person should look at. It does not edit code itself. Cursor Grok 4.7 at medium is enough
for the orchestrator.

## Run

1. Read the set's `COPY-PASTA.md` and `00-EXECUTION-ORDER.md` only. The subagents read the
   numbered plans and the code.
2. For each unchecked prompt, in order, launch one `Task` subagent (`generalPurpose`, foreground)
   with:
   - **model** from the prompt's **Cursor model** line: Cursor Grok 4.7 → `grok-4.7-xhigh-fast`,
     Codex 5.3 → `gpt-5.3-codex-high`, Opus 5.5 → `claude-opus-5-5-high`. When a slug is not in
     this session's subagent model list, stop and ask.
   - **prompt**: the fenced block verbatim, then: "You run under an orchestrator; nobody can
     answer questions mid-turn. Return the files you changed, your self-check results, any
     blocker or open question, and anything a later prompt must know. Only the last prompt in
     the set returns operator verification commands."
   - Notes a later prompt is told to read ("Read 03's final message"): paste that subagent's
     returned notes into the later prompt.
3. Prompts the execution order lets run at the same time may launch together in one message
   only when `00-EXECUTION-ORDER.md` gives them disjoint files. Otherwise run them in sequence.
4. After each subagent, check `git status` against the prompt's stated scope, tick its
   checkbox in `COPY-PASTA.md`, and confirm its plan file moved to `completed/`.

## Stop and report

Stop the run, and do not start the next prompt, when a subagent:

- reports a blocker, an open question, or a self-check failure it could not fix
- changed files outside its prompt's scope
- is next in line and its prompt needs a person (tap, install, Metro switch) or says to stop
  the turn

## Final message

One line per prompt (done, or stopped and why). Then the cumulative verification commands from
the set's last prompt or Close, and the one diff the operator should review first.
