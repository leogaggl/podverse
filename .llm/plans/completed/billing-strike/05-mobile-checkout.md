# 05 — Mobile checkout

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

Read [00-SUMMARY.md](./00-SUMMARY.md) first. Read **mobile-react-native**,
**mobile-fdroid-flavors**, **screen-reader-accessibility**, and **i18n-user-facing-strings**.

PayPal's store link already exists. Do not add another PayPal button or channel. This prompt
adds Strike beside it, and it makes the unavailable-billing build ask for the `foss` platform.

## 1. Which platform checkout options use

`useStoreCheckout` today always calls `getCheckoutOptions` with `ios` or `android`, including
when `client.backend === 'unavailable'`. The `foss` channel is never read.

- Unavailable billing (`EXPO_PUBLIC_MOBILE_BILLING=unavailable`, or UnifiedPush, per
  `selectBillingBackend`): request `platform: 'foss'` and `storefront: null`.
- StoreKit, Play, and the E2E fake client: keep `ios` or `android`, and keep sending the
  storefront the store client returns.
- Widen `BillingApi.getCheckoutOptions` so `platform` is `BillingPlatform`, not only
  `'android' | 'ios'`.

## 2. What each build shows

| Backend | Strike in checkout options | PayPal in checkout options |
| ------- | -------------------------- | -------------------------- |
| `unavailable` | In-app invoice panel | Existing **Pay with PayPal on the Web** button |
| `storekit`, `play`, `fake` | **Pay with Bitcoin on the Web** (`openCheckout({ mode: 'extend' })`) | Existing PayPal button, unchanged |

Neither store backend renders a QR, a bolt11 string, or a `lightning:` link. The invoice is
created on the website (prompt 04), so the button does nothing useful until the `web` channel
is enabled. The app does not special-case that; checkout options already hide a processor whose
channel is off.

`resolveStoreCheckoutMode` returns `purchase` when the store processor, PayPal, **or Strike** is
offered. Contact mode stays the case where none of those are offered. Update
`storeCheckout.test.ts`.

When the unavailable build has Strike, the contact block stays hidden. PayPal and Strike can
show together. When it has neither, the contact block stays as it is today.

## 3. In-app invoice (unavailable billing only)

New `MembershipStrikeCheckout` under `apps/mobile/src/components/membership/`, used only from
`MembershipStoreCheckout` in the unavailable branch.

- Create with `reqBillingStrikeCreateCheckout` and `platform: 'foss'`.
- QR via `react-native-qrcode-svg` (install `react-native-svg` with the Expo local binary, then
  `react-native-qrcode-svg`). The QR has an accessibility label that names it a Lightning
  invoice. Amount in USD, countdown to `expires_at`, **Copy Invoice**, **Open Wallet**
  (`Linking.openURL('lightning:<bolt11>')`).
- Poll `reqBillingStrikeGetCheckout` every 3 seconds while the screen is focused; stop on
  `settled`, `expired`, or blur. `pending` and `expired` copy matches the web panel (reuse the
  consumer keys from prompt 04). `settled` refreshes the account the same way a store purchase
  does (`refreshSnapshot` in `useStoreCheckout`) and shows the same success text.
- Announce status with `accessibilityLiveRegion="polite"`.
- Buttons use the shared `Button`. Copy and wallet keep a resting label while any request is
  in flight (**button-stable-bounds**).

Install, from the monorepo root, in **Mobile**:

```bash
npm --prefix apps/mobile exec -- expo install react-native-svg
npm --prefix apps/mobile install react-native-qrcode-svg
npm run mobile:install
```

Tell the operator a dev-client rebuild is required (`react-native-svg` is native). Do not run
the rebuild yourself.

## 4. Store link button

On store backends, when Strike is offered, render one outline `Button`, full width, under the
PayPal button (PayPal stays above it). Label:
`membership.checkout.pay_with_bitcoin_on_the_web` → "Pay with Bitcoin on the Web", in consumer
originals for all four locales, next to `pay_with_paypal_on_the_web`. Title case. Do not edit
`overrides/`. `testID="membership-checkout-strike"`.

The unavailable build does not show this link button. It shows the invoice panel instead.
`testID` for the panel root: `membership-checkout-strike-invoice`.

## 5. Tests

Unit (`storeCheckout.test.ts` and a test beside the platform choice if the hook is hard to
mount): foss options are requested only for the unavailable backend; `purchase` mode when only
Strike is offered; the store link is a separate flag from the invoice panel.

Maestro: `apps/mobile/e2e/membership-checkout.yaml` uses the fake store client. Assert
`membership-checkout-strike` is not visible (the E2E seed does not enable Strike on `ios` or
`android`). Do not add a flow that pays a real invoice. The sandbox doc in prompt 06 is the
in-app payment check.

## Operator commands

**Mobile** — unit tests:

```bash
npm --prefix apps/mobile run test
```

**Mobile Maestro** — **Mobile E2E Metro**, **Mobile E2E API**, and **Mobile E2E iOS** /
**Mobile E2E Android** already running (see `apps/mobile/e2e/HOW-TO-RUN.md`). Do not paste those
leave-running commands here.

```bash
npm run mobile:e2e:test -- membership-checkout
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
```

Rebuild the dev client before the sandbox walkthrough in prompt 06, in **Mobile iOS** /
**Mobile Android**:

```bash
npm run mobile:ios -- --device "iPhone 17 Pro"
npm run mobile:android -- --device Pixel_6_Pro_API_33
```
