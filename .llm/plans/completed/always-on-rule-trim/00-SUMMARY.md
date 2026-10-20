# Always-on rule trim — summary

## Goal

Every request in a podverse window carries the always-on rules, `AGENTS.md`, and `.cursorrules`:
about 113 KB, roughly 28,000 tokens. Much of that is domain guidance only a few tasks need
(store builds, simulator names, CarPlay log streaming, About/Summary layout). Load those rules
when the work touches their files, keep a short always-on index that names each one and its
trigger, and remove text repeated across the root files. Target: under 50 KB always-on, with no
rule becoming unreachable.

## How scoping works

- **Always-on** (`alwaysApply: true`) loads into every request.
- **Glob-scoped** (`alwaysApply: false` plus `globs`) attaches once an agent reads or edits a
  matching file. Every non-always rule in this repo uses globs today.
- **Description-only** loading has no precedent here and is not used by this plan.
- A glob cannot fire when no file is touched: the operator asks for ship steps, or how to run
  the app. The always-on **rule index** covers that. One line per scoped rule names the trigger,
  so the agent opens the rule before answering.

## Operator review

Fill **Decision** with `approve`, `keep` (stays always-on), or a change. Prompt 01 applies only
rows marked `approve` or changed, and skips rows already marked `applied`. Sizes are bytes
before the trim.

| Rule | Size | Proposal | Globs (01 confirms each matches files) | Decision |
| --- | --- | --- | --- | --- |
| mobile-store-builds-on-demand | 4,826 | Globs + index line "Store build or submit steps" | `apps/mobile/eas.json`, `apps/mobile/app.config.ts`, `scripts/mobile/eas-store.sh`, `makefiles/local/Makefile.local.mobile.mk`, `.github/workflows/**` | approve |
| about-summary-web-mobile-alignment | 4,775 | Globs + index line "About or Summary content" | `apps/web/src/components/Content/About/**`, web and mobile About/Summary components, `packages/helpers/src/dtos/**/*About*` | change: use these globs: `apps/web/src/components/Content/About/**`, `apps/web/src/components/Media/Livestream/LivestreamSummary.tsx`, `apps/web/src/components/Core/Podcast/Episodes/CoreEpisodeSummary.tsx`, `apps/mobile/src/components/content/**`, `apps/mobile/src/screens/{podcast,episode,album,artist,track,clip,player}/**`, `apps/mobile/src/hooks/useItemDescription.ts`, `packages/helpers/src/dtos/**/*About*` |
| mobile-ios-simulator | 4,715 | Globs + index line "Mobile run, install, or device commands" | `apps/mobile/**`, `scripts/mobile/**` | approve |
| release-notes-suggest | 4,543 | Globs + index line "Any ship step (tag, release, publish, store, promotion)" | `release-notes/**`, `scripts/publish/**`, `scripts/mobile/eas-store.sh` | approve |
| comments-future-forward | 3,783 | Globs on source files | `**/*.{ts,tsx,js,mjs,cjs,sql,scss,sh,yaml,yml}`, `apps/mobile/e2e/**` | approve |
| ui-copy-casing | 3,591 | Globs on copy surfaces | `packages/i18n-catalog/**`, `apps/{web,management-web,mobile}/src/**`, `packages/ui/src/**`, `apps/api/src/**/email*/**`, `apps/*/e2e/**` | change: replace `apps/api/src/**/email*/**` (matches nothing) with `apps/api/src/lib/mailer/**`; otherwise approve |
| no-membership-expiry-notifications | 2,853 | Globs + index line "Membership expiry, notifications, scheduled jobs" | `packages/notifications/**`, `apps/workers/src/**`, `**/*membership*`, `**/*Membership*`, `**/*notification*` | approve |
| app-routes-shared-constants | 1,869 | Globs on app and package source | `apps/*/src/**`, `packages/*/src/**` | applied 2026-10-19 |
| reinstall-node-modules-after-linux-npm | 1,856 | Globs + index line "Linux-container npm commands" | `scripts/publish/**`, `scripts/development/update-lockfile-linux.sh` | change: approve the globs; the index line names the three scripts (`sync-develop-to-staging.sh`, `update-lockfile-linux.sh`, `bump-version.sh`) because the trigger is giving a command, not editing a file |
| legacy-app-reference | 1,677 | Globs + vocabulary already points to it | `../podverse-rn/**` is outside the repo, so rely on the index line "legacy app / podverse-rn" | change: glob `.cursor/skills/mobile-legacy-screenshot-planning/**` (a glob is required; that skill is where legacy reads happen) plus the index line "legacy app / podverse-rn / v4 mobile" |
| mobile-next-store-identity | 1,591 | Globs + index line (shared with store builds) | `apps/mobile/app.config.ts`, `apps/mobile/eas.json`, `scripts/mobile/eas-store.sh` | approve |
| even-content-spacing | 1,509 | Globs on layout code | `**/*.scss`, web, management-web, mobile, and ui `src/**` | applied 2026-10-19 |
| playback-timestamp-format | 1,415 | Globs on UI source | its existing globs | applied 2026-10-19 |
| avoid-type-assertions | 1,266 | Globs on TypeScript | its existing globs; `.cursorrules` keeps the one-line rule | applied 2026-10-19 |
| avoid-reexport-wrappers | 1,170 | Globs on source | `apps/*/src/**`, `packages/*/src/**` | applied 2026-10-19 |
| type-imports-separate-line | 1,016 | Globs on TypeScript | its existing globs; `.cursorrules` keeps the one-line rule | applied 2026-10-19 |
| maestro-adb-port-reservation | 945 | Globs on port config | `infra/docker/**`, `**/docker-compose*.yml`, `makefiles/**`, `scripts/mobile/**`, `apps/mobile/e2e/**` | applied 2026-10-19 |
| eqeqeq-strict-equality | 779 | Globs on code | its existing globs; `.cursorrules` keeps the one-line rule | applied 2026-10-19 |

