# Auth sessions and remote logout

## Request

It seems fishy to me that the web has such a long expiration while mobile has a short one. The intended user experience is that we are not a highly sensitive information app, so we do not want to forcibly log out users anytime soon. But I think that year expiration may be a misunderstanding about how token refreshes work. I'm not sure. The end result user experience is the user should be able to not visit the website for many weeks and still be logged in when they get there. Are there any changes you would recommend for us to get that user experience? It seems, but I'm not sure, like that is already how it works on mobile, where a login will stay valid for a long, long time, but you're telling me 900 seconds is the expiration, which is confusing to me. So if you think web is doing something incorrectly, that we can. Still, get the end result user experience that we're looking for without that year long expiration. Then, I want you to include in this plan set to fix that process.

It sounds like this auth process that we're talking about is separate from the other planning work we're doing now. So I would like you to create high-level placeholder files for making the changes we want to make later. But it also sounds like it would be a good idea to add the ability to forcibly remotely log out accounts, and that is an oversight in our current design. So I would like that to be a part of whatever changes you recommend for the best possible setup for our auth handling between web and mobile and any other potential future client.

## Operator answers

- **Separate set.** This is its own plan set, not part of `realtime-banner-notifications`. The "include in this plan set" line in the first paragraph was superseded by the second paragraph.
- **User experience:** Podverse is not a highly sensitive app. A user who has not visited for many weeks is still logged in when they return, on web and on mobile. No forced logouts in normal use.
- **Remote logout is required.** Sessions can be ended from the server. The operator called its absence "an oversight in our current design."
- **Scope:** the best setup for web, mobile, and any future client, not a web-only patch.
- **Direction accepted:** the operator said "Proceed with what you recommend" to the design under Recommended design. The planning run confirms the details and asks the open questions.

Answers to the five open questions (asked by planning step 02):

1. **Idle limit length:** "idle limit is 365 days with no use; every use renews it; one limit for every client."
2. **Device list:** "full session list on web and mobile, with device label, last used, a sign-out button per session, and "Sign Out of All Other Devices"."
3. **Admin granularity:** "admins end all of an account sessions only, with one "Force Logout" on the management-web user page; an admin setting a user password also ends all of that user sessions."
4. **Notify on remote logout:** "the signed-out device shows the specific reason, such as "You were signed out from another device", "An administrator signed you out", or "Your password was changed"; a reused refresh token that ends a session as suspected theft shows "You were signed out for your security"."
5. **Management-web auth:** "management-web admin logins use the same session model in this set, with a session table in the management database, the same renewal and revocation, and a superuser able to force-logout another admin."

### Review of the first planning pass

Answers to "## Decisions to review" in 00-SUMMARY.md (D1–D54):

- **D14 and D46, password changes:**
  - "changing your own password ends every other session, and the browser or device that made the change stays signed in, in both the app and management."
  - "A forgotten-password reset ends every session."
  - "An admin setting another user password still ends all of that user sessions."
  - "Update plan 21 to match; plan 63 already matches."
- **D1, refresh rotation:** "keep as planned; the previous refresh token stays valid until the new one is first used, with no time limit."
- **Every other decision** (D2–D13, D15–D45, D47–D54) is "accepted as written."

Found while recording the answers: the app has no signed-in way to change your own password today. Its only password routes are `POST /account/reset-password` (forgotten password) and `POST /account/set-password` (finishing an invite or account setup). Both are public email-link routes. Neither web Settings nor the mobile More screens have a change-password control. The operator answered:

- **App change-password scope:** option A. "Add a signed-in POST /account/change-password that takes the current and new password, ends every other session, and keeps the caller session; add a Change Password form in web Settings → Account and a matching mobile Settings screen, with catalog keys, Playwright, and Maestro coverage."
- **Invite completion:** "Invite completion (POST /account/set-password) ends every session."
- **Confirm-password fields (new requirement):** "remove the confirm-password field from every form: web Sign Up, Reset Password, and Set Password; mobile Sign Up; management-web Redeem Admin Invite and Edit User. The new change-password forms use one current-password field and one new-password field, with no show-password toggle."
- **Greenfield (new requirement):** "No environment holds data that must survive, so plans should make the deepest correct changes, including greenfield schema edits with no upgrade or compatibility paths."
  - This supersedes the Recommended design's point 8 (rollout keeps existing logins; rows R36 and R37) and decisions D7 and D8. Plans drop the legacy-token rollout, the columns and functions that exist only for it, and the deferred removal of that path.
  - Migrations follow **linear-sql-greenfield-only**: plain forward DDL with no guards, backfills, or upgrade branches. A new migration file still goes at the next free number; consolidated `0001_*_schema.sql` is not hand-edited.
  - Code left with no readers is removed rather than kept, for example the `DEFAULT_AUTH_JWT_EXPIRATION` and `DEFAULT_AUTH_MOBILE_REFRESH_TOKEN_EXPIRATION` exports that step 07 planned to leave in place.
- **The six confirm-password forms**, the only files in the tree with a confirm-password field: `apps/web/src/components/Auth/AuthSignUpForm.tsx`, `apps/web/src/components/Auth/AuthResetPasswordForm.tsx`, `apps/web/src/app/set-password/SetPasswordPageClient.tsx`, `apps/mobile/src/screens/auth/SignUpScreen.tsx`, `apps/management-web/src/app/(public-flows)/admins/redeem-invite-link/RedeemAdminInviteLinkPageClient.tsx`, and `apps/management-web/src/app/(management)/users/[id]/edit/EditUserPageClient.tsx`.

