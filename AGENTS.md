# AI Development Guide

This document provides rules and patterns for AI coding assistants working on the Podverse monorepo. It consolidates critical information that helps AI tools generate correct, consistent code.

### LLM / editor guidance (read early)

Authoritative AI rules and skills: **`.cursor/`**, **`.cursorrules`**. **Styles / design tokens** (SCSS, themes): [`.cursor/skills/styles-source-of-truth/SKILL.md`](.cursor/skills/styles-source-of-truth/SKILL.md). Contributor policy and plans: [docs/development/llm/DOCS-DEVELOPMENT-LLM.md](docs/development/llm/DOCS-DEVELOPMENT-LLM.md) and [`llm-cursor-source`](.cursor/skills/llm-cursor-source/SKILL.md).

**Linear SQL migrations and generated `0004_` / `0005_`:** Authoritative forward-only files live under `infra/k8s/base/ops/source/database/linear-migrations/`. The init snapshots `0004_app_linear_baseline.sql.gz` and `0005_management_linear_baseline.sql.gz` are **generated** (plus hand-maintained `0003_apply_linear_baselines.sh`) and include deterministic `linear_migration_history` seed rows — do not hand-edit the gz files; after SQL changes run `make db_regen_linear_baseline` (regenerates both archives), commit them, and use **`/test` on a PR** so the workflow re-verifies. See [docs/operations/database/LINEAR-MIGRATIONS.md](docs/operations/database/LINEAR-MIGRATIONS.md) and [`.cursor/rules/linear-baseline-0004.mdc`](.cursor/rules/linear-baseline-0004.mdc).

## Quick Reference

| Item            | Value                                              |
| --------------- | -------------------------------------------------- |
| Node.js         | 24+ (see `.nvmrc`)                                 |
| Package Manager | npm workspaces                                     |
| Style           | Semicolons required, single quotes, 2-space indent |
| TypeScript      | Strict mode, no `any` types                        |

### Essential Commands

Run these from the monorepo root. Command form: `.cursor/rules/commands-from-monorepo-root.mdc`.

```bash
npm run build:packages # Build packages (required before apps)
npm run lint           # Lint all packages and apps
npm run dev:api        # Start API (localhost:3000)
npm run dev:web        # Start web app (localhost:3002)
npm run dev:all        # Start everything with watch mode
```

### Nix / terminal (agent sandbox)

Node, npm, make, and other flake tools: `.cursor/rules/nix-terminal-wrapper.mdc`.
Setup in other repos: [docs/development/tooling/CURSOR-NIX-WITH-ENV.md](docs/development/tooling/CURSOR-NIX-WITH-ENV.md).

### Lock file and workspace dependencies

All monorepo Dockerfiles use `npm ci` for reproducible installs. The root `package-lock.json` must match all workspace `package.json` files. The Make targets that build Docker images (e.g. `local_build_api`, `local_build_web`, `local_build_web_runtime_config`, `local_build_test_assets`, `local_build_all`) automatically run `sync_lockfile` first so the lock file is in sync before `npm ci` runs in the container. After adding, removing, or renaming workspace packages, run `make sync_lockfile` and commit the updated `package-lock.json` so the change is committed; the next Docker build will use the updated lock file from the context.

**Linux-canonical lockfile:** CI runs on Linux and needs Linux optional deps (e.g. `@parcel/watcher`, `@next/swc-linux-x64-gnu`, next-intl’s `@swc/core`) in the lockfile. Generate or refresh the lockfile under Linux x64 so it stays correct for CI: run `./scripts/development/update-lockfile-linux.sh` (requires Docker). The bump-version script runs this automatically before committing. When you add or update dependencies from a Mac, run that script and commit the updated `package-lock.json`. Restoring Mac `node_modules` afterward: `.cursor/rules/reinstall-node-modules-after-linux-npm.mdc`. See [LOCKFILE-LINUX.md](docs/development/tooling/LOCKFILE-LINUX.md).

**Workers (example: add feeds from Podcast Index DB):**

```bash
npm run dev_pi_bulk_feeds_add_from_file -w apps/workers -- -startId 1 -endId 10 -q rss-slow
```

