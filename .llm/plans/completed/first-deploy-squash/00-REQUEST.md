# Request

i want to squash all the migrations in podverse and we will treat this as the first version we will ever deploy.

I want you to also sweep through documentation and look for opportunities where we may be able to remove references that are no longer relevant in the context of a totally new deployment.

And I also want you to sweep through code and look for code that seems like it will be intended only for a legacy scenario and have no need.

Going forward in our new squashed version, and you can remove comments from the code if it's no longer relevant to the future.

And this will be sweeping across a very large code base. So, I would like you to separate this in a planned set that can run in parallel as much as possible using Cursor Grok 4.7.

Run parallel agents and determine if anything can be squashed and also any code can be removed because it's no longer up to date with the way it is. Any documentation or code or comments.

## Operator answers

### Which chains to squash

Question: which migration chains should this set squash into a first-deploy baseline?

Answer: "We are willing to squash everything. And we only have one tester on mobile, so they can be expected to delete their app if that is what it will take to allow squashing and using an all new version. We can wipe anything we need in the way of the process."

That includes the Postgres app chain, the Postgres management chain, and the mobile SQLite chain.

### What may be removed

Question: besides deleting the old numbered SQL files after the squash, what may later prompts remove?

Answer: upgrade-only material. Docs, comments, and code whose only job is migrating an older schema or an older deployment inside this monorepo. Keep current product behavior, including features carried over from the previous app.

"to be clear, we are not talking about v4, we are strictly talking about this Podverse monorepo, which is also known as v5."

Do not remove compatibility with v4 / podverse-rn. Do not remove a current feature because it was ported from an earlier design. A removal has to be something that exists only to upgrade an older state of this monorepo.

### Who wipes databases

Question: squash requires dropping and recreating every Podverse database. Who does that, and which databases?

Answer: the operator drops and recreates every database (local, test, alpha, and any other cluster). The plan only gives the commands. No agent connects to a cluster or drops data.

### Review of the first planning pass

The operator chose, for the descriptions backfill: "Remove the command, its cron, and the reason."

The rest were settled from the same goal: remove upgrade-only v5 material, and keep current behavior and v4 compatibility.

- D0, D14, D17: remove `ormDescriptionsBackfill`, its cron, and `description_backfill`. Plan 60 already removes the command. Plan 52 (second pass, row R33) drops the reason and runs after plan 60.
- D1: keep the four `add_by_rss_*` SQL functions. They are the live twins of the JavaScript hash, and the API parity test calls them. The one-time row rehash does not survive the dump.
- D2: accept losing the `--` comments from migrations `0002`–`0031`.
- D3: keep `squash-linear-migrations.sh`.
- D4: delete the Jenkins `apply-migration.jenkinsfile`.
- D5: leave the `# Version: N` lines on Kubernetes manifests.
- D6: the alpha wipe restarts Valkey and leaves the message queue.
- D7: fix only the migrations table in `MANAGEMENT-DATABASE-CONSOLE.md`.
- D8: the local wipe is `make local_clean`.
- D9: an old mobile install fails at database open with a reinstall message.
- D10: the squashed mobile migration is version 1.
- D11: the car cache schema version stays at 2.
- D12: keep the second Add by RSS hash.
- D13: keep `migration_baseline` and `adoptCachedExpiryWithManager`.
- D15: keep the older notification field reads.
- D16: keep those parser and settings fields optional.
- D18: keep `ormVerifiedPublisherLinksBackfill`.
- D19: drop the local env path that upgrades an older checkout.
- D20: ignore older consent cookies.
- D21: ignore older embed builder `type` values.
- D22: the Add by RSS IndexedDB version stays at 8.
- D23: web still matches the hash that omits `feed_url`.
- D24: edit the four aicast scripts. This set does not generate audio.
- D25: keep the historical upgrade sentences in proposals 727 and 743 that name no deleted migration file.

## Glossary

- v5: this Podverse monorepo. The only product this set is about.
- v4 / podverse-rn: the previous app. Out of scope. Leave its compatibility code in place.

## Orientation

