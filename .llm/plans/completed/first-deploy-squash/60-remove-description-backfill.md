**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# Remove the description preview backfill

`ormDescriptionsBackfill` repairs `item_description` and `channel_description` rows whose `preview` is null, and with `-enqueueReparse` it schedules `feed-force-reparse` jobs for truncated rows whose `source_length` is null. Those rows are descriptions cut raw before previews were stored.

A current parse does not write that shape. `compatItemDescriptionDto` / `compatChannelDescriptionDto` call `prepareDescriptionForStorage`, which returns a preview and a source length, or null. `handleParsedOneData` saves that object or deletes the row. A first deploy never has null-preview descriptions for this command to repair.

The CronJob is suspended (`schedule: "0 0 1 1 *"`, `suspend: true`) and is documented as a manual one-off. Delete the command and the CronJob.

Leave these in place. They serve rows a first deploy still creates:

- `ormVerifiedPublisherLinksBackfill` and `worker-verified-publisher-links-backfill.cronjob.yaml`. A parse calls `recomputeForChannel`; a failed recompute is logged and parsing continues, and this command is the repair. Plan 61 only rewrites its comment.
- `imageShrinkBackfill` and `worker-image-shrink-backfill.cronjob.yaml`. The cron runs daily at 02:00 and enqueues images that are not resized yet.
- `billingImportLegacyMembershipExpiry`. That imports expiry from v4. v4 stays.
- `scheduledJobsRunDue` and `handleFeedForceReparse`. Management still schedules `description_tier_change`. Do not remove the job type.

Do not edit `packages/orm/**`, `packages/parser/**`, `release-notes/**`, or `infra/k8s/INFRA-K8S.md`.

## Rows

R13, R22, R29

## Runs after

none

## Files

apps/workers/src/commands/index.ts
apps/workers/src/commands/orm/descriptions/backfill.ts
apps/workers/src/commands/orm/descriptions/planDescriptionBackfill.ts
apps/workers/src/commands/orm/descriptions/planDescriptionBackfill.test.ts
apps/workers/src/lib/startup/categoriesForCommand.ts
apps/workers/src/lib/startup/categoriesForCommand.test.ts
apps/workers/src/commands/orm/scheduledJob/runDue.test.ts
apps/workers/package.json
apps/workers/ENV.md
packages/worker-commands/src/registry.ts
infra/k8s/base/cron/kustomization.yaml
infra/k8s/base/cron/worker-descriptions-backfill.cronjob.yaml

## Tests

- Delete `apps/workers/src/commands/orm/descriptions/planDescriptionBackfill.test.ts` with the module it covers.
- In `categoriesForCommand.test.ts`, delete the `it('maps ormDescriptionsBackfill to Base and ORM'` case. Leave the `ormArchivedSlimReport` and `ormVerifiedPublisherLinksBackfill` cases.
- In `runDue.test.ts`, change both `'description_backfill'` strings (the mock `parseFeedForceReparsePayload` return and `reparseJob.payload.reason`) to `'description_tier_change'`. The handler does not branch on the reason. `description_tier_change` is the reason management still schedules.

No API integration test and no Playwright spec. The management API returns `getWorkerCommandListForApi()` from this registry and does not hardcode the name.

## Release scratchpad

Append this to `release-notes/scratchpad.md` when this prompt is the only one in its phase. When it shares a phase, do not edit the scratchpad; put the same entry in the final message under "Release notes entry".

```markdown
## Remove the description preview backfill worker

- Surfaces: workers, k8s
- Change: `ormDescriptionsBackfill` and the suspended CronJob `worker-descriptions-backfill` are removed. Parses store a preview and a source length, so a first deploy has no rows for that job. Changing a feed's description length tier still schedules `feed-force-reparse` with reason `description_tier_change`.
- Who notices: operators who started that suspended CronJob by hand
- Operator steps: none. The next sync removes the CronJob object.
```

## Steps

1. Delete these files:
   - `apps/workers/src/commands/orm/descriptions/backfill.ts`
   - `apps/workers/src/commands/orm/descriptions/planDescriptionBackfill.ts`
   - `apps/workers/src/commands/orm/descriptions/planDescriptionBackfill.test.ts`
   - `infra/k8s/base/cron/worker-descriptions-backfill.cronjob.yaml`
   The `descriptions/` directory has only those three files. Do not add a replacement module.

2. `apps/workers/src/commands/index.ts`: remove the `ormDescriptionsBackfill` import and the `ormDescriptionsBackfill` property on the exported command map. Leave `ormVerifiedPublisherLinksBackfill` and `imageShrinkBackfill`.

3. `apps/workers/package.json`: remove the script `"orm_descriptions_backfill": "node ./dist/index.js ormDescriptionsBackfill"`.

4. `apps/workers/src/lib/startup/categoriesForCommand.ts`: remove `'ormDescriptionsBackfill'` from the Base + ORM command array (the array that also lists `ormArchivedSlimReport`). Do not remove `ormVerifiedPublisherLinksBackfill`.

5. `packages/worker-commands/src/registry.ts`: remove the `WORKER_COMMAND_DEFS` object whose `name` is `'ormDescriptionsBackfill'` (label `Descriptions: backfill previews and reparses`, through its `example_cli`). Leave the verified-publisher object that follows it. `dist/` is gitignored; do not hand-edit it. From the repo root, run `npm run build -w packages/worker-commands` so local `dist/` matches `src/`. That package's `build` script lints `src/` and runs `tsc`. Do not commit `dist/`.

6. `infra/k8s/base/cron/kustomization.yaml`: remove the resource line `- worker-descriptions-backfill.cronjob.yaml`. Leave the verified-publisher and image-shrink lines.

7. `apps/workers/ENV.md`: in the Base + ORM only table row, remove `ormDescriptionsBackfill, ` from the command list. In the notifications platform note, replace "locally after database migration without MQ/Parser categories" with "locally once the app database exists, without MQ or Parser categories." Do not edit the v4 membership expiry section.

8. Apply the test edits in `## Tests`.