### Package Build Order

Build packages in this order (dependencies must be built first):

1. `helpers` (core utilities, types, DTOs) — **MUST build first**
2. `playback-core` (shared playback/queue policy) — **immediately after helpers**
3. Then in parallel:
   - `helpers-validation` (validation utilities)
   - `helpers-requests` (API request types and utilities)
   - `helpers-backend` (backend-specific utilities)
   - `helpers-browser` (browser-specific utilities)
   - `helpers-config` (configuration validation)
4. `external-services-firebase`, `external-services-paypal`, `external-services-strike`,
   `external-services-apple-app-store`, `external-services-google-play`,
   `external-services-object-storage`, `external-services-podcast-index` (parallel)
5. `orm`
6. `notifications`, `billing` (parallel)
7. `parser`
8. `mq`

**Note:** `playback-core` depends only on `@podverse/helpers`. The 5 specialized helper packages (validation, requests, backend, browser, config) all depend on core `@podverse/helpers` but don't depend on each other, so they can build in parallel after `helpers` and `playback-core` complete.

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

### HTTP / request helpers

Use the shared request helpers for all HTTP calls; do not use raw `fetch()`.

- **Server/Node:** Use `fetchWithTimeout` from `@podverse/helpers-backend` (timeout, cache, body, headers). The only place that may call native `fetch` is inside that helper.
- **Browser/isomorphic:** Use `request` (and optionally `requestWithHeaders`) from `@podverse/helpers-requests`; they return `{ status, data }` and use axios under the hood.

### Environment File Formatting

Quote style, empty values, and K8s `source/*.env` comments: `.cursor/rules/env-file-formatting.mdc`.

- **Alignment with .env.example**: All `.env` files (including `infra/config/local/*.env`) must match the organization, section comments, and variable order of their authoritative `.env.example`; only values may differ
- **Web and Management Web**: `apps/web/.env.local` and `apps/management-web/.env.local` contain only `RUNTIME_CONFIG_URL`; the runtime-config sidecar uses `apps/web/sidecar/.env` and `apps/management-web/sidecar/.env` (created by `make local_env_setup`)

### Import Order

Organize imports with blank lines between groups:

```typescript
import path from 'path'; // 1. Node built-ins

import express from 'express'; // 2. External packages

import { logger } from '@podverse/helpers'; // 3. Workspace packages
import { Podcast } from '@podverse/orm';

import { config } from './config'; // 4. Relative imports
```

Enforced by ESLint; fix with `npm run lint:fix`. Styles (CSS/SCSS) go last in components/pages.

### Shared UI (`@podverse/ui`)

- Shared primitives and the web visual baseline: `.cursor/rules/prefer-shared-ui-web-management.mdc`.
- Extracting between apps: `.cursor/skills/ui-component-promotion/SKILL.md`.
- User-facing strings: `.cursor/rules/i18n-user-facing-strings.mdc`. Shared UI copy: `.cursor/rules/shared-ui-i18n.mdc`.
- Repeated `@podverse/ui` wiring in one app: `.cursor/rules/app-local-ui-wrappers.mdc`.

### ESM and import type

- **ESM import specifiers:** `.cursor/rules/import-specifiers-tiered.mdc` and `.cursor/skills/import-specifiers-tiered/SKILL.md`. Tier B includes those apps' `e2e/**`. Prefer `"type": "module"` where applicable.
- **Type-only imports:** use `import type` for types so the import is not a runtime reference, including across a circular import. Keep a value import when the symbol is used at runtime (classes for `instanceof`, decorators that need the constructor). Separate type and value imports: `.cursor/rules/type-imports-separate-line.mdc`.

### Type assertions

`.cursor/rules/avoid-type-assertions.mdc`.

## Architecture

### Directory Structure

