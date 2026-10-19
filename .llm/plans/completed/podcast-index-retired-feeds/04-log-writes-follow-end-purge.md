# 04 — Log writes, follow end, purge

**Cursor model:** Opus 5.5 · **Reasoning:** high

## Summary

Write one Removed Content row per account per show, end directory follows that conversion
left behind, and purge the table after 30 days. Decisions: 00-SUMMARY 8 through 11.

Depends on 01 and on `removed-content-references` (`convertArchivedShowFollows`,
`removeAllItemsForTakedownFeeds`, `captureRemovedReferences`). Do not rewrite
`processPendingArchiveFeeds`.

## Service

`packages/orm/src/services/accountContentLog.ts`. Export it from `packages/orm/src/index.ts`.

```ts
export const ACCOUNT_CONTENT_LOG_MAX_ROWS = 100;
export const ACCOUNT_CONTENT_LOG_MAX_NEW_PER_SHOW = 5000;
export const ACCOUNT_CONTENT_LOG_WRITE_CHUNK = 500;

export type AccountContentLogWrite = {
  accountId: number;
  channelIdText: string;
  channelTitle: string | null;
  reason: 'left_directory' | 'taken_down';
  followOutcome: 'ended' | 'moved_to_add_by_rss' | null;
  clipCount: number;
  playlistEntryCount: number;
};

export async function upsertAccountContentLogs(
  rows: AccountContentLogWrite[],
  manager?: EntityManager
): Promise<{ written: number; trimmed: number }>;
```

One statement per chunk of 500, `INSERT ... ON CONFLICT (account_id, log_type, channel_id_text) DO UPDATE`:

- `log_type` is always `removed_content`.
- `reason` becomes `taken_down` if either side is `taken_down`.
- `follow_outcome` stays `moved_to_add_by_rss` if either side is that value. Otherwise the
  new value fills a null, and `ended` may replace null.
- Counts use `GREATEST`.
- `channel_title` uses the new value when it is non-null.
- `updated_at = now()`. `created_at` is set only on insert.

Then, for each touched account, delete rows beyond `ACCOUNT_CONTENT_LOG_MAX_ROWS`, oldest
`updated_at` first. Callers that pass a manager run inside that transaction.

If `rows` is longer than `ACCOUNT_CONTENT_LOG_MAX_NEW_PER_SHOW`, write the first 5,000
(ordered by `accountId`) and log a warning with the channel id and the omitted count. The
caller still ends every follow.

Unit-test the SQL shape with a mocked manager, in the style of `archiver.test.ts`: conflict
target, `taken_down` not downgraded, `moved_to_add_by_rss` kept, greatest count, and the
5,000 cut.

## Left the directory

In `convertArchivedShowFollows` (the file `removed-content-references` added; follow the
behavior if the file name differs):

- When a follower's directory follow is deleted and an Add-by-RSS follow is inserted, add a
  write with `reason` `left_directory`, `followOutcome` `moved_to_add_by_rss`, counts 0.
  Use the channel `id_text` and title. Upsert in that same transaction.

New function in the same module:

```ts
export async function endSettledDirectoryFollows(): Promise<{ ended: number }>;
```

Select channels whose feed lifecycle is `archived` and `follow_conversion_status` is
`converted`, `unreachable`, or `no_followers`, and that still have
`account_following_channel` rows. Cap the channel scan at 100 per run, matching
`FOLLOW_CONVERSION_MAX_CHANNELS_PER_RUN`.

For each channel, load the remaining followers. Delete every
`account_following_channel` row for that channel. Upsert `left_directory` / `ended` / counts
0 for those accounts, subject to the 5,000 cut. A show with no remaining follows is a no-op.

Call it from `archiveAll` immediately after `convertArchivedShowFollows`. Do not move the
other steps.

## Taken down

Inside `removeAllItemsForTakedownFeeds`, in the per-feed transaction, after
`captureRemovedReferences` and before the items are deleted:

1. Count clips grouped by `clip.account_id` for this channel's items.
2. Count `playlist_resource` rows grouped by `playlist.account_id` for those items and for
   soundbites of those items. One playlist owner is one account; sum their rows.
3. Load `account_following_channel` account ids for the channel.
4. Build one write per account in that union. `reason` `taken_down`. Followers get
   `followOutcome` `ended` unless the upsert rules will keep an earlier
   `moved_to_add_by_rss`. Accounts with no follow get `followOutcome` null. Counts are that
   account's clip and playlist counts.
5. Upsert, then delete the `account_following_channel` rows for the channel.

Do this even when the show has no followers, so a clip owner still gets a row. Skip the
upsert when the union is empty.

## Purge

`apps/workers/src/commands/orm/accountContentLog/purge.ts`, command name
`accountContentLogPurge`. Follow `notificationsPlatformPurge`: read the retention config,
`subtractDays`, delete where `updated_at` is before the cutoff, log the count.

Wire it the way `notificationsPlatformPurge` is wired:

- `apps/workers/src/commands/index.ts`
- `packages/worker-commands/src/registry.ts` (category that matches a purge, risk `normal`)
- `apps/workers/src/lib/startup/categoriesForCommand.ts` next to `notificationsPlatformPurge`
  (`BASE_ORM_COMMANDS`), and the matching case in `categoriesForCommand.test.ts`

Retention env `ACCOUNT_CONTENT_LOG_RETENTION_DAYS`, default 30, optional, same pattern as
`NOTIFICATION_RETENTION_DAYS`:

- `apps/workers/src/config/index.ts`
- `apps/workers/src/lib/startup/validation.ts` (same section order as the env files)
- `apps/workers/.env.example` quoted `"30"`
- `infra/k8s/base/workers/source/workers.env` unquoted `30`, its own comment line
- `apps/workers/ENV.md`

Cron `infra/k8s/base/cron/worker-account-content-log-purge.cronjob.yaml`, schedule
`"15 4 * * *"`, `concurrencyPolicy: Forbid`, `backoffLimit: 0`, same container shape as
`worker-notifications-purge.cronjob.yaml`. Command argument `accountContentLogPurge`. Add the
file to `infra/k8s/base/cron/kustomization.yaml`. Do not copy the placeholder comment in the
notifications cron.

## Scratchpad

```markdown
## Removed Content log and follow end

- Surfaces: orm, workers, k8s cron, workers env
- Change: archiveAll ends directory follows after conversion settles and writes one
  account_content_log row per account per show. Takedown does the same and records clip and
  playlist counts. accountContentLogPurge deletes rows whose updated_at is older than
  ACCOUNT_CONTENT_LOG_RETENTION_DAYS (default 30). No push or email.
- Who notices: signed-in users, once the API and screens ship. Operators get a daily purge cron.
- Operator steps: deploy the cron with the migration. Base retention is 30.
```

## Done when

- A second write for the same account and channel updates one row.
- Ending follows still happens for accounts past the 5,000 log cut.
- Comments do not cite a plan or a step number.

## Operator verification

**Root**

```bash
npm run build:packages
npm run test -w packages/orm
npm run test -w apps/workers
npm run build -w apps/workers
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/cron
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/workers
```
