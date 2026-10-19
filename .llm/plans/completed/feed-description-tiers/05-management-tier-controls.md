# 05 — Management tier controls

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

## Summary

An admin can see which feeds had descriptions shortened, see the smallest tier that would fit,
and pick a tier from presets. A change schedules a forced reparse, so the feed's notes come back
within one runner pass (about 5 minutes) plus the parse.

Depends on 01 (tier helpers) and 03 (columns, `scheduleFeedForceReparse`). Follow the existing
`spam_item_limit_override` wiring end to end; do not invent a new pattern. Do not edit apps/api,
the parser, or the consumer catalog.

## API — `apps/management-api`

`schemas/feedOperationsPolicy.ts`, in the PATCH body:

```ts
description_length_tier_override: Joi.string()
  .valid(...Object.values(DescriptionLengthTierEnum))
  .allow(null)
  .optional(),
```

Add it to the `hasMutation` check. Null resets to the default tier.

`schemas/feedOperationsListQuery.ts`:

- Add `description_truncated: Joi.boolean().optional()`. True means
  `description_truncated_count > 0`.
- Add `description_longest_source_length` to `SORT_KEYS`.

`lib/feed/feedFlagStatusAppDb.ts`:

- Row type, select, and mapping: add the four new `feed` columns.
- Lookup and list results also carry two derived fields:
  - `description_length_tier_effective`: `resolveDescriptionLengthTier(override)`
  - `description_length_tier_suggested`: `suggestDescriptionLengthTier(longest)`, null when
    unknown or beyond Maximum
- Update path: write `description_length_tier_override` beside the other overrides. When the
  new value differs from the stored one, call
  `scheduleFeedForceReparse(feed.id, 'description_tier_change', new Date())` after the update
  commits. An unchanged value schedules nothing.
- List filter and sort for the new query fields. The partial index from 03 covers
  `description_truncated=true` sorted by longest source.

`routes/feeds.ts`, `PATCH /:id/policy-state`: map the field into the update params. Add it to
the audit-log payload with before and after values, the same way the spam limit is logged.
Return the refreshed lookup, which includes the derived fields.

`lib/database/tablePolicy.ts`: list the four new `feed` columns. Mark
`description_length_tier_override` `updatable: false`. The table browser must not change the
tier, because only policy-state schedules the reparse. Mark the three telemetry columns
`updatable: false` too.

`apps/management-api/openapi.yml` (**openapi-sync**): the PATCH body field with its enum, the
list query parameter and sort key, and the six response fields. Add one example.

## Request client — `packages/management-api-requests/src/feeds.ts`

Add the PATCH field, the list query field, and the six response fields to the types. Use the
helpers enum type for the tier fields.

## Web — management-web flag-status page

`apps/management-web/src/app/(management)/feeds/flag-status/FlagStatusPageClient.tsx`:

- In the overrides section beside the spam limit: a `FormDropdown` with
  `eyebrow={t('descriptionLength')}` (**management-web-form-eyebrow**). Options:
  - **Default (Standard)**, value null
  - **Standard — 10,000 Characters**
  - **Extended — 25,000 Characters**
  - **Maximum — 50,000 Characters**

  Build the labels from `DESCRIPTION_LENGTH_TIERS`, with numbers formatted by the page locale,
  so the copy cannot drift from the limits.
- Initialize it in `setFeedStateFromLookup` the way the spam limit input is initialized. Send it
  in the same apply request.
- In the read-only `DescriptionList`: **Shortened Descriptions** (count), **Longest
  Description** (characters, or the empty value), **Last Shortened** (local date and time per
  **time-format-local**), and **Suggested Tier** (tier label, or **Exceeds Maximum**).
- After a successful apply that changed the tier, show the existing success message plus one
  sentence: "A reparse is scheduled. Full notes appear after the next parse."
- Directory table: a filter control **Shortened Descriptions Only** that sets
  `description_truncated=true`, and a sortable **Longest Description** column. Follow
  **management-web-tables** and **tables-support-sorting**.

Copy goes in the management catalog originals (`en-US`, `es`, `fr`, `el-GR`) under
`packages/i18n-catalog/management/originals/`. English chrome is title case (**ui-copy-casing**);
the reparse sentence is sentence case. Translate es, fr, and el-GR in each language's own
capitalization. Do not edit `overrides/` or put strings in `@podverse/ui`.

## Tests

`apps/management-api/src/routes/feeds.integration.test.ts`:

- PATCH `extended` stores it, clears `last_parsed_file_hash`, and creates one pending
  `scheduled_job` row with dedupe key `feed-force-reparse:<id>`.
- Repeating the PATCH with the same tier creates no second row.
- PATCH null resets to the default, and the lookup reports `standard` as effective.
- PATCH `huge` returns 400.
- The list with `description_truncated=true` returns only a seeded feed whose count is above 0,
  sorted by longest source.
- The table-browser update of `description_length_tier_override` is refused.

`apps/management-web/e2e/feeds-flag-status.spec.ts`: open a seeded feed, choose **Extended —
25,000 Characters**, apply, reload, and see it selected. If the management seed has no feed
with truncation telemetry, add one deterministic feed to the management E2E seed with a count,
a longest source, and a suggested tier, and assert those read-only rows. Follow
**e2e-page-tests**.

## Scratchpad

Append to `release-notes/scratchpad.md`:

```markdown
## Admins can raise a feed's description length

- Surfaces: management-api, management-web
- Change: Flag Status shows how many of a feed's descriptions were shortened, the longest
  source, and the smallest tier that fits. Admins choose Standard (10,000), Extended (25,000),
  or Maximum (50,000). A change schedules a forced reparse. The directory can filter to feeds
  with shortened descriptions, sorted by longest source.
- Who notices: operators
```

## Done when

- The tier changes only through `PATCH /feeds/:id/policy-state`.
- An unchanged tier never schedules a reparse.
- No hardcoded limit numbers in management-web; labels come from `DESCRIPTION_LENGTH_TIERS`.
- Code comments must not cite this plan or any plan number.

## Operator verification

**Root** — API tests need `make test_deps` (Postgres 5732, Valkey 6679). Do not set
`E2E_API_GATE_MODE`.

```bash
npm run build:packages
npm run test -w apps/management-api
make e2e_test_management_web_report_spec SPEC=e2e/feeds-flag-status.spec.ts
open .artifacts/e2e-reports/latest/index.html
```
