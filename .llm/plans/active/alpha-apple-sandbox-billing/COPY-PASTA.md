# Alpha Apple sandbox billing — COPY-PASTA

How to use:

1. Select **Cursor model** and **Reasoning** in the Cursor UI (line above each fence).
2. Copy the fenced block only, paste, and the agent runs it.
3. Tick the box when that prompt is done. The agent moves the numbered plan to `completed/`.

Decisions: [00-SUMMARY.md](./00-SUMMARY.md). Order and rules:
[00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).

Start 03 early. The build takes the longest and does not depend on 01 or 02.

## Model per prompt

| Prompt | Cursor model | Reasoning | Why this tier |
| ------ | ------------ | --------- | ------------- |
| 01 | Cursor Grok 4.7 | medium | Operator walkthrough, no code |
| 02 | Cursor Grok 4.7 | high | Env edits plus cluster reads; every command must keep `--context al` |
| 03 | Cursor Grok 4.7 | medium | Operator build steps |
| 04 | Cursor Grok 4.7 | high | Reads billing logs and judges the result |

If a prompt stalls or makes the same mistake twice, rerun it on **Codex 5.3**.

## Prompts

- [ ] **01 — App Store Connect setup** — operator clicks; the agent guides

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/alpha-apple-sandbox-billing/01-app-store-connect.md
Follow 00-EXECUTION-ORDER.md. Walk me through each step one at a time and wait for my
screenshot or reply before the next. Do not change any file.
```

- [ ] **02 — Alpha product mapping** — operator commits, pushes, restarts, and maps products

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/alpha-apple-sandbox-billing/02-alpha-mapping-and-allowlist.md
Follow 00-EXECUTION-ORDER.md. Every kubectl command keeps --context al. Edit the three
env files and the alpha doc, then give me fish-safe git and kubectl commands and stop
this turn. When I reply that products are mapped in management web, run the checks in
section 3 and report.
```

- [ ] **03 — iOS build with store billing** — operator changes EAS env, builds, submits

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/alpha-apple-sandbox-billing/03-ios-store-billing-build.md
Follow 00-EXECUTION-ORDER.md. Check git status in the Podverse repo, then give me the
steps and Mobile tab commands. Do not run eas or make mobile_eas_* yourself.
```

- [ ] **04 — Purchase on the iPhone** — operator buys; the agent checks the server

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/alpha-apple-sandbox-billing/04-device-purchase-check.md
Follow 00-EXECUTION-ORDER.md. Give me the device steps and stop this turn. When I reply
that the purchase finished, read the alpha API logs and report against "Done when".
Do not print tokens or signed payloads. When this prompt is done, archive the whole
alpha-apple-sandbox-billing directory to completed/.
```
