# 722-popularity-tracking-consent

**Master step:** P2.1.8 / P2.1.10
**Status:** done

## Scope

Account-level, versioned Popularity Tracking consent for consumer web and mobile. Logged-in users
who have never decided, or who previously accepted an older agreement version, are blocked until
they choose Yes or No. A decline is sticky across later version bumps. Tracking is allowed only
when the last decision is accept of the current server version.

Anonymous visitors are never prompted and never tracked as unique listeners.

## Surfaces

- Consumer web: `/popularity-tracking` gate and Account settings
- Mobile: full-screen gate after login and More → Settings → Popularity Tracking
- API: `GET /legal/popularity-tracking` and `PATCH /account-settings/listen-stats` `{ accepted }`

## Follow-up

The choice screen that shipped here labels the rest of the text "Full Agreement" and sits that
control on the bottom edge of "Yes, Track Me". The buttons are still the short height. That
framing is wrong for this feature. The served text explains how Popularity Tracking works. The
legal notice belongs in the terms of service. The opt-in, the sticky decline, and the version
check above stay.

The work is
[`.llm/plans/active/popularity-tracking-how-it-works/`](/.llm/plans/active/popularity-tracking-how-it-works/00-SUMMARY.md).

## Out of scope

- Management CMS for the explanation
- Changing how aggregated stats are computed
- Prompting signed-out visitors
