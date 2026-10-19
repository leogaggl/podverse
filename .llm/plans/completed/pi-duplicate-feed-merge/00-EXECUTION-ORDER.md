# Execution order

Decisions: [00-SUMMARY.md](./00-SUMMARY.md). Prompts: [COPY-PASTA.md](./COPY-PASTA.md).

Phases run in order. Wait for every prompt in a phase to finish before the next phase. Prompts
in the same phase do not share files and may run at the same time.

| Phase | Prompts | Wait for |
| --- | --- | --- |
| 1 | 01 data model, 03 matching helpers | — |
| 2 | 02 detection sync, 05 parse side-effect guard | Phase 1 |
| 3 | 04 apply merge | Phase 2 |
| 4 | 06 API and web redirects | Phase 3 |
| 5 | 07 mobile remap, 08 management review | Phase 4 |

07 and 08 both read the applied-merge contract from 04 and 06. They do not edit the same files.
07 must not add management routes. 08 must not edit `apps/mobile`.

## File ownership

| Prompt | Owns | Must not edit |
| --- | --- | --- |
| 01 | `0015_channel_merge.sql`, lifecycle enum, transition matrix, policy gates, ORM entities for the new tables | Worker commands, parser notification block |
| 03 | New pure matcher module; `deduplicator.helpers.ts` delegates to it | `deduplicator.ts` merge SQL (04 replaces that) |
| 02 | CSV sync command, cron, `PODCAST_INDEX_DUPLICATE_MERGE_MODE`, recent-feed skip, `podcast_guid` collision in channel update | `parser.ts` notification block (05), ORM merge (04) |
| 05 | `parser.ts` new-episode notification and auto-download calls, plus the suppress option | Channel update, CSV sync |
| 04 | Apply + revert transaction, journal writes, worker apply command | Web routes, mobile |
| 06 | API 410, `POST /identity/resolve`, web `permanentRedirect` | Mobile SQLite, management-web pages |
| 07 | Mobile sync job and local key rewrite | Server merge SQL |
| 08 | management-api merge routes, management-web review page | Mobile, parser |

## Rollout (operator, after the code is on alpha)

1. Ship with `PODCAST_INDEX_DUPLICATE_MERGE_MODE=off` (the base default).
2. Set alpha workers to `dry_run`. Let one cron pass finish. Read `channel_merge` counts by
   status. Open management review and spot-check a `needs_review` row and a `verified` row.
3. Set alpha to `apply`. Confirm one re-point and one absorb against real Podcast Index pairs
   (the Grimerica feeds Dave fixed are a useful pair once they appear in the CSV).
4. Only then consider `apply` anywhere else.

Do not un-suspend the cron in an environment whose mode is unset. The base manifest sets `off`.
