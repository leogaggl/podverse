# 01 — Choice screen layout (closed)

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

Do not execute this file. The work moved.

The shared form-button height is already in the working tree: `Button` `size="form"`,
`FORM_BUTTON_MIN_HEIGHT` 52, and `AgreementChoices` rendering Yes / No through `FormActions`.
The terms accordion title is already "View Terms of Service". Do not revert either.

The missing seam is the space between those buttons and the accordion. That edit is prompt 01
of [mobile-stacked-form-actions](../mobile-stacked-form-actions/01-stack-decisions-and-dialog-type.md),
because it changes the same `AgreementChoices` and the same screen-layout rule. Running both
rewrites one component two ways.

This set keeps the explanation (prompt 02) and the terms notice (prompt 03).
