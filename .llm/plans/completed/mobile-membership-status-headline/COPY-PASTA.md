# Mobile membership status headline — copy-pasta

## Execution rules

One phase. One agent. Wait for it to finish before the verification in the plan.

| Prompt | Model | Reasoning | Why |
| ------ | ----- | --------- | --- |
| 01 | Cursor Grok 4.7 | high | Locked UI spec: tokens, copy, and Maestro steps are already chosen |

## How to use

1. In the Cursor UI, select **Cursor Grok 4.7** and reasoning **high**.
2. Paste the fence below into one agent.
3. When that agent finishes, run the **Mobile Maestro** block at the bottom of
   `01-status-headline-and-trial-sheet.md`. **Mobile E2E Metro**, **Mobile E2E API**,
   **Mobile E2E test-assets**, and **Mobile E2E iOS** / **Mobile E2E Android** must already
   be up.

## Phase 1

- [x] **01 — Status headline and Trial Limitations sheet**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/mobile-membership-status-headline/01-status-headline-and-trial-sheet.md

Follow the locked choices in 00-SUMMARY.md. Premium uses tokens.text.accent. Free Trial uses
tokens.text.warning. The date uses formatDateAbbrev. The Trial link opens a bottom sheet and
the Membership screen loses its accordion. More › About keeps the accordion. Do not change web.
Do not change the purchase button label. Assert more-membership-cta. Do not assert the
English words Extend Membership or Buy Membership.

Run npm run i18n:compile after the catalog edits. Do not run tests. End with the operator
verification commands from the plan.
```
