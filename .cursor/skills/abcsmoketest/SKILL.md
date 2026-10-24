---
name: abcsmoketest
description: Run the fast Podverse test tiers in full, then a narrow web and iOS smoke that checks startup and one item loading in the player. Fix clear failures and defer unclear ones. Use when the operator runs /abcsmoketest or says abcsmoketest, and in every step of an abcsmoketest plan-runner run.
---

# `abcsmoketest`

A narrow **abctestall**. The fast tiers run in full: unit, mobile unit, and API and
management-api integration. End-to-end shrinks to web and iOS, and on each only to two checks:
the app starts, and a seeded episode loads and plays in the player. Use **abctestall** when the
whole Playwright and Maestro sweep is needed.

## When the operator invokes it

Do not run tests in that chat. The run goes through plan-runner: one fresh agent per step, one
step at a time, each on Cursor Grok 4.7 at the reasoning its template line names, with Fast off.
Reply with the command, labeled **Root**:

```bash
./scripts/abctest/run.sh smoke
```

Tell the operator, briefly:

- First time on a computer: `npm --prefix ../plan-runner install`, then
  `node ../plan-runner/run-plan-set.mjs --login`.
- In **Mobile E2E Metro**, leave `npm run mobile:dev:e2e` running before the command. The command
  exits until port 8081 is that E2E bundle.
- When the run pauses, fix the cause and continue the same agent:
  `./scripts/abctest/run.sh smoke --resume 'What you changed.'`
- Progress prints in the terminal. Each step's final message is saved in
  `.artifacts/plan-runner/<set>/`; the Close step's message is the summary.

The steps are in [smoke-COPY-PASTA.md](/.cursor/prompts/abctest/smoke-COPY-PASTA.md). The script
copies that template into a fresh set under `.llm/plans/active/` and continues an open run instead
of starting a second one.

The rest of this skill is what each runner step follows.

## Runner steps

Each step follows **abctestall** § Runner steps, § Services, and § Failures, and the iOS step
also follows the service prep in § iOS Maestro. Run only the tier the step's prompt names, from
the monorepo root. This step overrides the usual "do not run tests during agent work" rule for
those commands.

Deferred failures go to the same `.llm/plans/active/abctestall-deferred.md`, so
**abctestdeferred** works them later.

## Order

1. **Unit**: `npm run test:unit`
2. **Mobile unit**: `npm --prefix apps/mobile run test`
3. **API and management-api integration**: `npm run build:packages`, `make test_deps`, then
   `npm run test:e2e:api`, as in **abctestall** tier 3.
4. **Web smoke**:
   `make e2e_test_web_report_spec SPEC=e2e/smoke.spec.ts,e2e/media-player-podcast-resume.spec.ts`
   - `smoke.spec.ts` loads the home page and `robots.txt`.
   - `media-player-podcast-resume.spec.ts` opens seeded episodes, presses Play, and checks that
     the audio element loads at the expected position.
5. **iOS smoke**, one flow at a time, in this order:
   - `hello-world`: launch, connect to the E2E API, and reach the home screen.
   - `play-mini-player`: search, open a seeded episode, play it, then check the mini player and
     the full player.

This run skips workers broker integration, the web Playwright variants, management-web, every
other Maestro flow, tablet, Android, and static checks.

## Keeping it narrow

The smoke set is the specs and flows in § Order, nothing else. Do not widen a run because a
nearby spec or flow looks related; that is **abctestall**'s job. Changing the smoke set means
editing § Order and `smoke-COPY-PASTA.md` together. A spec or flow belongs here only when it
proves startup or that an item loads in the player.

## Done

The Close step summarizes the run from every step's final message: passes per tier, fixes (file,
cause, rerun command, result), and deferred entries. Do not describe a tier as green when a
post-fix rerun has not actually passed. It names the reports to open:

- Web: `.artifacts/e2e-reports/latest/index.html`
- iOS: `.artifacts/mobile-e2e-reports/latest/ios-phone/index.html`

When the deferred file has entries, it ends by telling the operator to run
`./scripts/abctest/run.sh deferred`.