```
packages/           # Publishable npm packages (@podverse/*)
  helpers/          # Utilities, types, DTOs, logging
  external-services/# Third-party API integrations
  orm/              # Database entities, services, migrations
  notifications/    # Push notification services
  billing/          # Payment processor registry, billing event processing
  parser/           # RSS/Podcast feed parsing
  mq/               # Message queue operations

apps/               # Deployable applications
  api/              # REST API (Express)
  web/              # Web app (Next.js)
  workers/          # Background job processors
  management-api/   # Admin API
  management-web/   # Admin dashboard
  mobile/           # React Native + Expo (Tier 5 consumer; off Node build graph)

extensions/         # Optional extension sidecar images (operator-selected)
  prometheus/       # @podverse/extension-prometheus — OTLP + Prometheus scrape
```

### Where to Find Things

| Looking for...             | Location                                                                                                                                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API routes                 | `apps/api/src/routes/`                                                                                                                                                                                    |
| Database entities          | `packages/orm/src/entities/`                                                                                                                                                                              |
| Database services          | `packages/orm/src/services/`                                                                                                                                                                              |
| Shared types/DTOs          | `packages/helpers/src/dto/`                                                                                                                                                                               |
| Feed parsing               | `packages/parser/src/`                                                                                                                                                                                    |
| Web pages                  | `apps/web/src/app/`                                                                                                                                                                                       |
| Mobile app (RN + Expo)     | `apps/mobile/` — see [apps/mobile/AGENTS.md](apps/mobile/AGENTS.md), [APPS-MOBILE.md](apps/mobile/APPS-MOBILE.md); Tier 5 consumer (with web); standalone install (own lockfile); separate macOS CI track |
| Environment templates      | `infra/config/env-templates/` (app stubs link to `apps/*/.env.example`)                                                                                                                                   |
| Workers startup validation | `apps/workers/src/lib/startup/validation.ts` (see [ENV.md](apps/workers/ENV.md))                                                                                                                          |
| K8s manifests              | `infra/k8s/`                                                                                                                                                                                              |
| Extension sidecar source   | `extensions/<id>/` (K8s wiring: `infra/k8s/base/common/`)                                                                                                                                                 |
| Jenkins pipelines          | `infra/pipelines/jenkins/`                                                                                                                                                                                |
| GitHub Actions             | `.github/workflows/`                                                                                                                                                                                      |

## Coding Patterns

### Service Pattern

Business logic lives in `*Service` classes with static methods:

```typescript
// packages/orm/src/services/PodcastService.ts
export class PodcastService {
  static async findById(id: string): Promise<Podcast | null> {
    // implementation
  }
}
```

### ORM `varchar` lengths

- **DDL source of truth:** `infra/k8s/base/ops/source/database/linear-migrations/` (explicit `VARCHAR(n)` in SQL).
- **When to extract a number:** Prefer **domain-named** exports in `packages/orm/src/lib/` (for example
  `FEED_LIFECYCLE_REASON_KEY_MAX_LENGTH` in [`feedLifecycleLimits.ts`](packages/orm/src/lib/feedLifecycleLimits.ts))
  when the same semantic limit is used in **multiple** TypeScript places (ORM entities, Joi, DTOs). Import from
  `@podverse/orm` at app boundaries.
- **When to keep literals:** One-off column widths used only in a single entity can stay inline in `@Column`.
- **Avoid** generic shared constants such as `VARCHAR_64` reused across unrelated columns.

### Logger Pattern

Use the centralized logger from `@podverse/helpers`:

```typescript
import { logger } from '@podverse/helpers';

logger.info('Processing feed', { feedUrl, podcastId });
logger.warn('Retrying request', { attempt, maxAttempts });
logger.error('Feed parsing failed', { error, feedUrl });
```

### Error Handling

- Don't log expected errors (e.g., 401 for unauthenticated users)
- Include context when logging errors
- Let errors propagate to callers, add context when rethrowing

```typescript
// BAD - logs expected behavior as error
} catch (error) {
  console.error('Auth check error:', error)
}

// GOOD - only log unexpected errors
} catch (error) {
  const isExpected = isUnauthorizedError(error)
  if (!isExpected) {
    logger.error('Unexpected auth error', { error })
  }
  return null
}
```

## Anti-Patterns (Do Not Do)

### Configuration

- ❌ Set a default for LOG_DIR in any app (empty = console-only; see logging skill or [logs/LOGS.md](logs/LOGS.md))
- ❌ Add env vars without updating validation scripts (`lib/startup/validation.ts`)

