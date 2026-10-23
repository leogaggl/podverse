**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 15 — Workers account event publisher

Worker commands that create notifications need a registered account event publisher, or plan 11
drops their events with a warning and open streams never see parser or campaign notifications
(R22). Today only `mqAddByRSSRunParser` and `mqOpmlImportRun` have the `KeyValDB` category, and
neither writes notifications. The parser deployments and the scheduled-job cronjob have no
`podverse-keyvaldb-opaque` mount.

This plan:

- names the commands that write notifications in one list, and gives each the `KeyValDB`
  category;
- opens one dedicated publisher connection in those processes, separate from the cache client;
- keeps the existing fatal cache-client check only for the two commands that use the cache, so a
  Redis outage never stops a parser or a scheduled-job run;
- mounts the keyvaldb secret on every deployment and cronjob that runs a writing command.

Other work is landing in the tree. Before editing, confirm these still exist: the command groups
and `getCategoriesForCommand` in `apps/workers/src/lib/startup/categoriesForCommand.ts`, the
`if (categories.has(CATEGORY_KEYVALDB))` block and the `ormContext` initialize block in
`apps/workers/src/index.ts`, `getKeyvaldbConfig` in `apps/workers/src/config/index.ts`,
`LONG_RUNNING_COMMANDS` in `apps/workers/src/lib/extensions/longRunningCommands.ts`, and plan 11's
`registerAccountEventPublisher`, `unregisterAccountEventPublisher`,
`warnIfNoAccountEventPublisher`, and `ACCOUNT_EVENT_REDIS_RECONNECT_DELAY_MS` exported from
`@podverse/orm`.

## Rows

R22, R41

## Runs after

11

## Files

apps/workers/src/lib/startup/categoriesForCommand.ts
apps/workers/src/lib/startup/categoriesForCommand.test.ts
apps/workers/src/lib/accountEvents/accountEventPublisher.ts
apps/workers/src/lib/accountEvents/accountEventPublisher.test.ts
apps/workers/src/index.ts
apps/workers/ENV.md
apps/workers/.env.example
infra/k8s/base/workers/parser-normal.deployment.yaml
infra/k8s/base/workers/parser-live.deployment.yaml
infra/k8s/base/workers/parser-ondemand.deployment.yaml
infra/k8s/base/cron/worker-scheduled-jobs.cronjob.yaml
infra/k8s/base/ops/seed-embed-demo-showcase-feeds.cronjob.yaml
release-notes/scratchpad.md

## Which commands write notifications

Every in-app notification a worker writes goes through `AccountNotificationService.createMany`:

- the parser's `createInAppNotificationsForAccounts`, reached from `parseRSSFeedAndSaveToDatabase`;
- `dispatchAdminNotificationCampaign`, reached from the scheduled-job runner.

The commands that reach either path:

| Command | Path |
| --- | --- |
| `mqRSSRunParser` | parses feeds from the queue |
| `parserRSSParseFeed` | parses one feed |
| `scheduledJobsRunDue` | sends due campaigns; the feed-force-reparse job parses a feed |
| `devParserRSSParseArtistPublisherFeeds`, `devParserRSSParseMusicMediumFeeds`, `devParserRSSParsePodcasting20Feeds`, `devParserRSSParseTrendingFeeds` | parse feeds |
| `seedEmbedDemoShowcaseFeeds` | parses the showcase feeds |

`mqRSSRunLiveItemListener` and `mqRSSAddRecentlyUpdatedFeedsFromPodcastIndex` share
`FULL_STACK_COMMANDS` with `mqRSSRunParser` but only enqueue feeds; they do not write
notifications and do not get the category. `mqAddByRSSRunParser` has no ORM and writes no
notifications.

Before editing, confirm the list: `rg -n "createInAppNotificationsForAccounts|dispatchAdminNotificationCampaign|parseRSSFeedAndSaveToDatabase|runParser" apps/workers/src packages/mq/src`.
If a command not in the table reaches one of these, add it to the list and to the k8s step below,
and say so in the final message.

## Categories

In `apps/workers/src/lib/startup/categoriesForCommand.ts`:

