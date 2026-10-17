# 04 — Purchase on the iPhone

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

## 1. Purchase (operator)

1. Open Podverse Next build 2. Sign in as any alpha account.
2. More → Membership → the purchase button. It says **Extend Membership** today. After
   `mobile-stacked-form-actions` prompt 02, a non-premium account says **Buy Membership**.
   Either label opens this checkout. The pass is the App Store sheet, not the word on the button.
3. The screen shows Monthly and Annual with App Store prices, plus **Complete Purchase**. If it
   shows only **Pay with PayPal on the Web**, the build still has billing off; go back to 03.
4. If it shows the plans but says a plan is unavailable, the products did not load from Apple.
   Recheck 01 (agreement active, product status Ready to Submit, exact ids).
5. Choose Monthly → **Complete Purchase**. The sheet should say it is a TestFlight purchase and
   will not be charged. Confirm.
6. The app shows the extended expiry date.

## 2. Server check (agent)

Read API logs around the purchase. Do not print tokens or signed payloads.

```bash
kubectl --context al -n podverse-alpha logs deploy/podverse-api -c api --since=10m | rg -i 'billing|apple|sandbox'
```

Confirm in management web → the tester account → **Billing**: one Apple transaction, a grant,
and the new expiry. If the log says the sandbox purchase was ignored, `BILLING_SANDBOX_GRANT_ALL`
is not `true` on the running API; recheck its `printenv` output.

A sandbox App Store Server Notification should also arrive at
`/api/v2/billing/webhooks/apple`. It can lag the purchase by a minute. Its absence alone does not
fail this check, because the purchase route grants first. Note it in the report.

## 3. Restore (operator)

On the same screen, open **Troubleshooting → Restore Purchases**. It must not grant a second
month.

## Done when

- Membership expiry moved forward by one month for the tester.
- One Apple transaction is recorded, not two.
- Report the webhook arrival (yes, or not seen within five minutes).
