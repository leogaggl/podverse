# Web 404 hardening — COPY-PASTA

How to use:

1. Select **Cursor model** and **Reasoning** in the Cursor UI (the line above each fence).
1. Copy the fenced block only, paste, and the agent runs it.
1. Tick the box when that prompt is done.

Ledger and settled decisions: [00-SUMMARY.md](./00-SUMMARY.md) and the review answers in
[00-REQUEST.md](./00-REQUEST.md). Order and file ownership:
[00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).

**Optional — run the set unattended (Root tab):**
`./scripts/abcplan/run.sh run web-404-hardening`. It runs one fresh agent per prompt on that
prompt's model, every pending prompt under the first pending heading at once, stops at the first
blocker, and resumes with `./scripts/abcplan/run.sh run web-404-hardening --resume 'Your answer.'`.

Phases run one after another. Prompts under one phase heading edit disjoint files and run at the
same time. Each of them puts its release-notes entry in its final message; Close appends them.

## Model per prompt

| Phase | Prompt | Cursor model | Reasoning | Why this tier |
| --- | --- | --- | --- | --- |
| 1 | 10 | Cursor Grok 4.7 | extra high | The loader contract every later page relies on; a fully specified plan |
| 1 | 11 | Cursor Grok 4.7 | medium | Guidance rule with its text written out in the plan |
| 1 | 30 | Cursor Grok 4.7 | medium | Deletes seven unreachable checks in three pages |
| 1 | 50 | Opus 5.5 | high | Changes who can read a playlist; private paths must stay closed |
| 2 | 20 | Cursor Grok 4.7 | medium | Read-only re-check of five pages, no edits |
| 2 | 40 | Cursor Grok 4.7 | high | Three pages, removed-clip parity, one new spec |
| 2 | 41 | Cursor Grok 4.7 | high | Profile redirect narrowed to a 404, new unit test, spec update |
| Close | Close | Cursor Grok 4.7 | medium | Append four release entries, archive, cumulative verification |

Fast stays off. If a Cursor Grok 4.7 prompt stalls or makes the same mistake twice, rerun it one
reasoning level higher; from extra high, rerun it on **Codex 5.3 · high**. Escalate to
**Opus 5.5** only when the failure is a design question. Record the change on the prompt here.

## Phase 1

Four prompts at once. Owners: 10 owns `apps/web/src/lib/ssr/**`, `apps/web/src/lib/seo/fetchers.ts`,
`apps/web/e2e/detail-route-not-found.spec.ts`, and `makefiles/local/e2e-spec-order-web.txt`.
11 owns `.cursor/rules/web-detail-route-not-found.mdc` and `.cursor/rules/rule-index.mdc`. 30 owns
the clip, chapter, and official clip `page.tsx` files. 50 owns the API playlist controller, its two
test files, and `apps/api/openapi.yml`. Nobody writes `release-notes/scratchpad.md` in this phase.

- [x] **10 — Shared not-found loader and safe SEO fetchers**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/web-404-hardening/10-shared-not-found-loader.md
Review answers D1 and D2 in 00-REQUEST.md are settled: reuse getErrorResponseStatus from
@podverse/helpers, add no status reader to helpers-requests, and wrap all 11 request-sending
fetchers. Only an API 404 becomes notFound(); every other error is rethrown unchanged.
Edit no page.tsx. Prompts 11, 30, and 50 run at the same time: edit only the files in this plan's
## Files, and report errors in other files instead of fixing them. Do not write
release-notes/scratchpad.md; put the plan's entry in your final message under "Release notes entry".
Do not run tests.
When the plan is done, move 10-shared-not-found-loader.md to
.llm/plans/completed/web-404-hardening/ and leave the rest of the set in active/.
End without a verification block: report what changed, any blocker, and anything a later prompt
needs.
```

- [x] **11 — Guidance rule for dynamic detail pages**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/web-404-hardening/11-detail-route-not-found-guidance.md
Write the rule text the plan gives, including the one profile exception (a 404 on
/profile/[id_text] redirects to /profiles). The rule cites no plan numbers.
Prompts 10, 30, and 50 run at the same time: edit only .cursor/rules/web-detail-route-not-found.mdc
and .cursor/rules/rule-index.mdc. The rule names loadOrNotFound even though prompt 10 may not
have written it yet.
Do not run tests. This plan has no release-notes entry.
When the plan is done, move 11-detail-route-not-found-guidance.md to
.llm/plans/completed/web-404-hardening/.
End without a verification block: report what changed and any blocker.
```

- [x] **30 — Item detail pages drop unreachable null checks**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/web-404-hardening/30-item-detail-null-not-found-checks.md
Remove only the entity-null notFound() checks the plan names in the clip, chapter, and official
clip pages. Keep the clip page's removed-clip catch and the nested missing-item checks.
Prompts 10, 11, and 50 run at the same time. Prompt 10 is editing apps/web/src/lib/seo/fetchers.ts
now: do not edit it, loadOrNotFound, or apps/web/e2e/detail-route-not-found.spec.ts. Edit only the
three page.tsx files and report errors elsewhere instead of fixing them.
Do not run tests. This plan has no release-notes entry.
When the plan is done, move 30-item-detail-null-not-found-checks.md to
.llm/plans/completed/web-404-hardening/.
End without a verification block: report what changed and any blocker.
```

- [x] **50 — Signed-in viewers can read another account's non-private playlist**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/web-404-hardening/50-playlist-get-signed-in-non-owner.md
A signed-in GET /playlist/:playlist_id_text returns a public or unlisted playlist exactly as a
signed-out caller gets it. The owner still reads their own playlist, private included. A private
playlist the caller does not own stays 404, and every write stays owner-only. Prove each of those
in the plan's tests.
Change no web page and no mobile code. Prompts 10, 11, and 30 run at the same time: edit only the
files in this plan's ## Files, and report errors elsewhere instead of fixing them. Do not write
release-notes/scratchpad.md; put the plan's entry in your final message under "Release notes entry".
Do not run tests.
When the plan is done, move 50-playlist-get-signed-in-non-owner.md to
.llm/plans/completed/web-404-hardening/.
End without a verification block: report what changed, any blocker, and anything a later prompt
needs.
```

