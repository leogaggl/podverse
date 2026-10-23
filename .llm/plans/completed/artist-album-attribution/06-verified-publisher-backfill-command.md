**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 06 — Worker command to backfill verified publisher links

Existing feeds are not reparsed until their content changes (`FeedNoChangesSinceLastParsedError`
in `handleParsedFeed`), so plan 03's parse hook alone would leave most links unset for a long
time. `ormVerifiedPublisherLinksBackfill` recomputes every content channel that has publisher
claims or stored links, using plan 02's service. It is safe to rerun: recompute writes nothing
when the stored rows already match.

## Rows

R12, R13

## Runs after

02

## Files

apps/workers/src/commands/orm/verifiedPublisherLinks/backfill.ts
apps/workers/src/commands/orm/verifiedPublisherLinks/backfill.test.ts
apps/workers/src/commands/index.ts
apps/workers/src/lib/startup/categoriesForCommand.ts
apps/workers/src/lib/startup/categoriesForCommand.test.ts
apps/workers/package.json
packages/worker-commands/src/registry.ts
infra/k8s/base/cron/worker-verified-publisher-links-backfill.cronjob.yaml
infra/k8s/base/cron/kustomization.yaml
release-notes/scratchpad.md

## Reuses

- `ChannelVerifiedPublisherService.recomputeForContentChannel` and `computeForContentChannel`
  from plan 02.
- The command shape of `ormDescriptionsBackfill` in
  `apps/workers/src/commands/orm/descriptions/backfill.ts`: `getLogger`, `CommandLineArgs`, and
  its private `parsePositiveIntArg`, `hasFlag`, and `isDryRun` helpers. Copy those three helpers
  into the new file (`scheduledJob/runDue.ts` keeps its own `isDryRun` the same way); do not
  extract a shared module in this plan. Log failures with `logger.error(…)` as `runDue.ts` does.
- `worker-descriptions-backfill.cronjob.yaml` as the suspended manual CronJob template.

## The command

`apps/workers/src/commands/orm/verifiedPublisherLinks/backfill.ts`:

```typescript
const DEFAULT_BATCH_LIMIT = 500;

const SELECT_CONTENT_CHANNEL_IDS_SQL = `
  SELECT ids.channel_id
  FROM (
    SELECT channel_id FROM channel_publisher
    UNION
    SELECT channel_id FROM channel_verified_publisher
  ) ids
  WHERE ids.channel_id > $1
  ORDER BY ids.channel_id ASC
  LIMIT $2`;
```

- `export const ormVerifiedPublisherLinksBackfill = async (args: CommandLineArgs) => { … }`.
- Args: `-limit` (batch size, default 500), `-afterId` (start after this channel id, default 0,
  for resuming a stopped run), and the dry-run flags (`-dry-run`, `-dryRun`, `-dry_run`).
- Walk ids in batches with `AppDataSourceReadWrite.query(SELECT_CONTENT_CHANNEL_IDS_SQL, [afterId,
  limit])`, reading each row's `channel_id` with `Reflect.get` plus a number check (no `as`),
  until a batch comes back empty.
- For each id:
  - Normal run: `recomputeForContentChannel(id)`; add the returned count to `links_stored`.
  - Dry run: `computeForContentChannel(id)`; add the result length to `links_found`. Nothing is
    written.
  - A thrown error for one channel is logged with its id (`logger.error`, with the id in the
    message) and counted in `channels_failed`; the walk continues.
- Log one line per batch:
  `${prefix}ormVerifiedPublisherLinksBackfill batch last_channel_id=… channels=…` and a final
  totals line with `channels_scanned`, `links_stored` (or `links_found` in a dry run), and
  `channels_failed`. The batch line's `last_channel_id` is the value to pass as `-afterId` to
  resume.
- Doc comment on the export: what it recomputes, that a rerun converges, and that it is meant to
  run once after the verified publisher migration and any time links look stale.

