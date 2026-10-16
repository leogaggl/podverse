# Buy Membership and Extend Membership

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

Read [00-SUMMARY.md](00-SUMMARY.md). The purchase-label bullet is locked. This step does not
change button layout.

## The rule

Add `membershipPurchaseAction` next to `deriveMembershipState` in
`packages/helpers/src/lib/accountMembership.ts`.

| Account                   | Result    |
|---------------------------|-----------|
| Signed out                | `sign_up` |
| `tier === 'premium'`      | `extend`  |
| Signed in, any other tier | `buy`     |

`extend` includes an expired Premium membership. `tier` stays `premium` after expiry.
`buy` includes an active Trial and an expired Trial. Do not branch on `isExpired` or on
`AccessDenialReason`.

Update the comment on `deriveMembershipState` that says the button label is auth-based.
The label is this function.

Map the result to existing catalog keys. Do not add a second Extend string.

| Result           | Key                               | English           |
|------------------|-----------------------------------|-------------------|
| `sign_up`        | `membership.gate.sign_up`         | Sign Up           |
| `buy`            | `membership.buy_membership`       | Buy Membership    |
| `extend`         | `membership.extend_my_membership` | Extend Membership |
| account required | `authentication.login`            | Login             |

Screens that already say Sign Up through `authentication.sign_up` keep that key. The gate
keeps `membership.gate.sign_up`.

`needs_account` stays Login. Do not send it through `membershipPurchaseAction`.

## Catalog

`packages/i18n-catalog/consumer/originals/` for `en-US`, `es`, `fr`, and `el-GR`. Do not edit
`overrides/`. Run `npm run i18n:compile` from the repo root after the catalog edit.

Add `membership.buy_membership`:

| Locale | Value                 |
|--------|-----------------------|
| en-US  | Buy Membership        |
| es     | Comprar membresía     |
| fr     | Acheter un abonnement |
| el-GR  | Αγορά συνδρομής       |

Point every purchase action in the table below at `buy_membership` or
`extend_my_membership`. Then remove a key that has no callers left:

- `membership.buy_premium_membership`
- `membership.renew_membership`
- `membership.get_premium`
- `membership.gate.renew`
- `membership.gate.banner_action`

Sentences, not button chrome. Replace the renew / get-premium instruction. Keep sentence
case in English. Translate the same meaning in es, fr, and el-GR.

- `membership.gate.body_premium` — This is a Premium feature. Buy a membership to use it.
- `membership.gate.body_expired` — split at the call site. Premium: Your membership has
  expired. Extend it to use this feature. Any other signed-in tier: Your Trial has expired.
  Buy a membership to use this feature.
- `membership.membership_expired` — this is the API 403 message, one string for every
  tier. Drop the renew instruction. "Your membership has expired." The button beside it
  carries Buy or Extend.
- `membership.trial_expired_text_line2` — Please buy a membership to continue using Premium
  features.
- `membership.feature_premium_only_explanation` — keep the spam sentence. End with: Buy a
  membership to use it.
- `membership.gate.settings_row_subtitle` — Premium: Extend to use Premium features again.
  Otherwise: Buy a membership to use Premium features.
- `membership.membership_expired_danger` — keep `{type}`. Premium: Extend now to continue
  using Premium features. Trial: Buy a membership to continue using Premium features.
- `membership.membership_expiring_warning` — keep `{type}` and `{date}`. Premium: Extend now.
  Trial: Buy a membership now.

`membership.membership_expired_text_line2` already says extend. Leave it for Premium.
`membership.manage.grace_renew_body` is a failed charge. Leave it.

## Call sites

Keep testIDs. `premium-gate-renew`, `membership-expired-banner-renew`,
`more-nav-membership-renew`, and `membership-checkout-strike-renew` stay. Do not rename
`/membership/renew` or `renewPath`. Mobile rows are under `apps/mobile/src`. Web rows are
under `apps/web/src`. The banner row without a Web prefix is the mobile banner. On
`renew/page.tsx`, the non-grace paragraph follows the same split: buy for Trial, the
existing extend sentence for Premium.

