# 01 — App Store Connect setup

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

Operator work in [App Store Connect](https://appstoreconnect.apple.com), signed in to the
**Podverse LLC** team. The agent explains steps and checks screenshots; it changes nothing.

## 1. Paid Apps Agreement

**Business** (or **Agreements, Tax, and Banking**). The **Paid Apps** agreement must be
**Active**. Without it StoreKit returns no products, in sandbox too.

If it is pending, finish tax and banking first. Nothing below works until it is active.

## 2. Create the two products

**Apps → Podverse Next → Monetization → In-App Purchases** (not the old Podverse app).

Create two **Non-Renewing Subscription** products:

| Reference Name | Product ID | Price |
| --- | --- | --- |
| Premium Monthly | `com.podverse.app.next.premium.onetime.monthly` | USD 2.99 or 3.00 tier |
| Premium Annual | `com.podverse.app.next.premium.onetime.annual` | USD 29.99 or 30.00 tier |

Web prices are USD 3 and 30 (`MEMBERSHIP_PREMIUM_COST_*` in
`k.podcastdj.com/apps/podverse-alpha/common/source/product-membership-settings.env`). Pick the
nearest Apple price point. The server grants by cadence, not by price.

For each product add one **App Store Localization** (English (U.S.)) with a display name and a
short description. The product status should reach **Ready to Submit**. A product in **Missing
Metadata** does not load in sandbox.

A review screenshot is only needed for App Review. Skip it for this test.

Product ids cannot be changed or reused after creation. Copy them exactly.

## 3. Sandbox server notifications

**Apps → Podverse Next → App Information → App Store Server Notifications**.

- **Sandbox Server URL:** `https://api-alpha.podcastdj.com/api/v2/billing/webhooks/apple`
- **Version:** 2
- Leave **Production Server URL** empty.

Save.

## 4. Optional: Sandbox Apple Account

TestFlight purchases already run in sandbox with your own Apple Account and are free. A Sandbox
Apple Account is only needed to test as a different buyer.

To add one: **Users and Access → Sandbox → Test Accounts → +**, with an email that is not an
Apple Account. On the iPhone, sign in under **Settings → Developer → Sandbox Apple Account** (or
when the purchase sheet asks).

## Done when

- Paid Apps Agreement is active.
- Both products exist on Podverse Next with the exact ids and status Ready to Submit.
- The sandbox notification URL is saved with Version 2.
