**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 40 — API membership env docs drop numbered migrations

`apps/api/ENV.md` tells operators that trial length and RSS caps become canonical only after two numbered linear migrations apply. After the squash those files are gone. The table `product_membership_settings` is part of `0001_app_schema.sql`. This plan rewrites that sentence so it names the table and the seed rule, and names no migration file.

## Rows

R11

## Runs after

none

## Files

apps/api/ENV.md

## Tests

none

## Release scratchpad

none

## Edit

In `apps/api/ENV.md`, under `### Premium/Membership`, replace only the `MEMBERSHIP_FREE_TRIAL_EXPIRATION` bullet. Today it says the canonical values live in `product_membership_settings` after `0030_product_membership_settings.sql` and `0031_product_membership_settings_caps.sql` apply.

Write this bullet instead:

```markdown
- **`MEMBERSHIP_FREE_TRIAL_EXPIRATION`** (Optional) - Free trial length in seconds (default: 2678400, 31×86400). **Bootstrap:** the canonical trial length and RSS/refresh caps for new signups and resolved membership APIs live in `product_membership_settings` in the app database (seeded from env when the row is missing). Env remains required for startup validation and seeds a database that has no row; changing env alone does not override an existing row until you update the row (management Products → Memberships) or adjust env and re-seed.
```

Keep the default `2678400`, the management Products path, and the rule that env does not override an existing row. Do not name `0001_app_schema.sql` or any `00NN_*.sql` file. Do not say the values apply only after a migration runs.

## Leave unchanged

- `apps/management-api/ENV.md` (Product / membership marketing defaults). It already names `product_membership_settings` and does not name a migration file.
- `apps/api/.env.example` and `apps/management-api/.env.example`. Their bootstrap comments already name the table.
- Do not edit `apps/api/.env` or `apps/management-api/.env`.
- The Important Notes bullet in `apps/api/ENV.md` that says defaults have been removed from `config/index.ts`. That sentence is about config style, not an older schema. `config/index.ts` still uses numeric fallbacks for optional env vars (`readWholeNumberEnv`). Do not rewrite it here.
- `apps/api/APPS-API.md` and `apps/management-api/APPS-MANAGEMENT-API.md`. They do not cite migration files.
