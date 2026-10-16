# Popularity Tracking — copy-paste prompts

Read [00-SUMMARY.md](00-SUMMARY.md) before starting. Prompts 02 and 03 run together. Wait
until both finish, then run verification once. Do not paste a layout prompt from this set.
The accordion gap is `mobile-stacked-form-actions` prompt 01.

## Models

| Prompt | Model | Reasoning | Why |
| ------ | ----- | --------- | --- |
| 02 | Cursor Grok 4.7 | high | Copy is specified. Translate it; do not redesign it. |
| 03 | Cursor Grok 4.7 | high | Terms text is specified. Do not invent extra clauses. |

## Phase 1

Start both. They do not edit the same files.

- [x] **02 — How it works**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/completed/popularity-tracking-how-it-works/02-how-it-works-copy.md

Follow 00-SUMMARY.md. Replace the agreement voice with the explanation in that plan, in every locale. Do not bump POPULARITY_TRACKING_AGREEMENT_VERSION.

Do not run tests during agent work.
```

- [x] **03 — Terms notice**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/completed/popularity-tracking-how-it-works/03-terms-notice.md

Follow 00-SUMMARY.md. Update the terms so Popularity Tracking is described as an optional feature, in every locale. Do not bump TERMS_OF_SERVICE_VERSION.

Do not run tests during agent work.
```

## After both

**Root** — API and web. **Mobile Maestro** — the phone flow. Metro for that Maestro run is
already up in **Mobile E2E Metro**, with **Mobile E2E iOS** or **Mobile E2E Android**, and
**Mobile E2E API** when the flow needs the API. Do not paste those leave-running commands here.

```bash
npm run i18n:validate
npm run test -w apps/api -- src/test/legal-popularity-tracking.test.ts src/test/terms-acceptance-gate.test.ts src/lib/legal/termsContent.test.ts
make e2e_test_web_report_spec SPEC=e2e/popularity-tracking-consent.spec.ts
open .artifacts/e2e-reports/latest/index.html
```

```bash
npm run mobile:e2e:test -- popularity-tracking
open .artifacts/mobile-e2e-reports/latest/failures.json
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
```

On the phone, open the Popularity Tracking gate and More → Settings → Popularity Tracking.
The accordion says How It Works. The clear gap under the buttons, and buttons that match
Login's Submit, come from stacked form actions. Check those only after that plan's prompt 01
has landed. On the web gate, the accordion says How It Works, and the terms page's Popularity
Tracking section matches plan 03.
