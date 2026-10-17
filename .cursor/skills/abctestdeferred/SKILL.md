---
name: abctestdeferred
description: Resolve every entry in abctestall-deferred.md, remove each one after it passes, and delete the file when empty. Use when the operator invokes abctestdeferred.
---

# `abctestdeferred`

Use this workflow when the operator invokes **`abctestdeferred`**. Work only the entries in
`.llm/plans/active/abctestall-deferred.md` — the failures **abctestall** could not settle. This
invocation overrides the usual "do not run tests during agent work" rule for those entries.
Do not start a full **abctestall** sweep.

## Queue

Read the whole file before editing. If it is missing, say there is nothing deferred and stop.
If it exists and names no tests, delete it and stop.

Group entries that likely share a root cause (same control, same screen, same assertion family,
or the same copy). Order the groups so one fix can clear the most entries. Inside a group, start
with the entry whose evidence is clearest.

## Resolve

Work one group at a time. Read that entry's command, assertion, what was already tried, and the
competing explanations before changing anything. Rerun the command recorded on the entry — the
narrowest one that covers it. The agent runs that command and starts any required services in
its own background shells. Use the same service rules as **abctestall**: inspect listeners
first, and do not kill an unidentified or operator-owned process.

Follow **abce2etestdebug** for how to read one E2E failure, and **mobile-test-economics** for
the two-hypothesis limit on a device assertion. Do not raise timeouts, add retries, weaken
assertions, or accept several outcomes as the first response.

Fix the product code or the test, whichever the evidence supports. Say which you chose and why.
A passing sibling does not clear an entry that was not rerun.

After a change, rerun every entry in the group that the change might have fixed. Remove an
entry from the file only after that rerun passes. Leave the file's other entries in place.

## When you need the operator

Pause when the next step needs the operator: the cause is still ambiguous, the fix is a product
decision, or only they can observe the device, a credential, or a screenshot you cannot read.

Ask in that response. Name the competing explanations, what would distinguish them, and the
exact observation or action you need. Keep the unresolved entry in the file.

Continue other entries that do not depend on the answer. If the answer would change the shared
cause or the order of the remaining queue, stop the queue until they answer. Do not append a
new deferral, and do not delete an unresolved entry.

A Maestro exit **78** is an environment block. Pause the mobile entries and ask. Do not start
the next mobile flow on a device that failed to recover.

## Done

When no test entries remain, delete `.llm/plans/active/abctestall-deferred.md`.

Summarize fixes (file, cause, code or test, rerun command, result), entries removed, entries
still open, and any question waiting on the operator. Do not call an entry fixed until its
post-fix rerun has passed.
