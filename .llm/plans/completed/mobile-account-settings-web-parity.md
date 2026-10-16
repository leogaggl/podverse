# Deferred: Mobile account settings that web already has

Saved for later. No code has been changed for this work.

This is the rest of the account surface a signed-in person can use on the website and cannot use
in the app. Login, resend verification, and forgot password are a separate plan:
`.llm/plans/active/mobile-login-verification-and-password-reset.md`.

## Already on mobile — do not rebuild

`apps/mobile/src/terms/AccountAccessPanel.tsx` already has membership status, review terms, sign
out, download my data, OPML export, and delete account. Settings already has appearance, playback,
downloads, notifications, terms, and popularity tracking. My Profile already shows the public
profile. None of that is in this plan.

## Not a mobile gap

These finish in the browser from the email link. Universal links do not claim the paths.

- `/verify-email`
- `/reset-password`
- `/email-change-verifying`
- `/set-password` (admin invite completion; `admin_only_username` / invite flow only)

## 1. Change email

Web: Settings → Account → Change Email (`ModalChangeEmail`), then the link in the email opens
`/email-change-verifying`.

Mobile has no way to start that. Add it on the account access panel, next to download and delete,
and only when email flows exist. Alpha and production use `user_signup_email`, so show it. Reuse
the catalog keys web uses (`settings.account.change_email` and the modal strings under
`settings.account.change_email_modal`). Do not write new English if those keys cover the screen.

The screen or dialog collects the new email and current password the same way
`ModalChangeEmail` does, then calls the same request (`reqAccountSendChangeEmail` or whatever
`ModalChangeEmail` calls — read that file and use its request, do not invent a second endpoint).

Success copy is the existing "check your email" string from that modal. The confirmation link
stays on the website.

Failure: 429 uses `handleRateLimitMessage`. A mailer failure is still swallowed in
`sendChangeEmailVerificationEmail.ts` (it logs and returns). Do not build a new support dialog
here. The signup mailer plan
(`.llm/plans/completed/signup-verification-email-failure-notice.md`) says to give that sender a
result type and leave the pop-up for later. This screen shows the same success text web shows
today.

Test IDs prefixed `account-access-change-email`.

## 2. Edit profile

Web: Settings → Profile (`SettingsProfile.tsx`) edits display name, bio, and sharable status, then
`reqAccountUpdate`.

Mobile My Profile (`apps/mobile/src/screens/profile/MyProfileScreen.tsx`) only displays them. Add
an edit screen reached from My Profile (a header or row action, title from the existing profile
settings catalog keys). Fields:

- Display name
- Bio
- Who can see the profile (the same three sharable statuses web's dropdown uses)

Save calls `reqAccountUpdate` with `display_name`, `bio`, `sharable_status`, and the current
locale, matching `AccountController.update`. Web's locale selector sends the current display name
and bio on a locale save so this update does not wipe them; the mobile locale screen must be
checked the same way. If it already sends the current profile fields, leave it. If it sends empty
profile fields, include those fields from the loaded account so a locale change cannot blank the
profile.

Reuse `settings.profile.*` catalog keys. Title case for the screen title and field labels; the
help under each field stays sentence case.

After a successful save, the in-memory account and the account snapshot update so My Profile
shows the new name without a relaunch.

Test IDs prefixed `my-profile-edit`.

## Tests

- API already covers account update and the change-email endpoints. Add a case only if the mobile
  call shape is not already asserted.
- Mobile unit tests for the profile payload (empty display name becomes null, locale is preserved)
  if that mapping is a function. Do not snapshot the screen.
- No new Maestro flow unless an existing profile or account-access flow asserts the old screen and
  would fail.

## Out of scope

- Listen stats (`SettingsListenStats` on web). Not required to recover an account.
- A logged-in "change password" form. Web does not have one either; reset is the forgot-password
  email.
- In-app handling of the email-change confirmation link.

## Verification (operator, after implementation)

```bash
npm run build:packages
npm --prefix apps/mobile run test
```