```typescript
/** Commands that write account notifications and so publish account events through Redis. */
export const ACCOUNT_NOTIFICATION_WRITER_COMMANDS = [
  'mqRSSRunParser',
  'parserRSSParseFeed',
  'scheduledJobsRunDue',
  'devParserRSSParseArtistPublisherFeeds',
  'devParserRSSParseMusicMediumFeeds',
  'devParserRSSParsePodcasting20Feeds',
  'devParserRSSParseTrendingFeeds',
  'seedEmbedDemoShowcaseFeeds',
] as const;

/** Commands that read and write the KeyValDB cache and need it reachable at startup. */
export const KEYVALDB_CACHE_COMMANDS = ['mqAddByRSSRunParser', 'mqOpmlImportRun'] as const;

export function writesAccountNotifications(commandName: string): boolean;
export function usesKeyvaldbCache(commandName: string): boolean;
```

Implement the two predicates with a `ReadonlySet<string>` built from each list, so they need no
`as` cast. Rename the existing function body to a private `getBaseCategoriesForCommand`, and make
the exported `getCategoriesForCommand` call it and add `CATEGORY_KEYVALDB` when
`writesAccountNotifications(commandName)`. The existing command groups stay as they are.

`validateKeyvaldb` stays as it is: it still requires `KEYVALDB_CACHE_EXPIRATION`, which
`getKeyvaldbConfig` reads and which `workers.env` and `.env.example` already set.

## Publisher module

`apps/workers/src/lib/accountEvents/accountEventPublisher.ts`:

```typescript
/** Opens the publisher connection and registers it with `@podverse/orm`. */
export function startAccountEventPublisher(config: { host: string; port: number; password: string }): void;

/**
 * Waits until the publisher connection is ready, up to `timeoutMs`. Resolves false on timeout
 * and never throws; the connection keeps retrying in the background.
 */
export async function waitForAccountEventPublisherReady(timeoutMs: number): Promise<boolean>;

/** Unregisters the publisher and closes its connection. Safe to call twice. */
export async function closeAccountEventPublisher(): Promise<void>;
```

The connection is the API's publisher (plan 13): `new Redis({ host, port, password,
connectionName: 'podverse-workers-account-events-pub', retryStrategy: () =>
ACCOUNT_EVENT_REDIS_RECONNECT_DELAY_MS, enableOfflineQueue: false, maxRetriesPerRequest: 1,
lazyConnect: true })`, `connect()` without awaiting, registered with
`registerAccountEventPublisher`, errors logged once per outage with a recovery message, a second
start does nothing. Use `getLoggerService()` from `@podverse/orm` or the workers logger factory,
whichever `index.ts` already uses at this point. Do not reuse the cache client from
`lib/keyvaldb/keyvaldb.ts`: its retry strategy gives up after three attempts, and the publisher
must keep retrying for the life of a parser deployment.

## Startup

In `apps/workers/src/index.ts`:

- Gate the existing body of `if (categories.has(CATEGORY_KEYVALDB))` (cache client,
  `initKeyvaldb`, the two FATAL checks) on `usesKeyvaldbCache(commandName)` as well, so it runs
  for the two cache commands exactly as today and never for a writer.
- After the ORM databases initialize and before the command runs, when
  `writesAccountNotifications(commandName)`:
  1. `startAccountEventPublisher({ host, port, password })` from `getKeyvaldbConfig()`.
  1. `await waitForAccountEventPublisherReady(5_000)`. On false, log one warning that live
     notification events from this run may be dropped until Redis is reachable, and continue.
     One-shot commands (`scheduledJobsRunDue`, `parserRSSParseFeed`) can write within their
     first seconds, and a publish before the connection is ready is dropped because the offline
     queue is off; this wait covers the normal case without making Redis required.
  1. ``warnIfNoAccountEventPublisher(`workers ${commandName}`)`` from `@podverse/orm` (D2's
     startup check).
- One-shot commands exit through `finalizeOneShotWorkerProcess` with `process.exit`. Every
  publish is awaited inside `createMany`, so nothing is in flight at exit and no close call is
  needed there. Long-running commands keep the connection for the life of the pod.

## Tests

- `apps/workers/src/lib/startup/categoriesForCommand.test.ts`:
  - Every command in `ACCOUNT_NOTIFICATION_WRITER_COMMANDS` maps to a set containing ORM and
    KeyValDB.
  - `mqRSSRunLiveItemListener` and `mqRSSAddRecentlyUpdatedFeedsFromPodcastIndex` do not include
    KeyValDB.
  - `usesKeyvaldbCache` is true for `mqAddByRSSRunParser` and `mqOpmlImportRun` and false for
    `mqRSSRunParser`.
  - Update the existing expected sets for `scheduledJobsRunDue`, `mqRSSRunParser`, and the
    `devParserRSSParse*` commands to include KeyValDB.
- `apps/workers/src/lib/accountEvents/accountEventPublisher.test.ts`: mock `ioredis` with a fake
  `Redis` class extending `EventEmitter`, mock the logger, and mock `@podverse/orm` with
  `importOriginal` making register and unregister `vi.fn`. Use fake timers.
  - Start registers one connection named `podverse-workers-account-events-pub`; a second start
    creates nothing.
  - `waitForAccountEventPublisherReady` resolves true when `ready` fires before the timeout and
    false when it does not.
  - Two `error` events between `ready`s log one warning; the next `ready` logs one recovery.
  - Close twice unregisters and quits once.
- Existing tests: `runDue.test.ts` mocks `@podverse/orm` wholesale, and
  `runOpmlImport.integration.test.ts` builds a real ORM context but runs OPML import, which
  writes no notifications. Run
  `rg -n "createORMContext" apps/workers/src --glob '*.test.ts'` and, for any test that reaches
  `createMany` unmocked with `nodeEnv` `test`, register `{ publish: async () => 0 }` in setup and
  unregister in teardown.

## Kubernetes

Add `podverse-keyvaldb-opaque` to the main container's `envFrom` in each workload that runs a
writing command, after `podverse-mq-opaque`, matching `parser-opml-import.deployment.yaml`:

```yaml
            - secretRef:
                name: podverse-keyvaldb-opaque
