# 03 — Terms notice

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

The terms of service are the legal notice. Popularity Tracking's own screen is only the
explanation (plan 02). This plan updates the terms so the notice matches the feature.

Read [00-SUMMARY.md](00-SUMMARY.md). Follow the facts and the no-version-bump rule. Do not edit
the popularity-tracking markdown, catalog keys, or `AgreementChoices`.

## What the current terms miss

`apps/api/legal/terms/en-US.md` has a short "Listen Statistics" section. It says the company
may record pseudonymous events, that you can opt in or out, and that raw events are deleted
after `{retention_days}` days. It does not say:

- the feature's name, or that it stays off until the person turns it on
- that turning it off does not limit playback, the account, or a membership
- what a record contains, and that the company can connect the random id back to the account
- that a second play does not count twice while the row exists
- that the website also records another person's profile and a playlist open
- that signed-out listening is not stored this way
- that public counts can remain after a raw row is deleted
- that deleting the account deletes the id and the rows
- how to ask for a copy or a deletion, and that a refusal can be appealed by replying
- who operates the service, or which state's law governs

Do not add biometric, genetic, student, or precise-location language. This feature does not
collect those.

Do not name Illinois or Indiana in the markdown. The company is in Illinois and expects to
organize in Indiana. `{legal_name}` and `{legal_address}` follow that move without a terms
rewrite.

## English section

Replace the `## Listen Statistics` section through the raw-events sentence. Keep the Cloudflare
analytics sentence and the cookie section. They are a different feature.

The access sentence moves into the new section. Do not leave a second, vaguer copy of it under
Your Data.

````markdown
## Popularity Tracking

Popularity Tracking is an optional feature. It stays off until you turn it on, and you can turn it off in account settings. Turning it off does not limit playback, your account, or a membership.

When it is on, {legal_name} records that your account played a catalog episode, track, or clip, and which show it belongs to. Playing the same thing again, while that record is still stored, does not count you a second time. On the website, opening someone else's profile is recorded, and opening a playlist is recorded. Opening your own profile is not. Listening while signed out is not recorded this way.

Each record stores a random id for your account, the thing you played or opened, and the time. The id is not your name, your email, or your public username. {legal_name} can connect that id back to your account, so your choice and a deletion request apply to you. The record is not anonymous.

The records are used to count listeners for discovery lists and so creators can see that their work is reaching people. They are not sold, they are not shared as a profile of you, and they are not used to advertise to you.

Raw records are deleted after {retention_days} days. Counts already published can remain as numbers, without a list of who listened. Deleting your account deletes the id and the records tied to it.

To ask for a copy, a correction, or deletion sooner than that, email {contact_email}. If we refuse, reply to that email and we will review the request again.
````

When `{contact_email}` is empty, `termsContent.ts` already drops lines that contain that
placeholder. Keep that behavior so this section does not show a broken email sentence.

Add this at the end of the English file:

````markdown
# The Company

{legal_name} operates {brand_name} from the United States. These terms are governed by the laws of the state where {legal_name} is organized, and by United States federal law.

{legal_address}
````

`interpolateTermsMarkdown` must replace `{legal_address}` from `config.legal.address`. When
that value is empty, drop lines that contain `{legal_address}`, the same way empty
`{contact_email}` lines are dropped. Never leave the placeholder in the served markdown.

Translate the new section and the company block into `es.md`, `fr.md`, and `el-GR.md`. Match
the meaning. Use each language's own capitalization. Keep every placeholder identical to
English. Do not edit `overrides/`.

## Version

Do not change `TERMS_OF_SERVICE_VERSION`, `POPULARITY_TRACKING_AGREEMENT_VERSION`, or the
"Valid since" behavior. Say that in the summary you leave for the operator, and point them at
00-SUMMARY for why.

## Tests

Find the test that loads terms markdown from `GET /legal/terms` (or the loader, if no route
test exists). Assert the interpolated English contains "Popularity Tracking" and "optional",
and that the served body does not contain the literal `{legal_address}`.

If no terms-markdown test exists, add one case next to the other legal route tests. Do not
snapshot the whole document. Do not edit `copyMarkdown.test.ts`; its "Listen Statistics"
heading is parser sample text.

## Verify

Do not run tests in this turn. The operator runs the set once, from
[COPY-PASTA.md](COPY-PASTA.md).
