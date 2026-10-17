# Popularity Tracking: how it works, and the terms notice

The choice screen explains an optional feature. It is not a legal agreement. The legal notice
lives in the terms of service.

Three plans, run together. They do not edit the same files.

| Plan | What it changes |
| ---- | --------------- |
| [01](01-choice-screen-layout.md) | Closed. Button height is already in the working tree. The accordion gap is [stacked form actions](../mobile-stacked-form-actions/01-stack-decisions-and-dialog-type.md) |
| [02](02-how-it-works-copy.md) | The explanation people read, on web and mobile |
| [03](03-terms-notice.md) | The terms section that covers this feature for a U.S. company |

## What stays

- Opt-in. Tracking runs only when the account accepted the current server version.
- A decline sticks. A later version does not ask again.
- Signed-out listening is not stored as a unique listener. The stats routes require a signed-in
  account, and they refuse the write when the account has not opted in.
- Column and DTO names stay (`listen_stats_agreement_version` and the rest). Renaming them
  rewrites account snapshots already stored on phones.

## Do not bump versions in this set

`POPULARITY_TRACKING_AGREEMENT_VERSION` and `TERMS_OF_SERVICE_VERSION` stay as they are.

The working tree already uses `2026-10-15` for both ids. Keep that id. This text has not
shipped to users, so the new explanation and the new terms section replace the words under
`2026-10-15`. Do not mint a later date in this set.

The terms section and the friendly explanation describe the same opt-in. The terms do not
reserve a right to track while the feature is off. The explanation is not a second legal
agreement. The stored field name stays `listen_stats_agreement_version`.

A bump of the popularity version turns tracking off for everyone who already said yes, until
they confirm again. This set corrects the explanation of behavior that already ships. It does
not change what is recorded, how long it is kept, or who can see it.

A bump of the terms version blocks the app until every account accepts again. The terms already
say listen statistics are optional. This set makes that notice match the feature. The operator
can bump either version later if counsel wants a fresh confirmation.

## Facts the copy and the terms must match

These are already true in the code. Do not soften them.

- One stored row per account per thing, while that row exists. Playing it again does not add
  another row. After the row is deleted, a later play can record it again.
- A row holds a random account id (`account_guid`), the thing that was played or opened, and
  the time. It does not hold the person's name, email, or username. The id is not shown on the
  public profile.
- `stats_track_account_guid` stores that id next to `account_id`. The company can connect them.
  The data is not anonymous. Do not write "anonymized".
- Playback on web and mobile can record the show, the episode or track, and the clip.
- On the website only, opening someone else's profile is recorded, and opening a playlist is
  recorded. A visit to your own profile is not. Mobile does not send those two today.
- Raw rows are deleted after `STATS_TRACK_EVENT_RETENTION_DAYS` (default 30,
  `DEFAULT_STATS_TRACK_EVENT_RETENTION_DAYS`). Public lists can keep the counts after a row is
  gone. Those counts are numbers, not a list of listeners.
- Deleting the account deletes the id and the rows tied to it (`ON DELETE CASCADE` from
  `account` to `stats_track_account_guid`, then to the event tables).
- The company does not sell the rows and does not use them to advertise to the listener.

## Legal scope of plan 03

This is the notice a U.S. company needs for this feature. It is not a claim that a statute's
count threshold is met.

- **Federal and Illinois.** The notice has to match the product. Calling the rows anonymous
  while the company can link the id to the account is the gap. Illinois biometric and
  breach-notice statutes do not cover this listen record. Do not add those disclosures.
- **Indiana.** The Indiana Consumer Data Protection Act (Indiana Code 24-15) has been in effect
  since January 1, 2026. It applies when a business targets Indiana residents and, in a calendar
  year, processes personal data of at least 100,000 consumers, or of at least 25,000 consumers
  while getting more than half of its revenue from selling personal data. This repo cannot see
  that count. The terms still publish the notice a covered business owes: what is processed,
  why, how to ask for a copy or deletion, that the rows are not sold, and that they are not used
  for advertising. The company is organized in Illinois and expects to organize in Indiana.
  The terms follow the state in `LEGAL_ADDRESS` / `{legal_name}`. They do not name either state.

Counsel reviews the terms before a version bump. This set does not bump.