Why content channels only: every link row belongs to one content channel, and
`recomputeForContentChannel` rewrites exactly that channel's rows. The union also visits channels
whose claims were removed but still hold rows, so those rows are cleared.

## Registration

1. `apps/workers/src/commands/index.ts`: import `ormVerifiedPublisherLinksBackfill` from
   `./orm/verifiedPublisherLinks/backfill.js` beside the `ormDescriptionsBackfill` import, and add
   it to the command map beside `ormDescriptionsBackfill`.
1. `apps/workers/src/lib/startup/categoriesForCommand.ts`: add
   `'ormVerifiedPublisherLinksBackfill'` to the Base + ORM list after `'ormArchivedSlimReport'`.
   `apps/workers/ENV.md` already covers it through `orm\*`; leave it.
1. `apps/workers/package.json`: add
   `"orm_verified_publisher_links_backfill": "node ./dist/index.js ormVerifiedPublisherLinksBackfill",`
   after `orm_descriptions_backfill`.
1. `packages/worker-commands/src/registry.ts`: add after the `ormDescriptionsBackfill` entry:

```typescript
  {
    name: 'ormVerifiedPublisherLinksBackfill',
    label: 'Verified publisher links: backfill',
    description:
      'Recompute verified publisher links for every channel with publisher claims or stored links, from the stored references of both feeds. Writes nothing for a channel whose links already match. Use -afterId to resume and -dry-run to count without writing.',
    category: 'orm',
    risk: 'normal',
    example_cli: 'npm run orm_verified_publisher_links_backfill -w apps/workers -- -limit 500',
  },
```
1. `infra/k8s/base/cron/worker-verified-publisher-links-backfill.cronjob.yaml`: copy
   `worker-descriptions-backfill.cronjob.yaml` with `metadata.name:
   worker-verified-publisher-links-backfill`, the command args `- "ormVerifiedPublisherLinksBackfill"`
   (no extra flags), and the header comment: manual ops only, suspended until an operator triggers
   a one-off Job; rerunning is safe because each channel is recomputed from stored references.
   Keep `suspend: true`, `schedule: "0 0 1 1 *"`, `concurrencyPolicy: Forbid`, resources,
   security context, and volumes as in the template.
1. `infra/k8s/base/cron/kustomization.yaml`: list the new file after
   `worker-descriptions-backfill.cronjob.yaml`.

## Must stay true

- A dry run writes nothing.
- One failing channel does not stop the run.
- No `as`, no `any`; strict equality.

## Tests

- `apps/workers/src/lib/startup/categoriesForCommand.test.ts`: add
  `it('maps ormVerifiedPublisherLinksBackfill to Base and ORM', …)` matching the
  `ormDescriptionsBackfill` case.
- `apps/workers/src/commands/orm/verifiedPublisherLinks/backfill.test.ts` (Vitest; `vi.mock`
  `@podverse/orm` with `AppDataSourceReadWrite.query` returning two batches, then an empty one,
  and a `ChannelVerifiedPublisherService` class whose methods are spies; mock
  `@workers/factories/logger.js`):
  - A normal run calls `recomputeForContentChannel` for every id in order and passes the last id
    of each batch as the next `afterId`.
  - A dry run calls `computeForContentChannel` and never `recomputeForContentChannel`.
  - When one recompute rejects, the rest still run and the final log line reports
    `channels_failed=1`.

## Release scratchpad

```markdown
## Backfill command for verified publisher links

- Surfaces: workers, k8s cron
- Change: new worker command `ormVerifiedPublisherLinksBackfill` (npm script
  `orm_verified_publisher_links_backfill`) recomputes verified publisher links for every channel
  with publisher claims or stored links. Flags: `-limit` (batch size), `-afterId` (resume),
  `-dry-run`. New suspended CronJob `worker-verified-publisher-links-backfill` for one-off runs.
- Who notices: operators; artist pages list verified albums for feeds parsed before this release
  once it has run.
- Operator steps: after the `0022_channel_verified_publisher.sql` migration and the parser
  release, run the command once per deployment (trigger a Job from the suspended CronJob).
```
