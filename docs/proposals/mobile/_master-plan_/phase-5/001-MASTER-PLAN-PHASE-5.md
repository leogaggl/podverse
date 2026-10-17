# Podverse Mobile — Master Plan (Phase 5, native store IAP)

> **Implemented ahead of schedule.** Native store purchase was built during Phase 2 alongside the
> billing ledger, so P5.1–P5.3 are done. What remains is store-side setup and device verification,
> listed under § Remaining work. Phase index: [PHASES.md](/docs/proposals/mobile/_master-plan_/PHASES.md)
>
> Operator guide: [docs/billing/BILLING.md](/docs/billing/BILLING.md).

## Scope

Native in-app purchase for membership on iOS and Android. Membership is a **one-time month or a
one-time year**: a non-renewing purchase on the App Store and a prepaid base plan on Google Play.
Each purchase adds a grant to the account's grant ledger, and grants stack.

## Carried from Phase 1

| Step | Carried from | What                                                                         | Status |
| ---- | ------------ | ---------------------------------------------------------------------------- | ------ |
| P5.1 | 19.2         | StoreKit / Play Billing purchase on device (`expo-iap`, no RevenueCat)       | done   |
| P5.2 | 19.3         | Server transaction validation (`/billing/apple/transactions`, `/google/...`) | done   |
| P5.3 | 19.5         | Restore purchases (`/billing/restore`) and account binding on the purchase   | done   |

Where the code lives:

- **Device:** `apps/mobile/src/billing/` — `createBillingClient.ts` picks StoreKit, Play, fake, or
  unavailable; `settleStorePurchase.ts` posts to the API and finishes the transaction;
  `restoreStorePurchases.ts` backs the Restore button. UI is `MoreMembershipExtendScreen` →
  `MembershipStoreCheckout`.
- **API:** `apps/api/src/routes/billing.ts` plus App Store Server Notifications V2 and Play
  real-time developer notification webhooks. Workers reconcile; they never charge.
- **Local testing:** `apps/mobile/storekit/PodverseMembership.storekit` for StoreKit, and the
  sandbox guides linked from `BILLING.md`.

## Decisions (resolved)

- **No third-party IAP service.** `expo-iap` talks to StoreKit and Play Billing directly.
- **One entitlement record.** Store, PayPal, Strike, trial, admin, and legacy-import time are all
  grants in one ledger; `membership_expires_at` is recomputed from it.
- **Holding store and web time at once is fine.** A new grant starts where existing access runs
  out, so purchases stack instead of conflicting.

## Constraints carried forward

- **FOSS flavor has no IAP.** `EXPO_PUBLIC_MOBILE_BILLING=unavailable` (or the UnifiedPush build)
  selects the unavailable client; those builds link to web checkout.
- **Sandbox purchases** grant membership in production when `BILLING_SANDBOX_GRANT_ALL` is `true`,
  or for accounts listed in `BILLING_SANDBOX_ALLOWED_ACCOUNT_IDS`.
- **Each processor is off until its `BILLING_*_ENABLED` flag is `"true"`**, and the checkout
  channel is the separate sales switch.
- Interacts with [Phase 3 V4V](/docs/proposals/mobile/_master-plan_/phase-3/001-MASTER-PLAN-PHASE-3.md) —
  store policy treats boosts and memberships differently, so resolve that when Phase 3 starts.

## Remaining work

- Create the month and year products in App Store Connect and Play Console for
  `com.podverse.app.next`, and map them in `billing_processor_product`.
- Verify a sandbox purchase, a restore, and a refund webhook on a real iOS device and a real
  Android device against a deployed API.
- Decide per environment which processors and checkout channels are enabled.

## Detail ID band

**970–999.** Phase 1 IDs 561, 562, 564 were never written as files; reuse them only if you want
continuity with the Phase 1 step tables.
