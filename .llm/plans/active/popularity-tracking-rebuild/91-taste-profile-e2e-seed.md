**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 91 — E2E seed: a Taste Profile account and a stale-acceptance account

Fixtures for the web spec (plan 93), the web gate check (plan 92) and the Maestro flow (plan 95).
Mobile E2E reuses this seed (`make mobile_e2e_seed`), so one change covers both clients.

Two new accounts, both with a trial grant and the current terms:

- **`e2e-taste-profile@example.com`** accepted the current Popularity Tracking version and has a
  Taste Profile with two shows and one show on Hidden From Taste Profile. A dedicated account
  keeps the web spec's hides, unhides and opt-out away from `e2e-user@example.com`, which other
  specs rely on.
- **`e2e-popularity-stale@example.com`** accepted an older Popularity Tracking version, so the web
  agreement prompt appears for it, and a No there deletes data (plan 70's "stale acceptance").

## Rows

R18, R55, R56, R58

## Runs after

10, 20

## Files

- `tools/web/seed-e2e.mjs`
- `apps/web/e2e/helpers/legalConsent.ts`

## `tools/web/seed-e2e.mjs`

Large file. Search for the anchors below, then edit a window (**large-file-reading**). Plan 20
changes only the value of `E2E_POPULARITY_TRACKING_VERSION`; this plan uses that constant and does
not touch its value.

### Constants

After `const E2E_POPULARITY_UNDECIDED_EMAIL = …;` add:

```js
/** Sync with apps/web/e2e/helpers/legalConsent.ts */
const E2E_TASTE_PROFILE_EMAIL = 'e2e-taste-profile@example.com';
/** Sync with apps/web/e2e/helpers/legalConsent.ts */
const E2E_POPULARITY_STALE_EMAIL = 'e2e-popularity-stale@example.com';
/** Older than E2E_POPULARITY_TRACKING_VERSION, so an acceptance on it is stale. */
const E2E_OUTDATED_POPULARITY_TRACKING_VERSION = '2026-01-01';
```

### Accounts — inside `resolveSeedAccountId`

The full seed path (after the `SEED_MEDIA_FIXTURES_ONLY` early return) truncates `account` with
`CASCADE` and creates every fixture account. Anchor: the consent-order account block, which ends
with the `account_settings` insert for `consentOrderAccountId`, right before
`console.log(\`Seeded 1 test user: e2e-user@example.com\`);`.

Insert two account blocks there. Copy the undecided-account block (`undecidedIdText` …
`undecidedAccountId`) step for step: `account` (random `id_text` from
`crypto.randomBytes(8).toString('hex').slice(0, 15)`), `account_credentials` with `passwordHash`,
`account_membership_status`, the `billing_membership_grant` trial row, and
`account_terms_acceptance` on `E2E_CONFIGURED_TERMS_VERSION`. Only `account_settings` differs:

| Account | Variable prefix | `allow_listen_stats` | `listen_stats_accepted` | `listen_stats_agreement_version` | `listen_stats_decided_at` |
| --- | --- | --- | --- | --- | --- |
| `E2E_TASTE_PROFILE_EMAIL` | `tasteProfile` | `true` | `true` | `E2E_POPULARITY_TRACKING_VERSION` | `NOW()` |
| `E2E_POPULARITY_STALE_EMAIL` | `popularityStale` | `true` | `true` | `E2E_OUTDATED_POPULARITY_TRACKING_VERSION` | `NOW() - INTERVAL '30 days'` |

Pass the version as a query parameter, as the e2e-user block does. After the existing
`console.log` lines for seeded users, add:

```js
console.log(`Seeded taste-profile user: ${E2E_TASTE_PROFILE_EMAIL}`);
console.log(`Seeded popularity-stale user: ${E2E_POPULARITY_STALE_EMAIL}`);
```

### Taste rows — new `seedTasteProfileFixtures(client)`

The rows need the seeded channels, which `seedMediaPlayerAndEmbedFixtures` creates after the
accounts. Add a new function directly after `seedRemovedContentFixtures`, and call it in `main()`
on the line after `await seedRemovedContentFixtures(client, accountId);`:

```js
await seedTasteProfileFixtures(client);
```

The function:

1. Look up the account id: `SELECT ac.account_id FROM account_credentials ac WHERE ac.email = $1`
   with `E2E_TASTE_PROFILE_EMAIL`. When there is no row (the `SEED_MEDIA_FIXTURES_ONLY` path does
   not create the account), `console.log('Skipping taste-profile fixtures: account not seeded')`
   and return.
2. `DELETE FROM stats_listener WHERE account_id = $1`. The cascades clear any taste and hidden
   rows from an earlier run, so a reseed always starts from the same state.
3. `INSERT INTO stats_listener (account_id) VALUES ($1) RETURNING listener_id`.
4. Resolve channel ids by `id_text` with one query:
   `SELECT id, id_text FROM channel WHERE id_text = ANY($1::text[])` with
   `[E2E_PODCAST_CHANNEL_ID_TEXT, E2E_VIDEO_CHANNEL_ID_TEXT, E2E_DIRECTORY_ARTIST_ID_TEXT]`.
   If any of the three is missing, `throw new Error(\`Taste-profile fixtures: channel ${idText} not seeded\`)`.
5. Insert two `stats_taste_profile` rows:

   | Channel | `listen_count` | `completion_count` | `first_listened_at` | `last_listened_at` | `recent_score` | `long_term_score` | `scores_updated_at` |
   | --- | --- | --- | --- | --- | --- | --- | --- |
   | `E2E_PODCAST_CHANNEL_ID_TEXT` | 3 | 1 | `NOW() - INTERVAL '20 days'` | `NOW() - INTERVAL '1 day'` | 1.5 | 2.8 | `NOW() - INTERVAL '1 day'` |
   | `E2E_VIDEO_CHANNEL_ID_TEXT` | 2 | 0 | `NOW() - INTERVAL '30 days'` | `NOW() - INTERVAL '2 days'` | 0.9 | 1.9 | `NOW() - INTERVAL '2 days'` |

   The podcast row sorts first (`last_listened_at DESC`).
6. Insert one `stats_taste_profile_hidden` row for `E2E_DIRECTORY_ARTIST_ID_TEXT` with
   `hidden_at = NOW() - INTERVAL '3 days'`.
7. `console.log(\`Seeded taste-profile fixtures for ${E2E_TASTE_PROFILE_EMAIL}\`)`.

All three `*_ID_TEXT` constants already exist at the top of the file; reuse them. The seed runs as
`podverse_app_read_write`, which plan 10 grants on `stats_listener`.

## `apps/web/e2e/helpers/legalConsent.ts`

After `E2E_CONSENT_ORDER_PASSWORD`, add, each with a one-line JSDoc in the file's style:

```typescript
/** Current popularity-tracking acceptance with a seeded Taste Profile. Sync with tools/web/seed-e2e.mjs. */
export const E2E_TASTE_PROFILE_EMAIL = 'e2e-taste-profile@example.com';

export const E2E_TASTE_PROFILE_PASSWORD = 'Test!1Aa';

/** Popularity tracking accepted on an older version. Sync with tools/web/seed-e2e.mjs. */
export const E2E_POPULARITY_STALE_EMAIL = 'e2e-popularity-stale@example.com';

export const E2E_POPULARITY_STALE_PASSWORD = 'Test!1Aa';
```

The web specs read channel ids and titles from `apps/web/e2e/helpers/seedConstants.ts`, which
already exports `E2E_PODCAST_CHANNEL_ID_TEXT`, `E2E_PODCAST_CHANNEL_TITLE`,
`E2E_VIDEO_CHANNEL_ID_TEXT`, `E2E_VIDEO_CHANNEL_TITLE`, `E2E_DIRECTORY_ARTIST_ID_TEXT` and
`E2E_DIRECTORY_ARTIST_TITLE`. That file does not change.

## Tests

No test of its own. Plans 92, 93 and 95 use these fixtures.

## Release scratchpad

none
