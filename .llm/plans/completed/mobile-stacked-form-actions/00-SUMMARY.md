# Mobile stacked form actions

A Trial member who adds a Podcast Index feed from Search gets the premium gate
(`ConfirmDialog` in `MembershipGateProvider`). Its two buttons sit side by side, so a long
label wraps and the row changes height. The body is 15pt, and the gap from that body to the
buttons is `spacing.md` (8). The confirm label is Renew Membership. A Trial has not bought a
membership, so that label is the wrong action.

`FormActions` already has a column mode. It is opt-in (`stacked`), and the default is a row.
`mobile-screen-layout` tells agents to build that row. This set makes the column the only
layout for form-style decisions, gives the dialog paragraph the next regular type step, and
uses the gap helpers that already exist.

## Locked choices

- Do not add a component. `FormActions` is the shared decision block. Delete its row layout
  and the `stacked` prop. Two or more actions are a column of full-width `size="form"`
  buttons. One action stays one full-width button.
- Array order is top to bottom. Do not reorder page or sheet callers.
- `ConfirmDialog` builds `[confirm, cancel]`, so the confirm action is on top and cancel is
  under it. That is the order it already uses when `stacked` is true. Drop the prop.
- Button gap inside `FormActions` is `formActionsGap` (`spacing.lg`, 16). The seam from the
  paragraph or fields to that block is `formActionsTopGap` (`spacing.xl`, 20). No new spacing
  numbers.
- Dialog body uses `typography.prose` (17 / 400 / 24). That is one regular step above
  `typography.body` (15). Do not use `subheading` (16 and semibold). Title stays 18 / 700:
  `typography.heading` plus `fontWeight: '700'`. Body color stays secondary.
- Do not change `typography.ts` or the spacing scale.
- Web and management-web keep right-aligned `Modal.Actions` / `FormPrimaryActions`. Phone
  width is why mobile stacks. Do not edit those in the layout step.
- Purchase actions, in phase 2 only: **Buy Membership** when the account is not Premium
  (Trial, expired Trial, or signed in with no tier). **Extend Membership** when the tier is
  Premium, including a Premium membership that has expired. Signed out stays **Sign Up**,
  except the account-required gate, which stays **Login**. The label follows `tier` on
  `deriveMembershipState`. It does not follow `isExpired`, and it does not follow the 403
  reason. Phase 1 does not change these strings.

## Separate plans

[mobile-search-result-preview-spacing](../../active/mobile-search-result-preview-spacing.md) restyles the
feed preview above the Add button. Do not edit `PodcastIndexFeedPreviewScreen` or `HelperNote`
in this set. Both this set and that plan edit `.cursor/rules/mobile-screen-layout.mdc`, in
different sections. Do not run them in parallel.

[popularity-tracking-how-it-works](../../active/popularity-tracking-how-it-works/00-SUMMARY.md) owns the
explanation and the terms notice. The gap under the Yes / No buttons lives in prompt 01 of
this set, because it is the same `AgreementChoices` and `mobile-screen-layout` edit. Do not
run that set's old layout prompt.

[mobile-membership-status-headline](../mobile-membership-status-headline/00-SUMMARY.md) owns
the Membership screen status block. It does not own the purchase-button label. Do not run
prompt 02 of this set in parallel with that plan. Both edit `MoreMembershipScreen` and
`membership-gate.yaml`. Run prompt 02 first.

## Files

| Path                                                                                 | Role                     |
| ------------------------------------------------------------------------------------ | ------------------------ |
| `00-SUMMARY.md`                                                                      | Scope and locked choices |
| `00-EXECUTION-ORDER.md`                                                              | Two sequential steps     |
| [`01-stack-decisions-and-dialog-type.md`](01-stack-decisions-and-dialog-type.md)     | Button layout            |
| `02-buy-and-extend-labels.md`                                                        | Purchase action labels   |
| `COPY-PASTA.md`                                                                      | Paste prompts            |

Two prompts, in order. Nothing in this set runs in parallel.
