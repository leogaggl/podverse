# abcsmoketest run {{SET}}

Started by `./scripts/abctest/run.sh smoke`, which copies this template into a fresh set and runs
it with plan-runner: one new agent per step, one step at a time. Every step follows the
**abcsmoketest** skill § Runner steps. Do not paste these prompts into a chat.

When the run pauses, fix the cause and continue the same agent:
`./scripts/abctest/run.sh smoke --resume 'What you changed.'`

## Unit

- [ ] **01 — Unit tier**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
You are step 01 of abcsmoketest run {{SET}}. Follow .cursor/skills/abcsmoketest/SKILL.md § Runner steps.

Run tier 1 only (unit, packages and apps except API, management-api, and mobile):
npm run test:unit
```

- [ ] **02 — Mobile unit tier**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
You are step 02 of abcsmoketest run {{SET}}. Follow .cursor/skills/abcsmoketest/SKILL.md § Runner steps.

Run tier 2 only (mobile unit):
npm --prefix apps/mobile run test
```

## Integration

- [ ] **03 — API and management-api integration**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
You are step 03 of abcsmoketest run {{SET}}. Follow .cursor/skills/abcsmoketest/SKILL.md § Runner steps.

Run tier 3 only. Build packages first, because earlier steps may have changed them:
npm run build:packages
make test_deps
npm run test:e2e:api
```

## Web smoke

- [ ] **04 — Web startup and player smoke**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
You are step 04 of abcsmoketest run {{SET}}. Follow .cursor/skills/abcsmoketest/SKILL.md § Runner steps.

Run the web smoke only:
make e2e_test_web_report_spec SPEC=e2e/smoke.spec.ts,e2e/media-player-podcast-resume.spec.ts

Rerun one failing spec with make e2e_test_web_report_spec SPEC=<path>. Do not run other specs.
```

## iOS smoke

`./scripts/abctest/run.sh smoke` exits until Mobile E2E Metro is listening. In the **Mobile E2E
Metro** tab, leave `npm run mobile:dev:e2e` running first. Port 8081 must be that E2E bundle.

- [ ] **05 — iOS startup and player smoke**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
You are step 05 of abcsmoketest run {{SET}}. Follow .cursor/skills/abcsmoketest/SKILL.md § Runner steps,
and .cursor/skills/abctestall/SKILL.md § iOS Maestro for service prep and exit 78.

Prepare the mobile services, then run these two flows only, one at a time, in this order:
npm run mobile:e2e:test -- --platform ios hello-world
npm run mobile:e2e:test -- --platform ios play-mini-player
```

## Close

- [ ] **Close — Smoke summary**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** low

```
You are the last step of abcsmoketest run {{SET}}. Do not run tests or change code.

Read every final message this run saved (01 through 05) and
.llm/plans/active/abctestall-deferred.md. Write the summary .cursor/skills/abcsmoketest/SKILL.md § Done
describes: passes per tier, fixes (file, cause, rerun command, result), deferred entries, and the
web and iOS report paths. Name any tier whose post-fix rerun did not pass. If the deferred file
has entries, end by telling the operator to run ./scripts/abctest/run.sh deferred.
```
