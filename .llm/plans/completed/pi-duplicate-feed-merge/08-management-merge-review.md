# 08 — Management merge review

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

## Summary

Pairs the matcher will not apply on its own show up in management web. An admin can approve,
reject, or revert. Approving does not merge in the request; it marks the row so the next apply
run does.

Depends on [04-apply-merge-server.md](./04-apply-merge-server.md). Do not edit mobile or the
parser. Register list routes **before** `/feeds/:id` so `merges` is not parsed as an id.

## API

Add routes on the feeds router in
[apps/management-api/src/routes/feeds.ts](apps/management-api/src/routes/feeds.ts) (or a router
mounted at `/feeds/merges` ahead of `/:id`).

| Method | Path | Permission | Action |
| --- | --- | --- | --- |
| `GET` | `/feeds/merges` | `requireCrud('feeds', 'read')` | Paginated list. Query `status` optional. Default `needs_review`. Include from/to Podcast Index ids, channel titles, `confidence`, `mode`, `status`. |
| `GET` | `/feeds/merges/:id` | read | `match_stats` plus up to 20 item pairs: old title, survivor title, tier. |
| `POST` | `/feeds/merges/:id/approve` | `requireCrud('feeds', 'update')` | Allowed from `needs_review` only. Set `verified` and store `note`. Do not run the merge. |
| `POST` | `/feeds/merges/:id/reject` | update | Allowed from `detected`, `verified`, or `needs_review`. Set `rejected` and `note`. |
| `POST` | `/feeds/merges/:id/revert` | update | Calls `revertChannelMerge` from plan 04. Allowed from `applied` only. |

`ensureAuthenticated` on each, same as the other feed routes. Joi schemas in
`apps/management-api/src/schemas/`, not inline. Audit-log the three posts the same way
`PATCH /:id/policy-state` does.

Update `apps/management-api/openapi.yml` (**openapi-sync**): `operationId`, security, one
example on each POST.

## Web

Follow the flag-status page, not a new visual system.

- Route constant `FEEDS_MERGE_REVIEW` in `apps/management-web/src/lib/routes.ts`.
- Hub card on `FeedsPageClient` next to flag status.
- Page `apps/management-web/src/app/(management)/feeds/merge-review/` with the same
  `canReadFeeds` gate as flag status.
- Table of pairs, status filter, detail drawer or page with the sample pairs, and Approve /
  Reject / Revert. Revert asks for confirmation (destructive). Disable Revert unless status is
  `applied`. Disable Approve unless status is `needs_review`.

Copy goes through the management catalog originals (`en-US`, `es`, `fr`, `el-GR`). English
chrome is title case (`Merge Review`, `Needs Review`). Do not edit `overrides/`. Do not put
strings in `@podverse/ui`.

## Tests

Management-web E2E `apps/management-web/e2e/feeds-merge-review.spec.ts`:

- A seeded `needs_review` row appears.
- Approve moves it to `verified` and does not change follows (assert the old feed is not yet
  `merged`).
- Reject hides it from the default list.

Use the existing management auth fixture. Follow **e2e-page-tests** and
**management-post-save-navigation** only if you add a dedicated edit page; a drawer that stays
on the list does not navigate away.

## Scratchpad

Append to `release-notes/scratchpad.md`:

```markdown
## Operators can review show merges

- Surfaces: management-api, management-web
- Change: Duplicate feeds Podcast Index marked, but that do not clearly share episodes, wait in
  Merge Review. Approve lets the next apply run move them. Revert undoes an applied merge.
- Who notices: operators, not listeners
```

## Done when

- The default list is `needs_review`.
- Approve does not itself move follows or queue rows.
- Revert uses the plan 04 function and is refused for any other status.

## Operator verification

**Root** — do not set `E2E_API_GATE_MODE`.

```bash
make e2e_test_management_web_report_spec SPEC=e2e/feeds-merge-review.spec.ts
open .artifacts/e2e-reports/latest/index.html
```