Checked facts for planners. The planning run decides the split.

- Postgres app chain: `infra/k8s/base/ops/source/database/linear-migrations/app/`. Files present: `0000_init_helpers.sql`, `0001_app_schema.sql`, then `0002` through `0031_account_api_key.sql`.
- Postgres management chain: `infra/k8s/base/ops/source/database/linear-migrations/management/`. Files present: `0000_init_helpers.sql`, `0001_management_schema.sql`, `0002_notifications_permissions.sql`, `0003_billing_permissions.sql`, `0004_admin_session.sql`.
- Squash helper already in the repo: `scripts/database/squash-linear-migrations.sh`. Without `--write` it writes candidates under `.artifacts/squash-linear-migrations/`. With `--write` it replaces `0001_app_schema.sql` and `0001_management_schema.sql` by applying the chain to a throwaway Postgres and dumping the result. It does not delete the later `NNNN_*.sql` files.
- Contract for that squash: `docs/operations/database/LINEAR-MIGRATIONS.md` section "Pre-release squash". After the write, delete obsolete `NNNN_*.sql` files (keep `0000` and `0001` per database), update readiness markers, regenerate baselines, and drop/recreate databases. Do not concatenate evolutionary SQL by hand.
- Generated snapshots, not hand-edited: `infra/k8s/base/db/source/bootstrap/0004_app_linear_baseline.sql.gz` and `0005_management_linear_baseline.sql.gz`. Rule: `.cursor/rules/linear-baseline-0004.mdc`. Skill: `.cursor/skills/linear-sql-greenfield-only/SKILL.md`. Regen is `make db_regen_linear_baseline` then `make db_verify_linear_baseline`, done by the agent that changes the SQL, not left as an operator follow-up.
- Readiness markers today: `API_EXPECTED_MIGRATION_FILENAME=0031_account_api_key.sql` and `MANAGEMENT_API_EXPECTED_MIGRATION_FILENAME=0004_admin_session.sql` in `infra/k8s/base/ops/kustomization.yaml`. The same keys are also set for the API and management API env. Skill: `.cursor/skills/migration-readiness-marker-sync/SKILL.md`.
- Mobile SQLite is a separate chain: `apps/mobile/src/data/db/migrations.ts` (`MIGRATIONS`, applied with `PRAGMA user_version`), plus `runMigrations.ts` and `migrations.test.ts`. Schema twin: `apps/mobile/src/data/db/schema.ts`. There is no squash script for this chain. Rule `.cursor/rules/dto-changes-are-device-data-migrations.mdc` says never edit a migration that has shipped. This request is the exception for this one squash: the only mobile tester deletes the app. After the squash, later mobile migrations still append and are not rewritten.
- `release-notes/scratchpad.md` cites old migration filenames in existing entries. The release-notes rule says never edit or remove another change's entry. A new entry for this squash is allowed. Do not rewrite the old entries.
- `.llm/plans/` is the planning workspace, including `.llm/plans/completed/`. It is not operator documentation. Do not rewrite archived plan sets. Another set is already in `.llm/plans/active/cross-device-playback/`; do not edit it.
- Product and operator docs to sweep start at `docs/`, especially `docs/operations/database/`. In-repo guidance that states the migration contract (the linear-baseline rule, the greenfield-only skill, `AGENTS.md` where it names `0004` / `0005`) is in scope when the squash makes a sentence false.
- Comments: `.cursor/rules/comments-future-forward.mdc`. Remove or rewrite a comment that only describes an older schema, an older deployment, or a plan that will not exist for a first deploy. Leave a comment that states a constraint of the code as it stands.
- Model request in the operator's words: parallel agents, Cursor Grok 4.7 where the copy-pasta model table allows it. The schema squash is a destructive migration. Follow `.cursor/skills/abcplan/SKILL.md` and the copy-pasta model table for that prompt. Do not force Grok onto it. Sweep prompts that follow an existing pattern stay on Cursor Grok 4.7.
- Agents do not drop databases. The last prompt's operator commands name the wipe. The operator runs them.
