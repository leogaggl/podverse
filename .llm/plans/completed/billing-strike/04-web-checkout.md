# 04 — Web checkout

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

Read [00-SUMMARY.md](./00-SUMMARY.md) first. Read the **web**, **e2e-page-tests**,
**ui-e2e-screenshot-report**, and **screen-reader-accessibility** guidance. Mobile checkout is
prompt 05. Do not edit `apps/mobile` here.

## 1. Request helpers

`packages/helpers-requests/src/api/billing/billing.ts`: `reqBillingStrikeCreateCheckout` and
`reqBillingStrikeGetCheckout` returning `DTOBillingStrikeCheckout` (01). Create accepts an
optional `platform` of `'web' | 'foss'` and omits it when the caller leaves it unset (the API
defaults to `web`).

## 2. Web checkout (`apps/web/src/app/checkout/`)

- When checkout options include both PayPal and Strike, show a payment method choice after the
  cadence choice: "PayPal" and "Bitcoin (Lightning)". One available method → no choice shown.
- New `CheckoutStrikePanel.tsx`:
  - Creates the checkout with no `platform` (web), then renders the QR (`qrcode` → SVG data URL
    in an `<img>` with alt text naming it a Lightning invoice), the amount in USD, a countdown
    to `expires_at`, "Copy Invoice" (clipboard), and "Open Wallet" (`lightning:<bolt11>` link).
  - Polls `GET /billing/strike/checkouts/:id` every 3 seconds while visible; stops on
    `settled`, `expired`, unmount, or tab hidden (resume on visible).
  - `pending` → "Payment detected, confirming…" status.
  - `settled` → the same success state PayPal capture shows (new expiry), then refresh status.
  - `expired` → message and "Get a New Invoice" (creates a new checkout).
  - Status changes announced with `aria-live="polite"`.
- Add `qrcode` (and `@types/qrcode` if needed) to `apps/web/package.json`. Tell the operator to
  run `make sync_lockfile` and `./scripts/development/update-lockfile-linux.sh`.
- Styles via existing tokens (**styles-source-of-truth**); no `var()` fallbacks.

## 3. Consumer i18n originals (all four locales)

Keys for: method choice labels, Lightning panel title, copy invoice, open wallet, copied
confirmation, countdown label, pending, expired message, new invoice button, QR alt text.
Title case for chrome, sentence case for prose (**ui-copy-casing**); Strike, Bitcoin, and
Lightning keep their capitals. Do not edit `overrides/`. Prompt 05 reuses these keys in the app.

## 4. E2E

`apps/web/e2e/checkout-strike.spec.ts`: enable the Strike `web` channel in the seed or through
the test's setup path the other checkout specs use; intercept the two Strike API calls with
`page.route` to drive `unpaid` → `pending` → `settled`, and a second case for `expired` → new
invoice. Assert the QR image, copy button, and wallet link are present and named. Follow
**e2e-readability** and **e2e-screenshot-verified-element**.

## Operator commands

**Root**

```bash
make sync_lockfile
npm run build:packages
npm run test -w apps/web
make e2e_test_web_report_spec SPEC=e2e/checkout-strike.spec.ts,e2e/checkout-membership.spec.ts
open .artifacts/e2e-reports/latest/index.html
```
