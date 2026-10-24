---
name: form-primary-actions-row
description: Right-aligned form footer with Cancel before Primary (DOM order) in management UI.
version: 1.0.0
---

# Form primary actions row (management-web)

**When to use:** Adding or editing footer rows on management-web forms (create/edit flows).

## Pattern

- Use **`FormPrimaryActions`** from `@podverse/ui` (or **`FormActions`** in Metaboost). It uses
  **`formButtonsWrapper`**: right-aligned, **`gap: var(--spacing-2xl)`**.
- **DOM order:** put the secondary action (**Cancel**) **first**, then the primary (**Submit** /
  **Create**). On a wide viewport: Cancel on the left, primary on the **right**, both grouped at the
  **right** edge of the form.
- **Narrow viewports** (max-width 767px) stack the buttons full width, secondary above primary. Do not
  add a one-off row that stays horizontal on a phone.

## Why

Keeps destructive/navigation actions readable, aligns with Metaboost management-web footers, and
matches Playwright expectations (Cancel then submit in tree order).

## Checkbox alignment (create-user and similar)

- Use **`CheckboxField`** from `@podverse/ui` for labeled checkboxes (row layout, gap token) instead
  of a raw `<input type="checkbox">` plus ad hoc label spacing.

## Modals (Podverse web + management-web)

- Footer buttons **inside `Modal`** → use **`Modal.Actions`** from **`@podverse/ui`** (right-aligned, wrapping),
  not **`FormPrimaryActions`** (that’s for page-level forms). See **`modal-layout-contract`**.

## Checklist

- Footer actions on a management form? → Use `FormPrimaryActions` / `FormActions`, not a loose flex
  row with inconsistent alignment.
- Primary button last in DOM among footer buttons?
- Checkbox + label spacing inconsistent? → Prefer `CheckboxField` from `@podverse/ui`.
- Form controls duplicated (`.label`, `.input`, `.formGroup`) across pages? → Prefer `Label`, `Input`,
  `FormDropdown`, `FormGroup` from `@podverse/ui`.