### i18n / Translations

- User-facing strings, title case, and compiled catalogs: `.cursor/rules/i18n-user-facing-strings.mdc` and `.cursor/rules/ui-copy-casing.mdc`.
- Adding a locale: `.cursor/rules/i18n-management.mdc`. Guide: `docs/localization/I18N.md`.
- Do not use empty strings in catalog `originals/`.

### General

- ❌ Skip `npm run build:packages` before running apps
- ❌ Import from package `src/` directly (use `@podverse/package-name`)
- ❌ Add features beyond what was requested (keep changes focused)
- ❌ Create abstractions for one-time operations
- ❌ An interactive control needs an accessible name: `.cursor/rules/screen-reader-accessibility.mdc`

## Testing and Verification

When implementing features or executing plans that touch **api** or **management-api**, include **integration tests** (see api-testing skill). When they touch **web** or **management-web**, include **E2E tests** (see e2e-page-tests skill).

### AI agents: write tests, do not run them

- **Do** add or update tests when the change requires them (see the paragraph above and **feature-implementation-testing**).
- **Do not run** tests during agent or plan work. End with the operator's commands, including the cumulative list on the last COPY-PASTA prompt. See `.cursor/rules/end-with-targeted-make-report-verify.mdc` and `.cursor/skills/response-ending-make-verify/SKILL.md`.
- **Before Submitting Changes** below applies to **operators and PR authors**, not to in-session agent runs.

### Root npm scripts

| Script                         | What it runs                                                             | Services needed                                       |
| ------------------------------ | ------------------------------------------------------------------------ | ----------------------------------------------------- |
| `npm run test:unit`            | Vitest in packages and apps (excludes api/management-api)                | None (pure Node)                                      |
| `npm run test:e2e:api`         | `check-test-requirements` then Vitest in apps/api + apps/management-api  | Postgres **5732**, Valkey **6679** (`make test_deps`) |
| `npm run test:e2e:web`         | `make e2e_test_playwright` (Playwright only; does not re-run API Vitest) | After `test:e2e:api` in `npm test`                    |
| `npm run test:e2e:web:reports` | `make e2e_test_report` (HTML step-screenshot reports)                    | API Vitest + Playwright reports                       |
| `npm run test:reports`         | `test:unit` then `test:e2e:api` then `test:e2e:web:reports`              | All tiers                                             |
| `npm test`                     | `test:unit` then `test:e2e:api` then `test:e2e:web`                      | All tiers                                             |

### Test infrastructure

- **Test env (no `local_env_setup`)** — API integration tests and Playwright E2E use deterministic env from [`packages/helpers-config/src/podverseTestEnv.ts`](packages/helpers-config/src/podverseTestEnv.ts). E2E servers set `PODVERSE_SKIP_DOTENV=true` so missing `apps/api/.env` does not fail startup. **`make local_env_setup` is for local dev only**, not required for `make test_deps`, `npm run test:e2e:api`, or `make e2e_test_*`.
- **`make test_deps`** — starts Postgres (port **5732**), Valkey (port **6679**), creates test DBs (`podverse_app_test`, `podverse_management_test`), applies schema. Port coexistence: Podverse dev uses 5432/6379; the dedicated test ports avoid clashing with those and with other local toolchains that may use different test ports.
- **`make test_deps_mq`** — optional broker-backed integration dependency: starts ActiveMQ Artemis on port **61616** and provisions `opml-import`, `rss-on-demand`, and `add-by-rss-on-demand` (+ DLQs). Use with `PODVERSE_RUN_MQ_INTEGRATION=1` for MQ-backed worker integration tests.
- **`scripts/check-test-requirements.mjs`** — TCP check for 5732/6679; exits with instructions if unreachable.
- **`make help_test`** — prints test ports, container names, and instructions.
- **Playwright browsers:** one-time install: `npx playwright install chromium`.

### API integration tests