```

- `infra/k8s/base/workers/parser-normal.deployment.yaml` (`mqRSSRunParser`)
- `infra/k8s/base/workers/parser-live.deployment.yaml` (`mqRSSRunParser`)
- `infra/k8s/base/workers/parser-ondemand.deployment.yaml` (`mqRSSRunParser`)
- `infra/k8s/base/cron/worker-scheduled-jobs.cronjob.yaml` (`scheduledJobsRunDue`; keep the
  cronjob's deeper indentation)
- `infra/k8s/base/ops/seed-embed-demo-showcase-feeds.cronjob.yaml` (`seedEmbedDemoShowcaseFeeds`)

`podverse-workers-config` already sets `KEYVALDB_HOST`, `KEYVALDB_PORT`, and
`KEYVALDB_CACHE_EXPIRATION`. No init container is added: these workloads must start when Redis is
down. Check `infra/k8s/` overlays for a patch to any of these five workloads that replaces
`envFrom`; none existed when this plan was written.

Local Docker workers read `infra/config/local/workers.env`, which `scripts/local-env/setup.sh`
already fills with the KeyValDB host, port, and password, so local env needs no change.

## Docs

- `apps/workers/ENV.md`, command table: add KeyValDB to the categories of the
  `parserRSSParseFeed, scheduledJobsRunDue, devParserRSSParse*` row and of the `mqRSSRunParser`
  part of the Full stack row (split `mqRSSRunLiveItemListener` into its own row without
  KeyValDB). Add `seedEmbedDemoShowcaseFeeds` and `devParserRSSParseArtistPublisherFeeds` to the
  first of these rows if they are missing.
- `apps/workers/ENV.md`, `## KeyValDB (commands that use Redis)`: one paragraph. The cache
  commands (`mqAddByRSSRunParser`, `mqOpmlImportRun`) require Redis at startup. The commands that
  write notifications open a separate connection to publish account events on
  `podverse:account-events`, do not require Redis at startup, and drop events with a warning
  while it is unreachable.
- `apps/workers/.env.example`: one comment line above the KeyValDB block saying the same in a
  sentence.

## Release scratchpad

```markdown
## Workers publish account events to Redis

- Surfaces: workers, k8s base workers and cron manifests, ops
- Change: parser workers (`mqRSSRunParser`, `parserRSSParseFeed`, the dev parse commands,
  `seedEmbedDemoShowcaseFeeds`) and the scheduled-job runner (`scheduledJobsRunDue`) now open one
  Redis (Valkey) connection and publish an account event on `podverse:account-events` after they
  write notifications, so open account event streams show parser and campaign notifications
  within about a second. These commands now validate `KEYVALDB_HOST`, `KEYVALDB_PORT`,
  `KEYVALDB_PASSWORD`, and `KEYVALDB_CACHE_EXPIRATION`. They still start and run when Redis is
  down; events are dropped and logged.
- Who notices: operators (new secret mount, one more Redis connection per parser pod and per
  scheduled-job run)
- Operator steps: the base manifests now mount `podverse-keyvaldb-opaque` on the three parser
  deployments, the scheduled-jobs cronjob, and the showcase seed cronjob. Anyone running these
  commands outside those manifests must set the `KEYVALDB_*` vars, or startup validation fails.
```
