# 80 — Channel "may have livestreams" flag (server)

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

## Rows

- **R53** (server half): a channel remembers that its feed has carried a live item, even after
  the parser archives that item. Plan 82 is the Add by RSS device half.
- **R62** (server half): the flag never changes a channel's medium. Plan 88 is the Add by RSS
  half.

Runs first in area H. Plans 81, 83, and 87 read the seed rows this plan adds.

## The flag is not a medium (R62)

The operator: "The livestream designation is a flag in addition to their designation as a
podcast, video, music, etc." Regular content already follows that model; this plan keeps it and
no plan in the set adds a livestream medium or channel type. Checked in the code:

- **Medium comes from the feed.** `MediumEnum` (`packages/helpers/src/lib/medium.ts`) and the
  `medium_value_check` constraint in `0001_app_schema.sql` list podcast, music, video, the list
  mediums, and publisher mediums. None is a livestream medium.
- **Live items are their own rows.** `public.live_item` holds `item_id`, `live_item_status_id`,
  `start_time`, `end_time`, and `chat_web_url`. Its item belongs to the channel like any other
  item. The channel's `medium_id` is not touched.
- **Live items have their own API.** `apps/api/src/routes/liveItem.ts` mounts `/live-item/*`
  (global, category, subscribed, and channel lists) beside the channel and item routes.
- **Links are medium plus `livestream`.** `APP_ROUTES.PODCAST_LIVESTREAM` (`/podcast/livestream`)
  and `APP_ROUTES.MUSIC_LIVESTREAM` (`/music/livestream`) in `appRoutes.ts`. The notification
  link picks one from the channel's medium (`livestream-started` / `livestream-scheduled`).

So a channel with live items stays on its medium's chips (Podcasts, or Artists and Albums). Its
regular items list on Episodes or Tracks, and its live items list on Livestreams (plan 81).
`may_have_live_items` only records that live items have appeared. The update below passes
`medium_id: channel.medium_id`, which writes the stored medium back unchanged, as
`has_value_time_splits` does. It never derives a medium from live items.

## Parity source

`channel.has_value_time_splits`: a channel boolean the parser sets once and never clears, in
`packages/parser/src/lib/rss/item/itemValue.ts` (`if (!channel.has_value_time_splits) { …
channelService.update(channel.id, { has_value_time_splits: true, medium_id: channel.medium_id
}) }`). Copy its column, entity, DTO, and update shape.

## Locked decisions

1. **Name.** `may_have_live_items` on `public.channel`, `boolean DEFAULT false NOT NULL`. The
   name follows the `live_item` table, not the UI word "livestream".
2. **Sticky.** The parser sets it to `true` whenever a parse carries at least one
   `podcast:liveItem` of any status (pending, live, or ended). Nothing clears it. Archiving a
   live item that left the feed leaves the flag alone.
3. **Count.** Use `parsedLiveItems.length` (before dedupe and before `itemKeysToSkip`). A
   `liveItem` tag in the feed is what the flag records, even if a regular item shares its key.
4. **Backfill.** The migration sets the flag for every channel with any `live_item` row today,
   whatever its status or flag status.
5. **DTO is optional.** `DTOChannel.may_have_live_items?: boolean`. Mobile stores channel
   payloads on the device and builds `DTOChannel` literals (`engineSourceAdoption.ts`,
   `buildChannelFromDownload.ts`); an optional field keeps those readable
   (**dto-changes-are-device-data-migrations**). Readers treat anything but `true` as false.
6. **Flag only.** Setting the flag changes no other channel column, and nothing reads it to
   pick a chip, a route, or a medium.
7. **No reader yet.** No API filter or UI reads the flag in this set. Channel responses carry it
   because the entity column serializes. Plans 83–86 do not filter by it on the server: the
   upcoming query (plan 81) reads `live_item` status directly.
8. **Seed.** Both seeded livestream channels get the flag and keep their medium. One scheduled
   item joins `E2E Live AV Channel` so the chip lists show live first, then scheduled.

## Files

`<linear-migrations>` is `infra/k8s/base/ops/source/database/linear-migrations`.

