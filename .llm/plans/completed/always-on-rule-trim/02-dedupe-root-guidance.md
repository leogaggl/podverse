# 02 — Dedupe `.cursorrules` and `AGENTS.md`, then close the set

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

## Summary

Apply the rows of the root-files table in `00-SUMMARY.md` whose **Decision** is `approve` or a
written change. Replace text a rule already states in full with one line naming that rule.
Never delete guidance that no rule carries.

## Method

For each section of `.cursorrules` and `AGENTS.md`:

1. Find the rule or skill that covers it (`rg -l '<key phrase>' .cursor/rules .cursor/skills`).
2. When that rule says everything the section says, replace the section with one line:
   `- **Strict equality:** see **eqeqeq-strict-equality**.`
3. When the section says something the rule does not (an example, a port, a path), keep that
   part and drop only the repeated sentences.
4. When no rule covers it, leave the section alone.

Known repeats to start from:

| Topic | Also in |
| --- | --- |
| Do not run tests during agent work | `end-with-targeted-make-report-verify`, `response-ending-make-verify` skill |
| Nix wrapper | `nix-terminal-wrapper` |
| Commands from root, copy button | `commands-from-monorepo-root` |
| Strict equality, type assertions, type imports | `eqeqeq-strict-equality`, `avoid-type-assertions`, `type-imports-separate-line` |
| Title case | `ui-copy-casing` |
| Comments are future-forward | `comments-future-forward` |
| Operator-only git | `operator-only-git-operations` |

Keep in `AGENTS.md` (no rule carries these in full): quick reference, package build order,
lockfile, env-var policy and `config/index.ts` pattern, HTTP helpers, env file formatting,
import order, directory map and "where to find things", service, varchar, logger, and error
patterns, test infrastructure, root npm scripts, and references.

`AGENTS.md` serves non-Cursor agents too. A pointer must name the rule file path
(`.cursor/rules/<name>.mdc`) so those readers can open it.

## Measure

```bash
python3 .cursor/skills/abcagentoptimize/transcript_metrics.py --root .
```

Report before and after `agents_and_cursorrules_bytes` and the total.

## Close the set

In this same turn:

1. Move `02-dedupe-root-guidance.md`, `00-SUMMARY.md`, `00-EXECUTION-ORDER.md`, and
   `COPY-PASTA.md` to `.llm/plans/completed/always-on-rule-trim/`, then remove the empty
   `active/always-on-rule-trim/` directory.
2. Append a dated entry under **Runs** in `agent-optimize/LOG.md` in the operator's personal
   agent store: always-on bytes before and after 01 and 02, and which rows were applied.
3. End with the cumulative verification below.

## Done when

- [x] Approved rows applied; repeated text replaced with rule names
- [x] No guidance lost (each removed sentence exists in the named rule)
- [x] Sizes reported and logged
- [x] Set archived

## Operator verification (cumulative)

**Root**

```bash
npm run prettier:check
git diff --stat .cursor .cursorrules AGENTS.md
python3 .cursor/skills/abcagentoptimize/transcript_metrics.py --root .
```

Then work one ordinary prompt in a podverse-only window and watch for a scoped rule that should
have applied and did not.
