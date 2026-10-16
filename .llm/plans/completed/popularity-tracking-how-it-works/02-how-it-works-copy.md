# 02 — How it works

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

Replace the legal-agreement voice with an explanation. Same opt-in. Same version check. The
words change. The behavior does not.

Read [00-SUMMARY.md](00-SUMMARY.md) and follow the facts and the no-version-bump rule. Keep
`2026-10-15`. Do not edit `AgreementChoices` layout. That gap is
[stacked form actions](../mobile-stacked-form-actions/01-stack-decisions-and-dialog-type.md).
Do not edit the terms files (plan 03). The terms and this explanation describe the same
opt-in.

## Voice

Friendly and plain. A listener who does not write software should be able to follow it. Still
say the parts that matter: a random id, that we can connect it back to the account, that a
second play does not count twice while the row exists, that the website also records a profile
visit and a playlist open, and that public lists keep counts after a row is deleted.

Do not call this an agreement, a policy, or a consent form. Do not say the data is anonymous
or anonymized. Do not say "legal", "comply", or "we are required".

The first block, before the first `#` heading, is what `getCopyMarkdownIntro` shows above the
buttons. Keep that block short. The rest opens under **How It Works**.

Headings in the English file are title case. Sentences are sentence case. `{brand_name}` and
`{retention_days}` stay as placeholders. Do not hardcode Podverse or `30`.

## English source

Write this to `apps/api/legal/popularity-tracking/en-US.md`, then translate it into `es.md`,
`fr.md`, and `el-GR.md`. Each language uses its own capitalization. Keep the placeholders
identical. Do not edit `overrides/`.

````markdown
Popularity Tracking is optional. It helps listeners find shows people are enjoying, and it helps creators see when their work is reaching people.

If you turn it on, {brand_name} counts you as one listener. Your name is not part of that count. You can turn it off any time in Settings.

# How a Listen Is Counted

Playing something in the catalog records that listen: the episode or track, the clip when you played a clip, and the show it belongs to. Playing that same thing again, while the record is still stored, does not count you a second time.

On the website, two more things are recorded: opening someone else's profile, and opening a playlist. Opening your own profile is not recorded.

Listening while signed out is not counted. If Popularity Tracking is off, new listens are not recorded.

# What We Store

Each record has a random id for your account, which thing you played or opened, and when. It does not include your name, your email, or your username. That id is not shown on your public profile.

We can still connect the id back to your account. That is how turning this off, and deleting your account, applies to you. This is not anonymous. We do not give the id to anyone else.

# What the Lists Show

The public lists show counts. They do not show who listened.

# What We Do Not Do

- We do not sell this information.
- We do not use it to advertise to you.

# How Long We Keep It

Individual records are deleted after {retention_days} days. Counts already added to the public lists can stay after a record is deleted. Those counts are numbers, not a list of listeners.

Deleting your account deletes the random id and the records tied to it.

# Changing Your Mind

Turn this on or off in Settings. Turning it off stops new records. Records already stored are deleted when they reach {retention_days} days.

If you turn it off, we will not ask again when this explanation changes. If you turn it on, and we later change what we record or how long we keep it, we will ask again. Until you say yes to that update, tracking stays off.
````

`apps/api/src/lib/legal/popularityTrackingContent.ts` today only replaces `{brand_name}`.
Also replace `{retention_days}` the same way `termsContent.ts` does: the configured
`STATS_TRACK_EVENT_RETENTION_DAYS` when it is a positive integer, otherwise
`DEFAULT_STATS_TRACK_EVENT_RETENTION_DAYS` from `@podverse/helpers`.

## Catalog

`packages/i18n-catalog/consumer/originals/` for `en-US`, `es`, `fr`, and `el-GR`.

| Key | en-US |
| --- | ----- |
| `popularity_tracking.how_it_works` | How It Works |
| `popularity_tracking.load_error` | Could not load how Popularity Tracking works. Please try again. |
| `popularity_tracking.status_stale` | How Popularity Tracking works has changed. It stays off until you turn it on again. |
| `popularity_tracking.already_agreed` | You already turned this on for the current explanation. |

Remove `popularity_tracking.full_agreement` after every callsite moves. Terms keep
`terms_acceptance.full_agreement` and the web terms key. Do not rename those.

Point these at `how_it_works`:

- `apps/mobile/src/popularityTracking/PopularityTrackingAgreementBody.tsx`
- `apps/web/src/components/Legal/PopularityAgreementGate.tsx`

Leave the Yes / No labels. Leave `testID`s (`popularity-tracking-full-agreement` and
`popularity-tracking-settings-full-agreement`). Maestro taps the id, not the title.

## Rule

`.cursor/rules/server-managed-copy.mdc` currently calls Popularity Tracking a versioned
acceptance document with an agreement date. Change that section so it says:

- Terms of Service stay a versioned acceptance document on `GET /legal/terms`.
- Popularity Tracking stays on `GET /legal/popularity-tracking` (authenticated), not a
  managed-copy slug, because the explanation can change without an app release.
- That document explains the feature. It is not the legal notice and it does not show an
  agreement date. The legal notice is the terms.
- The server version still gates tracking. Bump it only when what is recorded, how long it is
  kept, or who can see it changes. This wording pass does not bump it.

Do not mention a plan or a step number in the rule.

## Tests that name the old sentences

- `apps/api/src/test/legal-popularity-tracking.test.ts` — assert the intro contains
  "Popularity Tracking is optional" and the body contains "not anonymous". Drop
  "unique-listener rankings" and "pseudonymous listen event".
- `apps/web/e2e/popularity-tracking-consent.spec.ts` — the visible intro phrase and the
  accordion label become the new ones. The step that opens the accordion looks for **How It
  Works**, then a heading from the new body (for example "What We Store"). Do not look for
  "Full Agreement" on this screen.
- `packages/helpers/src/lib/copyMarkdown.test.ts` uses "## Listen Statistics" as sample
  markdown for the parser. Leave that fixture. It is not the terms file.

## Verify

Do not run tests in this turn. The operator runs the set once, from
[COPY-PASTA.md](COPY-PASTA.md).
