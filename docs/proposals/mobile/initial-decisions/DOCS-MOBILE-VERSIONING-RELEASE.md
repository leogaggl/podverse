# Mobile versioning and release flow

**Recommendation: keep the shared `X.Y.Z` version number for human sanity, but run mobile on its own
store-release track that is decoupled from the container-image promotion pipeline.** Mobile cannot
use the "retag the same digest" model that the servers use, because app stores rebuild binaries and
gate every release behind review.

## How the server pipeline works today (for contrast)

From [STAGING-MAIN-PROMOTION.md](/docs/development/release/STAGING-MAIN-PROMOTION.md):

- `develop → staging → main` are fast-forward branch mirrors.
- Staging builds images tagged `X.Y.Z-staging.N`.
- Promotion to `main` is **`crane copy`** — the _same image digest_ is retagged `X.Y.Z` and
  `latest`. **No rebuild.**
- One version line is bumped across all workspaces by `scripts/publish/bump-version.sh`.

The "promote without rebuild" trick is the heart of the server flow. **It does not exist for mobile.**

## Why mobile is fundamentally different

| Property                 | Server (containers)              | Mobile (App Store / Play Store)                |
| ------------------------ | -------------------------------- | ---------------------------------------------- |
| Promotion mechanism      | Retag same digest (`crane copy`) | Rebuild + re-sign per channel; store review    |
| Who gates release        | You                              | Apple / Google review (hours to days)          |
| Rollback                 | Retag previous digest instantly  | Submit a new build; cannot "un-ship"           |
| Phased rollout           | Your infra                       | Store-managed staged rollout (e.g. % of users) |
| Version identity         | `X.Y.Z` image tag                | Marketing version **+ monotonic build number** |
| Old versions in the wild | None (clients hit your servers)  | Many; users may never update                   |

The last row matters most architecturally: **you will always have old mobile clients in the field.**
Your API must stay backward compatible with shipped mobile versions far longer than it must for web.

## Recommended versioning scheme

Keep one human-facing version, add the store-required build number:

- **Marketing version = the monorepo `X.Y.Z`.** When you bump the repo version, the mobile app's
  marketing version (`CFBundleShortVersionString` on iOS, `versionName` on Android) matches. This is
  the "consistent version numbers for ease of use" you already value.
- **Build number is mobile-only and monotonic.** iOS `CFBundleVersion` and Android `versionCode`
  must strictly increase for every uploaded binary, including re-submissions of the same `X.Y.Z`.
  Drive it from CI (e.g. a build counter or commit-derived integer). It is independent of the repo
  version and never resets.

So a TestFlight build might be `5.5.0 (1042)` and the production build of the same release `5.5.0
(1051)` — same marketing version, different build numbers.

## Mapping mobile onto develop → staging → main

Reuse the branch model for **server** promotion. Mobile store channels are **not** tied to branch
pushes. Merging to `staging` or `main` never builds or submits the app.

| Branch    | Server result                 | Mobile (on demand only)                                           |
| --------- | ----------------------------- | ----------------------------------------------------------------- |
| `develop` | dev/test images               | Optional local `internal` (dev client) when you need one          |
| `staging` | `X.Y.Z-staging.N` images      | Operator runs `beta` via Make → TestFlight + Play internal draft  |
| `main`    | `X.Y.Z` promoted (no rebuild) | Operator runs `production` via Make → App Store / Play when ready |

EAS profiles pin environments in [`apps/mobile/eas.json`](/apps/mobile/eas.json): `internal` →
`development`, `beta` → `preview`, `production` → `production`. Put alpha `EXPO_PUBLIC_*` values on
the **preview** environment so a beta build points at alpha without a local `.env`.

Key differences to design for:

- **No fast-forward promotion of a binary.** Promoting to production is "submit the
  already-tested build to review," not a retag. Prefer promoting the _exact binary_ you tested in
  TestFlight/closed testing to production (both stores support this) so you ship what you QA'd.
- **Review latency is part of the schedule.** A `main` merge ships servers in minutes but ships
  mobile only after an on-demand build **and** store approval. Plan releases so the API/web side
  does not assume all clients upgraded.
- **Decouple completely from server publish.** Local Make (`scripts/mobile/eas-store.sh`) is the
  release path. Do not attach `eas build` / `eas submit` to push or merge events. A future GitHub
  `workflow_dispatch` button is optional and must stay behind an approval environment. See
  [MOBILE-RELEASE-RUNBOOK.md](/docs/operations/mobile/MOBILE-RELEASE-RUNBOOK.md).

## Tooling recommendation

- **EAS Build + EAS Submit** via `scripts/mobile/eas-store.sh` (and `make mobile_eas_ios_*` /
  `mobile_eas_android_*`). Signing credentials stay on EAS; the Mac (or a future Actions runner)
  only holds an Expo login / `EXPO_TOKEN`.
- **Store metadata as code** (Fastlane `deliver`/`supply` or EAS metadata) so release notes,
  screenshots, and review info are versioned in the repo.
- **No over-the-air updates.** JavaScript and native changes both ship in the next store binary.
  EAS Update stays off unless the operator explicitly asks for it in that conversation. It is a
  major change. See **mobile-store-builds-on-demand**.

## API backward-compatibility discipline

Because old mobile clients persist:

- Version the API contract and **never break shipped DTO shapes**; add fields, do not repurpose
  them. The shared `@podverse/helpers` DTOs make this explicit and reviewable.
- Consider a minimum-supported-version signal so the app can prompt users to upgrade when a client
  is too old, rather than failing silently.

## Bottom line

Keep the single `X.Y.Z` marketing version for consistency, add a mobile-only monotonic build number,
ship store builds on demand (not on every staging/main merge), and keep mobile release separate from
the container promotion pipeline. Design the API to outlive old clients.
