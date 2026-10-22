# AI Development Guide

Rules for AI coding assistants working on the Podverse monorepo. Lookups (directory layout, where
to find things, package build order, test scripts and infrastructure, the skills list, import
order, service and ORM patterns): [docs/development/AGENTS-REFERENCE.md](docs/development/AGENTS-REFERENCE.md).

Authoritative AI rules and skills: **`.cursor/`**, **`.cursorrules`**. Styles and design tokens:
**styles-source-of-truth**. Contributor policy and plans:
[DOCS-DEVELOPMENT-LLM.md](docs/development/llm/DOCS-DEVELOPMENT-LLM.md) and **llm-cursor-source**.

**Linear SQL migrations and generated `0004_` / `0005_`:** Authoritative forward-only files live under `infra/k8s/base/ops/source/database/linear-migrations/`. The init snapshots `0004_app_linear_baseline.sql.gz` and `0005_management_linear_baseline.sql.gz` are **generated** (plus hand-maintained `0003_apply_linear_baselines.sh`) and include deterministic `linear_migration_history` seed rows — do not hand-edit the gz files; after SQL changes run `make db_regen_linear_baseline` (regenerates both archives), commit them, and use **`/test` on a PR** so the workflow re-verifies. See [docs/operations/database/LINEAR-MIGRATIONS.md](docs/operations/database/LINEAR-MIGRATIONS.md) and [`.cursor/rules/linear-baseline-0004.mdc`](.cursor/rules/linear-baseline-0004.mdc).

## Quick Reference

- Node.js 24+ (`.nvmrc`), npm workspaces, TypeScript strict with no `any`.
- Semicolons, single quotes, 2-space indent.
- Run commands from the monorepo root (`.cursor/rules/commands-from-monorepo-root.mdc`). Build
  packages before apps: `npm run build:packages`.
- Node, npm, and make come from the Nix flake: `.cursor/rules/nix-terminal-wrapper.mdc`.
- After adding, removing, or renaming workspace packages, run `make sync_lockfile`. After adding
  or updating dependencies from a Mac, run `./scripts/development/update-lockfile-linux.sh` and
  commit `package-lock.json` ([LOCKFILE-LINUX.md](docs/development/tooling/LOCKFILE-LINUX.md)).

## Critical Rules

### Environment Variables

**Never set default values in `config/index.ts` files.**

```typescript
// BAD - hides configuration errors
dbHost: process.env.DB_HOST || 'localhost';
dbHost: process.env.DB_HOST ?? '';

// GOOD - fails fast if not configured
dbHost: process.env.DB_HOST!;
```

Config files are the ONE exception where `!` assertions are allowed because validation runs at startup before config is used. Add this eslint-disable at the top:

```typescript
/* eslint-disable @typescript-eslint/no-non-null-assertion -- env vars validated at startup */
```

Every new env var is added to the app's startup validation (`lib/startup/validation.ts`). Never
set a default for `LOG_DIR` (empty means console only; see **logging**). Env file layout:
`.cursor/rules/env-file-formatting.mdc`.

### HTTP / request helpers

Use the shared request helpers for all HTTP calls; do not use raw `fetch()`.

- **Server/Node:** Use `fetchWithTimeout` from `@podverse/helpers-backend` (timeout, cache, body, headers). The only place that may call native `fetch` is inside that helper.
- **Browser/isomorphic:** Use `request` (and optionally `requestWithHeaders`) from `@podverse/helpers-requests`; they return `{ status, data }` and use axios under the hood.

### Logger and errors

Use `logger` from `@podverse/helpers` (`logger.info('Processing feed', { feedUrl })`).

- Don't log expected errors (e.g., 401 for unauthenticated users)
- Include context when logging errors
- Let errors propagate to callers, add context when rethrowing

```typescript
// GOOD - only log unexpected errors
} catch (error) {
  const isExpected = isUnauthorizedError(error)
  if (!isExpected) {
    logger.error('Unexpected auth error', { error })
  }
  return null
}
```

### General

- ❌ Import from package `src/` directly (use `@podverse/package-name`)
- ❌ Add features beyond what was requested (keep changes focused)
- ❌ Create abstractions for one-time operations
- ❌ Use empty strings in catalog `originals/` (i18n: `.cursor/rules/i18n-user-facing-strings.mdc`)
- An interactive control needs an accessible name: `.cursor/rules/screen-reader-accessibility.mdc`

## Testing and Verification

When implementing features or executing plans that touch **api** or **management-api**, include **integration tests** (see api-testing skill). When they touch **web** or **management-web**, include **E2E tests** (see e2e-page-tests skill).

### AI agents: write tests, do not run them

- **Do** add or update tests when the change requires them (see the paragraph above and **feature-implementation-testing**).
- **Do not run** tests during agent or plan work. End with the operator's commands, including the cumulative list on the last COPY-PASTA prompt. See `.cursor/rules/end-with-targeted-make-report-verify.mdc` and `.cursor/skills/response-ending-make-verify/SKILL.md`.
- Test ports, `make test_deps`, E2E setup, and the operator's pre-submit checks are in
  [AGENTS-REFERENCE.md](docs/development/AGENTS-REFERENCE.md).
