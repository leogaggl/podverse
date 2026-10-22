---
name: abconeatatime
description: Walk the operator through every open question left in the session, one at a time, then confirm before finishing the work. Use when the operator runs /abconeatatime or says abconeatatime.
---

# `abconeatatime`

The operator wants the session's remaining decisions settled one at a time, not as a wall of
questions. Ask one, wait for an answer, then ask the next. Finish the work only after every item is
resolved and the operator says to go ahead.

## Gather the open items

Collect everything still undecided or unfinished in this session:

- Questions you or an earlier step asked that have no answer yet
- Choices a plan, a planning step, or a final message marked as "you may want to reverse"
- Blocked runs (plan-runner `RUNNER-STATUS: BLOCKED`), deferred entries, and unfinished todos
- Conflicts or known gaps that someone has to settle before the work can finish

Read-only research is fine here (plan files, final messages in `.artifacts/plan-runner/`). Make no
edits while gathering or asking.

Start with one short line: how many items there are and a few words naming each, in the order you
will ask them. Put blocking items first, then items that later answers depend on.

## Ask one at a time

For each item:

1. Say in a sentence or two what is undecided and what each answer changes.
2. Ask with `AskQuestion` when there are obvious options. Put the recommended option first and add
   "(Recommended)" to its label. Mark only one option recommended; if none stands out, say so.
3. Stop the turn and wait for the reply.
4. When the reply is unclear, partial, or raises a new question, follow up on the same item before
   moving on. An item is resolved only when you could act on the answer without guessing.
5. Confirm the answer in one line, then ask the next item.

New open items that come up from an answer join the end of the list. Say so when one is added.

## Before finishing the work

When every item is resolved:

1. List each item with its decision, one line each.
2. Say what you will do to finish the session's work (files, plans, commands).
3. Ask whether to proceed, and wait. Do the work only after the operator says yes.

Then finish the work, following the repo's usual rules: no tests run by the agent, a verification
block at the end, and git or publish commands left to the operator.