## Glossary

- **Remote logout:** ending a session from somewhere other than the device holding it: the user from another device, or an admin from management-web.
- **Session:** one login on one client (a browser profile, a mobile install, a future client).
- **Idle limit:** how long a session survives with no use. Use renews it.

## Orientation

Checked while writing this file; re-verify, since other work is landing in the tree.

- `apps/api/src/lib/auth/index.ts` holds all API auth:
  - `authenticate` (web login) signs one JWT with `config.auth.jwtExpiration` and sets it with `setAuthCookie` (httpOnly, `maxAge` from `config.auth.sessionCookieMaxAgeMs`). Nothing renews it, so an active web user is logged out exactly one year after login.
  - `issueMobileTokenPair` signs a 15-minute access JWT and a 365-day refresh JWT (`token_use: 'access' | 'refresh'`). `refreshMobileToken` verifies the refresh JWT and the account, then issues a fresh pair, so a mobile session stays alive as long as the app is opened within the refresh lifetime. That is why mobile already matches the requested experience.
  - Both token kinds are stateless. `revokeMobileToken` only acknowledges ("Refresh JWTs stay valid until they expire or AUTH_JWT_SECRET is rotated"). `logout` only clears the cookie in that browser. A password change does not end other sessions. The only server-side kill switch today is rotating `AUTH_JWT_SECRET`, which logs out everyone.
  - `verifyTokenAndMembership` (behind `ensureAuthenticated` and `optionalEnsureAuthenticated`) and `refreshMobileToken` already load the account on every authenticated request (`getAccountMatchingJwtIdentity`), so a session check can ride on that lookup.
  - Tokens are read from the `AuthCookieName` cookie or an `Authorization: Bearer` header.
- `apps/api/.env.example` and `apps/api/ENV.md`: `AUTH_JWT_EXPIRATION` (31536000), `AUTH_MOBILE_ACCESS_TOKEN_EXPIRATION` (900), `AUTH_MOBILE_REFRESH_TOKEN_EXPIRATION` (31536000), with defaults from `DEFAULT_AUTH_*` constants used in `apps/api/src/config/index.ts` and checked in `apps/api/src/lib/startup/validation.ts`.

## Recommended design

The planning run confirms each point against the code and records any change as a decision for review.

1. **Server-side session records.** Each login creates a session row: account, client type (web, mobile, future clients), a device label, created, last seen, revoked. The web cookie and the mobile refresh token each identify their session. A future client uses the same mechanism.
2. **Every authenticated request checks the session** in the account lookup it already makes: a revoked or missing session is a 401. Revocation takes effect on the next request, with no wait for a token to expire.
3. **Web renews as it is used.** A web request on a session last renewed more than a day ago extends the cookie and the session's last seen. The cookie lifetime becomes an idle limit, not a limit from login.
4. **Mobile keeps short access tokens and long refresh tokens**, with the refresh token rotated on every refresh and bound to its session. Using an already-rotated refresh token is treated as theft: it revokes that session.
5. **One idle limit for every client**, so web and mobile behave the same.
6. **Remote logout:**
   - The user can sign out one session or every other session.
   - An admin can force-logout an account from management-web (management API).
   - A password change, and account deletion, end every other session.
   - `logout` and `revokeMobileToken` revoke the calling session on the server.
7. **Open realtime streams close on revocation.** The `realtime-banner-notifications` set adds an account event stream over SSE with fanout through the existing Redis (Valkey). Revoking a session publishes an event that closes that session's open streams right away. Until this lands, that set caps a stream's lifetime at 30 minutes.
8. **Rollout keeps existing logins.** Tokens issued before sessions exist must not log everyone out at deploy. The planning run picks how: a one-time grace path that turns a valid legacy token into a session on first use, or another approach with the same user outcome.

## Open questions for the planning run

Ask the operator; do not assume.

1. **Idle limit length.** Proposed: 365 days, matching mobile today.
2. **Device list.** Does the user get a screen listing their sessions (device label, last seen) with per-session sign-out, on web and mobile, or only a "Sign Out of All Other Devices" action?
3. **Admin granularity.** Can an admin end one session, or only all of an account's sessions?
4. **Notify on remote logout?** Should the signed-out device show a reason ("You were signed out from another device"), or the ordinary logged-out state?
5. **Management-web auth.** Do management-web admin logins use the same session model, or stay as they are?

## Likely areas

Non-binding; the Split step decides the areas, waves, and plan files.

- **A. Session model:** linear SQL migration and entity for sessions, ORM service, retention and cleanup of old rows.
- **B. API auth:** login, web cookie renewal, mobile token pair bound to a session, refresh rotation and reuse detection, the session check in `verifyTokenAndMembership`, logout and revoke, password change and account deletion ending sessions, env vars and docs, legacy token rollout, OpenAPI, integration tests.
- **C. Remote logout surfaces:** user-facing session management on web and mobile (per the device-list answer), i18n, Playwright and Maestro coverage.
- **D. Admin force-logout:** a management API route and a management-web control, with permissions and E2E.
- **E. Realtime hook:** publishing session revocation so open account event streams close, once `realtime-banner-notifications` has landed.