| Surface                           | Change                                                                         |
|-----------------------------------|--------------------------------------------------------------------------------|
| `membershipGateCopy.ts`           | Confirm and notice labels use the helper. Login stays for `needs_account`.     |
| `MembershipGateProvider.tsx`      | Pass `tier` and `isLoggedIn` from `useMembership`.                             |
| `GatedFeatureNotice.tsx`          | Same helper. Read membership if tier is not a prop.                            |
| `MoreMembershipScreen.tsx`        | Logged-in CTA is Buy or Extend. Logged out stays Sign Up.                      |
| `MembershipExpiredBanner.tsx`     | Banner button is Buy or Extend. The banner stays a row.                        |
| `navigation/index.tsx`            | Expired-row subtitle uses the subtitle split above.                            |
| `modalForMembership403.tsx`       | Action label from the helper, using the account tier.                          |
| `useMembershipGate.ts`            | Pass `deriveMembershipState` into that helper.                                 |
| `SettingsMembership.tsx`          | Premium tier is Extend even when not entitled. Trial is Buy.                   |
| `MembershipCTA.tsx`               | Trial, including expired Trial, is Buy. Premium, including expired, is Extend. |
| `renew/page.tsx`                  | Heading is Extend only for Premium. Otherwise Buy. Grace copy stays.           |
| `MembershipExpirationToast.tsx`   | Message uses the warning and danger split. Link text stays.                    |
| Web `MembershipExpiredBanner.tsx` | Link text is Buy or Extend from the helper.                                    |

`membershipGateCopy.test.ts` asserts the new keys, including expired Premium → extend and
expired Trial → buy.

## Tests that assert the old words

The seeded `e2e-user` is a Trial account. A mocked `membership_expired` 403 does not make
that account Premium. The button is Buy Membership.

| File                                           | Assertion                                                                      |
|------------------------------------------------|--------------------------------------------------------------------------------|
| `membership-gate.yaml`                         | `more-membership-cta` reads Buy Membership. Tap id stays `premium-gate-renew`. |
| `membership-gating.spec.ts`                    | Dialog button is Buy Membership.                                               |
| `podcast-index-feed-add-trial-blocked.spec.ts` | Button is Buy Membership.                                                      |
| `membership-page-trial-limitations.spec.ts`    | Signed-out heading is Buy Membership.                                          |

## Leave

- `membership.cta_upgrade_text` ("Upgrade to Premium") is a status line, not this action.
- Management-web Extend Membership. It already names the admin action.
- `checkout.buy_more_time`. No caller. It already says Extend Membership.
- Route strings, OpenAPI `renewPath`, and testIDs that contain `renew`.

## Verify

Do not run these during implementation. This is the set check. Phase 1's layout is included.

**Root** after the catalog edit, if the agent has not already compiled:

```bash
npm run i18n:compile
```

**Mobile Maestro**, after **Mobile E2E Metro**, **Mobile E2E API**, and **Mobile E2E iOS** /
**Mobile E2E Android** are already up:

```bash
npm run mobile:e2e:test -- membership-gate
npm run mobile:e2e:test -- subscriptions-anonymous
npm run mobile:e2e:test -- library-playlists
npm run mobile:e2e:test -- custom-api
npm run mobile:e2e:test -- podcast-episode
open .artifacts/mobile-e2e-reports/latest/failures.json
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
```

**Root** for the web specs:

```bash
make e2e_test_web_report_spec SPEC=e2e/membership-gating.spec.ts,e2e/podcast-index-feed-add-trial-blocked.spec.ts,e2e/membership-page-trial-limitations.spec.ts
open .artifacts/e2e-reports/latest/index.html
```

On the Trial premium-gate shot, the confirm button reads Buy Membership, Cancel is under it,
and the body is larger than the old 15pt line with a clear band above the buttons.
