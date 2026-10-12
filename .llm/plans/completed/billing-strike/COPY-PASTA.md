# Billing Strike — COPY-PASTA

**Starts after `billing-prepaid-only` is complete** (that set deletes itself when done).

How to use:

1. Request Strike sandbox access (partners@strike.me) before prompt 06's sandbox walkthrough;
   coding does not need it.
2. Select **Cursor model** and **Reasoning** in the Cursor UI (line above each fence).
3. Copy the fenced block only → paste → agent executes.
4. Tick the checkbox when done; the agent moves the numbered plan to `completed/`.
5. Run nothing until 06 prints the cumulative verification block.

Locked decisions: [00-SUMMARY.md](./00-SUMMARY.md). Order:
[00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).

## Model per prompt

| Prompt | Cursor model | Reasoning | Why this tier |
| ------ | ------------ | --------- | ------------- |
| 01 | Codex 5.3 | high | Schema, env validation, processor id fan-out |
| 02 | Codex 5.3 | high | Webhook signature verification and exact Strike API usage |
| 03 | Codex 5.3 | high | Money path: checkout, settle idempotency, webhook budget, storefront guard |
| 04 | Cursor Grok 4.7 | high | Web checkout UI, polling, i18n, E2E |
| 05 | Cursor Grok 4.7 | high | Mobile invoice panel and store link, following the web panel |
| 06 | Cursor Grok 4.7 | high | Admin UI, operator docs, guidance, wrap-up |

If a **Cursor Grok 4.7** prompt stalls or makes the same mistake twice, rerun it on
**Codex 5.3**.

## Prompts

- [x] **01 — Contracts, schema, and config**

**Cursor model:** Codex 5.3 · **Reasoning:** high

```
Read and execute .llm/plans/completed/billing-strike/01-contracts-schema-config.md
Follow 00-SUMMARY.md and 00-EXECUTION-ORDER.md. Stop if billing-prepaid-only still exists.
Run only make db_regen_linear_baseline and make db_verify_linear_baseline (full permissions).
Do not run tests during agent work; end with the plan's operator commands.
```

- [x] **02 — Strike adapter package** (after 01)

**Cursor model:** Codex 5.3 · **Reasoning:** high

```
Read and execute .llm/plans/completed/billing-strike/02-strike-adapter-package.md
Follow 00-SUMMARY.md and 00-EXECUTION-ORDER.md. Verify the Strike API reference first and list
any difference from the summary at the top of the response.
Do not run tests during agent work; end with the plan's operator commands.
```

- [x] **03 — API, management API, and workers** (after 02)

**Cursor model:** Codex 5.3 · **Reasoning:** high

```
Read and execute .llm/plans/completed/billing-strike/03-api-workers.md
Follow 00-SUMMARY.md and 00-EXECUTION-ORDER.md. Keep OpenAPI in sync with every route change.
Do not run tests during agent work; end with the plan's operator commands.
```

- [x] **04 — Web checkout** (after 03)

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/completed/billing-strike/04-web-checkout.md
Follow 00-SUMMARY.md and 00-EXECUTION-ORDER.md. Do not edit i18n overrides.
Do not run tests during agent work; end with the plan's operator commands.
```

- [x] **05 — Mobile checkout** (after 04)

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/completed/billing-strike/05-mobile-checkout.md
Follow 00-SUMMARY.md and 00-EXECUTION-ORDER.md. Do not edit i18n overrides.
Store binaries link to web checkout. The Lightning invoice is only for the unavailable-billing
build. Do not run tests during agent work; end with the plan's operator commands.
```

- [x] **06 — Management web, docs, guidance, and wrap-up** (after 05)

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/completed/billing-strike/06-management-docs-guidance.md
Follow 00-SUMMARY.md and 00-EXECUTION-ORDER.md. Do not edit i18n overrides.
Re-read the Apple and Google pages named in 00-SUMMARY.md before writing the operator docs.
Do not run tests during agent work. End with the cumulative operator commands for the whole
set, then move the remaining billing-strike files to completed/.
```
