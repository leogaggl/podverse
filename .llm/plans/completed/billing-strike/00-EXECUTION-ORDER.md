# Billing Strike — execution order

Locked decisions: [00-SUMMARY.md](./00-SUMMARY.md). Prompts and model per prompt:
[COPY-PASTA.md](./COPY-PASTA.md).

**Prerequisite:** `.llm/plans/**/billing-prepaid-only/` no longer exists (that set deletes
itself when done). If it still exists, stop and tell the operator.

## Order

| # | Plan | Layer | Depends on |
| -- | ---- | ----- | ---------- |
| 01 | [01-contracts-schema-config.md](./01-contracts-schema-config.md) | helpers id, helpers-config env, `0014` SQL, ORM session, product constants, secret generator | — |
| 02 | [02-strike-adapter-package.md](./02-strike-adapter-package.md) | `packages/external-services-strike` | 01 |
| 03 | [03-api-workers.md](./03-api-workers.md) | API routes, webhook, storefront guard, reconcile, ensure-webhook command, OpenAPI, tests | 01, 02 |
| 04 | [04-web-checkout.md](./04-web-checkout.md) | web checkout UI, consumer i18n, web E2E | 03 |
| 05 | [05-mobile-checkout.md](./05-mobile-checkout.md) | FOSS in-app invoice, store link-out, mobile unit test, Maestro assertion | 03, 04 |
| 06 | [06-management-docs-guidance.md](./06-management-docs-guidance.md) | management-web, setup doc, sandbox doc, rules, final verify | 05 |

Run strictly in order. 06 is last because it prints the cumulative verification block and
archives the set.

## Every prompt

- Read `00-SUMMARY.md` first; it wins over the plan on conflict.
- Follow the `billing-one-time-purchases` and `billing-processor-adapters` rules.
- Server HTTP goes through `fetchWithTimeout` from `@podverse/helpers-backend`; browser and
  mobile calls through `@podverse/helpers-requests`.
- No secrets in ConfigMaps, `.env.example` values, logs, or responses.
- Comments are future-forward; no plan references.
- Do not run tests, lint, or builds. 01 is the one exception: it runs the linear baseline
  regeneration and verification required by **linear-sql-greenfield-only**.
- When a prompt is done: tick it in COPY-PASTA.md and move its plan to
  `.llm/plans/completed/billing-strike/`. 06 moves the remaining files.
- End with the plan's operator commands labeled with a `.vscode/terminals.json` tab name.
