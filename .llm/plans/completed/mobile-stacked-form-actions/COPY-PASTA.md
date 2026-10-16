# Mobile stacked form actions — copy-pasta

## Execution rules

Two phases. One agent each. Wait for phase 1 to finish before pasting phase 2. Run the
verification in `02-buy-and-extend-labels.md` after phase 2. That list covers both phases.

| Prompt | Model           | Reasoning | Why                                                          |
|--------|-----------------|-----------|--------------------------------------------------------------|
| 01     | Cursor Grok 4.7 | high      | Locked layout: reuse `FormActions`, named gaps, type roles   |
| 02     | Cursor Grok 4.7 | high      | Locked labels: Trial buys, Premium extends, including expiry |

## How to use

1. In the Cursor UI, select **Cursor Grok 4.7** and reasoning **high**.
2. Paste phase 1. Wait until that agent finishes.
3. Paste phase 2 with the same model and reasoning.
4. When phase 2 finishes, run the **Root** and **Mobile Maestro** blocks at the bottom of
   `02-buy-and-extend-labels.md`. **Mobile E2E Metro**, **Mobile E2E API**, and
   **Mobile E2E iOS** / **Mobile E2E Android** must already be up. Do not paste those
   leave-running commands into the same block.

## Phase 1

- [x] **01 — Stack form decisions and dialog type**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/completed/mobile-stacked-form-actions/01-stack-decisions-and-dialog-type.md

Follow the locked choices in 00-SUMMARY.md. Form decisions stack full width through FormActions.
Dialog body copy uses typography.prose. The seam above the buttons is formActionsTopGap. Do not
add a component, a spacing number, or a type role. Do not change web. Do not edit the search
preview screen or HelperNote. Do not change purchase labels. That is prompt 02.

Do not run tests. End with the operator verification commands from the plan. The operator
runs the combined check after prompt 02.
```

## Phase 2

- [x] **02 — Buy Membership and Extend Membership**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/completed/mobile-stacked-form-actions/02-buy-and-extend-labels.md

Follow the locked purchase-label rule in 00-SUMMARY.md. Trial, expired Trial, and a signed-in
account that is not Premium say Buy Membership. Premium, including an expired Premium
membership, says Extend Membership. Signed out stays Sign Up. The account-required gate stays
Login. The label follows tier, not the 403 reason and not isExpired.

Do not rename routes, renewPath, or testIDs that contain renew. Do not edit overrides. Run
npm run i18n:compile after the catalog edit. Do not run tests. End with the operator
verification commands from the plan, including the phase 1 Maestro flows.
```