| Path                                                                 | Change                  |
| -------------------------------------------------------------------- | ----------------------- |
| `<linear-migrations>/app/0021_channel_may_have_live_items.sql`       | New migration           |
| `infra/k8s/base/ops/kustomization.yaml`                              | File list and marker    |
| `infra/k8s/base/api/source/api.env`                                  | Readiness marker        |
| `infra/k8s/base/db/source/bootstrap/0004_app_linear_baseline.sql.gz` | Regenerated, not edited |
| `packages/orm/src/entities/channel/channel.ts`                       | Column                  |
| `packages/orm/src/services/channel/channel.ts`                       | `ChannelDto` field      |
| `packages/helpers/src/dtos/channel/channel.ts`                       | `DTOChannel` field      |
| `packages/parser/src/lib/rss/liveItem/channelLiveItemFlag.ts`        | New                     |
| `packages/parser/src/lib/rss/liveItem/channelLiveItemFlag.test.ts`   | New, Vitest             |
| `packages/parser/src/lib/rss/liveItem/liveItem.ts`                   | Call the helper         |
| `tools/web/seed-e2e.mjs`                                             | Flag and scheduled item |
| `apps/web/e2e/helpers/seedConstants.ts`                              | Scheduled item consts   |

## Implementation

### Migration `0021_channel_may_have_live_items.sql`

Greenfield-only (**linear-sql-greenfield-only**); no `IF NOT EXISTS`. Match the header comment
style of `0020_add_by_rss_feed_identity.sql`.

```sql
-- A channel whose feed has carried a podcast:liveItem at least once. The parser sets it and never
-- clears it, so it outlasts the live item itself, which is archived once it leaves the feed.
ALTER TABLE public.channel
    ADD COLUMN may_have_live_items boolean DEFAULT false NOT NULL;

UPDATE public.channel
SET may_have_live_items = true
WHERE id IN (
    SELECT item.channel_id
    FROM public.live_item
    JOIN public.item ON item.id = live_item.item_id
);
```

### Infra markers

- `infra/k8s/base/ops/kustomization.yaml`: add the new file to the app linear-migration list
  right after the `0020_add_by_rss_feed_identity.sql` entry (lines 61–62), and set
  `API_EXPECTED_MIGRATION_FILENAME` (line 28) to `0021_channel_may_have_live_items.sql`.
- `infra/k8s/base/api/source/api.env` line 45: the same marker value.
- `rg -n '0020_add_by_rss_feed_identity' infra` afterward; any other marker that names the
  newest app migration moves to `0021` too (**migration-readiness-marker-sync**). Management
  markers name the management chain and stay.
- Run `make db_regen_linear_baseline`, then `make db_verify_linear_baseline`
  (**linear-baseline-0004**). If Docker is not available, say so in the final message and leave
  the archives untouched; the operator regenerates them.

### ORM entity and DTO

- `packages/orm/src/entities/channel/channel.ts`, right after the `has_value_time_splits`
  column (around line 88):

```typescript
@Column({ type: 'boolean', default: false })
may_have_live_items!: boolean;
```

- `ChannelDto` in `packages/orm/src/services/channel/channel.ts` (around line 29): add
  `may_have_live_items?: boolean;` next to `has_value_time_splits`.

### Helpers DTO

`DTOChannel` in `packages/helpers/src/dtos/channel/channel.ts`, after `has_value_time_splits`:

```typescript
/** True once the feed has carried a live item; never cleared. Absent on older stored payloads. */
may_have_live_items?: boolean;
```

### Parser helper `channelLiveItemFlag.ts` (new)

Only type imports from `@podverse/orm`, so the test needs no database mock.

```typescript
import type { Channel, ChannelService } from '@podverse/orm';

/**
 * Records that this channel's feed carries live items. Writes only when the flag is still false;
 * the flag is never cleared.
 */
export const markChannelMayHaveLiveItems = async (
  channel: Pick<Channel, 'id' | 'may_have_live_items' | 'medium_id'>,
  parsedLiveItemCount: number,
  channelService: Pick<ChannelService, 'update'>
): Promise<boolean> => {
  if (parsedLiveItemCount === 0 || channel.may_have_live_items) {
    return false;
  }
  await channelService.update(channel.id, {
    may_have_live_items: true,
    medium_id: channel.medium_id,
  });
  return true;
};
```

