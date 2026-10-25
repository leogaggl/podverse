# Web 404 hardening — execution order

Request: [00-REQUEST.md](00-REQUEST.md). Ledger and decisions: [00-SUMMARY.md](00-SUMMARY.md).
Prompts, models, and reasoning: [COPY-PASTA.md](COPY-PASTA.md).

Phases run one after another. Prompts inside one phase run at the same time and edit disjoint
files. The operator runs tests once, after Close.

## Phase 1 — loader, guidance, item null checks, API playlist read (4 prompts at once)

| Prompt | Plan | Owns |
| --- | --- | --- |
| 10 | [10-shared-not-found-loader.md](10-shared-not-found-loader.md) | `apps/web/src/lib/ssr/loadOrNotFound.ts`, `apps/web/src/lib/ssr/loadOrNotFound.test.ts`, `apps/web/src/lib/seo/fetchers.ts`, `apps/web/e2e/detail-route-not-found.spec.ts`, `makefiles/local/e2e-spec-order-web.txt` |
| 11 | [11-detail-route-not-found-guidance.md](11-detail-route-not-found-guidance.md) | `.cursor/rules/web-detail-route-not-found.mdc`, `.cursor/rules/rule-index.mdc` |
| 30 | [30-item-detail-null-not-found-checks.md](30-item-detail-null-not-found-checks.md) | `apps/web/src/app/clip/[clip_id]/page.tsx`, `apps/web/src/app/chapter/[item_chapter_id_text]/page.tsx`, `apps/web/src/app/official-clip/[item_soundbite_id]/page.tsx` |
| 50 | [50-playlist-get-signed-in-non-owner.md](50-playlist-get-signed-in-non-owner.md) | `apps/api/src/controllers/playlist/playlist.ts`, `apps/api/src/test/playlist.test.ts`, `apps/api/src/test/api-key-routes-playlists-queue-clips.integration.test.ts`, `apps/api/openapi.yml` |

Why these share a phase:

- 11 writes guidance text that names the loader and the profile redirect; it needs neither to
  exist yet.
- 30 deletes null checks that are already unreachable, because the item, clip, chapter, and
  soundbite requests throw on a 404 today. It reads `fetchers.ts` but does not edit it.
- 50 is API-only. Plan 40's spec runs signed out, so it does not depend on 50.
- `release-notes/scratchpad.md` is the only shared file. Prompts 10 and 50 put their entries in
  their final messages; Close appends them.

## Phase 2 — channel and feed re-check, playlist and edit pages, profile (3 prompts at once)

Start only after every Phase 1 prompt is done. All three use plan 10's wrapped fetchers.

| Prompt | Plan | Owns |
| --- | --- | --- |
| 20 | [20-channel-feed-detail-routes.md](20-channel-feed-detail-routes.md) | no files; confirms five channel and feed pages still match the re-check |
| 40 | [40-playlist-and-edit-routes-not-found.md](40-playlist-and-edit-routes-not-found.md) | `apps/web/src/app/playlist/[playlist_id]/page.tsx`, `apps/web/src/app/playlist/edit/[playlist_id]/page.tsx`, `apps/web/src/app/clip/edit/[clip_id]/page.tsx`, `apps/web/e2e/playlist-and-edit-route-not-found.spec.ts`, `makefiles/local/e2e-spec-order-web.txt` |
| 41 | [41-profile-route-not-found.md](41-profile-route-not-found.md) | `apps/web/src/app/profile/[id_text]/page.tsx`, `apps/web/src/app/profile/[id_text]/page.test.ts`, `apps/web/e2e/seo-profile-sharable-status.spec.ts` |

- 40 inserts its spec-order line right after `apps/web/e2e/detail-route-not-found.spec.ts`, which
  plan 10 added in Phase 1. No other Phase 2 prompt edits that file.
- 40 and 41 put their release-notes entries in their final messages. 20 has none.

## Close (alone)

Start only after every Phase 2 prompt is done. Close appends the entries from
`.artifacts/plan-runner/web-404-hardening/10.md`, `50.md`, `40.md`, and `41.md` to
`release-notes/scratchpad.md` in that order, archives the set to
`.llm/plans/completed/web-404-hardening/`, and gives the cumulative verification.

## Open after this set

After plan 50, a signed-in non-owner who opens `/playlist/edit/<public id>` sees the edit form
where they now see Not Found. Signed-out visitors already see it. The API still refuses their save
and delete (403), and the Items tab uses an owner-only route. No plan adds an owner check to the
edit page; that would be separate web work.
