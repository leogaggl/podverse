# 01 — Status headline and Trial Limitations sheet

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

## Goal

On [`MoreMembershipScreen.tsx`](/apps/mobile/src/screens/more/MoreMembershipScreen.tsx), a person
with an active membership sees what they have, and when it ends, as soon as the screen opens.
An active Trial also gets a link that opens the limitations list. The collapsible block at the
bottom of this screen goes away.

## Where it sits

The stack title stays `membership.membership` ("Membership"). Do not add a second "Membership"
heading in the body.

Order under that title:

1. `CustomApiNotice` (unchanged, only when a custom API is set).
2. The centered status block, when the rules below say to show it.
3. Logged-out or expired sentences, when those states apply.
4. The existing Sign Up or purchase button, and the logged-out pricing card. Do not change
   the purchase button's label.
5. `MembershipFeatureTable`.

Nothing after the feature table on this screen.

## Who sees the status block

Show it when `isLoggedIn && isMember && !isExpired`. That is the same gate Premium uses today
(`showsExpiry`), minus the `tier === 'premium'` check, so Trial uses it too.

| State | Headline | "Expires On" + date | Trial link | Sentences |
| ----- | -------- | ------------------- | ---------- | --------- |
| Logged out | Hidden | Hidden | Hidden | `membership.cta_sign_up_text` |
| Active Trial | Free Trial | When `expiresAt !== null` | Shown | None |
| Active Premium | Premium | When `expiresAt !== null` | Hidden | None |
| Expired Trial or Premium | Hidden | Hidden | Hidden | The two expired lines already returned |

Drop the active-Trial branch that returns only `membership.cta_upgrade_text`. The headline
replaces that sentence. Keep the purchase button. Do not change its label. Buy vs Extend is
`mobile-stacked-form-actions` prompt 02. If that prompt has not landed, the logged-in label
is still Extend Membership. Do not rename it here.

If `expiresAt` is null, show the headline and omit the label, the date, and (for Trial) the
link. Do not invent a date.

## Layout

One column, `alignItems: 'center'`, `textAlign: 'center'`, `gap: tokens.spacing.sm`. No `Card`.

| Line | Type | Color |
| ---- | ---- | ----- |
| Premium or Free Trial | `typography.display` (28 / 700) | See colors |
| Expires On | `typography.label` | `themeStyles.textSecondary` |
| The date | `typography.title` (22 / 700) | `themeStyles.textPrimary` |
| Trial Limitations Only | `typography.body`, underlined | `tokens.text.link` |

`accessibilityRole="header"` on the headline. `testID="more-membership-status-tier"` on that
text. Keep `testID="more-membership-expires"` on the date text.

The link is a `Pressable` with `minHeight: 44`, centered label, `accessibilityRole="link"`,
and `testID="more-membership-trial-limitations-link"`. The visible words are the accessible
name.

## Colors

Use tokens. Do not add a color, and do not hardcode a hex.

- Premium: `tokens.text.accent`. On dark that is `#3d9dfe`, the same blue as the primary button
  fill, already a text color. It is stronger than the link blue.
- Free Trial: `tokens.text.warning` (`#f4a24f` on dark, `#e67e22` on light).
- The link: `tokens.text.link`, with `textDecorationLine: 'underline'`.

Do not paint the headline with `tokens.button.primaryBg` or `tokens.button.warningBg`. Those
are fills.

## Copy

Reuse these keys:

- Premium: `membership.premium` ("Premium").
- Label: `settings.membership.expires_on` ("Expires On").
- Date: `formatDateAbbrev(expiresAt, i18n.language)` from `@podverse/helpers`. That is
  date-fns `MMM d yyyy` with the app locale (for example `Oct 15 2026` in en-US). Do not add
  another formatter, and do not call `toLocaleDateString`.
- Sheet title: `membership.trial_limitations_title` ("Trial Limitations").

Add two keys on the existing `membership` object in every
`packages/i18n-catalog/mobile/originals/{en-US,es,fr,el-GR}.json`, beside
`trial_limitations_missing_content`. Do not edit `overrides/`. Do not put these keys in
`consumer/`.

| Key | en-US | es | fr | el-GR |
| --- | ----- | -- | -- | ----- |
| `status_free_trial` | Free Trial | Prueba gratuita | Essai gratuit | Δωρεάν δοκιμή |
| `trial_limitations_only` | Trial Limitations Only | Solo limitaciones de la prueba | Uniquement les limitations de l'essai | Μόνο περιορισμοί δοκιμής |

`membership.free_trial` stays "Trial". Web uses it inside sentences. Do not change it.

