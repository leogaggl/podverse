# Mobile membership status headline

The Membership screen tells a signed-in Trial member only "Upgrade to Premium". Premium already
gets a left-aligned card with the tier name and an expiry date. Trial does not.

This set adds one centered status block under the stack title for an active Trial or Premium
membership, and moves the Membership-screen Trial Limitations list into a bottom sheet opened
from a link under the Trial date.

## Locked choices

- **Premium** headline color is `tokens.text.accent` (the brand blue already used as text, same
  hex as the primary button fill). Do not use `tokens.text.link` or `tokens.button.primaryBg`.
- **Free Trial** headline color is `tokens.text.warning` (existing amber text). Do not use
  `tokens.button.warningBg`.
- The date uses `formatDateAbbrev` from `@podverse/helpers` and the label
  `settings.membership.expires_on` ("Expires On"). No new date formatter.
- The Trial link reads **Trial Limitations Only**, uses `tokens.text.link` with an underline,
  and is shown only for an active Trial membership.
- The Membership screen no longer renders `TrialLimitationsAccordion`.
- More › About keeps that accordion. Web is unchanged.
- The purchase button stays. This set does not change its label. Buy Membership vs Extend
  Membership is [mobile-stacked-form-actions](../mobile-stacked-form-actions/02-buy-and-extend-labels.md)
  prompt 02. Do not run that prompt in parallel with this set. Both edit `MoreMembershipScreen`
  and `membership-gate.yaml`. Run the label prompt first.

## Files

| Path | Role |
| ---- | ---- |
| `00-SUMMARY.md` | Scope and locked choices |
| `00-EXECUTION-ORDER.md` | One sequential step |
| `01-status-headline-and-trial-sheet.md` | Implementation |
| `COPY-PASTA.md` | Paste prompt |

One prompt. Nothing in this set runs in parallel.
