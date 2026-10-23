# combined-merge — execution order

One prompt per phase; every phase depends on the one before (each merge builds on the last), so
nothing runs in parallel. Models and prompts: `COPY-PASTA.md`. Runner: `overnight.sh`.

| Phase | Prompt | Plan                                       | Model · reasoning               |
| ----- | ------ | ------------------------------------------ | ------------------------------- |
| 1     | 01     | `01-merge-realtime-banner-notifications.md` | Cursor Grok 4.7 · high          |
| 2     | 02     | `02-merge-artist-album-attribution.md`      | Cursor Grok 4.7 · extra high    |
| 3     | 03     | `03-merge-auth-sessions.md`                 | Cursor Grok 4.7 · extra high    |
| 4     | 04     | `04-merge-popularity-tracking-rebuild.md`   | Cursor Grok 4.7 · extra high    |
| 5     | 05     | `05-combined-verification.md`               | Cursor Grok 4.7 · extra high    |
| —     | —      | abctestall (`./scripts/abctest/run.sh all`) | Cursor Grok 4.7 (its template)  |

The driver commits and pushes `combined` after each of phases 1–5 and after abctestall, and
archives this set when abctestall finishes.