Use the same import specifier style as the other files in `lib/rss/liveItem/`
(**import-specifiers-tiered**). If `Channel` or `ChannelService` is not exported from
`@podverse/orm` under those names, use the names `itemValue.ts` imports.

### `liveItem.ts`

In `handleParsedLiveItems`, before the batches run, call:

```typescript
await markChannelMayHaveLiveItems(channel, parsedLiveItems.length, new ChannelService());
```

Import `ChannelService` the way `itemValue.ts` does. Place the call before any early return for
an empty batch so a feed whose live items all dedupe away still sets the flag.

### Seed `tools/web/seed-e2e.mjs`

- Constants beside `E2E_LIVE_AV_VIDEO_ITEM_TITLE` (around line 265):
  `E2E_LIVE_AV_SCHEDULED_ITEM_ID_TEXT = 'e2eLiveSched01'` (14 characters,
  **e2e-seed-nano-id-limits**) and `E2E_LIVE_AV_SCHEDULED_ITEM_TITLE = 'E2E Scheduled Livestream'`.
- `insertLiveItem` (around line 1958) gains two parameters with defaults that keep today's calls
  unchanged: `statusName = 'live'` and `startsInDays = 0`. The `live_item` insert becomes:

```sql
INSERT INTO live_item (item_id, live_item_status_id, start_time)
VALUES ($1, (SELECT id FROM live_item_status WHERE status = $2 LIMIT 1),
        NOW() + ($3 * INTERVAL '1 day'))
```

with `[itemId, statusName, startsInDays]`.

- After the two existing calls: `insertLiveItem({ idText: E2E_LIVE_AV_SCHEDULED_ITEM_ID_TEXT,
guidSlug: 'scheduled', title: E2E_LIVE_AV_SCHEDULED_ITEM_TITLE, enclosureType: 'audio/mpeg',
enclosureUrl: E2E_PODCAST_SHORT_ENCLOSURE_URL, statusName: 'pending', startsInDays: 1 })`.
  Add it to the `console.log` line.
- After that channel's items: `UPDATE channel SET may_have_live_items = true WHERE id = $1` with
  the Live AV channel id. Do the same in the E2E Livestream Channel (`v5fCrIj9Io`) block, after
  its `live_item` insert.
- `live_item_status.status` allows `'pending'`, `'live'`, and `'ended'` (check constraint in
  `0001_app_schema.sql`).

### `apps/web/e2e/helpers/seedConstants.ts`

Beside the Live AV constants (around lines 279–284), mirror the two new constants with the same
names and values.

## Reuse

The `has_value_time_splits` column, entity, DTO, and parser update shape; the seed's
`insertLiveItem`.

## Tests

**Unit** — `channelLiveItemFlag.test.ts` with a fake `{ update: vi.fn() }` service:

- Count 0 and a false flag: no update, returns false.
- Count 2 and a false flag: one update with exactly `{ may_have_live_items: true, medium_id }`
  for the channel id, where `medium_id` is the channel's own value, returns true.
- Count 2 and a true flag: no update (the flag is never rewritten or cleared).

`packages/parser/vitest.config.ts` includes `src/**/*.test.ts`, so the file runs as is.

**Migration** — covered by `make db_verify_linear_baseline` and the API integration suite.

## Release scratchpad

Append to `release-notes/scratchpad.md`:

```markdown
## Channels remember that they may have livestreams

- Surfaces: database (app linear migration 0021), parser/workers, api, k8s base env
- Change: `channel.may_have_live_items` is set the first time a parse sees a `podcast:liveItem`
  and never cleared, so it survives the live item being archived. The migration backfills it
  from existing live items. Channel API responses include the field. The flag sits beside the
  channel's medium and never changes it: a podcast with livestreams is still a podcast.
- Who notices: nobody yet; later list filters read it
- Operator steps: the migration applies on deploy; the API readiness marker is now
  `0021_channel_may_have_live_items.sql`
```