After the JSON edits, run from the repo root:

```bash
npm run i18n:compile
```

Mobile imports `apps/mobile/i18n/compiled/*.json`. That output is gitignored. Compiling is
codegen, not a test.

## Trial Limitations sheet

Build `TrialLimitationsSheet` next to the accordion. Follow the bottom-anchored overlay in
[`BoostSheet.tsx`](/apps/mobile/src/components/boost/BoostSheet.tsx): `AppOverlay` with
`animation="slide"`, a scrim `Pressable` (`justifyContent: 'flex-end'`) that closes on press,
and `OverlayPanel` for the sheet. Do not import React Native `Modal`.

Keep the overlay mounted and drive it with `visible`.

Sheet contents, top to bottom:

- Title `membership.trial_limitations_title`, `accessibilityRole="header"`.
- Close control: `HeaderBarAction`, icon `close`, label `misc.close`,
  `testID="more-membership-trial-limitations-close"`.
- The same intro and bullets the accordion shows today, in a `ScrollView` (`maxHeight` about
  480, same idea as the boost sheet). No `Accordion`, no chevron, no Show More / Show Less.

`testID="more-membership-trial-limitations-sheet"` on the sheet. Set
`accessibilityViewIsModal` on that sheet view.

Pad the bottom by the safe-area inset so the last bullet clears the home indicator.

### Share the list, keep About as it is

[`TrialLimitationsAccordion.tsx`](/apps/mobile/src/components/membership/TrialLimitationsAccordion.tsx)
is also rendered from [`CopyMarkdown.tsx`](/apps/mobile/src/components/content/CopyMarkdown.tsx)
on More › About (`testID="more-about-trial-limitations"`). Leave that accordion in place.

Move the intro, the `TRIAL_LIMITATION_KEYS` list, and `MissingContentBullet` into
`TrialLimitationsContent`. The accordion and the sheet both render that content. Keep
`testID="trial-limitations-missing-content"` on the contact bullet. The mailto `Text` stays a
link with `tokens.text.accent` and an underline, as it is now.

Remove `<TrialLimitationsAccordion>` from `MoreMembershipScreen` only.

## Maestro

[`membership-gate.yaml`](/apps/mobile/e2e/membership-gate.yaml) currently scrolls to "Trial
Limitations" and expands the accordion while logged out. That block will time out once the
accordion is gone. Delete that scroll, tap, and the assertions that follow it (the summary, the
stats bullet, `trial-limitations-missing-content`, and the email), up through the screenshot
`membership-gate-signup-cta`. Keep the Sign Up CTA and feature-table assertions, then take that
screenshot.

On the logged-in visit (after `premium-gate-renew` lands on `more-membership-screen`):

- Assert text `Free Trial`, `Expires On`, and `more-membership-expires`.
- Assert visible id `more-membership-cta`. Do not assert the English label. Prompt 02 of
  stacked form actions owns that string (Buy Membership for the seeded Trial account).
- `assertNotVisible` text `Upgrade to Premium`.
- Tap `more-membership-trial-limitations-link`.
- Assert `more-membership-trial-limitations-sheet`, the summary sentence, the stats bullet, and
  `trial-limitations-missing-content`.
- Take a screenshot of the open sheet.
- Tap `more-membership-trial-limitations-close`, then `assertNotVisible` the sheet, before the
  flow ends.

Maestro can still hit controls under an open overlay. Close the sheet before any later tap on
the Membership screen.

[`membership-checkout.yaml`](/apps/mobile/e2e/membership-checkout.yaml) already waits for
`more-membership-expires` after purchase. Also assert text `Premium`, and `assertNotVisible`
text `Trial Limitations Only`.

Do not change `about.yaml`.

## Leave alone

- Web [`apps/web/src/app/membership/page.tsx`](/apps/web/src/app/membership/page.tsx) and
  `TrialLimitationsCollapsible`. Web Trial copy stays the "time remaining" sentences. This
  headline and sheet are a mobile layout, not a shared one.
- `deriveMembershipState`, checkout, feature-table rows, and the Extend Membership route.
- `packages/i18n-catalog/mobile/overrides/`.

## Operator verification

Prerequisites, already running in their own tabs: **Mobile E2E Metro**, **Mobile E2E API**,
**Mobile E2E test-assets**, and **Mobile E2E iOS** / **Mobile E2E Android**. Do not paste those
leave-running commands into the block below.

**Mobile Maestro:**

```bash
npm run i18n:validate
npm run mobile:e2e:test -- membership-gate
npm run mobile:e2e:test -- membership-checkout
open .artifacts/mobile-e2e-reports/latest/failures.json
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
```