## Phase 2

Start only after every Phase 1 prompt is done. Three prompts at once. Owners: 20 edits no files.
40 owns the playlist, playlist edit, and clip edit `page.tsx` files,
`apps/web/e2e/playlist-and-edit-route-not-found.spec.ts`, and `makefiles/local/e2e-spec-order-web.txt`.
41 owns `apps/web/src/app/profile/[id_text]/page.tsx`, its new `page.test.ts`, and
`apps/web/e2e/seo-profile-sharable-status.spec.ts`. Nobody writes `release-notes/scratchpad.md`.

- [x] **20 — Channel and feed detail routes re-check**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/web-404-hardening/20-channel-feed-detail-routes.md
This plan changes no files. Read the five pages it lists and confirm they still match its
re-check now that apps/web/src/lib/seo/fetchers.ts runs through loadOrNotFound. Review answer D4 is
settled: an unknown artist id stays on the error page.
If a page no longer matches, stop and report BLOCKED with what differs. Do not add loadOrNotFound,
notFound(), or a try/catch to any page. Prompts 40 and 41 run at the same time.
Do not run tests. This plan has no release-notes entry.
When the plan is done, move 20-channel-feed-detail-routes.md to
.llm/plans/completed/web-404-hardening/.
End without a verification block: report what you confirmed and any blocker.
```

- [x] **40 — Playlist and edit routes use the shared not-found boundary**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/web-404-hardening/40-playlist-and-edit-routes-not-found.md
Review answers D6 and D7 in 00-REQUEST.md are settled: a 5xx, network, or auth failure shows the
error page, a real 404 shows Not Found, and a signed-out visitor opening a removed clip's edit
link sees the visitor removed-clip page, matching /clip/[clip_id].
Add the spec-order line right after apps/web/e2e/detail-route-not-found.spec.ts with a targeted
insertion; do not rewrite makefiles/local/e2e-spec-order-web.txt.
Prompts 20 and 41 run at the same time: edit only the files in this plan's ## Files, and report
errors elsewhere instead of fixing them. Do not write release-notes/scratchpad.md; put the plan's
entry in your final message under "Release notes entry".
Do not run tests.
When the plan is done, move 40-playlist-and-edit-routes-not-found.md to
.llm/plans/completed/web-404-hardening/.
End without a verification block: report what changed, any blocker, and anything Close needs.
```

- [x] **41 — Profile route redirects to /profiles only for an API 404**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/web-404-hardening/41-profile-route-not-found.md
Review answer D5 is settled: a missing or private profile redirects to /profiles only when the
account load is an API 404, and every other error, including a failed /auth/me, is rethrown.
Opening your own profile still redirects to /my-profile.
Prompts 20 and 40 run at the same time: edit only the files in this plan's ## Files, and report
errors elsewhere instead of fixing them. Do not write release-notes/scratchpad.md; put the plan's
entry in your final message under "Release notes entry".
Do not run tests.
When the plan is done, move 41-profile-route-not-found.md to
.llm/plans/completed/web-404-hardening/.
End without a verification block: report what changed, any blocker, and anything Close needs.
```

## Close

Start only after every Phase 2 prompt is done.

- [x] **Close — release entries, archive the set, cumulative verification**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Close the plan set .llm/plans/active/web-404-hardening/.
Read the "Release notes entry" section of .artifacts/plan-runner/web-404-hardening/10.md, 50.md,
40.md, and 41.md, and append those four entries to the end of release-notes/scratchpad.md in that
order, one blank line between entries. Do not edit any other entry. When a final message has no
entry, use the ## Release scratchpad block of that plan in .llm/plans/completed/web-404-hardening/.
Confirm 10, 11, 20, 30, 40, 41, and 50 are in .llm/plans/completed/web-404-hardening/. Move
00-REQUEST.md, 00-SUMMARY.md, 00-EXECUTION-ORDER.md, and COPY-PASTA.md there, then remove the
empty active directory. Change no product code.
In your final message, list the open item from 00-EXECUTION-ORDER.md § Open after this set.
End with the cumulative verification for the whole set, assuming no earlier prompt was tested.
One fenced bash block, fish-safe, labeled Root. Tell the operator that Docker must be running.
Note that there is no dependency change, so no lockfile step, and no catalog change, so no i18n
compile.

Root:
npm run build:packages
npm run lint
npm run type-check -w apps/web
npm run type-check -w apps/api
npm run openapi:check
npm run test -w apps/web
make test_deps
npm run test:e2e:api
make e2e_test_web_report_spec SPEC=e2e/detail-route-not-found.spec.ts,e2e/playlist-and-edit-route-not-found.spec.ts,e2e/seo-profile-sharable-status.spec.ts,e2e/playlist-edit-play.spec.ts,e2e/removed-content.spec.ts,e2e/clip-editor-modal.spec.ts
open .artifacts/e2e-reports/latest/index.html
```

- [ ] **abcaicast** (optional)

After this set, do you want an abcaicast for this work?
