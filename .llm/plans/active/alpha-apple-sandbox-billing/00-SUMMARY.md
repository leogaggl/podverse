# Alpha Apple sandbox billing — summary

Goal: a TestFlight build of Podverse Next on a real iPhone opens the App Store purchase sheet on
**Extend Membership**, a sandbox purchase completes, and alpha extends that account's membership.

Order and agent rules: [00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md). Prompts:
[COPY-PASTA.md](./COPY-PASTA.md).

## Why the sheet does not show today

Three things are missing. Fixing any one alone still shows no Apple purchase.

| Gap | Where | Effect |
| --- | --- | --- |
| Build 1 was made with `EXPO_PUBLIC_MOBILE_BILLING=unavailable` on the EAS **preview** environment | Baked into the TestFlight binary | The app uses the F-Droid checkout: PayPal link-out only, no StoreKit |
| No Apple rows in `billing_processor_product` on alpha (the table is empty for every processor) | Alpha app database | `/billing/checkout-options?platform=ios` returns the `apple` channel with no products |
| `BILLING_SANDBOX_GRANT_ALL` must be `true` on alpha, which runs `NODE_ENV=production` | `k.podcastdj.com` api, workers, management-api env | Every verified sandbox purchase grants Premium. The allowlist stays empty |

The alpha `apple` / `ios` checkout channel is already enabled, storefront list empty (every
country), no minimum client version. Apple IAP is already enabled on alpha in sandbox, with
issuer `69a6de95-…`, key `4SRP7N992S`, bundle `com.podverse.app.next`, and app id `6823398032`.
The `.p8` is mounted from `podverse-billing-apple-iap-opaque`.

## Locked decisions

- Product ids are the ones in `apps/mobile/storekit/PodverseMembership.storekit` and
  `docs/billing/BILLING-APPLE-SANDBOX.md`:
  - `com.podverse.app.next.premium.nonrenewing.monthly`
  - `com.podverse.app.next.premium.nonrenewing.annual`
  Both are **Non-Renewing Subscription** products on the **Podverse Next** app record. Never the
  old Podverse app (`id1390888454`).
- Map those ids on alpha in **management web → Billing → Processor Products**. Do not use
  `billingSeedProcessorProductsFromEnv`. It refuses to run with `NODE_ENV=production`, and alpha
  is `production`.
- Alpha sets `BILLING_SANDBOX_GRANT_ALL=true` on the API, workers, and management API. The
  allowlist stays empty. Live servers leave the flag unset. Do not change `NODE_ENV`.
- An empty `PAYPAL_ENVIRONMENT` or `APPLE_IAP_ENVIRONMENT` stays sandbox. `NODE_ENV=production`
  does not select the live PayPal API or the production App Store. Staging can run with
  production Node and sandbox payments. Live and production are explicit values.
- Store billing for the next build: set `EXPO_PUBLIC_MOBILE_BILLING` to `store` on the EAS
  **preview** environment. Do not delete it; an explicit value shows up in the build-config
  printout.
- No over-the-air update. The fix ships as a new store build (**mobile-store-builds-on-demand**).
- Do not bump the marketing version. The next build is still `5.5.3`, with the next build number.
- TestFlight purchases already use Apple's sandbox and cost nothing. A separate Sandbox Apple
  Account is optional for this test.

## Out of scope

- Google Play on alpha (needs a Play internal-track upload first).
- PayPal product rows on alpha. The same empty table means PayPal web checkout has nothing to
  sell either. Track it separately if web PayPal is under test.
- Production App Store Server Notifications URL. Only the **sandbox** URL is set here.
- Changing `NODE_ENV` on alpha. `BILLING_SANDBOX_GRANT_ALL` is the switch.
