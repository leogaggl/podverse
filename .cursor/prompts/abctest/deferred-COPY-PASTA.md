# abctestdeferred run {{SET}}

Started by `./scripts/abctest/run.sh deferred`, which copies this template into a fresh set and
runs it with plan-runner: one new agent per step, one step at a time. Every step follows the
**abctestdeferred** skill § Runner steps. Do not paste these prompts into a chat.

When a step stops with a question, nothing else starts. Answer by continuing that same agent:
`./scripts/abctest/run.sh deferred --resume 'Your answer.'`

When the deferred file names an iOS flow, the command exits until Mobile E2E Metro is listening.
In **Mobile E2E Metro**, leave `npm run mobile:dev:e2e` running first.

## Triage

- [ ] **01 — Group the deferred entries**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
You are step 01 of abctestdeferred run {{SET}}. Follow the abctestdeferred skill § Runner steps
and § Queue. Do not run tests or change product or test code in this step.

Read .llm/plans/active/abctestall-deferred.md in full. If it is missing, or names no tests,
delete it, add no steps, and report DONE.

Otherwise group the entries and order the groups as § Queue describes. For each group, insert one
step into .llm/plans/active/{{SET}}/COPY-PASTA.md under the "Groups" heading, above the "Close"
heading. Number them 02, 03, and so on in queue order. Give each step the same three-part shape
as this step: the unticked checkbox line with a bold "NN — <short group name>" title, the same
Cursor model line, then a prompt fenced with three backticks. Each group prompt says, in this
order:
- "You are step NN of abctestdeferred run {{SET}}. Follow the abctestdeferred skill § Runner
  steps and § Resolve."
- "Work only these entries in .llm/plans/active/abctestall-deferred.md:" followed by each entry's
  heading exactly as it appears in that file.
- One sentence on the shared cause you suspect, so the step starts from it.

Do not tick any checkbox. End your final message with the queue you wrote.
```

## Groups

## Close

- [ ] **Close — Deferred summary**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
You are the last step of abctestdeferred run {{SET}}. Do not run tests or change code.

Read every final message this run saved and .llm/plans/active/abctestall-deferred.md. If the file
names no tests, delete it. Write the summary the abctestdeferred skill § Done describes: fixes
(file, cause, code or test, rerun command, result), entries removed, entries still open, and any
question still waiting on the operator.
```
