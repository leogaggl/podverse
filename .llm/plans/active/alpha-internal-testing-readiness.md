# Alpha deployment + internal store testing — readiness (temporary)

Temporary working note. Delete it once internal testers are running against alpha. Items are high
level on purpose; detail each one only when it is picked up.

## Assessment

**Close, but not yet.** The mobile app has enough features for internal testers. The gaps are
release plumbing and an alpha environment that has drifted, not missing screens:

- Alpha runs `5.5.2-staging.0` (GitOps `k.podcastdj.com/apps/podverse-alpha`). The newest staging
  tag, `5.5.3-staging.2`, is from 2026-07-27 and 255 commits behind `develop`. No published build
  contains billing, terms acceptance, auto-download, add-by-RSS credentials, or Strike.
- Nothing points a store build at alpha. `eas.json` has no env, and the beta workflow injects none.
- The `internal` EAS profile is a dev-client build that needs Metro, so it cannot go to testers.

## 1. High need — do first

1. **Cut a fresh staging build.** Sync `develop` to `staging` and let **Publish (staging)** build
   images for the current tree.
2. **Catch alpha up to that build.**
   - Back up the alpha database. 14 app and 2 management linear migrations apply forward from
     `5.5.2` (the `0001` baselines are unchanged, so no reset is needed).
   - Mirror about 200 lines of source env changes since `5.5.2` (api, management-api, workers,
     web-sidecar, product-membership-settings) into the alpha overlay.
   - Replace the placeholder mailer (`MAILER_HOST="smtp.example.com"`). Mobile has no password
     reset or email verification screens, so testers depend on email plus the web pages.
   - Confirm the new cron and worker jobs (billing reconcile, auto-download, notifications) are in
     the overlay.
   - Firebase push for the `.next` app ids, including the APNs key for the iOS bundle.
3. **Point store builds at alpha.** Set EAS environment variables for the `beta` profile:
   `EXPO_PUBLIC_MOBILE_API_BASE_URL` (alpha API, `/api/v2`), `EXPO_PUBLIC_MOBILE_WEB_BASE_URL`
   (otherwise universal links default to `podverse.fm`), `EXPO_PUBLIC_CONTACT_EMAIL`,
   `EXPO_PUBLIC_MOBILE_BILLING`, `EXPO_PUBLIC_MOBILE_PUSH_PROVIDER`. Leave
   `EXPO_PUBLIC_MOBILE_V4V_ENABLED` empty so the V4V placeholder stays hidden.
4. **Ship from the `beta` profile.** TestFlight internal and the Play internal track both take
   store-distribution builds. Fill in `submit.beta.ios` (App Store Connect app id / API key); the
   Make targets cover Android only.

## 2. Store account setup (one-time)

- **App Store Connect:** app record for `com.podverse.app.next`, a TestFlight internal group, and
  `ITSAppUsesNonExemptEncryption` in `app.config.ts` so builds skip the export-compliance prompt.
  Check the privacy manifest (required-reason APIs) on the first upload.
- **Play Console:** app record, internal testing track, and the App content forms (privacy
  policy URL, data safety, content rating, target audience, ads). Play products can only be created
  after a first build is uploaded. Add license testers for billing.
- **Privacy policy URL:** web has `/terms` and no `/privacy` page. Confirm terms covers privacy,
  or add the page before filling in the store forms.
- **Membership products** (month and year) only if purchase is part of internal testing. The
  simpler option is to leave store billing off on alpha and grant membership from management.

## 3. Mobile items to close or knowingly waive

- **Manual car gates:** CarPlay Simulator proof, Android Auto DHU run, and the Play Console
  Android Auto declaration (the app ships `automotive_app_desc.xml`).
- **E2E:** one full Maestro run green on both platforms, including `deep-link` and `push`.
- **iOS performance:** `mobile-ios-perf` and `mobile-home-switch-followups` have no prompts done.
  Judge from a release build on a real phone; dev builds are slower.
- **Feedback path:** there is no crash reporter, only the in-app error log and a contact email.
  Decide whether that is enough for internal testers.
- **Accept for internal testing:** no password reset, email verification, or edit-profile screens;
  no Privacy or Contact screens; V4V is a placeholder.

## 4. Suggested sequence

1. Alpha environment catch-up, fresh staging build, deploy. Smoke-test web and management on alpha.
2. Store records and EAS env vars. First `beta` build per platform, submitted to TestFlight internal
   and the Play internal track.
3. Phone smoke test against alpha: sign up (email arrives), log in, subscribe, play, download,
   offline, push, queue sync between web and phone, add by RSS, optional sandbox purchase.
4. Manual car gates.
5. Invite testers (`docs/operations/mobile/MOBILE-BETA-TESTER-ONBOARDING.md`) with release notes.

## 5. Later — before widening past internal testers

- App-wide minimum client version prompt (Phase 2 P2.3.1).
- Car UX parity layout (P2.3.22).
- Accessibility audit (P2.3.10) and the release-notes system plan.
- v4 membership expiry import (parked plan) and the production convergence gate (`4.25`).
