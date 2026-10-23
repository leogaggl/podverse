**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 12 — Listener-id separation: lint rule, source-guard test, agent rule

Enforce in code and by a test that only the listener identity zone reads the account-to-listener
mapping (R52). Chart code, popularity readers, management, workers, and the later recommendation
jobs never import `StatsListener` / `StatsListenerService` and never name the `stats_listener`
table.

The zone is `packages/orm/src/services/stats/listenerIdentity/`. Plan 11 creates its first file;
the write-path and consent plans add account-keyed services there. Nothing in this plan depends on
those files existing.

## Rows

R29, R52

## Runs after

none

## Files

- `eslint.config.mjs`
- `packages/orm/src/services/stats/statsListenerSeparation.sourceGuard.test.ts` (new)
- `.cursor/rules/popularity-listener-id-separation.mdc` (new)
- `.cursor/rules/rule-index.mdc`

## ESLint — `eslint.config.mjs`

Add one config object immediately before `eslintConfigPrettier,` (after the `apps/web/src`
`no-restricted-syntax` block):

```javascript
  {
    files: ['apps/**/*.{ts,tsx,mts}', 'packages/**/*.{ts,tsx,mts}'],
    ignores: [
      'packages/orm/src/services/stats/listenerIdentity/**',
      'packages/orm/src/entities/stats/statsListener.ts',
      'packages/orm/src/db/entities.ts',
      '**/*.test.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@podverse/orm',
              importNames: ['StatsListener', 'StatsListenerService'],
              message:
                'Only packages/orm/src/services/stats/listenerIdentity/ may read the listener-id mapping (see .cursor/rules/popularity-listener-id-separation.mdc).',
            },
          ],
          patterns: [
            {
              group: ['**/statsListener', '**/statsListener.js'],
              message:
                'Only packages/orm/src/services/stats/listenerIdentity/ may read the listener-id mapping (see .cursor/rules/popularity-listener-id-separation.mdc).',
            },
          ],
        },
      ],
    },
  },
```

No other config object in the root file sets `no-restricted-imports`, so this does not override
anything. The pattern does not match `statsListenEvent.js` or `statsListenerSeparation…`, because
gitignore-style groups match the whole last path segment.

## Source-guard test — `packages/orm/src/services/stats/statsListenerSeparation.sourceGuard.test.ts`

Pattern: `baseStatsTrackEvent.sourceGuard.test.ts` in the same directory (`readFileSync`,
`fileURLToPath`, vitest). Resolve the repo root with
`fileURLToPath(new URL('../../../../../', import.meta.url))` and walk directories with
`readdirSync(…, { withFileTypes: true })`.

- **Scanned roots** (repo-relative; skip a root that does not exist): `apps/api/src`,
  `apps/workers/src`, `apps/management-api/src`, `apps/web/src`, `apps/web/sidecar/src`,
  `apps/management-web/src`, `apps/management-web/sidecar/src`, `apps/mobile/src`, and every
  `packages/*/src`.
- **Skipped while walking:** `node_modules`, `dist`, `.next`, any `test`, `__tests__`, or `e2e`
  directory, and files ending in `.test.ts`, `.test.tsx`, `.spec.ts`, or `.d.ts`. Read only
  `.ts`, `.tsx`, and `.mts` files.
- **Forbidden text:** `/\bstats_listener\b/` and `/\bStatsListener(?:Service)?\b/`.
- **Allowed paths** (prefix match on the repo-relative path with forward slashes):
  `packages/orm/src/services/stats/listenerIdentity/`,
  `packages/orm/src/entities/stats/statsListener.ts`, `packages/orm/src/db/entities.ts`.
- Cases:
  1. No scanned file outside the allowed paths contains forbidden text. Collect offenders as
     `path:line` strings and `expect(offenders).toEqual([])`, so a failure names every file.
  1. `packages/orm/src/index.ts` contains neither `entities/stats/statsListener.js` nor
     `listenerIdentity/statsListener.js`.
  1. The scan reached at least one file in `apps/workers/src`, `apps/management-api/src`, and
     `packages/orm/src/services/stats` (guards against a wrong repo-root path silently scanning
     nothing).

Keep the walker inside the test file; it is small and has one user.

## Agent rule — `.cursor/rules/popularity-listener-id-separation.mdc`

Frontmatter: `description` (one line: who may read the listener-id mapping and how copy names the
id), `globs` covering `packages/orm/src/services/stats/**`, `packages/orm/src/entities/stats/**`,
`apps/api/src/controllers/stats/**`, `apps/workers/src/commands/stats/**`,
`apps/management-api/src/routes/stats.ts`, `apps/management-api/src/lib/database/tablePolicy.ts`,
`alwaysApply: false`. Body, short, present tense (**comments-future-forward**,
**llm-safe-plan-vocabulary**):

- The mapping table and `StatsListenerService` are read only inside the listener identity zone.
  Zone services exported from `@podverse/orm` take an `account_id` and never return a
  `listener_id`.
- Workers, management API and web, popularity readers, the range-totals refresh, and
  recommendation jobs work from `listener_id` values already stored in event and taste rows.
- The read-only database role cannot select the mapping; zone code uses the read-write data
  source.
- The management database browser never lists `stats_listener`. Which event, taste, daily, and
  range tables it lists is set in `apps/management-api/src/lib/database/tablePolicy.ts`.
- User-facing copy calls the id pseudonymous at most, never anonymous or anonymized.
- Enforcement: the `no-restricted-imports` block in `eslint.config.mjs` and
  `statsListenerSeparation.sourceGuard.test.ts`. Adding a reader outside the zone means changing
  this rule first, not the allowlist.
- Data model and contracts: `docs/features/POPULARITY-TRACKING.md`.

## Rule index — `.cursor/rules/rule-index.mdc`

Add one bullet in the existing style:
`- Popularity tracking, listener ids, stats or taste tables → \`popularity-listener-id-separation\``.

## Tests

The source-guard test above. No API or E2E tests.

## Release scratchpad

none