- Vitest applies `buildPodverseApiTestEnv` / `buildPodverseManagementApiTestEnv` from `@podverse/helpers-config` (see `apps/api/src/test/setup.ts`, `apps/management-api/vitest.setup.ts`).
- Run: `npm run test:e2e:api` (or `npm run test -w apps/api` for api only).

### E2E (Playwright)

- Web ports: API 4030, sidecar 4031, web 4032. Management-web ports: 4130, 4131, 4132.
- Playwright-spawned API processes use the `apiWebE2e` / `managementApiE2e` profiles from `podverseTestEnv.ts` (not dev `.env` files).
- Seed data: `make e2e_seed` (deterministic test users).
- Reports: `make e2e_test_report` produces HTML with step screenshots in `.artifacts/e2e-reports/`.
- Apps must be built before E2E: `npm run build:packages && npm run build -w apps/api && npm run build -w apps/management-api`.

### Before Submitting Changes

Operators and PR authors verify locally:

1. **Lint passes**: `npm run lint`
2. **Builds succeed**: `npm run build:packages`
3. **Tests pass**: `npm run test:unit` (no DB needed) and `npm run test:e2e:api` (requires `make test_deps`)
4. **E2E pass** (if UI changed): `make e2e_test_web` or `make e2e_test_management_web`

### Skills and rules

- **feature-implementation-testing** — tests are required when touching api/management-api/web/management-web
- **api-testing** — how to write API integration tests
- **e2e-page-tests** — how to write E2E Playwright specs
- **ui-component-promotion** — promote shared UI across web and management-web via `packages/ui`
- **reuse-beyond-components** (rule) — `.cursor/rules/reuse-beyond-components.mdc`
- **modal-layout-contract** — `Modal`, `Modal.Body`, `Modal.Actions`; no overflow masking; modal footers match web (right-aligned, wrap)
- **management-post-save-navigation** — after successful create or primary save on management-web New/Edit (one row), navigate to the list unless an exception applies (invite link, password-only update, detail-first flows)
- **css-custom-properties-no-var-fallbacks** — never `var(--token, fallback)` in SCSS/CSS or inline styles; fix tokens or set vars at source
- **unit-test-priority-confident** — prioritize unit tests by risk
- **unit-test-design-no-overgranularity** — avoid over-testing
- **unit-test-new-code-gate** — require tests for new critical logic
- **response-ending-make-verify** — `.cursor/skills/response-ending-make-verify/SKILL.md` and `.cursor/rules/end-with-targeted-make-report-verify.mdc`
- **ui-e2e-screenshot-report** — `.cursor/skills/ui-e2e-screenshot-report/SKILL.md`
- **e2e-run-with-make-only** (rule) — always use make targets for E2E
- **mobile-list-virtualization** (rule) — for `apps/mobile/src/**/*.tsx`, user-data lists use `FlatList` / `SectionList` (not `ScrollView` + `.map()`), list owns scroll via `ListHeaderComponent`/`ListFooterComponent`
- **screen-reader-accessibility** — `.cursor/rules/screen-reader-accessibility.mdc`
- **cross-surface-change-impact** — `.cursor/rules/cross-surface-change-impact.mdc`
- **dto-changes-are-device-data-migrations** — `.cursor/rules/dto-changes-are-device-data-migrations.mdc`
- **filter-sort-persistence** — `.cursor/rules/filter-sort-persistence.mdc`

## References

- [Quick Start Guide](docs/QUICKSTART.md) - Setup and running locally
- [Architecture](docs/architecture/ARCHITECTURE.md) - System design and data flow
- [V4V MetaBoost + LNURL](docs/v4v/bitcoin/lnd/V4V-METABOOST-LNURL.md) - Value-for-value boost flow and local setup
- [Contributing](docs/development/CONTRIBUTING.md) - Workflow and PR guidelines
- [API Client Boundaries](docs/development/API-CLIENT-BOUNDARIES.md) - Shared request client/auth contracts for web, SSR, and mobile
- [Lockfile (Linux)](docs/development/tooling/LOCKFILE-LINUX.md) - Generating package-lock.json for CI
- [i18n Guide](docs/localization/I18N.md) - Translation system details
- [IDE Setup](docs/development/IDE-SETUP.md) - VS Code configuration
