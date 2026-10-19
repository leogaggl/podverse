# Execution order — alpha Apple sandbox billing

Summary: [00-SUMMARY.md](./00-SUMMARY.md). Prompts: [COPY-PASTA.md](./COPY-PASTA.md).

## Order

| # | File | Who | Depends on |
| - | ---- | --- | ---------- |
| 01 | [01-app-store-connect.md](./01-app-store-connect.md) | Operator in App Store Connect | — |
| 02 | [02-alpha-mapping-and-allowlist.md](./02-alpha-mapping-and-allowlist.md) | Agent edits env; operator maps products, pushes, restarts | 01 (product ids exist) |
| 03 | [03-ios-store-billing-build.md](./03-ios-store-billing-build.md) | Operator: EAS env, build, submit | — (can run beside 01–02) |
| 04 | [04-device-purchase-check.md](./04-device-purchase-check.md) | Operator on the iPhone; agent reads logs | 01, 02, 03 |

03 does not depend on 01 or 02, but its build takes the longest, so start it early.

## Rules for the executing agent

1. Every `kubectl` command uses `--context al -n podverse-alpha`. The DigitalOcean context has a
   namespace with the same name. Never omit `--context al`.
2. Do not run `git commit`, `git push`, or any `gh` write. Give the operator fish-safe commands
   (no heredocs, single-quoted commit messages).
3. Do not run `eas build`, `eas submit`, or the `make mobile_eas_*` targets. Give them to the
   operator, labeled **Mobile**.
4. Do not print secrets. Account `id_text` values are identifiers and may be shown.
5. Do not edit the old Podverse app, its bundle id, or its App Store listing.
6. Do not add `expo-updates` or an `updates` config.
7. Do not run tests, lint, or type-check.
8. When a milestone is done, tick it in COPY-PASTA.md and move that file to
   `.llm/plans/completed/alpha-apple-sandbox-billing/`. Archive the whole directory after 04.

## Stop rules

- The App Store Connect app record for `com.podverse.app.next` is not the one with Apple ID
  `6823398032`.
- The Paid Apps Agreement is not active (01 step 1). In-app purchases do not load without it.
- A product id in App Store Connect differs from the two in 00-SUMMARY. Report it; do not rename
  the mapping to match a typo.
- `BILLING_SANDBOX_GRANT_ALL` is set on a live server. It belongs on alpha only.
