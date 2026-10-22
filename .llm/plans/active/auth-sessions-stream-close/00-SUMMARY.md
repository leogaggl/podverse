# Auth sessions: ending a session closes its live streams — summary

Prompts and models: [COPY-PASTA.md](COPY-PASTA.md). Order: [00-EXECUTION-ORDER.md](00-EXECUTION-ORDER.md).

This set holds the two plans of the `auth-sessions` request that need the
`realtime-banner-notifications` stream. The operator split them out so `auth-sessions` and
`realtime-banner-notifications` can run in separate worktrees, with this set run after both
merge. The request, the review answers, and the full ledger stay with `auth-sessions`
(`00-REQUEST.md` and `00-SUMMARY.md` in `.llm/plans/completed/auth-sessions/` once that set
closes, otherwise `.llm/plans/active/auth-sessions/`).

## Before this set runs

- Both `auth-sessions` and `realtime-banner-notifications` are merged into the branch this set
  runs on.
- Both sets add linear migrations and regenerate the `0004_` and `0005_` baseline archives. The
  branch that merged second renumbers its migration past the other's and reruns
  `make db_regen_linear_baseline`. `make db_verify_linear_baseline` passes before Phase 1.

## Rows (from the auth-sessions ledger)

- **R34** "Revoking a session publishes an event that closes that session's open streams right
  away." — Plan: 70, 71
- **R35** "Until this lands, that set caps a stream's lifetime at 30 minutes." (whether the cap
  stays once revocation events close streams) — Plan: 70

## Decisions

Accepted with the rest of the `auth-sessions` review (D47–D54 in its `00-SUMMARY.md`):

- **D47** (plan 70) The stream-close event is published from the ORM revoke functions, which also
  catch refresh-token reuse.
- **D48** (plan 70) The event lists the ended session ids.
- **D49** (plan 70) The stream route's session-ended 401 keeps the `jwt` cookie, because
  `EventSource` cannot read the 401 body.
- **D50** (plan 70) The 30-minute stream cap stays.
- **D51** (plan 70) Account deletion publishes no stream event.
- **D52** (plan 70) The hub remembers ended sessions for 60 seconds.
- **D53** (plan 70) No mobile change.
- **D54** (plan 71) A `session.ended` event with a null notice does not stop the web stream.
