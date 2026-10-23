# Livestream HLS end-to-end coverage — copy-pasta

Summary and locked decisions: [00-SUMMARY.md](./00-SUMMARY.md).

## How to use

Run the prompts in order, each in a fresh agent chat on the model and reasoning shown above its
fence. Agents do not run tests; the last prompt lists the verification for the whole set.

**Optional — run the set unattended (Root tab):**
`node ../plan-runner/run-plan-set.mjs livestream-hls-e2e-coverage`. It stops at the first blocker;
see the plan-runner README to resume.

**Optional — one chat runs the whole set:** paste
`Orchestrate .llm/plans/active/livestream-hls-e2e-coverage/ with .cursor/prompts/plan-orchestrator.md.`
(Cursor Grok 4.7 · medium). It stops at the first blocker. Use the prompts below instead when
you want to read each result before the next prompt starts.

## Phase 1 — import guard

- [x] **01 — Block video.js imports**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** low

```
Read and execute .llm/plans/active/livestream-hls-e2e-coverage/01-video-js-import-guard.md

Do not run tests during agent work. This is not the last prompt in the set: end with what you
changed and anything prompt 02 needs, without a verification block. Then move the plan file to
.llm/plans/completed/livestream-hls-e2e-coverage/ and tick prompt 01 in COPY-PASTA.md.
```

## Phase 2 — live HLS fixtures, seed, and spec

- [x] **02 — Live HLS E2E coverage**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/livestream-hls-e2e-coverage/02-livestream-hls-e2e.md

Do not run tests during agent work. Running the fixture generator in step 1 of the plan is part of
the work, not a test.

This is the last prompt in the set. When the work is done, move every remaining file in
.llm/plans/active/livestream-hls-e2e-coverage/ to .llm/plans/completed/livestream-hls-e2e-coverage/
and remove the empty active directory. End with the cumulative verification for the whole set in
one fenced bash block, labeled for the Root terminal tab:

npm run lint
make e2e_test_web_report_spec SPEC=e2e/media-player-livestream-hls-start.spec.ts,e2e/media-player-livestream-video-start.spec.ts,e2e/media-player-livestream-audio-start.spec.ts,e2e/media-player-podcast-to-livestream-transition.spec.ts,e2e/media-player-livestream-to-podcast-transition.spec.ts,e2e/media-player-hls-vod-start.spec.ts
open .artifacts/e2e-reports/latest/index.html

Remind the operator that Safari native HLS for a live stream remains a manual check.
```