Trims inside rules that stay always-on:

| Rule | Size | Proposal | Decision |
| --- | --- | --- | --- |
| vscode-terminals-commands | 6,661 | Keep the tab-naming rule and the non-mobile tabs. Move the mobile tab map and the CarPlay log-streaming section to a new glob rule on `apps/mobile/**` and `scripts/mobile/**`. | approve |
| commands-from-monorepo-root | 5,789 | Keep Do/Don't and the root-only list. Move worked examples and the EAS paragraph to the `build-order` skill or the mobile rule. | change: approve, but keep the `-w apps/mobile` fails paragraph in the always-on file (common mistake, short) |
| end-with-targeted-make-report-verify | 3,460 | Keep items 0–4 and the preferred commands. Drop text repeated from `response-ending-make-verify`. | approve |
| abcmemory-vocabulary | 6,212 | Keep. The description/About/Summary and HLS playlist vocabulary is used in conversation, not only in files. | keep |

Stay always-on unchanged (small or needed in every response): `release-notes-scratchpad`,
`nix-terminal-wrapper`, `llm-safe-plan-vocabulary`, `public-repo-no-secrets`,
`no-third-party-media-player-style`, `fish-operator-commands`,
`e2e-run-with-make-only`, `llm-cursor-source`, `plan-creation`,
`architecture-tier-dependencies`.

## Root files (prompt 02)

`.cursorrules` (8 KB) and `AGENTS.md` (28 KB) both load always-on and repeat the rules: "do not
run tests" appears in at least four places; strict equality, type assertions, type imports,
the Nix wrapper, and commands-from-root each appear in two or three.

| File | Proposal | Decision |
| --- | --- | --- |
| `.cursorrules` | Keep stack, architecture pointer, mobile pointers, and plan size. Replace each paragraph a rule already states with the rule name. | change: approve, with two exceptions. Keep the one-line summaries of rules 01 scopes (UI copy casing, comments future-forward, type assertions, strict equality, type imports); they become the only always-on copy. Keep the operator-only git paragraph; `operator-only-git-operations.mdc` has no frontmatter, so it never loads on its own. |
| `AGENTS.md` | Keep the parts no rule covers: build order, env-var policy, HTTP helpers, env file format, directory map, service and logger patterns, test infrastructure tables. Replace sections a rule states in full with one line naming the rule. | approve |

`AGENTS.md` is also read by non-Cursor agents and contributors. A pointer line costs those
readers one file open; that is the trade.

## Risks

- **A scoped rule does not load when it should.** The index line is the guard; 01 verifies that
  every scoped rule has one. Watch for the old mistakes coming back (bare `--device`, ship steps
  without notes, sentence-case labels) and move that rule back to always-on.
- **Glob over-reach.** A glob like `**/*.{ts,tsx}` attaches the rule in nearly every
  implementation turn, so its saving is mostly in planning and Q&A turns. That is still most
  turns by count.
- **Stale references.** Skills that say "see rule X" still work; a scoped rule is still a file.

## Measure

Before and after, from the repo root:

```bash
python3 .cursor/skills/abcagentoptimize/transcript_metrics.py --root .
```

Record both numbers in the abcagentoptimize log.
